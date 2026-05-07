/**
 * FFmpeg Re-streamer v2 — اتصال واحد بـ IPTV، بث HLS محلي
 *
 * المزايا:
 * - اتصال واحد فقط بـ IPTV (يحل مشكلة max_connections=1)
 * - إعادة تغليف محلية بدون إعادة ترميز (copy mode = سريع)
 * - بث HLS من السيرفر — كل المشاهدين يتشاركون نفس البث
 * - إعادة اتصال تلقائية عند انقطاع البث
 * - إدارة مشاهدين مع heartbeat — إيقاف تلقائي عند عدم وجود مشاهدين
 * - نظام جلسات يرتبط بـ checkConnectionLimit في server.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const FFMPEG_PATH = config.FFMPEG_PATH || 'ffmpeg';

// ─── إعدادات ──────────────────────────────────────────────
const HLS_SEG_DURATION   = 4;       // مدة كل segment بالثواني (4s = بث أسرع)
const HLS_LIST_SIZE      = 6;      // عدد segments في playlist
const MAX_RECONNECT      = 5;      // أقصى عدد إعادة اتصال متتالية قبل وضع البث في وضع الاستراحة
const RECONNECT_DELAY    = 3000;   // انتظار قبل إعادة الاتصال (ms)
const HEARTBEAT_TTL      = 120000; // صلاحية heartbeat المشاهد (120s)
const EXIT_GRACE_PERIOD  = 15000;  // فترة سماح عند خروج FFmpeg قبل قتل البث
const STARTUP_IMMUNITY   = 45000;  // فترة حصانة بعد بدء البث — لا يُقتل بدون مشاهدين
const PLAYLIST_WAIT      = 20000;  // أقصى انتظار لبدء playlist
const CLEANUP_DELAY      = 10000;  // تأخير حذف الملفات بعد الإيقاف
const MAX_CONCURRENT     = 10;     // أقصى عدد بثود متوازية
const DEAD_STREAM_COOLDOWN = 300000; // فترة راحة 5 دقائق بعد تجاوز حد إعادة الاتصال

class FFmpegRestreamer {
  constructor() {
    // streamId → { process, sourceUrl, name, viewers, startTime, streamDir, ... }
    this.streams = new Map();
    this.hlsDir = path.join(__dirname, '../hls');
    this._ensureDir(this.hlsDir);
    this._gcInterval = setInterval(() => this._gc(), 10000);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // ═══════════════════════════════════════════════════════
  //  الواجهة الرئيسية — بدء/انضمام لبث
  // ═══════════════════════════════════════════════════════

  /**
   * startStream — بدء بث جديد أو انضمام لبث قائم
   * @param {string} streamId - معرف القناة (مثلاً stream_id من IPTV)
   * @param {string} sourceUrl - رابط المصدر الكامل (مع credentials)
   * @param {string} name - اسم القناة
   * @param {string} userId - معرف المستخدم (للتتبع)
   * @param {string} deviceId - معرف الجهاز
   * @returns {{ hlsUrl, ready, isNew }}
   */
  async startStream(streamId, sourceUrl, name = 'Unknown', userId = '', deviceId = '') {
    const existing = this.streams.get(streamId);

    // البث يعمل بالفعل — أضف مشاهد
    if (existing && existing.process && !existing.process.killed) {
      this._addViewer(streamId, userId, deviceId);
      return {
        hlsUrl: existing.hlsUrl,
        ready: existing.ready,
        isNew: false,
        viewers: this.getViewerCount(streamId),
      };
    }

    // حد أقصى للبثود المتوازية
    if (this.streams.size >= MAX_CONCURRENT) {
      // أوقف أقدم بث بدون مشاهدين
      const idle = [...this.streams.entries()]
        .filter(([, s]) => this.getViewerCount(s.streamId) === 0)
        .sort(([, a], [, b]) => a.lastAccess - b.lastAccess)[0];
      if (idle) {
        console.log(`[Restreamer] إيقاف بث خامل: ${idle[1].name} (حد ${MAX_CONCURRENT})`);
        this._killStream(idle[0]);
      } else {
        throw new Error('تم بلوغ الحد الأقصى للبثود المتوازية');
      }
    }

    // ابدأ بث جديد
    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    this._ensureDir(streamDir);

    const playlistPath = path.join(streamDir, 'playlist.m3u8');
    const segmentPattern = path.join(streamDir, 'seg_%05d.ts');

    console.log(`[Restreamer] ▶ بدأ بث: ${name} (${streamId})`);

    const streamInfo = {
      streamId,
      sourceUrl,
      name,
      streamDir,
      playlistPath,
      hlsUrl: `/hls/stream_${streamId}/playlist.m3u8`,
      process: null,
      ready: false,
      viewers: new Map(), // viewerKey → { lastSeen }
      startTime: Date.now(),
      lastAccess: Date.now(),
      reconnectCount: 0,
      idleTimer: null,
      restarting: false,
      persistent: true, // البث مستمر حتى بدون مشاهدين
    };

    this.streams.set(streamId, streamInfo);

    // شغّل FFmpeg
    await this._startFFmpeg(streamId);

    // أضف المشاهد
    this._addViewer(streamId, userId, deviceId);

    return {
      hlsUrl: streamInfo.hlsUrl,
      ready: streamInfo.ready,
      isNew: true,
      viewers: this.getViewerCount(streamId),
    };
  }

  // ═══════════════════════════════════════════════════════
  //  إدارة المشاهدين
  // ═══════════════════════════════════════════════════════

  _addViewer(streamId, userId, deviceId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    const key = userId && deviceId ? `${userId}:${deviceId}` : (userId || deviceId || 'anon');
    stream.viewers.set(key, { lastSeen: Date.now() });
    stream.lastAccess = Date.now();
    if (stream.idleTimer) { clearTimeout(stream.idleTimer); stream.idleTimer = null; }
    console.log(`[Restreamer] +مشاهد ${stream.name} (${stream.viewers.size} متصل) key=${key}`);
  }

  heartbeat(streamId, userId, deviceId) {
    const stream = this.streams.get(streamId);
    if (!stream) return false;
    const key = userId && deviceId ? `${userId}:${deviceId}` : (userId || deviceId || 'anon');
    const viewer = stream.viewers.get(key);
    if (viewer) {
      viewer.lastSeen = Date.now();
      stream.lastAccess = Date.now();
      return true;
    }
    // حاول مطابقة بناءً على userId فقط (طلبات الأجزاء لا تحتوي ?did=)
    for (const [existingKey, existingViewer] of stream.viewers) {
      if (existingKey.startsWith(`${userId}:`) || existingKey === userId) {
        existingViewer.lastSeen = Date.now();
        stream.lastAccess = Date.now();
        return true;
      }
    }
    // مشاهد جديد (ربما من ?st= token) — أضفه
    stream.viewers.set(key, { lastSeen: Date.now() });
    stream.lastAccess = Date.now();
    if (stream.idleTimer) { clearTimeout(stream.idleTimer); stream.idleTimer = null; }
    return true;
  }

  removeViewer(streamId, userId, deviceId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;
    const key = userId && deviceId ? `${userId}:${deviceId}` : (userId || deviceId || 'anon');
    stream.viewers.delete(key);
    console.log(`[Restreamer] -مشاهد ${stream.name} (${stream.viewers.size} متصل) key=${key}`);
    // لا نوقف البث — القنوات تبقى شغالة دائماً (persistent)
  }

  getViewerCount(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return 0;
    const now = Date.now();
    let count = 0;
    for (const v of stream.viewers.values()) {
      if (now - v.lastSeen < HEARTBEAT_TTL) count++;
    }
    return count;
  }

  getAllViewers() {
    const out = {};
    for (const [id] of this.streams) {
      const n = this.getViewerCount(id);
      if (n > 0) out[id] = n;
    }
    return out;
  }

  getTotalViewers() {
    return Object.values(this.getAllViewers()).reduce((a, b) => a + b, 0);
  }

  _scheduleIdleStop(streamId) {
    // معطّل — القنوات تبقى شغالة دائماً بدون إيقاف خامل
  }

  // ═══════════════════════════════════════════════════════
  //  Pause/Resume — لإيقاف البث مؤقتاً أثناء تحميل VOD
  //  لأن حساب IPTV يسمح باتصال واحد فقط
  // ═══════════════════════════════════════════════════════

  async pauseAll() {
    const active = [...this.streams.entries()].filter(([, s]) => s.process && !s.process.killed);
    if (active.length === 0) return [];
    const pausedIds = [];
    for (const [id, s] of active) {
      console.log(`[Restreamer] ⏸ إيقاف مؤقت: ${s.name} (${id})`);
      // أوقف FFmpeg لكن لا تحذف من Map — نحتاجه للاستئناف
      s.restarting = true; // منع إعادة التشغيل التلقائية
      s.ready = false;
      if (s.process && !s.process.killed) {
        try { s.process.kill('SIGTERM'); } catch {}
      }
      if (s.idleTimer) { clearTimeout(s.idleTimer); s.idleTimer = null; }
      pausedIds.push(id);
    }
    // انتظر حتى تنتهي عمليات FFmpeg فعلياً
    await new Promise(r => setTimeout(r, 3000));
    return pausedIds;
  }

  async resumeAll(pausedIds) {
    if (!pausedIds || pausedIds.length === 0) return;
    for (const id of pausedIds) {
      const s = this.streams.get(id);
      if (s && s.sourceUrl) {
        console.log(`[Restreamer] ▶ استئناف: ${s.name} (${id})`);
        s.restarting = false; // السماح بإعادة التشغيل
        try {
          await this._startFFmpeg(id);
        } catch (e) {
          console.error(`[Restreamer] فشل استئناف ${id}: ${e.message}`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  FFmpeg Process Management
  // ═══════════════════════════════════════════════════════

  async _startFFmpeg(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    // نظّف الملفات القديمة
    this._cleanupDir(stream.streamDir);

    const args = [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-reconnect_on_network_error', '1',
      '-reconnect_on_http_error', '408,429,500,502,503,504,509,511',
      '-timeout', '30000000',
      '-user_agent', 'VLC/3.0.20 LibVLC/3.0.20',
      '-headers', 'Connection: keep-alive\r\n',
      '-rw_timeout', '15000000',
      '-i', stream.sourceUrl,
      '-c', 'copy',
      '-f', 'hls',
      '-hls_time', String(HLS_SEG_DURATION),
      '-hls_list_size', String(HLS_LIST_SIZE),
      '-hls_flags', 'delete_segments+append_list',
      '-hls_segment_filename', path.join(stream.streamDir, 'seg_%05d.ts'),
      '-y',
      stream.playlistPath,
    ];

    const proc = spawn(FFMPEG_PATH, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LD_LIBRARY_PATH: '/usr/local/lib' },
    });

    stream.process = proc;
    stream.ready = false;
    stream.restarting = false;

    // قراءة stderr بدون طباعة كل سطر (FFmpeg يطبع كثير)
    let lastErrLine = '';
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      if (lines.length) lastErrLine = lines[lines.length - 1];
      // اطبع فقط الأخطاء المهمة (تجاهل رسائل reconnect الروتينية)
      for (const line of lines) {
        const isError = line.includes('Error') || line.includes('error') ||
          line.includes('40') || line.includes('50') || line.includes('51');
        const isNoise = line.includes('Will reconnect') || line.includes('reconnect at');
        if (isError && !isNoise) {
          console.error(`[FFmpeg:${stream.name}] ${line.trim()}`);
        }
      }
    });

    proc.on('error', (err) => {
      console.error(`[Restreamer] FFmpeg error for ${stream.name}: ${err.message}`);
      stream.ready = false;
      this._handleExit(streamId, 1, lastErrLine);
    });

    proc.on('exit', (code) => {
      this._handleExit(streamId, code, lastErrLine);
    });

    // انتظر أن يكون الـ playlist جاهزاً
    try {
      await this._waitForPlaylist(stream);
      stream.ready = true;
      console.log(`[Restreamer] ✓ بث جاهز: ${stream.name}`);
    } catch (e) {
      console.error(`[Restreamer] ✗ فشل بدء البث: ${stream.name} — ${e.message}`);
      this._killStream(streamId);
      throw new Error(`فشل بدء البث: ${e.message}`);
    }
  }

  _handleExit(streamId, code, lastErr) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.ready = false;

    // إذا الإيقاف كان مننا (killStream) — لا تعيد
    if (stream.restarting) return;

    const viewerCount = this.getViewerCount(streamId);
    const uptime = Date.now() - stream.startTime;

    console.log(`[Restreamer] FFmpeg خروج: ${stream.name} code=${code} viewers=${viewerCount} uptime=${Math.round(uptime/1000)}s persistent=${stream.persistent}`);

    // ═══ القنوات المستمرة (persistent) — أعد الاتصال مع backoff ذكي ═══
    if (stream.persistent && stream.reconnectCount < MAX_RECONNECT) {
      stream.reconnectCount++;
      const delay = Math.min(RECONNECT_DELAY * Math.pow(2, stream.reconnectCount - 1), 30000); // exponential backoff
      console.log(`[Restreamer] إعادة تشغيل ${stream.name} (محاولة ${stream.reconnectCount}/${MAX_RECONNECT}) بعد ${Math.round(delay/1000)}s`);
      setTimeout(async () => {
        const s = this.streams.get(streamId);
        if (!s || s.restarting) return;
        try {
          await this._startFFmpeg(streamId);
        } catch (e) {
          console.error(`[Restreamer] فشلت إعادة التشغيل: ${e.message}`);
        }
      }, delay);
      return;
    }

    // تجاوز حد إعادة الاتصال — وضع استراحة طويل بدلاً من loop لانهائي
    if (stream.reconnectCount >= MAX_RECONNECT) {
      console.warn(`[Restreamer] ⚠ البث ميت: ${stream.name} — استراحة ${DEAD_STREAM_COOLDOWN/60000} دقائق قبل المحاولة مجدداً`);
      stream.reconnectCount = 0;
      // لا نحذف البث من الـ Map — فقط ننتظر
      setTimeout(async () => {
        const s = this.streams.get(streamId);
        if (!s || s.restarting) return;
        console.log(`[Restreamer] ↻ إعادة المحاولة بعد الاستراحة: ${stream.name}`);
        try {
          await this._startFFmpeg(streamId);
        } catch (e) {
          console.error(`[Restreamer] فشلت إعادة التشغيل بعد الاستراحة: ${e.message}`);
        }
      }, DEAD_STREAM_COOLDOWN);
      return;
    }

    // بث غير مستمر بدون مشاهدين
    if (viewerCount === 0) {
      this._killStream(streamId);
    }
  }

  async _waitForPlaylist(stream, maxWait = PLAYLIST_WAIT) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (fs.existsSync(stream.playlistPath)) {
        try {
          const content = fs.readFileSync(stream.playlistPath, 'utf8');
          if (content.includes('.ts') && content.includes('#EXTINF')) {
            return true;
          }
        } catch {}
      }
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Playlist لم يجهز في الوقت المحدد');
  }

  // ═══════════════════════════════════════════════════════
  //  إيقاف وتنظيف
  // ═══════════════════════════════════════════════════════

  _killStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.restarting = true; // منع إعادة التشغيل
    stream.ready = false;

    if (stream.process && !stream.process.killed) {
      try { stream.process.kill('SIGTERM'); } catch {}
      // إذا لم يتوقف بعد 3 ثواني — SIGKILL
      setTimeout(() => {
        try { if (!stream.process.killed) stream.process.kill('SIGKILL'); } catch {}
      }, 3000);
    }

    if (stream.idleTimer) clearTimeout(stream.idleTimer);

    // تأخير حذف الملفات
    const dir = stream.streamDir;
    setTimeout(() => this._cleanupDir(dir), CLEANUP_DELAY);

    this.streams.delete(streamId);
    console.log(`[Restreamer] ■ إيقاف بث: ${stream.name}`);
  }

  _cleanupDir(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch {}
      }
    } catch {}
  }

  // ═══════════════════════════════════════════════════════
  //  Garbage Collection
  // ═══════════════════════════════════════════════════════

  _gc() {
    const now = Date.now();
    for (const [id, stream] of this.streams) {
      // نظّف مشاهدين منتهيي الصلاحية
      for (const [key, v] of stream.viewers) {
        if (now - v.lastSeen > HEARTBEAT_TTL) {
          stream.viewers.delete(key);
        }
      }
      // لا توقف القنوات المستمرة (persistent) — تبقى شغالة دائماً
      // إعادة تعيين عداد إعادة الاتصال عند الاستقرار
      if (stream.ready && stream.reconnectCount > 0) {
        stream.reconnectCount = 0;
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  إحصائيات
  // ═══════════════════════════════════════════════════════

  getActiveStreams() {
    return [...this.streams.entries()].map(([id, s]) => ({
      streamId: id,
      name: s.name,
      viewers: this.getViewerCount(id),
      ready: s.ready,
      uptime: Date.now() - s.startTime,
      reconnectCount: s.reconnectCount,
    }));
  }

  isStreaming(streamId) {
    const s = this.streams.get(streamId);
    return s && s.ready;
  }

  stop() {
    if (this._gcInterval) clearInterval(this._gcInterval);
    for (const id of this.streams.keys()) this._killStream(id);
    console.log('[Restreamer] توقف');
  }

  start() {
    console.log('[Restreamer] جاهز — بث HLS محلي (قنوات مستمرة بدون إيقاف)');
  }

  /**
   * preloadStream — بدء بث بدون مشاهد (للتحميل المسبق)
   * يُستخدم عند بدء السيرفر لتحميل القنوات مسبقاً
   */
  async preloadStream(streamId, sourceUrl, name = 'Unknown') {
    const existing = this.streams.get(streamId);
    if (existing && existing.process && !existing.process.killed && existing.ready) {
      console.log(`[Restreamer] ⚡ القناة جاهزة مسبقاً: ${name}`);
      return { hlsUrl: existing.hlsUrl, ready: true };
    }

    console.log(`[Restreamer] ⚡ تحميل مسبق: ${name} (${streamId})`);

    const streamDir = path.join(this.hlsDir, `stream_${streamId}`);
    this._ensureDir(streamDir);

    const playlistPath = path.join(streamDir, 'playlist.m3u8');

    const streamInfo = {
      streamId,
      sourceUrl,
      name,
      streamDir,
      playlistPath,
      hlsUrl: `/hls/stream_${streamId}/playlist.m3u8`,
      process: null,
      ready: false,
      viewers: new Map(),
      startTime: Date.now(),
      lastAccess: Date.now(),
      reconnectCount: 0,
      idleTimer: null,
      restarting: false,
      persistent: true,
    };

    this.streams.set(streamId, streamInfo);

    try {
      await this._startFFmpeg(streamId);
      console.log(`[Restreamer] ⚡ جاهز مسبقاً: ${name}`);
      return { hlsUrl: streamInfo.hlsUrl, ready: streamInfo.ready };
    } catch (e) {
      console.error(`[Restreamer] فشل التحميل المسبق: ${name} — ${e.message}`);
      // لا تحذف — سيحاول إعادة الاتصال تلقائياً
      return { hlsUrl: streamInfo.hlsUrl, ready: false };
    }
  }
}

module.exports = new FFmpegRestreamer();