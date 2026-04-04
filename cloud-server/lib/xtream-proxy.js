/**
 * Xtream HLS Reverse Proxy v2 — Production-grade multi-channel/multi-user
 *
 * Architecture:
 * - Per-channel concurrency control (parallel between channels, serialized within)
 * - Bounded LRU segment cache (~200MB max) — prevents OOM
 * - Request coalescing: multiple viewers requesting same manifest/segment = one upstream fetch
 * - On-demand fetching: only contacts IPTV when a client actually requests
 * - Segment pre-fetch: after manifest fetch, pre-downloads new segments
 * - Server fallback: tries backup server on failure
 * - Viewer session tracking (TTL-based)
 * - Graceful degradation: serves stale cache on upstream failure
 */

const { XTREAM } = require('./xtream');

const UA               = 'VLC/3.0.20 LibVLC/3.0.20';
const MANIFEST_TTL     = 4000;        // 4s  — manifest cache (HLS segments ~6-10s)
const MANIFEST_STALE   = 30000;       // 30s — serve stale manifest on fetch failure
const SEG_TTL          = 45000;       // 45s — segment cache lifetime
const SESSION_TTL      = 60000;       // 60s — viewer session idle timeout
const GC_INTERVAL      = 10000;       // 10s — garbage collection
const MAX_SEG_CACHE_MB = 200;         // 200MB max segment cache
const MAX_SEG_ENTRIES  = 500;         // absolute max entries (safety)
const MAX_CONCURRENT_UPSTREAM = 3;    // max parallel requests to IPTV at once
const FETCH_TIMEOUT_MANIFEST = 8000;  // 8s  — manifest fetch timeout
const FETCH_TIMEOUT_SEGMENT  = 12000; // 12s — segment fetch timeout
const PREFETCH_TIMEOUT       = 10000; // 10s — segment prefetch timeout

const SERVERS = [XTREAM.primary, XTREAM.backup];

// ── Semaphore: limits concurrent requests to IPTV provider ──
// Allows parallel fetching (up to N) instead of strict serial queue
class Semaphore {
  constructor(max) {
    this._max = max;
    this._running = 0;
    this._queue = [];
  }
  async acquire() {
    if (this._running < this._max) {
      this._running++;
      return;
    }
    await new Promise(resolve => this._queue.push(resolve));
  }
  release() {
    this._running--;
    if (this._queue.length > 0 && this._running < this._max) {
      this._running++;
      this._queue.shift()();
    }
  }
  async run(fn) {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }
  get pending() { return this._queue.length; }
  get active() { return this._running; }
}

class XtreamProxy {
  constructor() {
    // Bounded LRU segment cache: segUrl → { buf, contentType, ts, size }
    this.segCache       = new Map();
    this._segCacheBytes = 0;

    // Viewer sessions: streamId → Map<sessionId, lastSeen>
    this.sessions = new Map();

    // Manifest cache: streamId → { content, srv, ts }
    this._manifestCache    = new Map();
    // Pending manifest fetches (request coalescing): streamId → Promise
    this._pendingManifests = new Map();
    // Pending segment fetches (coalescing): cacheKey → Promise
    this._pendingSegments  = new Map();
    // Known segments per stream (for prefetch dedup): streamId → Set<url>
    this._knownSegs        = new Map();

    // Global semaphore for IPTV upstream requests
    this._upstream = new Semaphore(MAX_CONCURRENT_UPSTREAM);

    this._gcTimer = null;
  }

  start() {
    this._gcTimer = setInterval(() => this._gc(), GC_INTERVAL);
    console.log(`[XtreamProxy] v2 Ready — ${MAX_CONCURRENT_UPSTREAM} concurrent upstream, ${MAX_SEG_CACHE_MB}MB cache`);
  }

  stop() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    this.segCache.clear();
    this._segCacheBytes = 0;
    this.sessions.clear();
    this._manifestCache.clear();
    this._pendingManifests.clear();
    this._pendingSegments.clear();
    this._knownSegs.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Manifest proxy (on-demand, cached, coalesced)
  // ─────────────────────────────────────────────────────────────
  async getManifest(streamId, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);

    const cacheKey = `manifest_${streamId}`;
    const cached = this._manifestCache.get(cacheKey);

    // Serve from cache if fresh
    if (cached && (Date.now() - cached.ts) < MANIFEST_TTL) {
      return this._rewriteManifest(cached.content, streamId, cached.srv);
    }

    // Request coalescing: if another request is already fetching, wait for it
    if (this._pendingManifests.has(streamId)) {
      try {
        await this._pendingManifests.get(streamId);
      } catch { /* will be handled below */ }
      const fresh = this._manifestCache.get(cacheKey);
      if (fresh && (Date.now() - fresh.ts) < MANIFEST_TTL) {
        return this._rewriteManifest(fresh.content, streamId, fresh.srv);
      }
    }

