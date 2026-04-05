/**
 * Xtream HLS Transparent Proxy — Simple, fast, per-user
 *
 * How it works:
 * - User requests manifest → proxy fetches from IPTV → rewrites URLs → returns
 * - User requests segment  → proxy fetches from IPTV → pipes back directly
 * - No caching, no polling, no re-broadcasting, no complexity
 * - Each request = direct pass-through to IPTV provider
 * - Session tracking for viewer stats + auto-cleanup when idle
 * - Handles IPTV 302 redirects (session tokens) transparently
 */

const { XTREAM } = require('./xtream');

const UA            = 'VLC/3.0.20 LibVLC/3.0.20';
const FETCH_TIMEOUT = 10000;  // 10s — upstream request timeout
const SESSION_TTL   = 60000;  // 60s — viewer session idle timeout
const GC_INTERVAL   = 15000;  // 15s — session cleanup cycle

const SERVERS = [XTREAM.primary, XTREAM.backup];

class XtreamProxy {
  constructor() {
    this.sessions = new Map(); // streamId → Map<sessionId, lastSeen>
    this._gcTimer = null;
  }

  start() {
    this._gcTimer = setInterval(() => this._gc(), GC_INTERVAL);
    console.log('[XtreamProxy] Ready — transparent proxy mode');
  }

  stop() {
    if (this._gcTimer) clearInterval(this._gcTimer);
    this.sessions.clear();
  }

  // ─── Manifest: fetch from IPTV → rewrite URLs → return ────
  async getManifest(streamId, baseUrl, sessionId) {
    this._touch(streamId, sessionId);

    const servers = [baseUrl, ...SERVERS.filter(s => s !== baseUrl)];
    let lastErr = null;

    for (const srv of servers) {
      const url = `${srv}/live/${XTREAM.user}/${XTREAM.pass}/${streamId}.m3u8`;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, 'Referer': `${srv}/` },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
        const content = await res.text();
        let actualBase = srv;
        try { if (res.url) actualBase = new URL(res.url).origin; } catch {}
        return this._rewriteManifest(content, streamId, actualBase);
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('All servers unreachable');
  }

  // ─── Segment: fetch from IPTV → return buffer ─────────────
  async getSegment(streamId, encodedPath, baseUrl, sessionId) {
    this._touch(streamId, sessionId);

    let decoded;
    try { decoded = decodeURIComponent(encodedPath); } catch { decoded = encodedPath; }

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

    let lastErr = null;
    for (const segUrl of candidates) {
      try {
        const res = await fetch(segUrl, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf, contentType: res.headers.get('content-type') || 'video/mp2t' };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Segment unavailable');
  }

  // ─── Sub-manifest: fetch from IPTV → rewrite → return ─────
  async getSubManifest(streamId, encodedUrl, sessionId) {
    this._touch(streamId, sessionId);

    let subUrl;
    try { subUrl = decodeURIComponent(encodedUrl); } catch { subUrl = encodedUrl; }

    const res = await fetch(subUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = await res.text();
    const base = subUrl.substring(0, subUrl.lastIndexOf('/') + 1);
    return this._rewriteSubManifest(content, streamId, base);
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

  _gc() {
    const now = Date.now();
    for (const [id, map] of this.sessions) {
      for (const [sid, t] of map) { if (now - t > SESSION_TTL) map.delete(sid); }
      if (map.size === 0) this.sessions.delete(id);
    }
    const viewers = this.getTotalViewers();
    if (viewers > 0) {
      console.log(`[XtreamProxy] Active viewers: ${viewers}`);
    }
  }
}

module.exports = new XtreamProxy();
