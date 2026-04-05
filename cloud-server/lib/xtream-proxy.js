/**
 * Xtream HLS Shared Proxy v2 — Multi-channel, multi-user, fast startup
 *
 * Problem: IPTV provider allows limited concurrent connections per subscription.
 *          Multiple users → multiple upstream fetches → IPTV kicks everyone.
 *
 * Solution v2 (rewritten for speed + concurrency):
 * - Manifests: bounded parallel (Semaphore, up to 3 concurrent) — different
 *   channels fetch simultaneously, same channel coalesced (1 in-flight)
 * - Segments:  parallel (up to 10 via Semaphore) — segments go to CDN, not IPTV
 * - Cache:     manifest 8s, segment 60s — fetch once, serve ALL users
 * - Coalesce:  if fetch already in-flight, other requests wait for same result
 * - Stale:     on upstream error, serve last good manifest (up to 30s old)
 * - Proactive: refresh manifest for active channels BEFORE cache expires
 * - Cleanup:   expired caches + idle sessions auto-cleaned every 15s
 */

const { XTREAM } = require('./xtream');

// ─── Constants ──────────────────────────────────────────────
const UA               = 'VLC/3.0.20 LibVLC/3.0.20';
const MANIFEST_TIMEOUT = 6000;   // 6s   — manifest fetch timeout (fail fast)
const SEGMENT_TIMEOUT  = 10000;  // 10s  — segment fetch timeout
const MANIFEST_TTL     = 8000;   // 8s   — manifest cache (less frequent = fewer 403s)
const MANIFEST_STALE   = 90000;  // 90s  — serve stale manifest on error (long enough to outlast 403 periods)
const COOLDOWN_403     = 30000;  // 30s  — longer cooldown specifically for 403/rate-limit errors
const PROACTIVE_MS     = 2000;   // 2s   — refresh manifest 2s before TTL expires
const SEG_TTL          = 60000;  // 60s  — segment cache
const SESSION_TTL      = 20000;  // 20s  — viewer idle timeout (shorter = accurate count on channel switch)
const GC_INTERVAL      = 15000;  // 15s  — cleanup cycle
const MAX_SEG_CACHE    = 300;    // max cached segments (~300MB worst case, prevent OOM)
const MAX_SEG_BYTES    = 400 * 1024 * 1024; // 400MB hard limit for segment cache
const MAX_MANIFEST_PARALLEL = 1; // MUST be 1: IPTV subscription allows ~1 concurrent connection
const MAX_SEG_PARALLEL = 8;      // parallel segment downloads (CDN-bound, keep reasonable)
const MAX_PROACTIVE_PER_CYCLE = 3; // max channels refreshed per proactive cycle (prevents burst)

