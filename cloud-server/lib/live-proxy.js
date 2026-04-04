/**
 * Live Proxy v2 — بث مباشر مشترك (Broadcast)
 *
 * النظام:
 * 1. اتصال واحد بالمصدر لكل قناة (upstream)
 * 2. بث البيانات لجميع المشاهدين المتصلين (broadcast / fan-out)
 * 3. إعادة اتصال تلقائية عند انقطاع المصدر
 * 4. بدون FFmpeg = صفر CPU + صفر تأخير
 *
 * يحل مشكلة: اشتراك IPTV بعدد اتصالات محدود
 * اتصال واحد بالمصدر → عدد لا محدود من المشاهدين
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const UA = 'VLC/3.0.20 LibVLC/3.0.20';
const RECONNECT_DELAY = 2000;
const MAX_RECONNECTS = 10;
const CONNECT_TIMEOUT = 12000;
const IDLE_DESTROY_DELAY = 8000; // تأخير قبل إغلاق القناة بدون مشاهدين

class LiveProxy {
  constructor() {
    // channelId → { sourceUrl, streamUrl, clients: Set<res>, upstream, request, reconnects, destroyed, reconnectTimer, idleTimer }
    this.channels = new Map();
    this._cleanupInterval = null;
  }

  start() {
    this._cleanupInterval = setInterval(() => this._cleanup(), 30000);
    console.log('[LiveProxy] v2 جاهز — بث مشترك (broadcast) بدون FFmpeg');
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
   * streamToClient — بث مباشر لعميل (broadcast)
   * إذا القناة تبث بالفعل — ينضم المشاهد للبث المشترك
   * إذا القناة جديدة — يفتح اتصال بالمصدر ويبدأ البث
   */
  async streamToClient(channelId, sourceUrl, req, res) {
    // إعداد headers الاستجابة
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });

    // إذا القناة تبث بالفعل — انضم للبث المشترك
    if (this.channels.has(channelId)) {
      const ch = this.channels.get(channelId);
      ch.clients.add(res);
      if (ch.idleTimer) { clearTimeout(ch.idleTimer); ch.idleTimer = null; }
      console.log(`[LiveProxy] +مشاهد ${channelId} (${ch.clients.size} متصل)`);

      const removeClient = () => {
        ch.clients.delete(res);
        console.log(`[LiveProxy] -مشاهد ${channelId} (${ch.clients.size} متصل)`);
        if (ch.clients.size === 0) {
          this._scheduleIdleDestroy(channelId);
        }
      };
      req.on('close', removeClient);
      res.on('close', removeClient);
      res.on('error', removeClient);
      return;
    }

    // قناة جديدة — إنشاء بث مشترك
    let streamUrl = sourceUrl;
    if (streamUrl.includes('/live/') && streamUrl.endsWith('.m3u8')) {
      streamUrl = streamUrl.slice(0, -5) + '.ts';
    }
    streamUrl = await this._resolveUrl(streamUrl);

    const ch = {
      sourceUrl,
      streamUrl,
      clients: new Set([res]),
      upstream: null,
      request: null,
      reconnects: 0,
      destroyed: false,
      reconnectTimer: null,
      idleTimer: null,
    };
    this.channels.set(channelId, ch);

    const removeClient = () => {
      ch.clients.delete(res);
      console.log(`[LiveProxy] -مشاهد ${channelId} (${ch.clients.size} متصل)`);
      if (ch.clients.size === 0) {
        this._scheduleIdleDestroy(channelId);
      }
    };
    req.on('close', removeClient);
    res.on('close', removeClient);
    res.on('error', removeClient);

    // بدء الاتصال بالمصدر
    this._connectUpstream(channelId);
  }

  /**
   * _connectUpstream — اتصال بمصدر IPTV وبث لجميع العملاء
   */
  _connectUpstream(channelId) {
    const ch = this.channels.get(channelId);
    if (!ch || ch.destroyed) return;

    const parsed = new URL(ch.streamUrl);
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
      if (ch.destroyed) { response.destroy(); return; }

      // redirect
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        ch.streamUrl = response.headers.location;
        response.destroy();
        console.log(`[LiveProxy] ${channelId} redirect → ${ch.streamUrl.substring(0, 60)}`);
        this._connectUpstream(channelId);
        return;
      }

      if (response.statusCode !== 200) {
        response.destroy();
        console.log(`[LiveProxy] ${channelId} HTTP ${response.statusCode}`);
        this._scheduleReconnect(channelId);
        return;
      }

      ch.upstream = response;
      ch.reconnects = 0;
      console.log(`[LiveProxy] ✓ ${channelId} — متصل (broadcast → ${ch.clients.size} مشاهد)`);

      // ═══ البث المشترك: كل chunk يُرسل لجميع العملاء ═══
      response.on('data', (chunk) => {
        if (ch.destroyed) return;
        const dead = [];
        for (const client of ch.clients) {
          try {
            if (!client.writableEnded && !client.destroyed) {
              client.write(chunk);
            } else {
              dead.push(client);
            }
          } catch {
            dead.push(client);
          }
        }
        // تنظيف العملاء المنفصلين
        for (const d of dead) ch.clients.delete(d);
        if (ch.clients.size === 0) {
          this._scheduleIdleDestroy(channelId);
        }
      });

      response.on('end', () => {
        if (!ch.destroyed) {
          console.log(`[LiveProxy] ${channelId} — المصدر أنهى البث`);
          this._scheduleReconnect(channelId);
        }
      });

      response.on('error', (err) => {
        if (!ch.destroyed) {
          console.log(`[LiveProxy] ${channelId} — خطأ مصدر: ${err.message}`);
          this._scheduleReconnect(channelId);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy();
      if (!ch.destroyed) {
        console.log(`[LiveProxy] ${channelId} — timeout`);
        this._scheduleReconnect(channelId);
      }
    });

    request.on('error', (err) => {
      if (!ch.destroyed) {
        console.log(`[LiveProxy] ${channelId} — خطأ اتصال: ${err.message}`);
        this._scheduleReconnect(channelId);
      }
    });

    ch.request = request;
    request.end();
  }

  _scheduleReconnect(channelId) {
    const ch = this.channels.get(channelId);
    if (!ch || ch.destroyed) return;
    if (ch.clients.size === 0) {
      this._destroyChannel(channelId);
      return;
    }
    ch.reconnects++;
    if (ch.reconnects > MAX_RECONNECTS) {
      console.log(`[LiveProxy] ${channelId} — تجاوز حد إعادة الاتصال (${MAX_RECONNECTS})`);
      // أغلق جميع العملاء
      for (const client of ch.clients) {
        try { client.end(); } catch {}
      }
      this._destroyChannel(channelId);
      return;
    }
    const delay = RECONNECT_DELAY + (ch.reconnects - 1) * 1000;
    console.log(`[LiveProxy] ${channelId} — إعادة اتصال ${ch.reconnects}/${MAX_RECONNECTS} بعد ${delay}ms (${ch.clients.size} مشاهد ينتظر)`);
    ch.reconnectTimer = setTimeout(() => this._connectUpstream(channelId), delay);
  }

  _scheduleIdleDestroy(channelId) {
    const ch = this.channels.get(channelId);
    if (!ch) return;
    if (ch.idleTimer) clearTimeout(ch.idleTimer);
    ch.idleTimer = setTimeout(() => {
      const current = this.channels.get(channelId);
      if (current && current.clients.size === 0) {
        console.log(`[LiveProxy] ${channelId} — إغلاق (لا مشاهدين)`);
        this._destroyChannel(channelId);
      }
    }, IDLE_DESTROY_DELAY);
  }

  _destroyChannel(channelId) {
    const ch = this.channels.get(channelId);
    if (!ch) return;
    ch.destroyed = true;
    if (ch.reconnectTimer) clearTimeout(ch.reconnectTimer);
    if (ch.idleTimer) clearTimeout(ch.idleTimer);
    if (ch.upstream) { try { ch.upstream.destroy(); } catch {} }
    if (ch.request) { try { ch.request.destroy(); } catch {} }
    this.channels.delete(channelId);
  }

  _cleanup() {
    for (const [id, ch] of this.channels) {
      if (ch.clients.size === 0 && !ch.idleTimer) {
        this._destroyChannel(id);
      }
    }
  }

  // ═══ إحصائيات ═══
  getStats() {
    const stats = [];
    for (const [id, ch] of this.channels) {
      stats.push({ channelId: id, viewers: ch.clients.size, reconnects: ch.reconnects });
    }
    return stats;
  }

  getTotalViewers() {
    let total = 0;
    for (const [, ch] of this.channels) total += ch.clients.size;
    return total;
  }
}

module.exports = LiveProxy;
