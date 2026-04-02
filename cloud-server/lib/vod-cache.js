/**
 * VOD Cache — تحميل وتخزين مؤقت للأفلام والمسلسلات
 * 
 * النظام:
 * 1. المستخدم يطلب فيلم/حلقة
 * 2. السيرفر يحمّل الملف من IPTV إلى مجلد cache محلي
 * 3. يخدم الملف عبر HTTP مع Range support (seekbar + مدة كاملة)
 * 4. عدة مشاهدين يقرأون نفس الملف — اتصال واحد فقط بـ IPTV
 * 5. الملفات تُحذف بعد فترة خمول
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const CACHE_DIR = path.join(__dirname, '..', 'vod-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

class VodCache {
  constructor() {
    // id → { filePath, sourceUrl, name, contentLength, downloadedBytes, downloading, request, lastAccess, viewers }
    this.files = new Map();
    this._cleanupInterval = null;
  }

  start() {
    // تنظيف كل 5 دقائق
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    console.log('[VodCache] جاهز — مجلد:', CACHE_DIR);
  }

  stop() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    // أوقف كل التحميلات
    for (const [id, info] of this.files) {
      if (info.request) { try { info.request.destroy(); } catch {} }
    }
    // حذف ملفات الـ cache
    try { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); } catch {}
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('[VodCache] توقف');
  }

  /**
   * requestVod — طلب فيلم/حلقة
   * إذا الملف محمّل بالفعل → يرجعه مباشرة
   * إذا لا → يبدأ التحميل ويرجع حالة التحميل
   */
  requestVod(id, sourceUrl, name, ext = 'mp4') {
    if (this.files.has(id)) {
      const info = this.files.get(id);
      info.viewers++;
      info.lastAccess = Date.now();
      return {
        success: true,
        fileUrl: `/vod/cache/${id}.${ext}`,
        ready: info.downloadedBytes > 500000, // جاهز بعد 500KB
        downloading: info.downloading,
        progress: info.contentLength > 0 ? Math.round((info.downloadedBytes / info.contentLength) * 100) : 0,
        contentLength: info.contentLength,
      };
    }

    // بدء التحميل
    const filePath = path.join(CACHE_DIR, `${id}.${ext}`);
    const info = {
      filePath,
      sourceUrl,
      name,
      ext,
      contentLength: 0,
      downloadedBytes: 0,
      downloading: true,
      request: null,
      lastAccess: Date.now(),
      viewers: 1,
    };
    this.files.set(id, info);
    this._downloadFile(id, info);

    return {
      success: true,
      fileUrl: `/vod/cache/${id}.${ext}`,
      ready: false,
      downloading: true,
      progress: 0,
      contentLength: 0,
    };
  }

  /**
   * releaseVod — مشاهد أنهى المشاهدة
   */
  releaseVod(id) {
    const info = this.files.get(id);
    if (!info) return;
    info.viewers = Math.max(0, info.viewers - 1);
    info.lastAccess = Date.now();
  }

  /**
   * getFileInfo — معلومات الملف للخدمة
   */
  getFileInfo(id) {
    const info = this.files.get(id);
    if (!info) return null;
    info.lastAccess = Date.now();
    return {
      filePath: info.filePath,
      contentLength: info.contentLength,
      downloadedBytes: info.downloadedBytes,
      downloading: info.downloading,
      exists: fs.existsSync(info.filePath),
    };
  }

  /**
   * isReady — هل الملف جاهز للتشغيل؟
   */
  isReady(id) {
    const info = this.files.get(id);
    if (!info) return false;
    return info.downloadedBytes > 500000; // 500KB كافية لبدء التشغيل
  }

  // ═══════════════════════════════════════════════════════
  // تحميل الملف من IPTV
  // ═══════════════════════════════════════════════════════
  _downloadFile(id, info) {
    const isHttps = info.sourceUrl.startsWith('https');
    const httpModule = isHttps ? https : http;

    console.log(`[VodCache] ⬇ تحميل: ${info.name}`);
    console.log(`[VodCache]   ${info.sourceUrl.substring(0, 80)}...`);

    const fileStream = fs.createWriteStream(info.filePath);

    const doRequest = (url, redirectCount = 0) => {
      if (redirectCount > 5) {
        console.error(`[VodCache] ${info.name}: too many redirects`);
        info.downloading = false;
        fileStream.end();
        return;
      }

      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
      }, (res) => {
        // تتبع redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`[VodCache] ${info.name}: ${res.statusCode} → redirect`);
          res.resume();
          doRequest(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          console.error(`[VodCache] ${info.name}: HTTP ${res.statusCode}`);
          info.downloading = false;
          fileStream.end();
          return;
        }

        const contentLength = parseInt(res.headers['content-length']) || 0;
        info.contentLength = contentLength;
        info.request = req;

        const sizeMB = contentLength > 0 ? (contentLength / 1024 / 1024).toFixed(0) : '?';
        console.log(`[VodCache] ${info.name}: HTTP 200 — ${sizeMB}MB — بدء التحميل`);

        res.on('data', (chunk) => {
          info.downloadedBytes += chunk.length;
        });

        res.pipe(fileStream);

        res.on('end', () => {
          info.downloading = false;
          info.request = null;
          const finalMB = (info.downloadedBytes / 1024 / 1024).toFixed(1);
          console.log(`[VodCache] ✅ ${info.name}: اكتمل التحميل (${finalMB}MB)`);
        });

        res.on('error', (e) => {
          console.error(`[VodCache] ${info.name} download error:`, e.message);
          info.downloading = false;
          info.request = null;
        });
      });

      req.on('error', (e) => {
        console.error(`[VodCache] ${info.name} HTTP error:`, e.message);
        info.downloading = false;
        fileStream.end();
      });

      req.setTimeout(30000, () => {
        console.error(`[VodCache] ${info.name}: timeout`);
        req.destroy();
      });
    };

    doRequest(info.sourceUrl);
  }

  // ═══════════════════════════════════════════════════════
  // تنظيف الملفات القديمة (بعد 30 دقيقة خمول)
  // ═══════════════════════════════════════════════════════
  _cleanup() {
    const now = Date.now();
    const IDLE_MS = 30 * 60 * 1000; // 30 دقيقة

    for (const [id, info] of this.files) {
      if (info.viewers > 0) continue;
      if (now - info.lastAccess > IDLE_MS) {
        console.log(`[VodCache] 🗑 حذف: ${info.name} (خمول)`);
        if (info.request) { try { info.request.destroy(); } catch {} }
        try { fs.unlinkSync(info.filePath); } catch {}
        this.files.delete(id);
      }
    }
  }

  getActiveFiles() {
    const result = [];
    for (const [id, info] of this.files) {
      result.push({
        id, name: info.name, viewers: info.viewers,
        progress: info.contentLength > 0 ? Math.round((info.downloadedBytes / info.contentLength) * 100) : 0,
        sizeMB: (info.downloadedBytes / 1024 / 1024).toFixed(1),
        downloading: info.downloading,
      });
    }
    return result;
  }
}

module.exports = VodCache;