const SERVERS = [XTREAM.primary, ...(XTREAM.backup !== XTREAM.primary ? [XTREAM.backup] : [])];

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
    // Manifest cache: streamId → { content, srv, ts, rewritten }
    this._manifests = new Map();
    // Manifest in-flight: streamId → Promise (coalescing)
    this._pendingManifests = new Map();
    // Segment cache: url → { buf, contentType, ts }
    this._segments = new Map();
    // Segment in-flight: url → Promise (coalescing)
    this._pendingSegments = new Map();
    // Viewer sessions: streamId → Map<sessionId, lastSeen>
    this.sessions = new Map();
    this._gcTimer = null;
  }

  start() {
    this._gcTimer = setInterval(() => this._gc(), GC_INTERVAL);
    this._proactiveTimer = setInterval(() => this._proactiveRefresh(), MANIFEST_TTL - PROACTIVE_MS);
    console.log(`[XtreamProxy] v4 Ready — serialized(${MAX_MANIFEST_PARALLEL}), seg parallel(${MAX_SEG_PARALLEL}), TTL ${MANIFEST_TTL/1000}s, stale ${MANIFEST_STALE/1000}s, 403-cooldown ${COOLDOWN_403/1000}s, proactive batch(${MAX_PROACTIVE_PER_CYCLE})`);
  }

  stop() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    if (this._proactiveTimer) clearInterval(this._proactiveTimer);
    this._manifests.clear();
    this._segments.clear();
    this.sessions.clear();
  }

  // ═══════════ Public API (called from Express routes) ═══════════

  /**
   * GET manifest — cached 8s, coalesced per-channel, stale fallback on error
   * Parallel via Semaphore (up to 3 concurrent for different channels)
   * Same-channel requests are coalesced (only 1 in-flight per channel)
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
            const rewritten = this._rewriteManifest(result.content, streamId, result.srv);
            const ts = Date.now();
            this._manifests.set(streamId, { content: result.content, srv: result.srv, baseUrl: bgUrl, ts, rewritten, lastGoodTs: ts, lastGoodRewritten: rewritten });
          })
          .catch(() => {})
          .finally(() => this._pendingManifests.delete(streamId));
        this._pendingManifests.set(streamId, p);
      }
      return cached.lastGoodRewritten; // instant response, fresh data arrives on next poll
    }

    // Cooldown after failure — longer for 403 (rate-limit) vs generic errors
    if (cached && cached.failed) {
      const cooldown = cached.is403 ? COOLDOWN_403 : MANIFEST_TTL;
      if (now - cached.ts < cooldown) {
        const stale = serveStale(cached);
        if (stale) return stale;  // serve last known-good during cooldown
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
        const cooldown = c.is403 ? COOLDOWN_403 : MANIFEST_TTL;
        if (Date.now() - c.ts < cooldown) {
          const stale = serveStale(c);
          if (stale) return stale;
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
      const rewritten = this._rewriteManifest(result.content, streamId, result.srv);
      const ts = Date.now();
      this._manifests.set(streamId, {
        content: result.content, srv: result.srv, baseUrl,
        ts, rewritten,
        // Preserve last-good for stale fallback
        lastGoodTs: ts, lastGoodRewritten: rewritten,
      });
      return rewritten;
    } catch (err) {
      // Determine if this is a 403 (rate-limit / subscription limit)
      const is403 = err.message?.includes('403');
      // Preserve lastGood from previous cache so stale serving survives repeated failures
      const prevLastGoodTs = cached?.lastGoodTs || 0;
      const prevLastGoodRewritten = cached?.lastGoodRewritten || null;
      this._manifests.set(streamId, {
        ts: Date.now(), failed: true, is403,
        lastGoodTs: prevLastGoodTs,
        lastGoodRewritten: prevLastGoodRewritten,
      });
      // Serve stale if available (handles 403 gracefully for active viewers)
      const stale = serveStale(this._manifests.get(streamId));
      if (stale) return stale;
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

    // Build candidate URLs
    let candidates;
    if (decoded.startsWith('http')) {
      candidates = [decoded];
    } else if (decoded.startsWith('/')) {
      candidates = [`${baseUrl}${decoded}`, ...SERVERS.filter(s => s !== baseUrl).map(s => `${s}${decoded}`)];
    } else {
      candidates = [
        `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`,
        ...SERVERS.filter(s => s !== baseUrl).map(s => `${s}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`),
      ];
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
        // (previously used delete() which wiped lastGoodRewritten, causing stale serving to fail)
        const entry = this._manifests.get(streamId);
        if (entry) {
          this._manifests.set(streamId, { ...entry, ts: 0 }); // expire ts → forces re-fetch, keeps lastGood
        }
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

  /** Manifest: parallel via Semaphore (up to 3 concurrent for different channels) */
  async _fetchManifest(streamId, preferredBase) {
    return manifestSemaphore.run(async () => {
      // Re-check cache after waiting for semaphore (another channel may have delayed us)
      const cached = this._manifests.get(streamId);
      if (cached && !cached.failed && Date.now() - cached.ts < MANIFEST_TTL) {
        return { content: cached.content, srv: cached.srv };
      }

      const servers = [preferredBase, ...SERVERS.filter(s => s !== preferredBase)];
      let lastErr = null;
      for (const srv of servers) {
        const url = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${streamId}.m3u8`;
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Referer': `${srv}/` },
            signal: AbortSignal.timeout(MANIFEST_TIMEOUT),
          });
          if (!res.ok) { lastErr = new Error(`HTTP ${res.status} from ${srv}`); continue; }
          const content = await res.text();
          // Capture actual server after 302 redirect (IPTV session token)
          let actualBase = srv;
          try { if (res.url) actualBase = new URL(res.url).origin; } catch {}
          return { content, srv: actualBase };
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('All IPTV servers unreachable');
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

      // Try each candidate, with 1 retry on timeout
      let lastErr = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        for (const segUrl of candidates) {
          try {
            const timeout = attempt === 0 ? SEGMENT_TIMEOUT : SEGMENT_TIMEOUT + 5000;
            const res = await fetch(segUrl, {
              headers: { 'User-Agent': UA },
              signal: AbortSignal.timeout(timeout),
            });
            if (!res.ok) { lastErr = new Error(`Segment HTTP ${res.status}`); continue; }
            const buf = Buffer.from(await res.arrayBuffer());
            const contentType = res.headers.get('content-type') || 'video/mp2t';
            // Cache for all users
            this._evictSegments();
            _totalSegBytes += buf.length;
            this._segments.set(cacheKey, { buf, contentType, ts: Date.now() });
            return { buf, contentType };
          } catch (e) { lastErr = e; }
        }
        // Only retry on timeout errors
        if (lastErr && !lastErr.message?.includes('timeout')) break;
      }
      throw lastErr || new Error('Segment unavailable');
    });
  }

  // ─── URL rewriting ────────────────────────────────────────
  _rewriteManifest(content, streamId, baseUrl) {
    return content.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      let abs;
      if (t.startsWith('http'))     abs = t;
      else if (t.startsWith('/'))   abs = `${baseUrl}${t}`;
      else                          abs = `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;
      const enc = encodeURIComponent(abs);
      return (t.endsWith('.m3u8') || t.includes('.m3u8?'))
        ? `/proxy/live/${streamId}/sub/${enc}`
        : `/proxy/live/${streamId}/seg/${enc}`;
    }).join('\n');
  }

  _rewriteSubManifest(content, streamId, baseUrl) {
    return content.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const abs = t.startsWith('http') ? t : `${baseUrl}${t}`;
      return `/proxy/live/${streamId}/seg/${encodeURIComponent(abs)}`;
    }).join('\n');
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
      const baseUrl = m.baseUrl || XTREAM.primary;
      const p = this._fetchManifest(streamId, baseUrl)
        .then(result => {
          const rewritten = this._rewriteManifest(result.content, streamId, result.srv);
          const ts = Date.now();
          this._manifests.set(streamId, {
            content: result.content, srv: result.srv,
            baseUrl, ts, rewritten,
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
