/**
 * Xtream HLS Reverse Proxy v3 — Zero-buffer streaming
 *
 * Architecture:
 * - Active polling: when a channel has viewers, manifest is refreshed every 4s in background
 * - Proactive prefetch: ALL new segments downloaded immediately after each manifest refresh
 * - By the time the player requests anything → already cached → instant response → zero buffering
 * - Semaphore concurrency: up to 5 parallel upstream requests (manifest + segments)
 * - Request coalescing: 100 viewers on same channel = 1 upstream fetch
 * - Bounded LRU segment cache (200MB / 500 entries max) — prevents OOM
 * - Auto-cleanup: stops polling 30s after last viewer leaves a channel
 * - Graceful degradation: serves stale manifest on upstream errors
 * - 302 redirect capture: IPTV redirects to streaming server with session token — captured and used
 */

const { XTREAM } = require('./xtream');

// ─── Tuning constants ──────────────────────────────────────────
const UA                      = 'VLC/3.0.20 LibVLC/3.0.20';
const POLL_INTERVAL           = 4000;    // 4s   — manifest refresh cycle (HLS segments ~10s)
const POLL_INTERVAL_ERROR     = 8000;    // 8s   — poll interval after upstream error
const MANIFEST_STALE_MAX      = 30000;   // 30s  — max age to serve stale manifest
const SEG_TTL                 = 60000;   // 60s  — segment cache lifetime
const SESSION_TTL             = 60000;   // 60s  — viewer session idle timeout
const CHANNEL_IDLE_TIMEOUT    = 30000;   // 30s  — stop polling when no viewers
const GC_INTERVAL             = 10000;   // 10s  — garbage collection cycle
const MAX_SEG_CACHE_MB        = 200;     // 200MB max segment cache
const MAX_SEG_ENTRIES         = 500;     // absolute max cached segments
const MAX_CONCURRENT_UPSTREAM = 5;       // max parallel IPTV requests
const FETCH_TIMEOUT_MANIFEST  = 8000;    // 8s   — manifest fetch timeout
const FETCH_TIMEOUT_SEGMENT   = 15000;   // 15s  — segment fetch timeout
const PREFETCH_BATCH          = 3;       // prefetch N segments in parallel per cycle

const SERVERS = [XTREAM.primary, XTREAM.backup];

// ─── Semaphore: bounded parallel upstream requests ─────────────
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
  get active()  { return this._active; }
  get pending() { return this._queue.length; }
}

// ═══════════════════════════════════════════════════════════════
class XtreamProxy {
  constructor() {
    // Per-channel state: streamId → { manifest, srv, ts, poller, lastViewer, baseUrl, errors }
    this._channels = new Map();

    // Bounded LRU segment cache: url → { buf, contentType, ts, size }
    this.segCache       = new Map();
    this._segCacheBytes = 0;

    // Viewer sessions: streamId → Map<sessionId, lastSeen>
    this.sessions = new Map();

    // Request coalescing
    this._pendingManifests = new Map(); // streamId → Promise
    this._pendingSegments  = new Map(); // cacheKey → Promise

    // Prefetch dedup: streamId → Set<url>
    this._knownSegs = new Map();

    // Global upstream semaphore
    this._upstream = new Semaphore(MAX_CONCURRENT_UPSTREAM);

    this._gcTimer = null;
  }

  start() {
    this._gcTimer = setInterval(() => this._gc(), GC_INTERVAL);
    console.log(`[XtreamProxy] v3 Ready — active polling, ${MAX_CONCURRENT_UPSTREAM} upstream, ${MAX_SEG_CACHE_MB}MB cache`);
  }

  stop() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    for (const [, ch] of this._channels) { if (ch.poller) clearTimeout(ch.poller); }
    this._channels.clear();
    this.segCache.clear();
    this._segCacheBytes = 0;
    this.sessions.clear();
    this._pendingManifests.clear();
    this._pendingSegments.clear();
    this._knownSegs.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API — called from Express routes
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET manifest — always served from cache (active polling keeps it fresh).
   * First request for a new channel triggers the polling loop + initial fetch.
   */
  async getManifest(streamId, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);
    const ch = this._ensureChannel(streamId, baseUrl);

    // Serve from cache immediately (polling keeps this fresh)
    if (ch.manifest) {
      return this._rewriteManifest(ch.manifest, streamId, ch.srv);
    }

    // First-ever request — wait for the initial poll to complete
    if (this._pendingManifests.has(streamId)) {
      try { await this._pendingManifests.get(streamId); } catch {}
      if (ch.manifest) {
        return this._rewriteManifest(ch.manifest, streamId, ch.srv);
      }
    }