    // This request does the actual fetch — all concurrent requests for same stream wait above
    const fetchPromise = this._fetchManifest(streamId, baseUrl)
      .then(result => {
        this._manifestCache.set(cacheKey, { content: result.content, srv: result.srv, ts: Date.now() });
        // Fire-and-forget prefetch — don't block manifest response
        this._prefetchNewSegments(streamId, result.content, result.srv);
        return result;
      })
      .catch(err => {
        // Serve stale cache on failure (graceful degradation)
        if (cached && (Date.now() - cached.ts) < MANIFEST_STALE) {
          cached.ts = Date.now(); // Prevent rapid refetch loop
          return cached;
        }
        throw err;
      })
      .finally(() => this._pendingManifests.delete(streamId));

    this._pendingManifests.set(streamId, fetchPromise);
    const result = await fetchPromise;
    return this._rewriteManifest(result.content, streamId, result.srv);
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Segment proxy (cached, coalesced, parallel)
  // ─────────────────────────────────────────────────────────────
  async getSegment(streamId, encodedPath, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);

    let decoded;
    try { decoded = decodeURIComponent(encodedPath); }
    catch { decoded = encodedPath; }

    const isAbs = decoded.startsWith('http');

    // Build candidate URLs for fetching
    let candidates;
    if (isAbs) {
      candidates = [decoded];
    } else if (decoded.startsWith('/')) {
      candidates = [
        `${baseUrl}${decoded}`,
        ...SERVERS.filter(s => s !== baseUrl).map(s => `${s}${decoded}`),
      ];
    } else {
      candidates = [
        `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`,
        ...SERVERS.filter(s => s !== baseUrl).map(s => `${s}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`),
      ];
    }

    // Check cache (try all candidate keys)
    for (const key of candidates) {
      const hit = this.segCache.get(key);
      if (hit && Date.now() - hit.ts < SEG_TTL) {
        hit.ts = Date.now(); // Refresh LRU timestamp
        return { buf: hit.buf, contentType: hit.contentType };
      }
    }

    const cacheKey = candidates[0];

    // Request coalescing: if another request is already fetching this segment, wait
    if (this._pendingSegments.has(cacheKey)) {
      return this._pendingSegments.get(cacheKey);
    }

    const fetchPromise = this._fetchSegment(cacheKey, candidates)
      .finally(() => this._pendingSegments.delete(cacheKey));

