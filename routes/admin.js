const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(requireAdmin);

// ─── Dashboard Stats ─────────────────────────────────────
router.get('/stats', async (req, res) => {
  const users = await db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const channels = await db.prepare('SELECT COUNT(*) as c FROM channels').get().c;
  const movies = await db.prepare("SELECT COUNT(*) as c FROM vod WHERE vod_type = 'movie'").get().c;
  const series = await db.prepare("SELECT COUNT(*) as c FROM vod WHERE vod_type = 'series'").get().c;
  const episodes = await db.prepare('SELECT COUNT(*) as c FROM episodes').get().c;

  res.json({ users, channels, movies, series, episodes });
});

// ─── Users Management ────────────────────────────────────
router.get('/users', async (req, res) => {
  const users = await db.prepare(
    'SELECT id, username, email, display_name, plan, expires_at, is_admin, is_blocked, role, balance, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json({ users });
});

router.put('/users/:id', async (req, res) => {
  const { plan, expires_at, is_blocked, is_admin } = req.body;
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  await db.prepare(`
    UPDATE users SET
      plan = COALESCE(?, plan),
      expires_at = COALESCE(?, expires_at),
      is_blocked = COALESCE(?, is_blocked),
      is_admin = COALESCE(?, is_admin)
    WHERE id = ?
  `).run(plan || null, expires_at || null, is_blocked ?? null, is_admin ?? null, req.params.id);

  res.json({ success: true });
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك حذف نفسك' });
  await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Channels Management ─────────────────────────────────
router.post('/channels', async (req, res) => {
  const { name, group_name, logo_url, stream_url, sort_order } = req.body;
  if (!name || !stream_url) return res.status(400).json({ error: 'الاسم ورابط البث مطلوبان' });

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, group_name || 'عام', logo_url || '', stream_url, sort_order || 0);

  res.status(201).json({ id, name, stream_url });
});

router.post('/channels/bulk', async (req, res) => {
  const { channels } = req.body;
  if (!Array.isArray(channels)) return res.status(400).json({ error: 'مصفوفة القنوات مطلوبة' });

  const count = await db.runTransaction(async (prepare) => {
    let c = 0;
    for (const ch of channels) {
      if (!ch.name || !ch.stream_url) continue;
      await prepare('INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), ch.name, ch.group_name || 'عام', ch.logo_url || '', ch.stream_url, ch.sort_order || 0);
      c++;
    }
    return c;
  });
  res.status(201).json({ added: count });
});

router.put('/channels/:id', async (req, res) => {
  const { name, group_name, logo_url, stream_url, is_enabled, sort_order } = req.body;
  const ch = await db.prepare('SELECT id FROM channels WHERE id = ?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'القناة غير موجودة' });

  await db.prepare(`
    UPDATE channels SET
      name = COALESCE(?, name),
      group_name = COALESCE(?, group_name),
      logo_url = COALESCE(?, logo_url),
      stream_url = COALESCE(?, stream_url),
      is_enabled = COALESCE(?, is_enabled),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name || null, group_name || null, logo_url || null, stream_url || null, is_enabled ?? null, sort_order ?? null, req.params.id);

  res.json({ success: true });
});

router.delete('/channels/:id', async (req, res) => {
  await db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.delete('/channels', async (req, res) => {
  await db.prepare('DELETE FROM channels').run();
  res.json({ success: true });
});

// ─── VOD Management ──────────────────────────────────────
router.post('/vod', async (req, res) => {
  const { title, vod_type, category, poster_url, year, rating, stream_token, description } = req.body;
  if (!title || !vod_type) return res.status(400).json({ error: 'العنوان والنوع مطلوبان' });

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, vod_type, category || '', poster_url || '', year || '', rating || '', stream_token || '', description || '');

  res.status(201).json({ id, title, vod_type });
});

router.post('/vod/bulk', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'مصفوفة المحتوى مطلوبة' });

  const count = await db.runTransaction(async (prepare) => {
    let c = 0;
    for (const v of items) {
      if (!v.title || !v.vod_type) continue;
      await prepare('INSERT INTO vod (id, title, vod_type, category, poster_url, year, rating, stream_token, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), v.title, v.vod_type, v.category || '', v.poster_url || '', v.year || '', v.rating || '', v.stream_token || '', v.description || '');
      c++;
    }
    return c;
  });
  res.status(201).json({ added: count });
});

router.put('/vod/:id', async (req, res) => {
  const { title, category, poster_url, year, rating, stream_token, description } = req.body;
  const item = await db.prepare('SELECT id FROM vod WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'المحتوى غير موجود' });

  await db.prepare(`
    UPDATE vod SET
      title = COALESCE(?, title),
      category = COALESCE(?, category),
      poster_url = COALESCE(?, poster_url),
      year = COALESCE(?, year),
      rating = COALESCE(?, rating),
      stream_token = COALESCE(?, stream_token),
      description = COALESCE(?, description)
    WHERE id = ?
  `).run(title || null, category || null, poster_url || null, year || null, rating || null, stream_token || null, description || null, req.params.id);

  res.json({ success: true });
});

router.delete('/vod/:id', async (req, res) => {
  await db.prepare('DELETE FROM vod WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Episodes Management ─────────────────────────────────
router.post('/vod/:id/episodes', async (req, res) => {
  const { title, season, episode_num, stream_token } = req.body;
  if (!title || !stream_token) return res.status(400).json({ error: 'العنوان ورمز البث مطلوبان' });

  const vod = await db.prepare('SELECT id FROM vod WHERE id = ?').get(req.params.id);
  if (!vod) return res.status(404).json({ error: 'المسلسل غير موجود' });

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO episodes (id, vod_id, title, season, episode_num, stream_token)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, title, season || 1, episode_num || 1, stream_token);

  res.status(201).json({ id, title, season: season || 1, episode_num: episode_num || 1 });
});

router.post('/vod/:id/episodes/bulk', async (req, res) => {
  const { episodes } = req.body;
  if (!Array.isArray(episodes)) return res.status(400).json({ error: 'مصفوفة الحلقات مطلوبة' });

  const vod = await db.prepare('SELECT id FROM vod WHERE id = ?').get(req.params.id);
  if (!vod) return res.status(404).json({ error: 'المسلسل غير موجود' });

  const count = await db.runTransaction(async (prepare) => {
    let c = 0;
    for (const ep of episodes) {
      if (!ep.title || !ep.stream_token) continue;
      await prepare('INSERT INTO episodes (id, vod_id, title, season, episode_num, stream_token) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), req.params.id, ep.title, ep.season || 1, ep.episode_num || 1, ep.stream_token);
      c++;
    }
    return c;
  });
  res.status(201).json({ added: count });
});

router.delete('/episodes/:id', async (req, res) => {
  await db.prepare('DELETE FROM episodes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
