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
const MANIFEST_TTL     = 8000;   // 8s   — manifest cache (HLS segments ~4-10s)
const MANIFEST_STALE   = 30000;  // 30s  — serve stale manifest on error
const PROACTIVE_MS     = 2000;   // 2s   — refresh manifest 2s before TTL expires
const SEG_TTL          = 60000;  // 60s  — segment cache
const SESSION_TTL      = 60000;  // 60s  — viewer idle timeout
const GC_INTERVAL      = 15000;  // 15s  — cleanup cycle
const MAX_SEG_CACHE    = 300;    // max cached segments (~300MB worst case, prevent OOM)
const MAX_SEG_BYTES    = 400 * 1024 * 1024; // 400MB hard limit for segment cache
const MAX_MANIFEST_PARALLEL = 5; // max parallel manifest fetches (100+ users, many channels)
const MAX_SEG_PARALLEL = 20;     // max parallel segment downloads (CDN, not IPTV)

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
    console.log(`[XtreamProxy] v2 Ready — manifests parallel(${MAX_MANIFEST_PARALLEL}), segments parallel(${MAX_SEG_PARALLEL}), cache ${MANIFEST_TTL/1000}s+coalesce+proactive`);
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

    // 1. Fresh cache → return immediately (all users share this)
    const cached = this._manifests.get(streamId);
    if (cached && !cached.failed && Date.now() - cached.ts < MANIFEST_TTL) {
      return cached.rewritten;
    }
    // Cooldown: if last attempt failed recently, don't flood IPTV
    if (cached && cached.failed && Date.now() - cached.ts < MANIFEST_TTL) {
      throw new Error('IPTV temporarily unavailable (cooldown)');
    }

    // 2. Already fetching this channel → wait for result (per-channel coalescing)
    if (this._pendingManifests.has(streamId)) {
      try { await this._pendingManifests.get(streamId); } catch {}
      const c = this._manifests.get(streamId);
      if (c && !c.failed) return c.rewritten;
    }

    // 3. Fetch from IPTV (parallel across channels, semaphore-bounded)
    const p = this._fetchManifest(streamId, baseUrl)
      .finally(() => this._pendingManifests.delete(streamId));
    this._pendingManifests.set(streamId, p);

    try {
      const result = await p;
      const rewritten = this._rewriteManifest(result.content, streamId, result.srv);
      this._manifests.set(streamId, {
        content: result.content, srv: result.srv,
        baseUrl, ts: Date.now(), rewritten,
      });
      return rewritten;
    } catch (err) {
      // On 403/error: set cooldown so we don't flood IPTV with retries
      if (!cached || cached.failed) {
        this._manifests.set(streamId, { ts: Date.now(), failed: true });
      } else if (Date.now() - cached.ts < MANIFEST_STALE) {
        // Has stale cache → serve it (don't bump ts — allow retry soon)
        return cached.rewritten;
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

    // 3. Fetch via Semaphore (parallel, up to 3)
    const p = this._fetchSegment(candidates, cacheKey)
      .catch(err => {
        // Segment failed → invalidate manifest cache so next request gets fresh IPTV session
        this._manifests.delete(streamId);
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
    for (const [id, m] of this._manifests) {
      if (now - m.ts > MANIFEST_STALE) this._manifests.delete(id);
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
  // For channels with active viewers, refresh manifest BEFORE cache expires
  // so users never wait for a cold fetch
  _proactiveRefresh() {
    const now = Date.now();
    for (const [streamId, m] of this._manifests) {
      // Skip failed entries
      if (m.failed) continue;
      // Skip if still fresh (not near expiry)
      if (now - m.ts < MANIFEST_TTL - PROACTIVE_MS) continue;
      // Skip if already fetching
      if (this._pendingManifests.has(streamId)) continue;
      // Only refresh if channel has active viewers
      if (this.getViewerCount(streamId) === 0) continue;

      const baseUrl = m.baseUrl || XTREAM.primary;
      const p = this._fetchManifest(streamId, baseUrl)
        .then(result => {
          const rewritten = this._rewriteManifest(result.content, streamId, result.srv);
          this._manifests.set(streamId, {
            content: result.content, srv: result.srv,
            baseUrl, ts: Date.now(), rewritten,
          });
        })
        .catch(() => { /* silent — users will get stale or retry */ })
        .finally(() => this._pendingManifests.delete(streamId));
      this._pendingManifests.set(streamId, p);
    }
  }
}

module.exports = new XtreamProxy();
