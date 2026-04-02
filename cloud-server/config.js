/**
 * إعدادات السيرفر السحابي v3
 * 
 * السيرفر يقوم بـ:
 * - تحويل IPTV → HLS باستخدام FFmpeg
 * - استخراج الترجمة (WebVTT)
 * - تقديم ملفات HLS مباشرة للتطبيق
 * - التحقق من المستخدم (JWT) قبل البث
 * - تحديث روابط البث تلقائياً عند التشغيل
 * 
 * السيرفر متصل بقاعدة بيانات الباك اند مباشرة
 */
const path = require('path');
const fs = require('fs');

// Load .env file if exists (no external dependency needed)
const _envFile = path.join(__dirname, '.env');
if (fs.existsSync(_envFile)) {
  for (const line of fs.readFileSync(_envFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const HLS_DIR = path.join(__dirname, 'hls');
fs.mkdirSync(HLS_DIR, { recursive: true });

// مسار قاعدة البيانات المحلية
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'cloud.db');

module.exports = {
  // ─── السيرفر ──────────────────────────────
  PORT: parseInt(process.env.PORT) || 8090,
  HOST: '0.0.0.0',

  // ─── الباك اند (Railway) ───────────────────
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',

  // ─── قاعدة البيانات (محلية — مستقلة) ────────
  DB_PATH,

  // ─── JWT (نفس المفتاح المستخدم في الباك اند) ─
  JWT_SECRET: process.env.JWT_SECRET || 'ma-streaming-secret-key-change-in-production',

  // ─── المجلدات ─────────────────────────────
  HLS_DIR,

  // ─── HLS ──────────────────────────────────
  HLS_TIME: 2,
  HLS_LIST_SIZE: 5,
  HLS_DELETE_THRESHOLD: 3,
  MIN_SEGMENTS_READY: 1,

  // ─── FFmpeg ───────────────────────────────
  FFMPEG_PATH: process.env.FFMPEG_PATH || require('ffmpeg-static'),
  FFPROBE_PATH: process.env.FFPROBE_PATH || require('ffprobe-static').path,

  // ─── البث عند الطلب ───────────────────────
  IDLE_TIMEOUT: 60 * 1000,

  // ─── TMDB ──────────────────────────────────
  TMDB_API_KEY: process.env.TMDB_API_KEY || 'e25ac5a68fba3713e572198a050697ca',
  TMDB_BEARER_TOKEN: process.env.TMDB_BEARER_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMjVhYzVhNjhmYmEzNzEzZTU3MjE5OGEwNTA2OTdjYSIsIm5iZiI6MTc3NDQxMTY5NC4zNDksInN1YiI6IjY5YzM1ZmFlY2I1OGU1ZmVkNjZhYzIyNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.2cHzpWAAWrrw-mYbyPfYf2H4dJ7ZOczm4QpBUzNhr64',
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
};
