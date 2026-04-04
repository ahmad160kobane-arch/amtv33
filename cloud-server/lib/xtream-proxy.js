/**
 * Xtream HLS Reverse Proxy
 *
 * Features:
 * - Active background poller per stream: continuously fetches manifest + pre-fetches segments
 * - Instant playback: segments are cached before client requests them
 * - Viewer session tracking (TTL-based, per channel)
 * - Keeps stream warm for KEEP_WARM ms after last viewer leaves (no cold-start on re-join)
 * - Server fallback: tries backup server on 4xx/5xx
 * - Shared segment cache: one upstream fetch per segment, shared among all viewers
 */

const { XTREAM } = require('./xtream');

const UA             = 'VLC/3.0.20 LibVLC/3.0.20';
const MANIFEST_TTL   = 6000;   // 6s  — cache manifest (HLS segments are ~10s)
const MANIFEST_STALE = 30000;  // 30s — serve stale manifest on fetch failure
const SEG_TTL        = 30000;  // 30s — segment cache lifetime
const SESSION_TTL    = 60000;  // 60s — viewer session idle timeout
const GC_INTERVAL    = 15000;  // 15s — garbage collection interval
const RETRY_DELAY_458 = 3000;  // 3s  — wait before retrying after HTTP 458

const SERVERS = [XTREAM.primary, XTREAM.backup];

// ── Global request queue: serializes ALL HTTP requests to IPTV provider ──
// Prevents concurrent connections that trigger HTTP 458 (connection limit)
class RequestQueue {
  constructor() { this._queue = []; this._running = false; }
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._drain();
    });
  }
  async _drain() {
    if (this._running) return;
    this._running = true;
    while (this._queue.length > 0) {
      const { fn, resolve, reject } = this._queue.shift();
      try { resolve(await fn()); } catch (e) { reject(e); }
    }
    this._running = false;
  }
}
const iptvQueue = new RequestQueue();

class XtreamProxy {
  constructor() {
    this.segCache  = new Map(); // segUrl  → { buf, contentType, ts }
    this.sessions  = new Map(); // streamId → Map<sessionId, lastSeen>
    this.pollers   = new Map(); // streamId → { baseUrl, content, ts, knownSegs, timer, lastViewer }
    this._gcTimer  = null;
  }

  start() {
    this._gcTimer = setInterval(() => this._gc(), GC_INTERVAL);
    console.log('[XtreamProxy] Ready — HLS reverse proxy with viewer tracking');
  }

  stop() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    for (const [id] of this.pollers) this._stopPoller(id);
    this.segCache.clear();
    this.sessions.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Manifest proxy (on-demand, cached)
  // ─────────────────────────────────────────────────────────────
  async getManifest(streamId, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);
    if (!this._manifestCache) this._manifestCache = new Map();
    if (!this._pendingManifests) this._pendingManifests = new Map();

