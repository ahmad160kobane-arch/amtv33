/**
 * VOD Proxy v3 — بث تدريجي مثل YouTube مع تخزين مؤقت على السيرفر
 * 
 * النظام:
 * 1. المستخدم يطلب فيلم/حلقة
 * 2. السيرفر يجلب معلومات الملف (الحجم، المدة) من IPTV
 * 3. يبدأ تحميل الملف في الخلفية إلى ملف مؤقت على القرص
 * 4. الـ proxy يقدّم البيانات من الملف المحلي (فوري) أو من المصدر
 * 5. التقديم/الرجوع في البيانات المحملة = فوري (من القرص)
 * 6. الملف المؤقت يُمسح عند إنهاء المشاهدة
 * 
 * مثل YouTube: البيانات تُحمّل باستمرار وتُخزّن — seeking فيها فوري
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const config = require('../config');

// مجلد التخزين المؤقت
const CACHE_DIR = path.join(config.HLS_DIR, '_vod_cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── HTTP Agents مع keep-alive — إعادة استخدام اتصالات TCP ───
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 120000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 120000,
  rejectUnauthorized: false,
});

// حجم buffer الـ pipe — 2MB لبث سلس بدون تقطيع
const PIPE_HIGH_WATER_MARK = 2 * 1024 * 1024;

class VodProxy {
  constructor() {
    this.sessions = new Map();
    this._cleanupInterval = null;
  }

  start() {
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    console.log('[VodProxy] جاهز — بث مباشر بدون تحميل (keep-alive + large buffers)');
  }

  stop() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    // مسح جميع ملفات الكاش عند الإيقاف
    for (const [id] of this.sessions) {
      this._deleteCache(id);
    }
    this.sessions.clear();
    // مسح مجلد الكاش بالكامل
    try { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); } catch {}
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
    httpAgent.destroy();
    httpsAgent.destroy();
    console.log('[VodProxy] توقف — ملفات الكاش مُسحت');
  }

  /**
   * initSession — تهيئة جلسة بث جديدة
   * يجلب معلومات الملف (الحجم، نوع المحتوى، دعم Range) بدون تحميل
   * ثم يجلب المدة عبر ffprobe بشكل غير متزامن
   */
  async initSession(id, sourceUrl, name, ext = 'mp4') {
    // إذا الجلسة موجودة → أرجعها
    if (this.sessions.has(id)) {
      const session = this.sessions.get(id);
      session.viewers++;
      session.lastAccess = Date.now();
      return {
        success: true,
        proxyUrl: `/vod/proxy/${id}.${session.ext}`,
        ready: true,
        duration: session.duration,
        contentLength: session.contentLength,
        acceptRanges: session.acceptRanges,
      };
    }

    // حل Redirects للحصول على الرابط المباشر
    const resolvedUrl = await this._resolveUrl(sourceUrl);

    // جلب معلومات الملف عبر HEAD request
    const meta = await this._probeHead(resolvedUrl);

    const session = {
      sourceUrl,
      resolvedUrl,
      name,
      ext,
      contentLength: meta.contentLength,
      contentType: meta.contentType || this._getMimeType(ext),
      acceptRanges: meta.acceptRanges,
      duration: 0,
      lastAccess: Date.now(),
      viewers: 1,
      probing: true,
      resolvedAt: Date.now(),
    };

    // ═══ ملف التخزين المؤقت — يمتلئ أثناء المشاهدة (tee) ═══
    const cachePath = path.join(CACHE_DIR, `${id}.cache`);
    session.cachePath = cachePath;
    session.cachedBytes = 0;
    session.cacheComplete = false;
    session.cacheStream = null;
    session._destroyed = false;

    this.sessions.set(id, session);

    // جلب معلومات الوسائط بشكل غير متزامن (المدة + الترجمة + الجودة)
    this._probeMedia(id, resolvedUrl).catch(() => {});

    // ═══ لا تحميل خلفية! الكاش يمتلئ أثناء المشاهدة ═══

    console.log(`[VodProxy] جلسة جديدة: ${name} — ${meta.contentLength > 0 ? (meta.contentLength / 1024 / 1024).toFixed(1) + 'MB' : '?'} — Range: ${meta.acceptRanges ? 'نعم' : 'لا'} — تخزين مؤقت: ${cachePath}`);

    return {
      success: true,
      proxyUrl: `/vod/proxy/${id}.${ext}`,
      ready: true,
      duration: 0,
      contentLength: meta.contentLength,
      acceptRanges: meta.acceptRanges,
    };
  }


  /**
   * getSession — جلب معلومات الجلسة
   */
  getSession(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.lastAccess = Date.now();
    return session;
  }

  /**
   * releaseSession — مشاهد أنهى المشاهدة
   */
  releaseSession(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    session.viewers = Math.max(0, session.viewers - 1);
    session.lastAccess = Date.now();

    // لا مشاهدين → امسح ملف الكاش بعد دقيقة (ربما يعود)
    if (session.viewers <= 0) {
      setTimeout(() => {
        const s = this.sessions.get(id);
        if (s && s.viewers <= 0) {
          this._deleteCache(id);
        }
      }, 60000);
    }
  }

  /**
   * _deleteCache — حذف ملف التخزين المؤقت + إيقاف التحميل
   */
  _deleteCache(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    session._destroyed = true;
    if (session.cacheStream) {
      try { session.cacheStream.end(); } catch {}
      session.cacheStream = null;
    }
    if (session.cachePath) {
      try { fs.unlinkSync(session.cachePath); } catch {}
    }
    session.cachedBytes = 0;
    session.cacheComplete = false;
    this.sessions.delete(id);
  }

  /**
   * proxyRequest — اتصال IPTV واحد فقط = أقصى سرعة!
   * 
   * ═══ القاعدة ═══
   * البيانات في الكاش → قراءة من القرص (فوري, 0 bandwidth)
   * البيانات مو في الكاش → proxy مباشر من IPTV + كتابة للكاش أثناء البث
   */
  proxyRequest(id, req, res) {
    const session = this.sessions.get(id);
    if (!session) {
      return res.status(404).json({ error: 'الجلسة غير موجودة' });
    }

    session.lastAccess = Date.now();

    const contentLength = session.contentLength;
    const contentType = session.contentType;
    const range = req.headers.range;

    let start = 0;
    let end = contentLength - 1;

    if (range && contentLength > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10) || 0;
      const hasEnd = parts[1] && parts[1].length > 0;
      end = hasEnd ? parseInt(parts[1], 10) : contentLength - 1;
    }

    // ═══ 1) البيانات في الكاش → قراءة فورية من القرص ═══
    if (start < session.cachedBytes && session.cachedBytes > 0 && fs.existsSync(session.cachePath)) {
      const cacheEnd = Math.min(end, session.cachedBytes - 1);
      const cacheChunk = cacheEnd - start + 1;
      this._serveFromCache(session, start, cacheEnd, cacheChunk, contentLength, contentType, res);
      return;
    }

    // ═══ 2) proxy مباشر من المصدر + كتابة للكاش إذا تتابعي ═══
    this._proxyAndTee(session, start, end, contentLength, contentType, req, res);
  }

  /**
   * _proxyAndTee — proxy مباشر + كتابة للكاش أثناء البث
   * 
   * اتصال IPTV واحد فقط → البيانات تروح للمشغل + تُكتب للكاش
   * لا bandwidth ضائعة — كل byte يروح للمشغل ويتخزن على القرص
   */
  _proxyAndTee(session, start, end, contentLength, contentType, req, res) {
    const rangeEnd = Math.min(end, contentLength - 1);
    const chunkSize = rangeEnd - start + 1;
    // هل البيانات تتابعية؟ (يمكن إضافتها للكاش)
    const canTeeToCache = (start <= session.cachedBytes);

    const doFetch = (url, retried) => {
      this._makeRequest(url, { start, end: rangeEnd }, (err, sourceRes) => {
        if (err) {
          if (!retried) {
            this._resolveUrl(session.sourceUrl).then((newUrl) => {
              session.resolvedUrl = newUrl;
              session.resolvedAt = Date.now();
              doFetch(newUrl, true);
            }).catch(() => {
              if (!res.headersSent) res.status(502).json({ error: 'فشل جلب البيانات' });
            });
            return;
          }
          if (!res.headersSent) res.status(502).json({ error: 'فشل جلب البيانات' });
          return;
        }

        if (!res.headersSent) {
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${rangeEnd}/${contentLength}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            'Cache-Control': 'no-store',
          });
        }

        // ═══ tee: إرسل للمشغل + اكتب للكاش ═══
        if (canTeeToCache && !session._destroyed) {
          // افتح ملف الكاش إذا مو مفتوح
          if (!session.cacheStream) {
            session.cacheStream = fs.createWriteStream(session.cachePath, { flags: 'a' });
            session.cacheStream.on('error', () => {});
          }

          sourceRes.on('data', (chunk) => {
            try { res.write(chunk); } catch {}
            if (!session._destroyed && session.cacheStream) {
              try { session.cacheStream.write(chunk); } catch {}
              session.cachedBytes += chunk.length;
            }
          });

          sourceRes.on('end', () => {
            try { res.end(); } catch {}
          });
        } else {
          // بدون كاش (طلب مو تتابعي — moov atom / seek بعيد)
          sourceRes.pipe(res);
        }

        sourceRes.on('error', () => { try { res.end(); } catch {} });
        req.on('close', () => { sourceRes.destroy(); });
        res.on('close', () => { sourceRes.destroy(); });
      });
    };

    doFetch(session.resolvedUrl, false);
  }

  /**
   * _serveFromCache — قراءة من الملف المحلي (فوري!)
   * لا اتصال IPTV — فقط قراءة من القرص
   */
  _serveFromCache(session, start, end, chunkSize, contentLength, contentType, res) {
    try {
      if (!res.headersSent) {
        if (start === 0 && end === contentLength - 1) {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': contentLength,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            'Cache-Control': 'public, max-age=3600',
          });
        } else {
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${contentLength}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            'Cache-Control': 'public, max-age=3600',
          });
        }
      }

      const fileStream = fs.createReadStream(session.cachePath, { start, end, highWaterMark: PIPE_HIGH_WATER_MARK });
      fileStream.pipe(res);
      fileStream.on('error', () => { try { res.end(); } catch {} });
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: 'خطأ قراءة الكاش' });
    }
  }

  // ═══════════════════════════════════════════════════════
  // HTTP Request الموحّد — مع Agent keep-alive + timeouts طويلة
  // ═══════════════════════════════════════════════════════
  _makeRequest(url, range, callback, redirectCount = 0) {
    if (redirectCount > 5) {
      callback(new Error('too many redirects'));
      return;
    }

    const isHttps = url.startsWith('https');
    const httpModule = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
      'Connection': 'keep-alive',
    };

    if (range) {
      headers['Range'] = `bytes=${range.start}-${range.end}`;
    }

    const req = httpModule.get(url, {
      headers,
      agent,
      timeout: 60000,
      highWaterMark: PIPE_HIGH_WATER_MARK,
    }, (res) => {
      // تتبع redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        this._makeRequest(res.headers.location, range, callback, redirectCount + 1);
        return;
      }

      if (range && res.statusCode !== 206 && res.statusCode !== 200) {
        res.resume();
        callback(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      if (!range && res.statusCode !== 200) {
        res.resume();
        callback(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      callback(null, res);
    });

    req.on('error', (e) => callback(e));

    // timeout طويل للبث — 60 ثانية بدون بيانات
    req.on('timeout', () => {
      req.destroy();
      callback(new Error('timeout'));
    });
  }

  // ═══════════════════════════════════════════════════════
  // حل Redirects
  // ═══════════════════════════════════════════════════════
  async _resolveUrl(url, maxRedirects = 5) {
    let currentUrl = url;
    for (let i = 0; i < maxRedirects; i++) {
      try {
        const resp = await fetch(currentUrl, {
          method: 'HEAD',
          redirect: 'manual',
          headers: { 'User-Agent': USER_AGENT },
        });
        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (location) {
            currentUrl = location;
            console.log(`[VodProxy] Redirect ${resp.status} → ${currentUrl.substring(0, 80)}...`);
            continue;
          }
        }
        return currentUrl;
      } catch (e) {
        // إذا HEAD فشل، جرّب GET مع manual redirect
        try {
          const resp = await fetch(currentUrl, {
            redirect: 'manual',
            headers: { 'User-Agent': USER_AGENT },
          });
          if (resp.status >= 300 && resp.status < 400) {
            const location = resp.headers.get('location');
            if (location) {
              resp.body?.cancel?.();
              currentUrl = location;
              continue;
            }
          }
          resp.body?.cancel?.();
          return currentUrl;
        } catch {
          return currentUrl;
        }
      }
    }
    return currentUrl;
  }

  // ═══════════════════════════════════════════════════════
  // HEAD Request — جلب معلومات الملف بدون تحميل
  // ═══════════════════════════════════════════════════════
  async _probeHead(url) {
    return new Promise((resolve) => {
      const isHttps = url.startsWith('https');
      const httpModule = isHttps ? https : http;
      const agent = isHttps ? httpsAgent : httpAgent;

      const req = httpModule.request(url, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        agent,
        timeout: 15000,
      }, (res) => {
        // تتبع redirect إضافي
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(this._probeHead(res.headers.location));
          return;
        }

        const contentLength = parseInt(res.headers['content-length']) || 0;
        const contentType = res.headers['content-type'] || '';
        const acceptRanges = (res.headers['accept-ranges'] || '').toLowerCase() === 'bytes';

        res.resume();
        resolve({ contentLength, contentType, acceptRanges });
      });

      req.on('error', (e) => {
        console.error(`[VodProxy] HEAD error:`, e.message);
        // Fallback: جرّب Range request صغير لاختبار الدعم
        this._probeWithRange(url).then(resolve).catch(() => {
          resolve({ contentLength: 0, contentType: '', acceptRanges: false });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ contentLength: 0, contentType: '', acceptRanges: false });
      });

      req.end();
    });
  }

  /**
   * Fallback: إذا HEAD غير مدعوم، نجرب Range request صغير
   */
  async _probeWithRange(url) {
    return new Promise((resolve) => {
      const isHttps = url.startsWith('https');
      const httpModule = isHttps ? https : http;
      const agent = isHttps ? httpsAgent : httpAgent;

      const req = httpModule.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Range': 'bytes=0-1',
        },
        agent,
        timeout: 15000,
      }, (res) => {
        const contentRange = res.headers['content-range'] || '';
        let contentLength = 0;
        let acceptRanges = false;

        if (res.statusCode === 206 && contentRange) {
          // Content-Range: bytes 0-1/TOTAL
          const match = contentRange.match(/\/(\d+)/);
          if (match) contentLength = parseInt(match[1]);
          acceptRanges = true;
        } else if (res.statusCode === 200) {
          contentLength = parseInt(res.headers['content-length']) || 0;
          acceptRanges = (res.headers['accept-ranges'] || '').toLowerCase() === 'bytes';
        }

        const contentType = res.headers['content-type'] || '';
        res.resume();
        resolve({ contentLength, contentType, acceptRanges });
      });

      req.on('error', () => {
        resolve({ contentLength: 0, contentType: '', acceptRanges: false });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ contentLength: 0, contentType: '', acceptRanges: false });
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  // FFprobe — جلب معلومات الوسائط (المدة + الترجمة + الجودة)
  // ═══════════════════════════════════════════════════════
  async _probeMedia(id, url) {
    const session = this.sessions.get(id);
    if (!session) return;

    try {
      const ffprobePath = config.FFPROBE_PATH;
      const probeData = await new Promise((resolve, reject) => {
        execFile(ffprobePath, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          '-user_agent', USER_AGENT,
          '-timeout', '15000000',
          url,
        ], { timeout: 25000 }, (err, stdout) => {
          if (err) return reject(err);
          try {
            resolve(JSON.parse(stdout));
          } catch (e) {
            reject(e);
          }
        });
      });

      const duration = parseFloat(probeData.format?.duration || '0');
      if (duration > 0) {
        session.duration = Math.floor(duration);
      }

      // ═══ استخراج مسارات الترجمة ═══
      const subtitleTracks = [];
      const audioTracks = [];
      let videoInfo = null;

      // ترجمات الصور (PGS/DVD/DVB) لا يمكن تحويلها لنص — نتجاهلها
      const BITMAP_SUBS = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'pgssub', 'xsub'];

      for (const stream of (probeData.streams || [])) {
        if (stream.codec_type === 'subtitle' && !BITMAP_SUBS.includes(stream.codec_name)) {
          subtitleTracks.push({
            index: stream.index,
            codec: stream.codec_name,
            language: stream.tags?.language || 'und',
            title: stream.tags?.title || '',
          });
        } else if (stream.codec_type === 'audio') {
          audioTracks.push({
            index: stream.index,
            codec: stream.codec_name,
            language: stream.tags?.language || 'und',
            title: stream.tags?.title || '',
            channels: stream.channels || 2,
          });
        } else if (stream.codec_type === 'video' && !videoInfo) {
          videoInfo = {
            index: stream.index,
            codec: stream.codec_name,
            width: stream.width || 0,
            height: stream.height || 0,
            bitrate: parseInt(stream.bit_rate || probeData.format?.bit_rate || '0'),
          };
        }
      }

      session.subtitleTracks = subtitleTracks;
      session.audioTracks = audioTracks;
      session.videoInfo = videoInfo;
      session.probing = false;

      const subInfo = subtitleTracks.length > 0 ? ` — ترجمة: ${subtitleTracks.map(s => s.language).join(', ')}` : '';
      const qualityInfo = videoInfo ? ` — ${videoInfo.width}x${videoInfo.height}` : '';
      console.log(`[VodProxy] ${session.name}: المدة = ${this._formatDuration(duration)}${qualityInfo}${subInfo}`);

    } catch (e) {
      if (session) session.probing = false;
      console.log(`[VodProxy] ${session?.name}: تعذر جلب معلومات الوسائط — ${e.message}`);
    }
  }

  /**
   * extractSubtitle — استخراج مسار ترجمة من المصدر وتحويله إلى WebVTT
   */
  async extractSubtitle(id, trackIndex) {
    const session = this.sessions.get(id);
    if (!session) return null;

    const cacheKey = `${id}_sub_${trackIndex}`;
    const vttPath = path.join(CACHE_DIR, `${cacheKey}.vtt`);

    // إذا مستخرج مسبقاً → أرجعه
    if (fs.existsSync(vttPath)) return vttPath;

    // استخدم الملف المحلي إذا متوفر، وإلا المصدر
    const useLocal = session.cachedBytes > 0 && fs.existsSync(session.cachePath);
    const inputPath = useLocal ? session.cachePath : session.resolvedUrl;

    const ffmpegPath = config.FFMPEG_PATH;

    // بناء أوامر FFmpeg — إضافة user_agent و reconnect للروابط
    const args = [];
    if (!useLocal) {
      args.push('-user_agent', USER_AGENT, '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
    }
    args.push('-i', inputPath, '-map', `0:${trackIndex}`, '-c:s', 'webvtt', '-y', vttPath);

    return new Promise((resolve, reject) => {
      console.log(`[VodProxy] ${session.name}: استخراج ترجمة track ${trackIndex} من ${useLocal ? 'الكاش' : 'المصدر'}...`);
      execFile(ffmpegPath, args, { timeout: 60000 }, (err) => {
        if (err) {
          console.error(`[VodProxy] ${session.name}: خطأ استخراج ترجمة:`, err.message);
          return reject(err);
        }
        console.log(`[VodProxy] ${session.name}: ✓ ترجمة مستخرجة (track ${trackIndex})`);
        resolve(vttPath);
      });
    });
  }

  /**
   * getMediaInfo — معلومات الوسائط للعميل
   */
  getMediaInfo(id) {
    const session = this.sessions.get(id);
    if (!session) return null;
    return {
      duration: session.duration || 0,
      videoInfo: session.videoInfo || null,
      subtitleTracks: session.subtitleTracks || [],
      audioTracks: session.audioTracks || [],
      cachedBytes: session.cachedBytes,
      cacheComplete: session.cacheComplete,
      contentLength: session.contentLength,
      probing: session.probing || false,
    };
  }

  // ═══════════════════════════════════════════════════════
  // أدوات مساعدة
  // ═══════════════════════════════════════════════════════
  _getMimeType(ext) {
    const types = {
      'mp4': 'video/mp4',
      'mkv': 'video/x-matroska',
      'avi': 'video/x-msvideo',
      'ts': 'video/MP2T',
      'mov': 'video/quicktime',
      'webm': 'video/webm',
      'flv': 'video/x-flv',
    };
    return types[ext] || 'video/mp4';
  }

  _formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════
  // تنظيف الجلسات القديمة (بعد 30 دقيقة خمول)
  // ═══════════════════════════════════════════════════════
  _cleanup() {
    const now = Date.now();
    const IDLE_MS = 30 * 60 * 1000;

    for (const [id, session] of this.sessions) {
      if (session.viewers > 0) continue;
      if (now - session.lastAccess > IDLE_MS) {
        console.log(`[VodProxy] حذف جلسة: ${session.name} (خمول)`);
        this._deleteCache(id);
      }
    }
  }

  getActiveSessions() {
    const result = [];
    for (const [id, session] of this.sessions) {
      result.push({
        id,
        name: session.name,
        viewers: session.viewers,
        duration: session.duration,
        contentLength: session.contentLength,
        sizeMB: session.contentLength > 0 ? (session.contentLength / 1024 / 1024).toFixed(1) : '?',
        cachedMB: session.cachedBytes > 0 ? (session.cachedBytes / 1024 / 1024).toFixed(1) : '0',
        cacheComplete: session.cacheComplete || false,
        acceptRanges: session.acceptRanges,
      });
    }
    return result;
  }
}

module.exports = VodProxy;
