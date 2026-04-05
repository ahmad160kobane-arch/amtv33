/**
 * HLS Proxy — بث m3u8 عبر السيرفر بدون إعلانات
 * 
 * لماذا هذا مطلوب:
 * - روابط m3u8 من embed.su / vidlink.pro تحتاج headers محددة (Referer)
 * - بدون الـ headers → 403 Forbidden
 * - الحل: السيرفر يجلب الـ m3u8 + segments ويمررها للتطبيق
 * 
 * الآلية:
 * 1. التطبيق يطلب master.m3u8 من سيرفرنا
 * 2. السيرفر يجلبها من المصدر مع الـ headers الصحيحة
 * 3. السيرفر يعيد كتابة الروابط الداخلية لتمر عبر proxy
 * 4. كل segment يُجلب من المصدر ويُمرر للتطبيق
 * 
 * النتيجة: التطبيق يشاهد بدون إعلانات + بدون 403
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Keep-alive agents for connection reuse (high concurrency) ───
const _httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 40,
  maxFreeSockets: 15,
  timeout: 60000,
});
const _httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 40,
  maxFreeSockets: 15,
  timeout: 60000,
  rejectUnauthorized: false,
});

class HlsProxy {
  constructor() {
    this.sessions = new Map();
    this._cleanupInterval = null;
  }

  start() {
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    console.log('[HlsProxy] جاهز — بث HLS بدون إعلانات (keep-alive agents, maxSockets: 40)');
  }

  stop() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this.sessions.clear();
  }

  /**
   * createSession — إنشاء جلسة HLS proxy جديدة
   * @param {string} streamUrl - رابط m3u8 الأصلي
   * @param {string} referer - الـ Referer المطلوب
   * @param {Array} subtitles - قائمة الترجمات
   * @returns {string} sessionId
   */
  createSession(streamUrl, referer, subtitles = []) {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const baseUrl = this._getBaseUrl(streamUrl);

    this.sessions.set(sessionId, {
      streamUrl,
      referer,
      baseUrl,
      subtitles,
      lastAccess: Date.now(),
    });

    console.log(`[HlsProxy] جلسة جديدة: ${sessionId} — ${streamUrl.substring(0, 80)}...`);
    return sessionId;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) session.lastAccess = Date.now();
    return session;
  }

  /**
   * proxyPlaylist — جلب m3u8 وإعادة كتابة الروابط
   */
  async proxyPlaylist(sessionId, subPath, req, res) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'جلسة غير موجودة' });
    }
    session.lastAccess = Date.now();

    // بناء الرابط الكامل
    let targetUrl;
    if (subPath && subPath !== 'master.m3u8') {
      targetUrl = this._resolveUrl(session.baseUrl, subPath);
    } else {
      targetUrl = session.streamUrl;
    }

    try {
      const content = await this._fetch(targetUrl, session.referer);
      const contentStr = content.toString('utf8');

      // إعادة كتابة الروابط في m3u8
      const rewritten = this._rewritePlaylist(contentStr, sessionId, targetUrl);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(rewritten);
    } catch (e) {
      console.error(`[HlsProxy] خطأ playlist: ${e.message}`);
      if (!res.headersSent) res.status(502).json({ error: 'فشل جلب الـ playlist' });
    }
  }

  /**
   * proxySegment — جلب segment (.ts / .m4s) ومرره للمشغل
   */
  async proxySegment(sessionId, segmentPath, req, res) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'جلسة غير موجودة' });
    }
    session.lastAccess = Date.now();

    const targetUrl = this._resolveUrl(session.baseUrl, segmentPath);

    try {
      const sourceRes = await this._fetchStream(targetUrl, session.referer);

      // نسخ headers المهمة
      const ct = sourceRes.headers['content-type'];
      if (ct) res.setHeader('Content-Type', ct);
      const cl = sourceRes.headers['content-length'];
      if (cl) res.setHeader('Content-Length', cl);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      sourceRes.pipe(res);
      sourceRes.on('error', () => { try { res.end(); } catch {} });
      req.on('close', () => { sourceRes.destroy(); });
    } catch (e) {
      console.error(`[HlsProxy] خطأ segment: ${e.message}`);
      if (!res.headersSent) res.status(502).json({ error: 'فشل جلب الـ segment' });
    }
  }

  /**
   * proxySubtitle — جلب ملف ترجمة ومرره
   */
  async proxySubtitle(sessionId, subtitleIndex, req, res) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'جلسة غير موجودة' });
    }

    const sub = session.subtitles[subtitleIndex];
    if (!sub) {
      return res.status(404).json({ error: 'ترجمة غير موجودة' });
    }

    try {
      const content = await this._fetch(sub.url, session.referer);
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(content);
    } catch (e) {
      if (!res.headersSent) res.status(502).json({ error: 'فشل جلب الترجمة' });
    }
  }

  // ─── إعادة كتابة روابط m3u8 ─────────────────────────
  _rewritePlaylist(content, sessionId, sourceUrl) {
    const sourceBase = this._getBaseUrl(sourceUrl);
    const lines = content.split('\n');
    const rewritten = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || line.startsWith('#')) {
        // أعد كتابة URI داخل tags مثل #EXT-X-MAP:URI="..."
        if (line.includes('URI="')) {
          const replaced = line.replace(/URI="([^"]+)"/, (match, uri) => {
            const fullUrl = this._resolveUrl(sourceBase, uri);
            const encodedPath = encodeURIComponent(fullUrl);
            return `URI="/free-hls/${sessionId}/seg/${encodedPath}"`;
          });
          rewritten.push(replaced);
        } else {
          rewritten.push(line);
        }
        continue;
      }

      // رابط عادي (playlist أو segment)
      const fullUrl = this._resolveUrl(sourceBase, line);
      if (line.endsWith('.m3u8') || line.includes('.m3u8?')) {
        // رابط playlist فرعي
        const encodedPath = encodeURIComponent(fullUrl);
        rewritten.push(`/free-hls/${sessionId}/playlist/${encodedPath}`);
      } else {
        // رابط segment
        const encodedPath = encodeURIComponent(fullUrl);
        rewritten.push(`/free-hls/${sessionId}/seg/${encodedPath}`);
      }
    }

    return rewritten.join('\n');
  }

  // ─── أدوات مساعدة ─────────────────────────────────────

  _getBaseUrl(url) {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      pathParts.pop(); // أزل اسم الملف
      parsed.pathname = pathParts.join('/') + '/';
      return parsed.toString();
    } catch {
      return url;
    }
  }

  _resolveUrl(base, relative) {
    if (relative.startsWith('http://') || relative.startsWith('https://')) {
      return relative;
    }
    try {
      return new URL(relative, base).toString();
    } catch {
      return base + relative;
    }
  }

  _fetch(url, referer) {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const mod = isHttps ? https : http;

      const req = mod.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': referer || '',
          'Origin': referer ? new URL(referer).origin : '',
          'Accept': '*/*',
        },
        agent: isHttps ? _httpsAgent : _httpAgent,
        timeout: 15000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          this._fetch(res.headers.location, referer).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  _fetchStream(url, referer) {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const mod = isHttps ? https : http;

      const req = mod.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': referer || '',
          'Origin': referer ? new URL(referer).origin : '',
          'Accept': '*/*',
        },
        agent: isHttps ? _httpsAgent : _httpAgent,
        timeout: 30000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          this._fetchStream(res.headers.location, referer).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        resolve(res);
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  _cleanup() {
    const now = Date.now();
    const IDLE = 30 * 60 * 1000; // 30 دقيقة
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccess > IDLE) {
        console.log(`[HlsProxy] حذف جلسة: ${id} (خمول)`);
        this.sessions.delete(id);
      }
    }
  }
}

module.exports = HlsProxy;
