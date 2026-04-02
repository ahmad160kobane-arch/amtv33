const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requirePremium } = require('../middleware/auth');

const router = express.Router();

// GET /api/channels - List enabled channels with pagination
router.get('/', async (req, res) => {
  try {
    const { group, search, limit, offset } = req.query;
    let where = 'WHERE is_enabled = 1';
    const params = [];

    if (group) {
      where += ' AND group_name LIKE ?';
      params.push(`%${group}%`);
    }
    if (search) {
      where += ' AND (name LIKE ? OR group_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM channels ${where}`).get(...params);
    const total = countRow.total;

    const pLimit = parseInt(limit) || 0; // 0 = no limit (backward compat)
    const pOffset = parseInt(offset) || 0;

    let sql = `SELECT id, name, group_name as "group", logo_url as logo,
               is_enabled as enabled, 1 as is_streaming, 0 as viewers
               FROM channels ${where} ORDER BY group_name, name`;

    if (pLimit > 0) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(pLimit, pOffset);
    }

    const channels = await db.prepare(sql).all(...params);
    res.json({ channels, total, hasMore: pLimit > 0 ? pOffset + pLimit < total : false });
  } catch (err) {
    console.error('Channels error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/channels/export - Full channel list with stream_url (for cloud server sync)
router.get('/export', async (req, res) => {
  try {
    const channels = await db.prepare(
      'SELECT id, name, group_name, logo_url, stream_url FROM channels WHERE is_enabled = 1 ORDER BY sort_order'
    ).all();
    res.json({ channels, total: channels.length });
  } catch (err) {
    console.error('Channel export error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/channels/groups - List all groups
router.get('/groups', async (req, res) => {
  const groups = await db.prepare('SELECT DISTINCT group_name FROM channels WHERE is_enabled = 1 ORDER BY group_name').all();
  res.json({ groups: groups.map(g => g.group_name) });
});

// GET /api/channels/:id - Get single channel (بدون كشف رابط IPTV)
router.get('/:id', async (req, res) => {
  const ch = await db.prepare('SELECT id, name, group_name, logo_url, is_enabled, sort_order, created_at FROM channels WHERE id = ?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'القناة غير موجودة' });
  res.json(ch);
});

// GET /api/stream/:id - Get stream URL via cloud server (requires premium)
router.get('/stream/:id', requireAuth, requirePremium, async (req, res) => {
  const ch = await db.prepare('SELECT id, name, logo_url, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'القناة غير متاحة' });

  // شغّل البث عبر السيرفر السحابي (لا نكشف رابط IPTV المباشر)
  const cloud = require('../lib/cloud');
  const result = await cloud.startLiveStream(ch.id, ch.stream_url, ch.name);

  // Log to watch history
  try {
    await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type, title, poster, content_type, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())')
      .run(uuidv4(), req.user.id, ch.id, 'channel', ch.name || '', ch.logo_url || '', 'channel');
  } catch {}

  if (result.error) return res.status(502).json({ error: 'السيرفر السحابي غير متاح' });
  res.json({ url: cloud.getHlsUrl(ch.id, 'live'), ready: result.ready, waiting: result.waiting });
});

module.exports = router;
