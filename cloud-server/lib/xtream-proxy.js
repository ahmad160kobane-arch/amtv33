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

const UA            = 'VLC/3.0.20 LibVLC/3.0.20';
const POLL_INTERVAL = 2000;   // 2s  — how often to refresh the manifest in background
const SEG_TTL       = 20000;  // 20s — segment cache lifetime (slightly > typical HLS segment)
const SESSION_TTL   = 60000;  // 60s — viewer session idle timeout
const KEEP_WARM     = 15000;  // 15s — keep poller alive after last viewer leaves (max_connections=1)
const GC_INTERVAL   = 15000;  // 15s — garbage collection interval

const SERVERS = [XTREAM.primary, XTREAM.backup];

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
  // Public: Manifest proxy
  // ─────────────────────────────────────────────────────────────
  async getManifest(streamId, baseUrl, proxyBase, sessionId) {
    this._touchSession(streamId, sessionId);

    // Ensure background poller is running (starts/warms the stream)
    this._ensurePoller(streamId, baseUrl);

    const p = this.pollers.get(streamId);

    // If we already have a fresh manifest from the background poller, serve it immediately
    if (p && p.content && (Date.now() - p.ts) < 4000) {
      return this._rewriteManifest(p.content, streamId, p.baseUrl, proxyBase);
    }

    // Cold start: fetch directly and wait
    const result = await this._fetchManifest(streamId, baseUrl);
    if (p) { p.content = result.content; p.baseUrl = result.srv; p.ts = Date.now(); }
    return this._rewriteManifest(result.content, streamId, result.srv, proxyBase);
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Segment proxy
  // ─────────────────────────────────────────────────────────────
  async getSegment(streamId, encodedPath, baseUrl, sessionId) {
    this._touchSession(streamId, sessionId);

    const decoded = decodeURIComponent(encodedPath);
    const isAbs   = decoded.startsWith('http');
    const srv     = (this.pollers.get(streamId) || {}).baseUrl || baseUrl;

    const candidates = isAbs
      ? [decoded, ...SERVERS.filter(s => !decoded.startsWith(s)).map(
          s => `${s}/live/${XTREAM.user}/${XTREAM.pass}/${decoded.split('/live/')[1] || decoded.split('/').pop()}`
        )]
      : [
          `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`,
          ...SERVERS.filter(s => s !== srv).map(s => `${s}/live/${XTREAM.user}/${XTREAM.pass}/${decoded}`),
        ];

    const cacheKey = candidates[0];
    const hit = this.segCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < SEG_TTL) return { buf: hit.buf, contentType: hit.contentType };

    // Also check alternate cache keys (in case poller cached it under different key)
    for (const alt of candidates.slice(1)) {
      const h2 = this.segCache.get(alt);
      if (h2 && Date.now() - h2.ts < SEG_TTL) return { buf: h2.buf, contentType: h2.contentType };
    }

    return this._fetchSegment(cacheKey, candidates);
  }

  // ─────────────────────────────────────────────────────────────
  // Public: Sub-manifest proxy (quality variant playlists)
  // ─────────────────────────────────────────────────────────────
  async getSubManifest(streamId, encodedUrl, proxyBase, sessionId) {
    this._touchSession(streamId, sessionId);
    const subUrl = decodeURIComponent(encodedUrl);
    let res;
    try {
      res = await fetch(subUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    } catch (e) { throw new Error(`Sub-manifest fetch failed: ${e.message}`); }
    if (!res.ok) throw new Error(`Sub-manifest HTTP ${res.status}`);
    const content  = await res.text();
    const baseForSub = subUrl.substring(0, subUrl.lastIndexOf('/') + 1);
    return this._rewriteSubManifest(content, streamId, baseForSub, proxyBase);
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
  // Background poller: keeps stream manifest + segments warm
  // ─────────────────────────────────────────────────────────────
  _ensurePoller(streamId, baseUrl) {
    if (this.pollers.has(streamId)) {
      this.pollers.get(streamId).lastViewer = Date.now();
      return;
    }
    const state = { baseUrl, content: null, ts: 0, knownSegs: new Set(), timer: null, lastViewer: Date.now() };
    this.pollers.set(streamId, state);
    this._schedulePoll(streamId, 0); // immediate first poll
  }

  _schedulePoll(streamId, delay) {
    const state = this.pollers.get(streamId);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => this._poll(streamId), delay);
  }

  async _poll(streamId) {
    const state = this.pollers.get(streamId);
    if (!state) return;

    try {
      const result = await this._fetchManifest(streamId, state.baseUrl);
      state.content  = result.content;
      state.baseUrl  = result.srv;
      state.ts       = Date.now();
      state.errCount = 0;

      // Pre-fetch new segments seen in the manifest
      for (const line of result.content.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const segUrl = t.startsWith('http')
          ? t
          : `${result.srv}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;

        if (!state.knownSegs.has(segUrl)) {
          state.knownSegs.add(segUrl);
          if (state.knownSegs.size > 30) {
            state.knownSegs.delete(state.knownSegs.values().next().value);
          }
          this._prefetchSeg(segUrl).catch(() => {});
        }
      }
    } catch (e) {
      state.errCount = (state.errCount || 0) + 1;
      // Log every 5th error to avoid spam
      if (state.errCount % 5 === 1) {
        console.log(`[XtreamProxy] Poll error stream ${streamId}: ${e.message}`);
      }
    }

    this._schedulePoll(streamId, POLL_INTERVAL);
  }

  async _prefetchSeg(segUrl) {
    if (this.segCache.has(segUrl)) return;
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
  }

  _stopPoller(streamId) {
    const state = this.pollers.get(streamId);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    this.pollers.delete(streamId);
    console.log(`[XtreamProxy] Stopped poller: ${streamId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Low-level fetchers
  // ─────────────────────────────────────────────────────────────
  async _fetchManifest(streamId, preferredBase) {
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
        return { content, srv };
      } catch (e) {
        lastErr = new Error(`${e.message} (${srv})`);
      }
    }
    throw lastErr || new Error('All servers unreachable');
  }

  async _fetchSegment(cacheKey, candidates) {
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

  _rewriteManifest(content, streamId, baseUrl, proxyBase) {
    return content.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const abs = t.startsWith('http') ? t : `${baseUrl}/live/${XTREAM.user}/${XTREAM.pass}/${t}`;
      const enc = encodeURIComponent(abs);
      return (t.endsWith('.m3u8') || t.includes('.m3u8?'))
        ? `${proxyBase}/proxy/live/${streamId}/sub/${enc}`
        : `${proxyBase}/proxy/live/${streamId}/seg/${enc}`;
    }).join('\n');
  }

  _rewriteSubManifest(content, streamId, baseUrl, proxyBase) {
    return content.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      const abs = t.startsWith('http') ? t : `${baseUrl}${t}`;
      const enc = encodeURIComponent(abs);
      return `${proxyBase}/proxy/live/${streamId}/seg/${enc}`;
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

    // Stop pollers for streams with no viewers for > KEEP_WARM
    for (const [id, state] of this.pollers) {
      if (now - state.lastViewer > KEEP_WARM) {
        this._stopPoller(id);
      }
    }

    const segs    = this.segCache.size;
    const viewers = this.getTotalViewers();
    const active  = this.pollers.size;
    if (viewers > 0 || active > 0) {
      console.log(`[XtreamProxy] Viewers: ${viewers} | Active streams: ${active} | Cached segs: ${segs}`);
    }
  }
}

module.exports = new XtreamProxy();
