/**
 * مسارات البث السحابي — الباك اند يتحكم بالسيرفر السحابي
 * 
 * التدفق:
 * 1. التطبيق يطلب بث من الباك اند (مع JWT token)
 * 2. الباك اند يتحقق من المستخدم (مسجل + مشترك + غير محظور)
 * 3. الباك اند يجلب رابط المصدر من قاعدة البيانات
 * 4. الباك اند يرسل الطلب للسيرفر السحابي (مع المفتاح السري)
 * 5. السيرفر السحابي يشغل FFmpeg ← يرجع رابط HLS
 * 6. الباك اند يرجع رابط HLS الكامل للتطبيق
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const cloud = require('../lib/cloud');

const router = express.Router();

// ═══════════════════════════════════════════════════════
// API للتطبيق — طلب بث (محمي بـ JWT)
// ═══════════════════════════════════════════════════════

/**
 * POST /api/cloud/stream/live/:channelId
 * التطبيق يطلب بث قناة مباشرة
 * Response: { success, hlsUrl, ready }
 */
router.post('/stream/live/:channelId', requireAuth, async (req, res) => {
  try {
    const channel = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'القناة غير متاحة' });
    if (!channel.stream_url) return res.status(400).json({ error: 'القناة بدون رابط بث' });

    const result = await cloud.startLiveStream(channel.id, channel.stream_url, channel.name);
    if (result.error) return res.status(502).json({ error: result.error });

    // أرجع رابط HLS الكامل من السيرفر السحابي
    res.json({
      success: true,
      hlsUrl: cloud.getHlsUrl(channel.id, 'live'),
      ready: result.ready || false,
      waiting: result.waiting || false,
    });

    // سجّل في تاريخ المشاهدة
    try {
      await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type, title, poster, content_type, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())').run(uuidv4(), req.user.id, channel.id, 'channel', channel.name || '', '', 'channel');
    } catch {}
  } catch (err) {
    console.error('[Cloud] خطأ بث مباشر:', err.message);
    res.status(500).json({ error: 'خطأ في بدء البث' });
  }
});

/**
 * POST /api/cloud/stream/vod/:id
 * التطبيق يطلب بث فيلم أو حلقة (مع ترجمة)
 * Response: { success, hlsUrl, ready }
 */
router.post('/stream/vod/:id', requireAuth, async (req, res) => {
  try {
    // ابحث بالـ id أولاً، ثم بالـ stream_token (للتوافق مع التطبيق)
    const paramId = decodeURIComponent(req.params.id);
    let item = await db.prepare('SELECT id, title, stream_token, vod_type, xtream_id, container_ext FROM vod WHERE id = ?').get(paramId);
    let itemType = 'vod';
    if (!item) {
      item = await db.prepare('SELECT id, title, stream_token, container_ext, xtream_id FROM episodes WHERE id = ?').get(paramId);
      itemType = 'episode';
    }
    // بحث بالـ stream_token إذا لم يُوجد بالـ id
    if (!item) {
      item = await db.prepare('SELECT id, title, stream_token, vod_type, xtream_id, container_ext FROM vod WHERE stream_token = ?').get(paramId);
      itemType = 'vod';
    }
    if (!item) {
      item = await db.prepare('SELECT id, title, stream_token, container_ext, xtream_id FROM episodes WHERE stream_token = ?').get(paramId);
      itemType = 'episode';
    }
    if (!item) return res.status(404).json({ error: 'المحتوى غير موجود' });

    // جلب رابط المصدر
    let sourceUrl = item.stream_token;

    // إذا stream_token فارغ لكن يوجد xtream_id → بناء الرابط من إعدادات IPTV
    if (!sourceUrl && item.xtream_id) {
      const cfg = await db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
      if (cfg && cfg.server_url) {
        const ext = item.container_ext || 'mkv';
        const type = itemType === 'episode' ? 'series' : 'movie';
        sourceUrl = `${cfg.server_url}/${type}/${cfg.username}/${cfg.password}/${item.xtream_id}.${ext}`;
      }
    }

    if (!sourceUrl) return res.status(400).json({ error: 'المحتوى بدون رابط بث' });

    const result = await cloud.startVodStream(item.id, sourceUrl, item.title);
    if (result.error) return res.status(502).json({ error: result.error });

    res.json({
      success: true,
      hlsUrl: cloud.getHlsUrl(item.id, 'vod'),
      ready: result.ready || false,
      waiting: result.waiting || false,
    });

    // سجّل في تاريخ المشاهدة
    try {
      const posterRow = await db.prepare('SELECT poster_url FROM vod WHERE id = ?').get(item.id);
      const posterUrl = (posterRow && posterRow.poster_url) || '';
      const ctype = itemType === 'episode' ? 'series' : 'movie';
      await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type, title, poster, content_type, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())').run(uuidv4(), req.user.id, item.id, itemType, item.title || '', posterUrl, ctype);
    } catch {}
  } catch (err) {
    console.error('[Cloud] خطأ بث VOD:', err.message);
    res.status(500).json({ error: 'خطأ في بدء البث' });
  }
});

/**
 * POST /api/cloud/stream/release/:streamId
 * التطبيق ينهي المشاهدة
 */
router.post('/stream/release/:streamId', requireAuth, async (req, res) => {
  const result = await cloud.releaseStream(req.params.streamId);
  res.json(result);
});

/**
 * GET /api/cloud/stream/ready/:streamId
 * التطبيق يفحص جهوزية البث
 */
router.get('/stream/ready/:streamId', requireAuth, async (req, res) => {
  const result = await cloud.isStreamReady(req.params.streamId);
  res.json(result);
});

/**
 * GET /api/cloud/health
 * فحص صحة السيرفر السحابي
 */
router.get('/health', async (req, res) => {
  const health = await cloud.healthCheck();
  res.json({ cloud: health });
});

// ═══════════════════════════════════════════════════════
// API إدارة البث (أدمن فقط)
// ═══════════════════════════════════════════════════════

/**
 * GET /api/cloud/admin/status
 * حالة كل البث النشط على السيرفر السحابي
 */
router.get('/admin/status', requireAdmin, async (req, res) => {
  const result = await cloud.getStreamStatus();
  res.json(result);
});

/**
 * POST /api/cloud/admin/stop/:streamId
 * الأدمن يوقف بث
 */
router.post('/admin/stop/:streamId', requireAdmin, async (req, res) => {
  const result = await cloud.stopStream(req.params.streamId);
  res.json(result);
});

/**
 * POST /api/cloud/admin/stop-all
 * الأدمن يوقف كل البث
 */
router.post('/admin/stop-all', requireAdmin, async (req, res) => {
  const result = await cloud.stopAll();
  res.json(result);
});

/**
 * POST /api/cloud/admin/start-live/:channelId
 * الأدمن يشغل بث يدوياً
 */
router.post('/admin/start-live/:channelId', requireAdmin, async (req, res) => {
  const channel = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ?').get(req.params.channelId);
  if (!channel) return res.status(404).json({ error: 'القناة غير موجودة' });
  const result = await cloud.startLiveStream(channel.id, channel.stream_url, channel.name);
  res.json(result);
});

module.exports = router;
