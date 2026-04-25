/**
 * Xtream HLS Shared Proxy v3 — Multi-account, Multi-channel, multi-user
 *
 * Each channel has its own IPTV account credentials from DB.
 * Multiple users share the same cached manifest/segments per channel.
 *
 * - Manifests: bounded parallel (Semaphore) — different channels fetch simultaneously
 * - Segments:  parallel via Semaphore — segments go to CDN, not IPTV
 * - Cache:     manifest 8s, segment 60s — fetch once, serve ALL users
 * - Coalesce:  if fetch already in-flight, other requests wait for same result
 * - Stale:     on upstream error, serve last good manifest (up to 90s old)
 * - Proactive: refresh manifest for active channels BEFORE cache expires
 * - Cleanup:   expired caches + idle sessions auto-cleaned every 15s
 */

const { XTREAM } = require('./xtream');

// ─── Constants ──────────────────────────────────────────────
const UA               = 'VLC/3.0.20 LibVLC/3.0.20';
const MANIFEST_TIMEOUT = 8000;   // 8s
const SEGMENT_TIMEOUT  = 15000;  // 15s
const MANIFEST_TTL     = 6000;   // 6s
const MANIFEST_STALE   = 120000; // 120s
const COOLDOWN_403     = 10000;  // reduced to 10s so we retry sooner
const COOLDOWN_ERR     = 4000;   // 4s cooldown for general errors
const PROACTIVE_MS     = 2000;
const SEG_TTL          = 120000; // 120s
const SESSION_TTL      = 30000;  // 30s
const GC_INTERVAL      = 15000;
const MAX_SEG_CACHE    = 1000;   // Increased for better caching
const MAX_SEG_BYTES    = 1024 * 1024 * 1024; // 1GB cache
const MAX_MANIFEST_PARALLEL = 200; 
const MAX_SEG_PARALLEL = 500;
const MAX_PROACTIVE_PER_CYCLE = 50;

// ─── Semaphore: bounded parallel execution ──────────────────
class Semaphore {
  constructor(max) { this._max = max; this._active = 0; this._queue = []; }
  async acquire() {
    if (this._active < this._max) { this._active++; return; }
    await new Promise(r => this._queue.push(r));
  }
  release() {
    this._active--;
    if (this._queue.length > 0 && this._active < this._max) {
      this._active++;
      this._queue.shift()();
    }
  }
  async run(fn) {
    await this.acquire();
    try { return await fn(); } finally { this.release(); }
  }
  get active() { return this._active; }
  get pending() { return this._queue.length; }
}

const manifestSemaphore = new Semaphore(MAX_MANIFEST_PARALLEL);
const segSemaphore      = new Semaphore(MAX_SEG_PARALLEL);
let _totalSegBytes = 0; // track total segment cache memory usage

// ═════════════════════════════════════════════════════════════
class XtreamProxy {
  constructor() {
    // Manifest cache: streamId → { content, srv, ts, rewritten, user, pass }
    this._manifests = new Map();
    // Manifest in-flight: streamId → Promise (coalescing)
    this._pendingManifests = new Map();
    // Segment cache: url → { buf, contentType, ts }
    this._segments = new Map();
    // Segment in-flight: url → Promise (coalescing)
    this._pendingSegments = new Map();
    // Viewer sessions: streamId → Map<sessionId, lastSeen>
    this.sessions = new Map();
    // Channel credentials cache: streamId → { user, pass, baseUrl }
    this._channelCreds = new Map();
    this._gcTimer = null;
    // DB reference — set via setDB()
    this._db = null;
  }

  setDB(db) { this._db = db; }

  start() {
    this._gcTimer = setInterval(() => this._gc(), GC_INTERVAL);
    this._proactiveTimer = setInterval(() => this._proactiveRefresh(), MANIFEST_TTL - PROACTIVE_MS);
    console.log(`[XtreamProxy] v6 Multi-Account Ready — manifest(${MAX_MANIFEST_PARALLEL}), seg(${MAX_SEG_PARALLEL}), TTL ${MANIFEST_TTL/1000}s, stale ${MANIFEST_STALE/1000}s, proactive(${MAX_PROACTIVE_PER_CYCLE})`);
  }

