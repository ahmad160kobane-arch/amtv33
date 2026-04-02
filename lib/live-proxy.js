/**
 * Live Proxy v1 — بث مباشر احترافي بدون FFmpeg
 *
 * النظام:
 * 1. يتصل بمصدر IPTV مباشرة (TS أو m3u8)
 * 2. يبث المحتوى مباشرة للتطبيق عبر HTTP pipe
 * 3. إعادة اتصال تلقائية عند انقطاع المصدر
 * 4. بدون FFmpeg = صفر CPU + صفر تأخير
 *
 * المزايا عن FFmpeg:
 * - بث فوري (لا انتظار لـ segments)
 * - لا استخدام CPU (pipe مباشر)
 * - لا ملفات مؤقتة (بدون HLS segments على القرص)
 * - أكثر استقراراً (أقل نقاط فشل)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const RECONNECT_DELAY = 2000;
const MAX_RECONNECTS = 10;
const CONNECT_TIMEOUT = 12000;

class LiveProxy {
  constructor() {
    // channelId → { sourceUrl, clients: Set<res>, upstream: IncomingMessage, reconnects }
    this.channels = new Map();
    this._cleanupInterval = null;
  }

  start() {
    this._cleanupInterval = setInterval(() => this._cleanup(), 30000);
    console.log('[LiveProxy] جاهز — بث مباشر بدون FFmpeg (pipe مباشر)');
  }

  stop() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    for (const [id] of this.channels) {
      this._destroyChannel(id);
    }
    console.log('[LiveProxy] توقف');
  }

  /**
   * تتبع redirects للحصول على الرابط المباشر
   */
  async _resolveUrl(url, maxRedirects = 5) {
    let currentUrl = url;
    for (let i = 0; i < maxRedirects; i++) {
      try {
        const resp = await fetch(currentUrl, {
          redirect: 'manual',
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(8000),
        });
        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (location) { currentUrl = location; continue; }
        }
        return currentUrl;
      } catch {
        return currentUrl;
      }
    }
    return currentUrl;
  }

  /**
   * streamToClient — بث مباشر لعميل
   * يتصل بالمصدر ويبث مباشرة عبر HTTP pipe
   */
  async streamToClient(channelId, sourceUrl, req, res) {
    // حل redirects
    const resolvedUrl = await this._resolveUrl(sourceUrl);

    // تحويل m3u8 → ts لمصادر IPTV الحية
    let streamUrl = resolvedUrl;
    if (streamUrl.includes('/live/') && streamUrl.endsWith('.m3u8')) {
      streamUrl = streamUrl.slice(0, -5) + '.ts';
    }

    // إعداد headers الاستجابة
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });

    let reconnects = 0;
    let destroyed = false;
    let upstream = null;
    let reconnectTimer = null;

    const cleanup = () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (upstream) { try { upstream.destroy(); } catch {} }
      console.log(`[LiveProxy] ✗ ${channelId} — عميل قطع الاتصال`);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    const connect = () => {
      if (destroyed) return;

      const parsed = new URL(streamUrl);
      const mod = parsed.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout: CONNECT_TIMEOUT,
        headers: {
          'User-Agent': UA,
          'Accept': '*/*',
          'Connection': 'keep-alive',
        },
      };

      const request = mod.request(options, (response) => {
        if (destroyed) { response.destroy(); return; }

        // redirect
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          streamUrl = response.headers.location;
          response.destroy();
          console.log(`[LiveProxy] ${channelId} redirect → ${streamUrl.substring(0, 60)}`);
          connect();
          return;
        }

        if (response.statusCode !== 200) {
          response.destroy();
          console.log(`[LiveProxy] ${channelId} HTTP ${response.statusCode}`);
          scheduleReconnect();
          return;
        }

        upstream = response;
        reconnects = 0;
        console.log(`[LiveProxy] ✓ ${channelId} — متصل (pipe مباشر)`);

        response.on('data', (chunk) => {
          if (destroyed) return;
          try {
            const ok = res.write(chunk);
            if (!ok) {
              // backpressure — انتظر drain
              response.pause();
              res.once('drain', () => { if (!destroyed) response.resume(); });
            }
          } catch {
            cleanup();
          }
        });

        response.on('end', () => {
          if (!destroyed) {
            console.log(`[LiveProxy] ${channelId} — المصدر أنهى البث`);
            scheduleReconnect();
          }
        });

        response.on('error', (err) => {
          if (!destroyed) {
            console.log(`[LiveProxy] ${channelId} — خطأ مصدر: ${err.message}`);
            scheduleReconnect();
          }
        });
      });

      request.on('timeout', () => {
        request.destroy();
        if (!destroyed) {
          console.log(`[LiveProxy] ${channelId} — timeout`);
          scheduleReconnect();
        }
      });

      request.on('error', (err) => {
        if (!destroyed) {
          console.log(`[LiveProxy] ${channelId} — خطأ اتصال: ${err.message}`);
          scheduleReconnect();
        }
      });

      request.end();
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      reconnects++;
      if (reconnects > MAX_RECONNECTS) {
        console.log(`[LiveProxy] ${channelId} — تجاوز حد إعادة الاتصال (${MAX_RECONNECTS})`);
        try { res.end(); } catch {}
        return;
      }
      const delay = RECONNECT_DELAY + (reconnects - 1) * 1000;
      console.log(`[LiveProxy] ${channelId} — إعادة اتصال ${reconnects}/${MAX_RECONNECTS} بعد ${delay}ms`);
      reconnectTimer = setTimeout(connect, delay);
    };

    // بدء الاتصال
    connect();
  }

  _destroyChannel(channelId) {
    const ch = this.channels.get(channelId);
    if (!ch) return;
    if (ch.upstream) { try { ch.upstream.destroy(); } catch {} }
    this.channels.delete(channelId);
  }

  _cleanup() {
    // تنظيف القنوات المنتهية (بدون عملاء)
    for (const [id, ch] of this.channels) {
      if (!ch.clients || ch.clients.size === 0) {
        this._destroyChannel(id);
      }
    }
  }
}

module.exports = LiveProxy;