    this._pendingSegments.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Sub-manifest proxy (quality variant playlists)
  // ─────────────────────────────────────────────────────────────
  async getSubManifest(streamId, encodedUrl, sessionId) {
    this._touchSession(streamId, sessionId);

    let subUrl;
    try { subUrl = decodeURIComponent(encodedUrl); }
    catch { subUrl = encodedUrl; }

    const content = await this._upstream.run(async () => {
      const res = await fetch(subUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MANIFEST),
      });
      if (!res.ok) throw new Error(`Sub-manifest HTTP ${res.status}`);
      return res.text();
    });

    const baseForSub = subUrl.substring(0, subUrl.lastIndexOf('/') + 1);
    return this._rewriteSubManifest(content, streamId, baseForSub);
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Viewer stats
  // ─────────────────────────────────────────────────────────────
  getViewerCount(streamId) {
    const map = this.sessions.get(streamId);
    if (!map) return 0;
    const now = Date.now();
    let n = 0;
    for (const t of map.values()) if (now - t < SESSION_TTL) n++;
    return n;
  }

  getAllViewers() {
    const out = {};
    for (const [id] of this.sessions) {
      const n = this.getViewerCount(id);
      if (n > 0) out[id] = n;
    }
    return out;
  }

  getTotalViewers() {
    return Object.values(this.getAllViewers()).reduce((a, b) => a + b, 0);
  }

  // ─────────────────────────────────────────────────────────────
  // Segment pre-fetch (fire-and-forget, doesn't block manifests)
  // ─────────────────────────────────────────────────────────────
  _prefetchNewSegments(streamId, manifestContent, srv) {
    if (!this._knownSegs.has(streamId)) this._knownSegs.set(streamId, new Set());
    const known = this._knownSegs.get(streamId);

    const lines = manifestContent.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;

      let segUrl;
      if (t.startsWith('http')) segUrl = t;
      else if (t.startsWith('/')) segUrl = `${srv}${t}`;
      else segUrl = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;

      if (!known.has(segUrl) && !this.segCache.has(segUrl)) {
        known.add(segUrl);
        // Keep known set bounded
        if (known.size > 30) {
          const first = known.values().next().value;
          known.delete(first);
        }
        // Fire-and-forget prefetch (low priority — uses semaphore but doesn't block clients)
        this._prefetchSeg(segUrl).catch(() => {});
      }
    }
  }

  async _prefetchSeg(segUrl) {
    if (this.segCache.has(segUrl)) return;
    return this._upstream.run(async () => {
      if (this.segCache.has(segUrl)) return; // re-check after wait
      try {
        const res = await fetch(segUrl, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(PREFETCH_TIMEOUT),
        });
        if (!res.ok) return;
        const buf         = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') || 'video/mp2t';
        this._putSegCache(segUrl, buf, contentType);
      } catch { /* prefetch failure is non-critical */ }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Low-level fetchers (use semaphore for concurrency control)
  // ─────────────────────────────────────────────────────────────
  async _fetchManifest(streamId, preferredBase) {
    return this._upstream.run(async () => {
      const servers = [preferredBase, ...SERVERS.filter(s => s !== preferredBase)];
      let lastErr = null;

      for (const srv of servers) {
        const url = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${streamId}.m3u8`;
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Referer': `${srv}/` },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MANIFEST),
          });
          if (!res.ok) {
            lastErr = new Error(`HTTP ${res.status} from ${srv}`);
            continue;
          }
          const content = await res.text();
          // Capture actual server after 302 redirect
          let actualBase = srv;
          try {
            if (res.url) {
              const u = new URL(res.url);
              actualBase = u.origin;
            }
          } catch {}
          return { content, srv: actualBase };
        } catch (e) {
          lastErr = new Error(`${e.message} (${srv})`);
        }
      }
      throw lastErr || new Error('All servers unreachable');
    });
  }

  async _fetchSegment(cacheKey, candidates) {
    return this._upstream.run(async () => {
      let lastErr = null;

      for (const segUrl of candidates) {
        try {
          const res = await fetch(segUrl, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_SEGMENT),
          });
          if (!res.ok) {
            lastErr = new Error(`Segment HTTP ${res.status}`);
            continue;
          }
          const buf         = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') || 'video/mp2t';
          this._putSegCache(cacheKey, buf, contentType);
          return { buf, contentType };
        } catch (e) {
          lastErr = new Error(`Segment fetch: ${e.message}`);
        }
      }
      throw lastErr || new Error('Segment unavailable');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Bounded LRU segment cache
  // ─────────────────────────────────────────────────────────────
  _putSegCache(key, buf, contentType) {
    const size = buf.length;

    // Evict oldest entries if cache exceeds limits
    while (
      (this._segCacheBytes + size > MAX_SEG_CACHE_MB * 1024 * 1024 || this.segCache.size >= MAX_SEG_ENTRIES)
      && this.segCache.size > 0
    ) {
      const oldest = this.segCache.keys().next().value;
      const entry = this.segCache.get(oldest);
      if (entry) this._segCacheBytes -= entry.size || 0;
      this.segCache.delete(oldest);
    }

    this.segCache.set(key, { buf, contentType, ts: Date.now(), size });
    this._segCacheBytes += size;
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────
  _touchSession(streamId, sessionId) {
    if (!this.sessions.has(streamId)) this.sessions.set(streamId, new Map());
    this.sessions.get(streamId).set(sessionId, Date.now());
  }

  _rewriteManifest(content, streamId, baseUrl) {
    return content.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;

      let abs;
      if (t.startsWith('http')) {
        abs = t;
      } else if (t.startsWith('/')) {
        abs = `${baseUrl}${t}`;
      } else {
        abs = `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;
      }
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
      const enc = encodeURIComponent(abs);
      return `/proxy/live/${streamId}/seg/${enc}`;
    }).join('\n');
  }

  // ─────────────────────────────────────────────────────────────
  // Garbage collection
  // ─────────────────────────────────────────────────────────────
  _gc() {
    const now = Date.now();

    // Expire old segment cache entries
    for (const [k, v] of this.segCache) {
      if (now - v.ts > SEG_TTL * 2) {
        this._segCacheBytes -= v.size || 0;
        this.segCache.delete(k);
      }
    }

    // Expire viewer sessions
    for (const [id, map] of this.sessions) {
      for (const [sid, t] of map) {
        if (now - t > SESSION_TTL) map.delete(sid);
      }
      if (map.size === 0) this.sessions.delete(id);
    }

    // Clean expired manifest cache
    for (const [k, v] of this._manifestCache) {
      if (now - v.ts > MANIFEST_STALE) this._manifestCache.delete(k);
    }

    // Clean known segments tracker for streams with no viewers
    for (const [id] of this._knownSegs) {
      if (!this.sessions.has(id)) this._knownSegs.delete(id);
    }

    // Log stats when there are active viewers
    const viewers = this.getTotalViewers();
    if (viewers > 0) {
      const cacheMB = (this._segCacheBytes / (1024 * 1024)).toFixed(1);
      console.log(`[XtreamProxy] Viewers: ${viewers} | Segs: ${this.segCache.size} (${cacheMB}MB) | Upstream: ${this._upstream.active}/${MAX_CONCURRENT_UPSTREAM} (${this._upstream.pending} queued)`);
    }
  }
}

module.exports = new XtreamProxy();
