/**
 * مدير البث — بث عند الطلب مع دعم الترجمة
 * 
 * بدون قاعدة بيانات — يحصل على روابط المصادر من Backend API
 * 
 * النظام:
 * 1. المشاهد يطلب بث عبر التطبيق
 * 2. التطبيق يرسل الطلب للباك اند → الباك اند يرسل رابط المصدر للسيرفر السحابي
 * 3. السيرفر السحابي يشغل FFmpeg → يحول المصدر إلى HLS مع ترجمة WebVTT
 * 4. المشاهد يتصل مباشرة بالسيرفر السحابي لتشغيل HLS
 * 5. عند خروج آخر مشاهد → FFmpeg يتوقف تلقائياً (توفير موارد)
 */
const { spawn, execFile } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const config = require('../config');

class StreamManager {
  constructor() {
    // streamId → { process, sourceUrl, startTime, viewers, lastAccess, type, name, idleTimer, restartCount }
    this.streams = new Map();
    this._monitorInterval = null;
  }

  start() {
    this._monitorInterval = setInterval(() => this._monitor(), 10000);
    console.log('[StreamManager] جاهز — وضع البث عند الطلب (بدون DB)');
  }

  stop() {
    if (this._monitorInterval) clearInterval(this._monitorInterval);
    for (const [id] of this.streams) {
      this._killStream(id);
    }
    console.log('[StreamManager] توقف');
  }

  // ═══════════════════════════════════════════════════════
  // البث عند الطلب
  // يُستدعى من الباك اند الرئيسي أو مباشرة مع رابط المصدر
  // ═══════════════════════════════════════════════════════

  /**
   * requestStream — بدء بث جديد أو إضافة مشاهد لبث قائم
   * @param {string} streamId - معرف القناة أو المحتوى
   * @param {string} type - 'live' أو 'vod'
   * @param {string} sourceUrl - رابط مصدر IPTV (يأتي من الباك اند)
   * @param {string} name - اسم القناة/المحتوى (للسجلات)
   */
  async requestStream(streamId, type, sourceUrl, name = 'Unknown') {
    // إذا البث يعمل بالفعل — أضف مشاهد
    if (this.streams.has(streamId)) {
      const info = this.streams.get(streamId);
      info.viewers++;
      info.lastAccess = Date.now();
      if (info.idleTimer) { clearTimeout(info.idleTimer); info.idleTimer = null; }
      console.log(`[Stream] +مشاهد ${info.name} (${info.viewers} متصل)`);
      return { success: true, hlsUrl: this._getHlsUrl(streamId, type), ready: this.isReady(streamId, type) };
    }

    // ابدأ البث الجديد
    if (!sourceUrl) return { success: false, error: 'رابط المصدر مطلوب' };

    // ═══ وضع اتصال واحد: أوقف أي بث نشط قبل بدء بث جديد ═══
    // الاشتراك IPTV يدعم اتصال واحد فقط — FFmpeg واحد في كل لحظة
    // لكن VOD مكتمل (FFmpeg انتهى) لا يستخدم اتصال — لا تُوقفه
    const activeStreams = [...this.streams.entries()].filter(([, info]) => !info.completed);
    if (activeStreams.length > 0) {
      console.log(`[Stream] ⚠ إيقاف ${activeStreams.length} بث نشط (اتصال IPTV واحد فقط)`);
      for (const [id] of activeStreams) {
        this._killStream(id);
      }
      // انتظر قليلاً حتى يُغلق الاتصال القديم
      await new Promise(r => setTimeout(r, 1000));
    }

    // تتبع redirects لتجاوز Cloudflare — FFmpeg يأخذ الرابط المباشر
    console.log(`[Stream] Resolving: ${sourceUrl.substring(0, 80)}...`);
    const resolvedUrl = await this._resolveRedirect(sourceUrl);
    console.log(`[Stream] Resolved: ${resolvedUrl.substring(0, 80)}...`);

    let result;
    if (type === 'live') {
      result = this._startLiveStream(streamId, resolvedUrl, name);
    } else {
      result = this._startVodStream(streamId, resolvedUrl, name);
    }

    if (result.success) {
      this.streams.get(streamId).viewers = 1;
      return { success: true, hlsUrl: this._getHlsUrl(streamId, type), ready: false, waiting: true };
    }
    return result;
  }

