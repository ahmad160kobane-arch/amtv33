const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');

const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const vodRoutes = require('./routes/vod');
const adminRoutes = require('./routes/admin');
const cloudRoutes = require('./routes/cloud');
const agentRoutes = require('./routes/agent');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({
  origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/vod', vodRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cloud', cloudRoutes);
app.use('/api/agent', agentRoutes);

// ─── Health Check ────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const cloud = require('./lib/cloud');
  const cloudHealth = await cloud.healthCheck();
  res.json({ status: 'ok', version: '2.0.0', name: 'MA Streaming API', cloud: cloudHealth });
});

// ─── البث يمر فقط عبر السيرفر السحابي ──────────────────
// الروابط القديمة المباشرة تم إلغاؤها — كل البث عبر /api/cloud/stream/*
// هذه التحويلات للتوافق مع الروابط القديمة فقط
const { requireAuth } = require('./middleware/auth');
const cloud = require('./lib/cloud');

app.get('/hls/:channelId/stream.m3u8', requireAuth, async (req, res) => {
  const ch = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(req.params.channelId);
  if (!ch) return res.status(404).json({ error: 'القناة غير متاحة' });
  // شغّل البث عبر السيرفر السحابي بدلاً من التوجيه المباشر لـ IPTV
  const result = await cloud.startLiveStream(ch.id, ch.stream_url, ch.name);
  if (result.error) return res.status(502).json({ error: 'السيرفر السحابي غير متاح' });
  res.redirect(cloud.getHlsUrl(ch.id, 'live'));
});

// ─── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'المسار غير موجود' });
});

// ─── Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// ─── Start ───────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║   MA Streaming API (PostgreSQL)      ║`);
    console.log(`  ║   http://localhost:${PORT}              ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });
}).catch(err => {
  console.error('[DB] Failed to initialize:', err.message);
  process.exit(1);
});