    // Check manifest cache first
    const cacheKey = `manifest_${streamId}`;
    const cached = this._manifestCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < MANIFEST_TTL) {
      return this._rewriteManifest(cached.content, streamId, cached.srv);
    }

    // Request coalescing: if another request is already fetching this manifest, wait for it
    if (this._pendingManifests.has(streamId)) {
      await this._pendingManifests.get(streamId);
      const fresh = this._manifestCache.get(cacheKey);
      if (fresh) return this._rewriteManifest(fresh.content, streamId, fresh.srv);
    }

    // This request does the actual fetch — all others wait above
    const fetchPromise = this._fetchManifest(streamId, baseUrl)
      .then(result => {
        this._manifestCache.set(cacheKey, { content: result.content, srv: result.srv, ts: Date.now() });
        this._prefetchNewSegments(streamId, result.content, result.srv);
        return result;
      })
      .catch(err => {
        // On failure (403/458), serve stale cache and refresh its timestamp
        // to prevent re-fetching every second (IPTV blocks while session active)
        if (cached && (Date.now() - cached.ts) < MANIFEST_STALE) {
          cached.ts = Date.now(); // Prevent refetch loop
          this._manifestCache.set(cacheKey, cached);
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
  // Public: Segment proxy
  // ─────────────────────────────────────────────────────────────
  async getSegment(streamId, encodedPath, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);

    const decoded = decodeURIComponent(encodedPath);
    const isAbs   = decoded.startsWith('http');

    // Build candidate URLs for fetching:
    // - Absolute URLs (from redirect server with session token) → use as-is, no fallback needed
    // - Relative paths → resolve against baseUrl and fallback servers
    let candidates;
    if (isAbs) {
      candidates = [decoded];
    } else if (decoded.startsWith('/')) {
      // Absolute path like /hlsr/token/.../segment.ts — resolve against baseUrl origin
      candidates = [
        `${baseUrl}${decoded}`,
        ...SERVERS.map(s => `${s}${decoded}`),
      ];
    } else {
      candidates = [
        `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`,
        ...SERVERS.filter(s => s !== baseUrl).map(s => `${s}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`),
      ];
    }

    const cacheKey = candidates[0];
    const hit = this.segCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < SEG_TTL) return { buf: hit.buf, contentType: hit.contentType };

    // Also check alternate cache keys
    for (const alt of candidates.slice(1)) {
      const h2 = this.segCache.get(alt);
      if (h2 && Date.now() - h2.ts < SEG_TTL) return { buf: h2.buf, contentType: h2.contentType };
    }

    return this._fetchSegment(cacheKey, candidates);
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Sub-manifest proxy (quality variant playlists)
  // ─────────────────────────────────────────────────────────────
  async getSubManifest(streamId, encodedUrl, sessionId) {
    this._touchSession(streamId, sessionId);
    const subUrl = decodeURIComponent(encodedUrl);
    // Serialize through queue to prevent concurrent IPTV connections
    const content = await iptvQueue.enqueue(async () => {
      const res = await fetch(subUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
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
    for (const [id] of this.sessions) { const n = this.getViewerCount(id); if (n > 0) out[id] = n; }
    return out;
  }

  getTotalViewers() {
    return Object.values(this.getAllViewers()).reduce((a, b) => a + b, 0);
  }

  // ─────────────────────────────────────────────────────────────
  // Segment pre-fetch (on-demand, triggered after manifest fetch)
  // ─────────────────────────────────────────────────────────────
  _prefetchNewSegments(streamId, manifestContent, srv) {
    if (!this._knownSegs) this._knownSegs = new Map();
    if (!this._knownSegs.has(streamId)) this._knownSegs.set(streamId, new Set());
    const known = this._knownSegs.get(streamId);

    for (const line of manifestContent.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      let segUrl;
      if (t.startsWith('http')) segUrl = t;
      else if (t.startsWith('/')) segUrl = `${srv}${t}`;
      else segUrl = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;
      if (!known.has(segUrl)) {
        known.add(segUrl);
        if (known.size > 20) known.delete(known.values().next().value);
        this._prefetchSeg(segUrl).catch(() => {});
      }
    }
  }

  async _prefetchSeg(segUrl) {
    if (this.segCache.has(segUrl)) return;
    return iptvQueue.enqueue(async () => {
      if (this.segCache.has(segUrl)) return; // re-check after queue wait
      try {
        const res = await fetch(segUrl, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return;
        const buf         = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') || 'video/mp2t';
        this.segCache.set(segUrl, { buf, contentType, ts: Date.now() });
      } catch { /* ignore */ }
    });
  }

  _stopPoller(streamId) {
    // Legacy — no-op (no more background pollers)
  }

  // ─────────────────────────────────────────────────────────────
  // Low-level fetchers
  // ─────────────────────────────────────────────────────────────
  async _fetchManifest(streamId, preferredBase) {
    return iptvQueue.enqueue(async () => {
      const servers = [preferredBase, ...SERVERS.filter(s => s !== preferredBase)];
      let lastErr = null;
      for (const srv of servers) {
        const url = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${streamId}.m3u8`;
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Referer': `${srv}/` },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) { lastErr = new Error(`HTTP ${res.status} from ${srv}`); continue; }
          const content = await res.text();
          // Capture actual server after 302 redirect (IPTV redirects to streaming server with session token)
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
    return iptvQueue.enqueue(async () => {
      let lastErr = null;
      for (const segUrl of candidates) {
        try {
          const res = await fetch(segUrl, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) { lastErr = new Error(`Segment HTTP ${res.status}`); continue; }
          const buf         = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get('content-type') || 'video/mp2t';
          this.segCache.set(cacheKey, { buf, contentType, ts: Date.now() });
          return { buf, contentType };
        } catch (e) {
          lastErr = new Error(`Segment fetch failed: ${e.message}`);
        }
      }
      throw lastErr || new Error('Segment unavailable from all servers');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────
  _touchSession(streamId, sessionId) {
    if (!this.sessions.has(streamId)) this.sessions.set(streamId, new Map());
    this.sessions.get(streamId).set(sessionId, Date.now());
    const p = this.pollers.get(streamId);
    if (p) p.lastViewer = Date.now();
  }

  _rewriteManifest(content, streamId, baseUrl) {
    return content.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      // Resolve segment URL to absolute:
      // - http://... → use as-is
      // - /hlsr/token/.../segment.ts → resolve against redirect server (baseUrl = actual server after 302)
      // - relative (segment.ts) → legacy format, resolve against IPTV path
      let abs;
      if (t.startsWith('http')) {
        abs = t;
      } else if (t.startsWith('/')) {
        abs = `${baseUrl}${t}`;
      } else {
        abs = `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;
      }
      const enc = encodeURIComponent(abs);
      // Path-only URLs — resolved by player relative to manifest origin
      // Web: origin = Railway HTTPS → Next.js rewrite → cloud server
      // Mobile: origin = cloud server directly
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

    // Expire segment cache
    for (const [k, v] of this.segCache)
      if (now - v.ts > SEG_TTL * 2) this.segCache.delete(k);

    // Expire viewer sessions
    for (const [id, map] of this.sessions) {
      for (const [sid, t] of map) if (now - t > SESSION_TTL) map.delete(sid);
      if (map.size === 0) this.sessions.delete(id);
    }

    // Clean manifest cache
    if (this._manifestCache) {
      for (const [k, v] of this._manifestCache)
        if (now - v.ts > 30000) this._manifestCache.delete(k);
    }
    // Clean known segments tracker
    if (this._knownSegs) {
      for (const [id] of this._knownSegs)
        if (!this.sessions.has(id)) this._knownSegs.delete(id);
    }

    const segs    = this.segCache.size;
    const viewers = this.getTotalViewers();
    if (viewers > 0) {
      console.log(`[XtreamProxy] Viewers: ${viewers} | Cached segs: ${segs}`);
    }
  }
}

module.exports = new XtreamProxy();