  /**
   * _resolveRedirect — تتبع HTTP redirects للحصول على الرابط المباشر
   * IPTV servers behind Cloudflare redirect to direct IP — FFmpeg can't follow CF redirects
   */
  async _resolveRedirect(url, maxRedirects = 5) {
    try {
      let currentUrl = url;
      for (let i = 0; i < maxRedirects; i++) {
        const resp = await fetch(currentUrl, {
          redirect: 'manual',
          headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
        });
        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (location) {
            currentUrl = location;
            console.log(`[Stream] Redirect ${resp.status} → ${currentUrl.substring(0, 80)}...`);
            continue;
          }
        }
        // 200 أو غير redirect — هذا الرابط النهائي
        return currentUrl;
      }
      return currentUrl;
    } catch (e) {
      console.error(`[Stream] فشل resolve redirect:`, e.message);
      return url;
    }
  }

  /**
   * releaseStream — مشاهد أنهى المشاهدة
   */
  releaseStream(streamId) {
    const info = this.streams.get(streamId);
    if (!info) return;
    info.viewers = Math.max(0, info.viewers - 1);
    info.lastAccess = Date.now();
    console.log(`[Stream] -مشاهد ${info.name} (${info.viewers} متصل)`);

    if (info.viewers <= 0) {
      // VOD مكتمل (FFmpeg انتهى) — نظّف فوراً
      if (info.completed) {
        console.log(`[Stream] تنظيف VOD مكتمل: ${info.name}`);
        this.streams.delete(streamId);
        const hlsDir = path.join(config.HLS_DIR, 'vod', streamId);
        try { fs.rmSync(hlsDir, { recursive: true, force: true }); } catch {}
        return;
      }
      info.idleTimer = setTimeout(() => {
        const current = this.streams.get(streamId);
        if (current && current.viewers <= 0) {
          console.log(`[Stream] إيقاف ${current.name} (خمول)`);
          this._killStream(streamId);
        }
      }, config.IDLE_TIMEOUT);
    }
  }

  // ═══════════════════════════════════════════════════════
  // تشغيل بث مباشر (قناة)
  // ═══════════════════════════════════════════════════════
  _startLiveStream(streamId, sourceUrl, name) {
    // تحويل m3u8 → ts للمصادر الحية (تجنب حظر Cloudflare)
    if (sourceUrl.includes('/live/') && sourceUrl.endsWith('.m3u8')) {
      sourceUrl = sourceUrl.slice(0, -5) + '.ts';
    }

    const outputDir = path.join(config.HLS_DIR, streamId);
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'stream.m3u8');
    const segmentPath = path.join(outputDir, 'seg_%d.ts');

    const cmd = [
      '-y', '-hide_banner', '-loglevel', 'warning',
      // ═══ تحسينات البث المباشر: بداية فورية + تأخير أقل ═══
      '-fflags', 'nobuffer+discardcorrupt+genpts',
      '-flags', 'low_delay',
      '-analyzeduration', '1000000',
      '-probesize', '1000000',
      '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '3',
      '-rw_timeout', '8000000',
      '-i', sourceUrl,
      // ═══ copy كل شيء — بدون إعادة encoding = صفر CPU ═══
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-map', '0:v:0', '-map', '0:a:0?',
      '-f', 'hls',
      '-hls_time', String(config.HLS_TIME),
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+omit_endlist+split_by_time',
      '-hls_delete_threshold', '4',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', segmentPath,
      '-hls_allow_cache', '0',
      '-hls_start_number_source', 'epoch',
      outputPath,
    ];

    return this._spawnFFmpeg(streamId, name, 'live', sourceUrl, cmd);
  }

  // ═══════════════════════════════════════════════════════
  // تشغيل بث VOD (فيلم/حلقة) — HLS Remuxing (مثل Netflix/Plex)
  //
  // FFmpeg يقرأ مباشرة من رابط IPTV ويقسّم الفيديو لـ segments
  // كل segment = 10 ثواني، المشغل يحمّل 3-5 segments مقدماً
  // النتيجة: 30-50 ثانية buffer = بث بدون تقطيع
  //
  // لا إعادة encoding (copy codec) = سرعة عالية جداً
  // FFmpeg يعالج أسرع من وقت التشغيل → الملف يكتمل بسرعة
  // ═══════════════════════════════════════════════════════
  _startVodStream(streamId, resolvedUrl, name) {
    return this._startVodStreamAt(streamId, resolvedUrl, name, 0);
  }

  /**
   * _startVodStreamAt — بدء HLS remux من موضع معين (للـ seeking)
   * @param {number} seekSec — الموضع بالثواني (0 = من البداية)
   */
  _startVodStreamAt(streamId, resolvedUrl, name, seekSec = 0) {
    const outputDir = path.join(config.HLS_DIR, 'vod', streamId);
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'stream.m3u8');
    const segmentPath = path.join(outputDir, 'seg_%d.ts');

    const cmd = [
      '-y', '-hide_banner', '-loglevel', 'warning',
      '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '5',
      '-rw_timeout', '15000000',
      '-analyzeduration', '10000000',
      '-probesize', '10000000',
    ];

    // ─── Seeking: بدء من موضع معين ───
    if (seekSec > 0) {
      cmd.push('-ss', String(seekSec));
    }

    cmd.push(
      '-i', resolvedUrl,
      '-map', '0:v:0',
      '-map', '0:a:0?',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-f', 'hls',
      '-hls_time', '10',
      '-hls_list_size', '0',
      '-hls_playlist_type', 'event',
      '-hls_flags', 'independent_segments+append_list',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', segmentPath,
      outputPath,
    );

    return this._spawnFFmpeg(streamId, name, 'vod', resolvedUrl, cmd);
  }

  /**
   * seekVodStream — Seeking في VOD (إعادة بدء FFmpeg من موضع جديد)
   *
   * عندما المستخدم يقفز لموضع لم يتم تحميله بعد:
   * 1. إيقاف FFmpeg الحالي
   * 2. مسح الـ segments القديمة
   * 3. بدء FFmpeg من الموضع الجديد
   */
  async seekVodStream(streamId, positionSec) {
    const info = this.streams.get(streamId);
    if (!info || info.type !== 'vod') return { success: false, error: 'لا يوجد بث VOD' };

    const { sourceUrl, name, viewers } = info;
    console.log(`[Stream] ⏩ Seek ${name} → ${Math.floor(positionSec)}s`);

    // إيقاف FFmpeg الحالي
    try { info.process.kill('SIGTERM'); } catch {}
    if (info.idleTimer) clearTimeout(info.idleTimer);
    this.streams.delete(streamId);

    // مسح الـ segments القديمة
    const hlsDir = path.join(config.HLS_DIR, 'vod', streamId);
    try { fs.rmSync(hlsDir, { recursive: true, force: true }); } catch {}

    // انتظار إغلاق الاتصال القديم
    await new Promise(r => setTimeout(r, 500));

    // إعادة حل الرابط (قد تكون صلاحيته انتهت)
    const resolvedUrl = await this._resolveRedirect(sourceUrl);

    // بدء FFmpeg من الموضع الجديد
    const result = this._startVodStreamAt(streamId, resolvedUrl, name, positionSec);
    if (result.success) {
      const newInfo = this.streams.get(streamId);
      if (newInfo) {
        newInfo.viewers = viewers;
        newInfo.seekOffset = positionSec;
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  // تشغيل FFmpeg
  // ═══════════════════════════════════════════════════════
  _spawnFFmpeg(streamId, name, type, sourceUrl, cmd) {
    try {
      const proc = spawn(config.FFMPEG_PATH, cmd, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      let stderrBuf = '';
      proc.stderr.on('data', (d) => { stderrBuf = (stderrBuf + d.toString()).slice(-2000); });
      proc.stdout.on('data', () => {});

      proc.on('exit', (code) => {
        console.log(`[Stream] ${name} انتهى (code=${code})`);
        if (code !== 0 && stderrBuf) console.error(`[FFmpeg] ${name} stderr:\n${stderrBuf.slice(-500)}`);
        const info = this.streams.get(streamId);
        if (info && info.idleTimer) clearTimeout(info.idleTimer);

        // ═══ VOD: عند اكتمال المعالجة بنجاح — لا تمسح الـ segments ═══
        // المستخدم لا يزال يشاهد! الملفات تُمسح فقط عند releaseStream
        if (type === 'vod' && code === 0) {
          if (info) {
            info.completed = true;
            info.process = null;
            console.log(`[Stream] ✓ ${name} — HLS مكتمل (segments محفوظة للمشاهدة)`);
          }
          return;
        }

        this.streams.delete(streamId);
        const hlsDir = type === 'vod' ? path.join(config.HLS_DIR, 'vod', streamId) : path.join(config.HLS_DIR, streamId);
        try { fs.rmSync(hlsDir, { recursive: true, force: true }); } catch {}

        // إعادة تشغيل تلقائية للقنوات المباشرة إذا كان هناك مشاهدين
        if (type === 'live' && info && info.viewers > 0) {
          const restarts = (info.restartCount || 0) + 1;
          if (restarts <= 5) {
            console.log(`[Stream] إعادة تشغيل ${name} (محاولة ${restarts}/5)`);
            setTimeout(() => {
              const result = this._startLiveStream(streamId, info.sourceUrl, name); // restart uses already-resolved URL
              if (result.success) {
                const newInfo = this.streams.get(streamId);
                if (newInfo) {
                  newInfo.viewers = info.viewers;
                  newInfo.restartCount = restarts;
                }
              }
            }, 3000 + restarts * 2000);
          }
        }
      });

      proc.on('error', (err) => {
        console.error(`[Stream] خطأ FFmpeg ${name}:`, err.message);
      });

      this.streams.set(streamId, {
        process: proc,
        sourceUrl,
        startTime: Date.now(),
        viewers: 0,
        lastAccess: Date.now(),
        type,
        name,
        idleTimer: null,
        restartCount: 0,
        getStderr: () => stderrBuf,
      });

      console.log(`[Stream] ▶ بدأ ${type === 'vod' ? 'VOD' : 'بث'}: ${name}`);
      return { success: true };
    } catch (e) {
      console.error(`[Stream] خطأ تشغيل ${name}:`, e.message);
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // إيقاف بث
  // ═══════════════════════════════════════════════════════
  _killStream(streamId) {
    const info = this.streams.get(streamId);
    if (!info) return;
    if (info.idleTimer) clearTimeout(info.idleTimer);
    if (info.process) { try { info.process.kill('SIGTERM'); } catch {} }
    this.streams.delete(streamId);

    const hlsDir = info.type === 'vod' ? path.join(config.HLS_DIR, 'vod', streamId) : path.join(config.HLS_DIR, streamId);
    try { fs.rmSync(hlsDir, { recursive: true, force: true }); } catch {}
    console.log(`[Stream] ⏹ ${info.name}`);
  }

  stopStream(streamId) {
    if (!this.streams.has(streamId)) return { success: false, error: 'لا يوجد بث نشط' };
    this._killStream(streamId);
    return { success: true };
  }

  stopAll() {
    let stopped = 0;
    for (const [id] of this.streams) {
      this._killStream(id);
      stopped++;
    }
    return { stopped };
  }

  // ═══════════════════════════════════════════════════════
  // معلومات وحالة
  // ═══════════════════════════════════════════════════════

  getActiveStreams() {
    const result = [];
    for (const [id, info] of this.streams) {
      result.push({
        id,
        name: info.name,
        type: info.type,
        viewers: info.viewers,
        uptime: Math.floor((Date.now() - info.startTime) / 1000),
        ready: this.isReady(id, info.type),
      });
    }
    return result;
  }

  getStreamInfo(streamId) {
    const info = this.streams.get(streamId);
    if (!info) return null;
    return {
      name: info.name,
      type: info.type,
      viewers: info.viewers,
      uptime: Math.floor((Date.now() - info.startTime) / 1000),
      ready: this.isReady(streamId, info.type),
      completed: !!info.completed,
    };
  }

  isReady(streamId, type) {
    const info = this.streams.get(streamId);
    const t = type || (info ? info.type : 'live');
    const dir = t === 'vod'
      ? path.join(config.HLS_DIR, 'vod', streamId)
      : path.join(config.HLS_DIR, streamId);
    if (!fs.existsSync(dir)) return false;
    const m3u8 = path.join(dir, 'stream.m3u8');
    if (!fs.existsSync(m3u8)) return false;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
    return files.length >= config.MIN_SEGMENTS_READY;
  }

  _getHlsUrl(streamId, type) {
    if (type === 'vod') return `/hls/vod/${streamId}/stream.m3u8`;
    return `/hls/${streamId}/stream.m3u8`;
  }

  // ═══════════════════════════════════════════════════════
  // فحص ترجمة (ffprobe)
  // ═══════════════════════════════════════════════════════
  probeSubtitles(sourceUrl) {
    return new Promise((resolve) => {
      const ffprobe = config.FFMPEG_PATH.replace('ffmpeg', 'ffprobe');
      execFile(ffprobe, [
        '-v', 'quiet', '-print_format', 'json',
        '-show_streams', '-select_streams', 's',
        '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
        sourceUrl,
      ], { timeout: 15000 }, (err, stdout) => {
        if (err) return resolve([]);
        try {
          const data = JSON.parse(stdout);
          resolve((data.streams || []).map(s => ({
            index: s.index,
            language: s.tags?.language || 'und',
            title: s.tags?.title || '',
            codec: s.codec_name,
          })));
        } catch { resolve([]); }
      });
    });
  }

  _monitor() {
    for (const [id, info] of this.streams) {
      // VOD مكتمل — لا عملية FFmpeg للمراقبة
      if (info.completed || !info.process) continue;
      try {
        process.kill(info.process.pid, 0);
      } catch {
        console.log(`[Stream] ${info.name} توقف بشكل غير متوقع`);
        if (info.idleTimer) clearTimeout(info.idleTimer);
        this.streams.delete(id);
      }
    }
  }
}

module.exports = StreamManager;