    // Safety fallback — direct fetch (should rarely happen)
    const result = await this._fetchManifestDirect(streamId, baseUrl);
    ch.manifest = result.content;
    ch.srv      = result.srv;
    ch.ts       = Date.now();
    ch.errors   = 0;
    this._prefetchSegments(streamId, result.content, result.srv);
    return this._rewriteManifest(ch.manifest, streamId, ch.srv);
  }

  /**
   * GET segment — served from cache (prefetch fills cache proactively).
   * If not cached yet, fetches on-demand with coalescing.
   */
  async getSegment(streamId, encodedPath, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);
    this._ensureChannel(streamId, baseUrl); // keep channel alive

    let decoded;
    try { decoded = decodeURIComponent(encodedPath); } catch { decoded = encodedPath; }

    const isAbs = decoded.startsWith('http');
    let candidates;
    if (isAbs) {
      candidates = [decoded];
    } else if (decoded.startsWith('/')) {
      candidates = [`${baseUrl}${decoded}`, ...SERVERS.filter(s => s !== baseUrl).map(s => `${s}${decoded}`)];
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
        hit.ts = Date.now(); // refresh LRU
        return { buf: hit.buf, contentType: hit.contentType };
      }
    }

    const cacheKey = candidates[0];

    // Request coalescing
    if (this._pendingSegments.has(cacheKey)) {
      return this._pendingSegments.get(cacheKey);
    }

    const p = this._fetchSegment(cacheKey, candidates)
      .finally(() => this._pendingSegments.delete(cacheKey));
    this._pendingSegments.set(cacheKey, p);
    return p;
  }

  /**
   * GET sub-manifest (quality variant playlists)
   */
  async getSubManifest(streamId, encodedUrl, sessionId) {
    this._touchSession(streamId, sessionId);
    let subUrl;
    try { subUrl = decodeURIComponent(encodedUrl); } catch { subUrl = encodedUrl; }

    const content = await this._upstream.run(async () => {
      const res = await fetch(subUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MANIFEST),
      });
      if (!res.ok) throw new Error(`Sub-manifest HTTP ${res.status}`);
      return res.text();
    });
    const base = subUrl.substring(0, subUrl.lastIndexOf('/') + 1);
    return this._rewriteSubManifest(content, streamId, base);
  }

  // ─── Viewer stats ──────────────────────────────────────────
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

  // ═══════════════════════════════════════════════════════════════
  // Active polling engine — keeps manifests + segments warm
  // ═══════════════════════════════════════════════════════════════

  _ensureChannel(streamId, baseUrl) {
    let ch = this._channels.get(streamId);
    if (ch) { ch.lastViewer = Date.now(); return ch; }

    ch = { manifest: null, srv: null, ts: 0, poller: null, lastViewer: Date.now(), baseUrl, errors: 0 };
    this._channels.set(streamId, ch);

    // Kick off first poll immediately
    this._poll(streamId);
    return ch;
  }

  async _poll(streamId) {
    const ch = this._channels.get(streamId);
    if (!ch) return;

    let nextInterval = POLL_INTERVAL;

    try {
      const result = await this._fetchManifestCoalesced(streamId, ch.baseUrl);
      ch.manifest = result.content;
      ch.srv      = result.srv;
      ch.ts       = Date.now();
      ch.errors   = 0;

      // Proactively prefetch ALL new segments
      this._prefetchSegments(streamId, result.content, result.srv);
    } catch {
      ch.errors = (ch.errors || 0) + 1;
      nextInterval = POLL_INTERVAL_ERROR;
      // Stale manifest is still served to clients (if available)
    }

    // Stop polling if no viewers for CHANNEL_IDLE_TIMEOUT
    if (Date.now() - ch.lastViewer > CHANNEL_IDLE_TIMEOUT) {
      if (ch.poller) clearTimeout(ch.poller);
      this._channels.delete(streamId);
      this._knownSegs.delete(streamId);
      return;
    }

    // Schedule next poll
    ch.poller = setTimeout(() => this._poll(streamId), nextInterval);
  }

  // ═══════════════════════════════════════════════════════════════
  // Segment prefetch — downloads new segments before player asks
  // ═══════════════════════════════════════════════════════════════

  _prefetchSegments(streamId, manifestContent, srv) {
    if (!this._knownSegs.has(streamId)) this._knownSegs.set(streamId, new Set());
    const known = this._knownSegs.get(streamId);
    const newUrls = [];

    for (const line of manifestContent.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      let segUrl;
      if (t.startsWith('http'))     segUrl = t;
      else if (t.startsWith('/'))   segUrl = `${srv}${t}`;
      else                          segUrl = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;

      if (!known.has(segUrl) && !this.segCache.has(segUrl)) {
        known.add(segUrl);
        newUrls.push(segUrl);
      }
    }

    // Bound the known set
    while (known.size > 60) { known.delete(known.values().next().value); }

    // Download new segments in parallel batches (doesn't block client requests)
    if (newUrls.length > 0) {
      this._prefetchBatch(newUrls).catch(() => {});
    }
  }

  async _prefetchBatch(urls) {
    for (let i = 0; i < urls.length; i += PREFETCH_BATCH) {
      const batch = urls.slice(i, i + PREFETCH_BATCH);
      await Promise.allSettled(batch.map(u => this._prefetchSeg(u)));
    }
  }

  async _prefetchSeg(segUrl) {
    if (this.segCache.has(segUrl)) return;
    return this._upstream.run(async () => {
      if (this.segCache.has(segUrl)) return;
      const res = await fetch(segUrl, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_SEGMENT),
      });
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      this._putSegCache(segUrl, buf, res.headers.get('content-type') || 'video/mp2t');
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Low-level upstream fetchers
  // ═══════════════════════════════════════════════════════════════

  async _fetchManifestCoalesced(streamId, baseUrl) {
    if (this._pendingManifests.has(streamId)) {
      return this._pendingManifests.get(streamId);
    }
    const p = this._fetchManifestDirect(streamId, baseUrl)
      .finally(() => this._pendingManifests.delete(streamId));
    this._pendingManifests.set(streamId, p);
    return p;
  }

  async _fetchManifestDirect(streamId, preferredBase) {
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
          if (!res.ok) { lastErr = new Error(`HTTP ${res.status} from ${srv}`); continue; }
          const content = await res.text();
          // Capture actual server after 302 redirect (IPTV uses session-token redirect)
          let actualBase = srv;
          try { if (res.url) actualBase = new URL(res.url).origin; } catch {}
          return { content, srv: actualBase };
        } catch (e) { lastErr = new Error(`${e.message} (${srv})`); }
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
          if (!res.ok) { lastErr = new Error(`Segment HTTP ${res.status}`); continue; }
          const buf = Buffer.from(await res.arrayBuffer());
          const ct  = res.headers.get('content-type') || 'video/mp2t';
          this._putSegCache(cacheKey, buf, ct);
          return { buf, contentType: ct };
        } catch (e) { lastErr = new Error(`Segment fetch: ${e.message}`); }
      }
      throw lastErr || new Error('Segment unavailable');
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Bounded LRU segment cache
  // ═══════════════════════════════════════════════════════════════

  _putSegCache(key, buf, contentType) {
    const size = buf.length;
    // Evict oldest entries if over limits
    while (
      (this._segCacheBytes + size > MAX_SEG_CACHE_MB * 1024 * 1024 || this.segCache.size >= MAX_SEG_ENTRIES)
      && this.segCache.size > 0
    ) {
      const oldest = this.segCache.keys().next().value;
      const entry  = this.segCache.get(oldest);
      if (entry) this._segCacheBytes -= entry.size || 0;
      this.segCache.delete(oldest);
    }
    this.segCache.set(key, { buf, contentType, ts: Date.now(), size });
    this._segCacheBytes += size;
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  _touchSession(streamId, sessionId) {
    if (!this.sessions.has(streamId)) this.sessions.set(streamId, new Map());
    this.sessions.get(streamId).set(sessionId, Date.now());
  }

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

  // ═══════════════════════════════════════════════════════════════
  // Garbage collection
  // ═══════════════════════════════════════════════════════════════

  _gc() {
    const now = Date.now();

    // Expire old segments
    for (const [k, v] of this.segCache) {
      if (now - v.ts > SEG_TTL * 2) {
        this._segCacheBytes -= v.size || 0;
        this.segCache.delete(k);
      }
    }

    // Expire viewer sessions
    for (const [id, map] of this.sessions) {
      for (const [sid, t] of map) { if (now - t > SESSION_TTL) map.delete(sid); }
      if (map.size === 0) this.sessions.delete(id);
    }

    // Clean known-segments for channels with no viewers
    for (const [id] of this._knownSegs) {
      if (!this.sessions.has(id)) this._knownSegs.delete(id);
    }

    // Stats
    const viewers  = this.getTotalViewers();
    const channels = this._channels.size;
    if (viewers > 0 || channels > 0) {
      const mb = (this._segCacheBytes / (1024 * 1024)).toFixed(1);
      console.log(`[XtreamProxy] Viewers: ${viewers} | Channels: ${channels} | Segs: ${this.segCache.size} (${mb}MB) | Upstream: ${this._upstream.active}/${MAX_CONCURRENT_UPSTREAM} (${this._upstream.pending} queued)`);
    }
  }
}

module.exports = new XtreamProxy();