  stop() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    if (this._proactiveTimer) clearInterval(this._proactiveTimer);
    this._manifests.clear();
    this._segments.clear();
    this.sessions.clear();
  }

  // ═══════════ Credential Resolution ═══════════════════════════

  /**
   * Resolve credentials for a channel — from cache, params, or DB lookup
   */
  async _resolveCredentials(streamId, baseUrl) {
    // Check in-memory cache first
    const cached = this._channelCreds.get(streamId);
    if (cached) return cached;

    // Try DB lookup
    if (this._db) {
      try {
        const row = await this._db.prepare(
          'SELECT c.stream_id, c.base_url, c.account_id, a.server_url, a.username, a.password FROM xtream_channels c LEFT JOIN iptv_accounts a ON c.account_id = a.id WHERE c.stream_id = ? OR c.id = ?'
        ).get(Number(streamId) || 0, String(streamId));
        if (row && row.username) {
          const creds = { user: row.username, pass: row.password, baseUrl: row.server_url || row.base_url || baseUrl };
          this._channelCreds.set(streamId, creds);
          return creds;
        }
      } catch (e) {
        // DB error — fall through to legacy
      }
    }

    // Fallback to legacy XTREAM global (for channels not yet migrated)
    if (XTREAM.user && XTREAM.pass) {
      return { user: XTREAM.user, pass: XTREAM.pass, baseUrl: baseUrl || XTREAM.primary };
    }
    return null;
  }

  /**
   * Set credentials for a channel explicitly (called from route when account info is known)
   */
  setChannelCredentials(streamId, user, pass, baseUrl) {
    this._channelCreds.set(String(streamId), { user, pass, baseUrl });
  }

  // ═══════════ Public API (called from Express routes) ═══════════

  /**
   * GET manifest — cached 8s, coalesced per-channel, stale fallback on error
   * Each channel uses its own IPTV account credentials
   */
  async getManifest(streamId, baseUrl, sessionId) {
    this._touch(streamId, sessionId);
    const now = Date.now();

    // Helper: return last known-good manifest if still within stale window
    const serveStale = (c) => {
      if (c && c.lastGoodRewritten && now - c.lastGoodTs < MANIFEST_STALE) {
        return c.lastGoodRewritten;
      }
      return null;
    };

    // 1. Fresh cache → return immediately (all users share this)
    const cached = this._manifests.get(streamId);
    if (cached && !cached.failed && now - cached.ts < MANIFEST_TTL) {
      return cached.rewritten;
    }

    // 1b. Stale-while-revalidate: expired but has good stale → serve instantly + refresh in background
    // This makes channel switching instant (0ms wait) instead of blocking on IPTV fetch
    if (cached && !cached.failed && cached.lastGoodRewritten && now - cached.lastGoodTs < MANIFEST_STALE) {
      if (!this._pendingManifests.has(streamId)) {
        const bgUrl = cached.baseUrl || baseUrl;
        const p = this._fetchManifest(streamId, bgUrl)
          .then(result => {
            const rewritten = this._rewriteManifest(result.content, streamId, result.srv, result.user, result.pass);
            const ts = Date.now();
            this._manifests.set(streamId, { content: result.content, srv: result.srv, baseUrl: bgUrl, ts, rewritten, lastGoodTs: ts, lastGoodRewritten: rewritten, user: result.user, pass: result.pass });
          })
          .catch(() => {})
          .finally(() => this._pendingManifests.delete(streamId));
        this._pendingManifests.set(streamId, p);
      }
      return cached.lastGoodRewritten; // instant response, fresh data arrives on next poll
    }

    // Cooldown after failure — longer for 403 (rate-limit) vs generic errors
    if (cached && cached.failed) {
      const cooldown = cached.is403 ? COOLDOWN_403 : COOLDOWN_ERR;
      if (now - cached.ts < cooldown) {
        const stale = serveStale(cached);
        if (stale) {
          console.warn(`[XtreamProxy] Serving stale manifest for ${streamId} during cooldown.`);
          return stale;  // serve last known-good during cooldown
        }
        throw new Error('IPTV temporarily unavailable (cooldown)');
      }
    }

    // 2. Already fetching this channel → wait for result (per-channel coalescing)
    if (this._pendingManifests.has(streamId)) {
      try { await this._pendingManifests.get(streamId); } catch {}
      const c = this._manifests.get(streamId);
      if (c && !c.failed) return c.rewritten;
      // Thundering herd fix: after coalesced failure, check cooldown before retrying
      if (c && c.failed) {
        const cooldown = c.is403 ? COOLDOWN_403 : COOLDOWN_ERR;
        if (Date.now() - c.ts < cooldown) {
          const stale = serveStale(c);
          if (stale) {
            console.warn(`[XtreamProxy] Manifest coalesced error for ${streamId}, serving stale fallback.`);
            return stale;
          }
          throw new Error('IPTV temporarily unavailable (cooldown)');
        }
      }
      const stale = serveStale(c || cached);
      if (stale) return stale;
    }

    // 3. Fetch from IPTV (serialized via semaphore — MAX_MANIFEST_PARALLEL=1)
    const p = this._fetchManifest(streamId, baseUrl)
      .finally(() => this._pendingManifests.delete(streamId));
    this._pendingManifests.set(streamId, p);

    try {
      const result = await p;
      const rewritten = this._rewriteManifest(result.content, streamId, result.srv, result.user, result.pass);
      const ts = Date.now();
      
      // Update cache
      this._manifests.set(streamId, {
        content: result.content, srv: result.srv, baseUrl,
        ts, rewritten, user: result.user, pass: result.pass,
        // Preserve last-good for stale fallback
        lastGoodTs: ts, lastGoodRewritten: rewritten,
      });
      return rewritten;
    } catch (err) {
      // Determine if this is a 403 (rate-limit / subscription limit)
      const is403 = err.message?.includes('403') || err.message?.includes('429');
      // Re-read current cache — a concurrent proactive refresh may have succeeded while we awaited
      const current = this._manifests.get(streamId);
      const prevLastGoodTs = current?.lastGoodTs || cached?.lastGoodTs || 0;
      const prevLastGoodRewritten = current?.lastGoodRewritten || cached?.lastGoodRewritten || null;
      
      this._manifests.set(streamId, {
        ts: Date.now(), failed: true, is403,
        lastGoodTs: prevLastGoodTs,
        lastGoodRewritten: prevLastGoodRewritten,
      });
      
      // Serve stale if available (handles 403 gracefully for active viewers)
      const stale = serveStale(this._manifests.get(streamId));
      if (stale) {
        console.warn(`[XtreamProxy] Manifest error for ${streamId}, serving stale fallback. Error: ${err.message}`);
        return stale;
      }
      throw err;
    }
  }

  /**
   * GET segment — cached 60s, coalesced
   * Parallel downloads via Semaphore (up to 10 concurrent — segments go to CDN)
   */
  async getSegment(streamId, encodedPath, baseUrl, sessionId) {
    this._touch(streamId, sessionId);

    let decoded;
    try { decoded = decodeURIComponent(encodedPath); } catch { decoded = encodedPath; }

    // Resolve per-channel credentials for segment URL building
    const creds = await this._resolveCredentials(streamId, baseUrl);
    const segUser = creds?.user || '';
    const segPass = creds?.pass || '';

    // Build candidate URLs
    let candidates;
    if (decoded.startsWith('http')) {
      candidates = [decoded];
    } else if (decoded.startsWith('/')) {
      candidates = [`${baseUrl}${decoded}`];
    } else {
      candidates = (segUser && segPass)
        ? [`${baseUrl}/live/${segUser}/${segPass}/${decoded}`]
        : [`${baseUrl}/${decoded}`];
    }

    const cacheKey = candidates[0];

    // 1. Cache hit → instant response (all users share this)
    const cached = this._segments.get(cacheKey);
    if (cached && Date.now() - cached.ts < SEG_TTL) {
      return { buf: cached.buf, contentType: cached.contentType };
    }

    // 2. Already fetching → coalesce (wait for same download)
    if (this._pendingSegments.has(cacheKey)) {
      return this._pendingSegments.get(cacheKey);
    }

    // 3. Fetch via Semaphore
    const p = this._fetchSegment(candidates, cacheKey)
      .catch(err => {
        // Segment failed → force manifest re-fetch on next request BUT preserve lastGoodRewritten
        const entry = this._manifests.get(streamId);
        if (entry) {
          this._manifests.set(streamId, { ...entry, ts: 0 }); // expire ts → forces re-fetch, keeps lastGood
        }
        console.warn(`[XtreamProxy] Segment error for ${cacheKey}. Error: ${err.message}`);
        throw err;
      })
      .finally(() => this._pendingSegments.delete(cacheKey));
    this._pendingSegments.set(cacheKey, p);
    return p;
  }

  /**
   * GET sub-manifest (quality variant playlists)
   * Parallel via manifest semaphore (not blocking other channels)
   */
  async getSubManifest(streamId, encodedUrl, sessionId) {
    this._touch(streamId, sessionId);

    let subUrl;
    try { subUrl = decodeURIComponent(encodedUrl); } catch { subUrl = encodedUrl; }

    // Check cache
    const cacheKey = `sub:${subUrl}`;
    const cached = this._segments.get(cacheKey);
    if (cached && Date.now() - cached.ts < MANIFEST_TTL) {
      return cached.rewritten;
    }

    // Coalesce
    if (this._pendingSegments.has(cacheKey)) {
      const result = await this._pendingSegments.get(cacheKey);
      return result.rewritten || result;
    }

    const p = manifestSemaphore.run(async () => {
      // Re-check cache after waiting for semaphore
      const c = this._segments.get(cacheKey);
      if (c && Date.now() - c.ts < MANIFEST_TTL) return { rewritten: c.rewritten };

      const res = await fetch(subUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(MANIFEST_TIMEOUT),
      });
      if (!res.ok) throw new Error(`Sub-manifest HTTP ${res.status}`);
      const content = await res.text();
      const base = subUrl.substring(0, subUrl.lastIndexOf('/') + 1);
      const rewritten = this._rewriteSubManifest(content, streamId, base);
      this._segments.set(cacheKey, { rewritten, ts: Date.now() });
      return { rewritten };
    }).finally(() => this._pendingSegments.delete(cacheKey));
    this._pendingSegments.set(cacheKey, p);

    const result = await p;
    return result.rewritten;
  }

  // ─── Viewer stats ─────────────────────────────────────────
  getViewerCount(streamId) {
    const m = this.sessions.get(streamId);
    if (!m) return 0;
    const now = Date.now();
    let n = 0;
    for (const t of m.values()) if (now - t < SESSION_TTL) n++;
    return n;
  }
  getAllViewers() {
    const out = {};
    for (const [id] of this.sessions) { const n = this.getViewerCount(id); if (n > 0) out[id] = n; }
    return out;
  }
  getTotalViewers() {
    return Object.values(this.getAllViewers()).reduce((a, b) => a + b, 0);
  }

  // ═══════════ Upstream fetchers ═════════════════════════════

  /** Manifest: parallel via Semaphore — uses per-channel credentials */
  async _fetchManifest(streamId, preferredBase) {
    return manifestSemaphore.run(async () => {
      // Re-check cache after waiting for semaphore (another channel may have delayed us)
      const cached = this._manifests.get(streamId);
      if (cached && !cached.failed && Date.now() - cached.ts < MANIFEST_TTL) {
        return { content: cached.content, srv: cached.srv };
      }

      // Resolve per-channel credentials
      const creds = await this._resolveCredentials(streamId, preferredBase);
      if (!creds || !creds.user || !creds.pass) {
        throw new Error('No IPTV credentials for channel ' + streamId);
      }
      const { user, pass, baseUrl: credBase } = creds;
      const srv = credBase || preferredBase;

      const url = `${srv}/live/${user}/${pass}/${streamId}.m3u8`;
      let lastErr = null;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, 'Referer': `${srv}/` },
          signal: AbortSignal.timeout(MANIFEST_TIMEOUT),
        });
        if (!res.ok) { throw new Error(`HTTP ${res.status} from ${srv}`); }
        const content = await res.text();
        // Capture actual server after 302 redirect (IPTV session token)
        let actualBase = srv;
        try { if (res.url) actualBase = new URL(res.url).origin; } catch {}
        return { content, srv: actualBase, user, pass };
      } catch (e) { lastErr = e; }

      throw lastErr || new Error('IPTV server unreachable');
    });
  }

  /** Segment: parallel via Semaphore (segments go to redirect server, not main IPTV) */
  async _fetchSegment(candidates, cacheKey) {
    return segSemaphore.run(async () => {
      // Re-check cache (might have been filled while waiting for semaphore)
      const cached = this._segments.get(cacheKey);
      if (cached && Date.now() - cached.ts < SEG_TTL) {
        return { buf: cached.buf, contentType: cached.contentType };
      }

      // Try each candidate, with up to 3 retries on timeout/transient errors
      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        for (const segUrl of candidates) {
          try {
            const timeout = attempt === 0 ? SEGMENT_TIMEOUT : SEGMENT_TIMEOUT + (attempt * 5000);
            const res = await fetch(segUrl, {
              headers: { 'User-Agent': UA, 'Connection': 'keep-alive' },
              signal: AbortSignal.timeout(timeout),
            });
            if (!res.ok) { 
              lastErr = new Error(`Segment HTTP ${res.status}`); 
              // Do not retry on hard errors like 403 or 401 or 404 (if 404, maybe retry later, but for now break inner)
              if (res.status === 403 || res.status === 401) break; 
              continue; 
            }
            const buf = Buffer.from(await res.arrayBuffer());
            const contentType = res.headers.get('content-type') || 'video/mp2t';
            // Cache for all users
            this._evictSegments();
            _totalSegBytes += buf.length;
            this._segments.set(cacheKey, { buf, contentType, ts: Date.now() });
            return { buf, contentType };
          } catch (e) { lastErr = e; }
        }
        // Only retry on timeout or network errors
        if (lastErr && !lastErr.message?.includes('timeout') && !lastErr.message?.includes('fetch failed')) break;
        // Small delay before retry
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
      throw lastErr || new Error('Segment unavailable');
    });
  }

  // ─── URL rewriting and Prefetching ───────────────────────────
  _prefetchSegments(streamId, newSegments) {
    // Only prefetch if there are active viewers to save bandwidth and connection limits
    if (this.getViewerCount(streamId) === 0) return;

    for (const segUrl of newSegments) {
      const cacheKey = segUrl;
      // Skip if already in cache or currently downloading
      if (this._segments.has(cacheKey) || this._pendingSegments.has(cacheKey)) {
        continue;
      }

      // Initiate background download
      const p = this._fetchSegment([segUrl], cacheKey)
        .catch(err => {
          // Silent catch for prefetch: errors will be handled if user explicitly requests it
        })
        .finally(() => this._pendingSegments.delete(cacheKey));
      
      this._pendingSegments.set(cacheKey, p);
    }
  }

  _rewriteManifest(content, streamId, baseUrl, user, pass) {
    const lines = content.split('\n');
    const rewritten = [];
    const newSegments = [];

    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) {
        rewritten.push(line);
        continue;
      }
      let abs;
      if (t.startsWith('http'))     abs = t;
      else if (t.startsWith('/'))   abs = `${baseUrl}${t}`;
      else                          abs = (user && pass) ? `${baseUrl}/live/${user}/${pass}/${t}` : `${baseUrl}/${t}`;
      const enc = encodeURIComponent(abs);
      
      if (t.endsWith('.m3u8') || t.includes('.m3u8?')) {
        rewritten.push(`/proxy/live/${streamId}/sub/${enc}`);
      } else {
        rewritten.push(`/proxy/live/${streamId}/seg/${enc}`);
        newSegments.push(abs);
      }
    }

    // Trigger prefetch asynchronously to avoid blocking manifest processing
    if (newSegments.length > 0) {
      setTimeout(() => this._prefetchSegments(streamId, newSegments), 0);
    }

    return rewritten.join('\n');
  }

  _rewriteSubManifest(content, streamId, baseUrl) {
    const lines = content.split('\n');
    const rewritten = [];
    const newSegments = [];

    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) {
        rewritten.push(line);
        continue;
      }
      const abs = t.startsWith('http') ? t : `${baseUrl}${t}`;
      rewritten.push(`/proxy/live/${streamId}/seg/${encodeURIComponent(abs)}`);
      newSegments.push(abs);
    }

    if (newSegments.length > 0) {
      setTimeout(() => this._prefetchSegments(streamId, newSegments), 0);
    }

    return rewritten.join('\n');
  }

  // ─── Session tracking + cleanup ───────────────────────────
  _touch(streamId, sessionId) {
    if (!this.sessions.has(streamId)) this.sessions.set(streamId, new Map());
    this.sessions.get(streamId).set(sessionId, Date.now());
  }

  _evictSegments() {
    // Evict by count
    while (this._segments.size >= MAX_SEG_CACHE) {
      const oldest = this._segments.keys().next().value;
      const entry = this._segments.get(oldest);
      if (entry && entry.buf) _totalSegBytes -= entry.buf.length;
      this._segments.delete(oldest);
    }
    // Evict by total memory (hard limit)
    while (_totalSegBytes > MAX_SEG_BYTES && this._segments.size > 0) {
      const oldest = this._segments.keys().next().value;
      const entry = this._segments.get(oldest);
      if (entry && entry.buf) _totalSegBytes -= entry.buf.length;
      this._segments.delete(oldest);
    }
  }

  _gc() {
    const now = Date.now();

    // Expire old manifests
    // For failed entries, keep alive as long as lastGoodRewritten is still within MANIFEST_STALE
    // (we're still serving stale to users, don't evict early)
    for (const [id, m] of this._manifests) {
      const lastRelevant = m.failed ? Math.max(m.ts, m.lastGoodTs || 0) : m.ts;
      if (now - lastRelevant > MANIFEST_STALE) this._manifests.delete(id);
    }

    // Expire old segments
    for (const [k, v] of this._segments) {
      if (now - v.ts > SEG_TTL * 2) {
        if (v.buf) _totalSegBytes -= v.buf.length;
        this._segments.delete(k);
      }
    }

    // Expire viewer sessions
    for (const [id, map] of this.sessions) {
      for (const [sid, t] of map) { if (now - t > SESSION_TTL) map.delete(sid); }
      if (map.size === 0) this.sessions.delete(id);
    }

    // Stats
    const viewers = this.getTotalViewers();
    const channels = this._manifests.size;
    const segs = this._segments.size;
    const segMB = (_totalSegBytes / 1024 / 1024).toFixed(1);
    const heapMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
    if (viewers > 0 || channels > 0) {
      console.log(`[XtreamProxy] Viewers: ${viewers} | Ch: ${channels} | Segs: ${segs}(${segMB}MB) | Heap: ${heapMB}MB | ManifestDL: ${manifestSemaphore.active}/${MAX_MANIFEST_PARALLEL}(q:${manifestSemaphore.pending}) | SegDL: ${segSemaphore.active}/${MAX_SEG_PARALLEL}`);
    }
  }

  // ─── Proactive manifest refresh ─────────────────────────
  // Refreshes manifests for active channels BEFORE cache expires.
  // KEY FIX: Limited to MAX_PROACTIVE_PER_CYCLE channels per cycle,
  // prioritized by viewer count — prevents flooding IPTV with burst requests.
  _proactiveRefresh() {
    const now = Date.now();
    // Collect candidates needing refresh
    const candidates = [];
    for (const [streamId, m] of this._manifests) {
      if (m.failed) continue;
      if (now - m.ts < MANIFEST_TTL - PROACTIVE_MS) continue; // still fresh
      if (this._pendingManifests.has(streamId)) continue;      // already fetching
      const viewers = this.getViewerCount(streamId);
      if (viewers === 0) continue;
      candidates.push({ streamId, viewers, m });
    }
    if (candidates.length === 0) return;
    // Sort by viewer count descending — refresh most-watched first
    candidates.sort((a, b) => b.viewers - a.viewers);
    // Only refresh up to MAX_PROACTIVE_PER_CYCLE per cycle
    // (remaining channels will be picked up next cycle or on-demand)
    for (const { streamId, m } of candidates.slice(0, MAX_PROACTIVE_PER_CYCLE)) {
      const baseUrl = m.baseUrl || '';
      const p = this._fetchManifest(streamId, baseUrl)
        .then(result => {
          const rewritten = this._rewriteManifest(result.content, streamId, result.srv, result.user, result.pass);
          const ts = Date.now();
          this._manifests.set(streamId, {
            content: result.content, srv: result.srv,
            baseUrl, ts, rewritten, user: result.user, pass: result.pass,
            lastGoodTs: ts, lastGoodRewritten: rewritten, // CRITICAL: must survive future 403s
          });
        })
        .catch(() => { /* silent — stale cache or on-demand retry will cover it */ })
        .finally(() => this._pendingManifests.delete(streamId));
      this._pendingManifests.set(streamId, p);
    }
  }
}

module.exports = new XtreamProxy();
