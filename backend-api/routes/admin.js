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
  const { name, group_name, logo_url, stream_url, sort_order, is_direct_passthrough } = req.body;
  if (!name || !stream_url) return res.status(400).json({ error: 'الاسم ورابط البث مطلوبان' });

  const id = uuidv4();
  await db.prepare(`
    INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order, is_direct_passthrough, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, name, group_name || 'عام', logo_url || '', stream_url, sort_order || 0, is_direct_passthrough || 0);

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
  const { name, group_name, logo_url, stream_url, is_enabled, sort_order, is_direct_passthrough } = req.body;
  const ch = await db.prepare('SELECT id FROM channels WHERE id = ?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'القناة غير موجودة' });

  await db.prepare(`
    UPDATE channels SET
      name = COALESCE(?, name),
      group_name = COALESCE(?, group_name),
      logo_url = COALESCE(?, logo_url),
      stream_url = COALESCE(?, stream_url),
      is_enabled = COALESCE(?, is_enabled),
      sort_order = COALESCE(?, sort_order),
      is_direct_passthrough = COALESCE(?, is_direct_passthrough)
    WHERE id = ?
  `).run(name || null, group_name || null, logo_url || null, stream_url || null, is_enabled ?? null, sort_order ?? null, is_direct_passthrough ?? null, req.params.id);

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

// ─── IPTV Config Management ─────────────────────────────
router.get('/iptv-config', async (req, res) => {
  let cfg = await db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
  if (!cfg) cfg = { server_url: '', username: '', password: '' };
  res.json(cfg);
});

router.put('/iptv-config', async (req, res) => {
  const { server_url, username, password } = req.body;
  const existing = await db.prepare('SELECT id FROM iptv_config WHERE id = 1').get();
  if (existing) {
    await db.prepare('UPDATE iptv_config SET server_url = ?, username = ?, password = ? WHERE id = 1')
      .run(server_url || '', username || '', password || '');
  } else {
    await db.prepare('INSERT INTO iptv_config (id, server_url, username, password) VALUES (1, ?, ?, ?)')
      .run(server_url || '', username || '', password || '');
  }
  res.json({ success: true });
});

// ─── User Role Management ───────────────────────────────
router.put('/users/:id/role', async (req, res) => {
  const { role, balance } = req.body;
  const user = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  let sql = 'UPDATE users SET role = ?';
  const params = [role || 'user'];
  if (balance !== undefined) { sql += ', balance = ?'; params.push(balance); }
  if (role === 'admin') { sql += ', is_admin = 1'; }
  else { sql += ', is_admin = 0'; }
  sql += ' WHERE id = ?';
  params.push(req.params.id);
  await db.prepare(sql).run(...params);
  res.json({ success: true });
});

// ─── Agents Management ──────────────────────────────────
router.get('/agents', async (req, res) => {
  const agents = await db.prepare(
    `SELECT u.id, u.username, u.email, u.display_name, u.balance, u.created_at,
     (SELECT COUNT(*) FROM activation_codes WHERE created_by = u.id) as total_codes,
     (SELECT COUNT(*) FROM activation_codes WHERE created_by = u.id AND status = 'used') as used_codes,
     (SELECT COUNT(*) FROM activation_codes WHERE created_by = u.id AND status = 'unused') as unused_codes
     FROM users u WHERE u.role = 'agent' ORDER BY u.created_at DESC`
  ).all();
  res.json({ agents });
});

router.put('/agents/:id/balance', async (req, res) => {
  const { amount, type, description } = req.body;
  if (!amount || !type) return res.status(400).json({ error: 'المبلغ والنوع مطلوبان' });

  const agent = await db.prepare('SELECT id, balance, role FROM users WHERE id = ? AND role = ?').get(req.params.id, 'agent');
  if (!agent) return res.status(404).json({ error: 'الوكيل غير موجود' });

  const newBalance = type === 'credit' ? agent.balance + amount : agent.balance - amount;
  if (newBalance < 0) return res.status(400).json({ error: 'الرصيد غير كافٍ' });

  await db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, agent.id);
  await db.prepare(
    'INSERT INTO agent_transactions (id, agent_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), agent.id, type, amount, newBalance, description || (type === 'credit' ? 'إيداع من الإدارة' : 'سحب من الإدارة'));

  res.json({ success: true, balance: newBalance });
});

// ─── Cloud Server Status ────────────────────────────────
router.get('/cloud-status', async (req, res) => {
  const cloudUrl = process.env.CLOUD_SERVER_URL || 'http://62.171.153.204:8090';
  try {
    const r = await fetch(`${cloudUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    res.json({ online: true, ...data, url: cloudUrl });
  } catch (e) {
    res.json({ online: false, error: e.message, url: cloudUrl });
  }
});

// ─── System Logs (in-memory ring buffer) ────────────────
const _logs = [];
const MAX_LOGS = 500;

function addLog(level, message, meta = {}) {
  _logs.push({ id: uuidv4(), level, message, meta, timestamp: new Date().toISOString() });
  if (_logs.length > MAX_LOGS) _logs.shift();
}

// Expose for other modules
router._addLog = addLog;

router.get('/logs', async (req, res) => {
  const { level, limit = 100, offset = 0 } = req.query;
  let filtered = level ? _logs.filter(l => l.level === level) : [..._logs];
  filtered.reverse(); // newest first
  const total = filtered.length;
  const items = filtered.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ logs: items, total });
});

router.delete('/logs', async (req, res) => {
  _logs.length = 0;
  res.json({ success: true });
});

// ─── Extended Stats ─────────────────────────────────────
router.get('/stats/extended', async (req, res) => {
  const users = await db.prepare('SELECT COUNT(*) as c FROM users').get();
  const premium = await db.prepare("SELECT COUNT(*) as c FROM users WHERE plan = 'premium'").get();
  const blocked = await db.prepare('SELECT COUNT(*) as c FROM users WHERE is_blocked = 1').get();
  const agents = await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'agent'").get();
  const channels = await db.prepare('SELECT COUNT(*) as c FROM channels').get();
  const enabledCh = await db.prepare('SELECT COUNT(*) as c FROM channels WHERE is_enabled = 1').get();
  const movies = await db.prepare("SELECT COUNT(*) as c FROM vod WHERE vod_type = 'movie'").get();
  const series = await db.prepare("SELECT COUNT(*) as c FROM vod WHERE vod_type = 'series'").get();
  const episodes = await db.prepare('SELECT COUNT(*) as c FROM episodes').get();
  const codes = await db.prepare('SELECT COUNT(*) as c FROM activation_codes').get();
  const usedCodes = await db.prepare("SELECT COUNT(*) as c FROM activation_codes WHERE status = 'used'").get();
  const recentUsers = await db.prepare(
    'SELECT id, username, plan, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
  ).all();

  res.json({
    users: users.c, premium: premium.c, blocked: blocked.c, agents: agents.c,
    channels: channels.c, enabledChannels: enabledCh.c,
    movies: movies.c, series: series.c, episodes: episodes.c,
    totalCodes: codes.c, usedCodes: usedCodes.c,
    recentUsers,
  });
});

// ─── IPTV Search (Xtream API from Railway) ─────────────
router.get('/iptv-search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ channels: [] });

  try {
    let cfg = await db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
    if (!cfg || !cfg.server_url) return res.status(400).json({ error: 'لم يتم تعيين إعدادات IPTV' });

    const apiBase = `${cfg.server_url}/player_api.php?username=${cfg.username}&password=${cfg.password}`;
    const [catRes, streamRes] = await Promise.all([
      fetch(`${apiBase}&action=get_live_categories`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }),
      fetch(`${apiBase}&action=get_live_streams`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }),
    ]);
    const categories = await catRes.json();
    const streams = await streamRes.json();

    const catById = {};
    for (const c of (Array.isArray(categories) ? categories : [])) {
      catById[c.category_id] = c.category_name || 'عام';
    }

    const query = q.toLowerCase();
    const filtered = (Array.isArray(streams) ? streams : [])
      .filter(s => {
        const name = (s.name || '').toLowerCase();
        const cat = (catById[s.category_id] || '').toLowerCase();
        return name.includes(query) || cat.includes(query);
      })
      .slice(0, 100)
      .map(s => ({
        stream_id: s.stream_id,
        name: s.name || '',
        logo: s.stream_icon || '',
        category: catById[s.category_id] || 'عام',
        stream_url: `${cfg.server_url}/live/${cfg.username}/${cfg.password}/${s.stream_id}.m3u8`,
      }));

    res.json({ channels: filtered, total: filtered.length });
  } catch (e) {
    res.status(500).json({ error: `خطأ: ${e.message}` });
  }
});

// ─── IPTV Sync: load all channels from Xtream ──────────
router.post('/iptv-sync', async (req, res) => {
  try {
    let cfg = await db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
    if (!cfg || !cfg.server_url) return res.status(400).json({ error: 'لم يتم تعيين إعدادات IPTV' });

    const apiBase = `${cfg.server_url}/player_api.php?username=${cfg.username}&password=${cfg.password}`;
    const [catRes, streamRes] = await Promise.all([
      fetch(`${apiBase}&action=get_live_categories`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) }),
      fetch(`${apiBase}&action=get_live_streams`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) }),
    ]);
    const categories = await catRes.json();
    const streams = await streamRes.json();

    if (!Array.isArray(streams)) return res.status(500).json({ error: 'فشل جلب القنوات من السيرفر' });

    const catById = {};
    for (const c of (Array.isArray(categories) ? categories : [])) {
      catById[c.category_id] = c.category_name || 'عام';
    }

    // Clear old channels and insert all
    await db.prepare('DELETE FROM channels').run();
    let count = 0;
    for (const s of streams) {
      if (!s.stream_id || !s.name) continue;
      const id = uuidv4();
      const streamUrl = `${cfg.server_url}/live/${cfg.username}/${cfg.password}/${s.stream_id}.m3u8`;
      await db.prepare(
        'INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?, ?, 1)'
      ).run(id, s.name, catById[s.category_id] || 'عام', s.stream_icon || '', streamUrl, count);
      count++;
    }

    res.json({ success: true, total: streams.length, saved: count });
  } catch (e) {
    res.status(500).json({ error: `خطأ: ${e.message}` });
  }
});

// ─── IPTV: add selected channels from search ───────────
router.post('/iptv-add-channels', async (req, res) => {
  const { channels } = req.body;
  if (!Array.isArray(channels) || channels.length === 0) return res.status(400).json({ error: 'لم يتم اختيار قنوات' });

  let count = 0;
  for (const ch of channels) {
    if (!ch.name || !ch.stream_url) continue;
    const existing = await db.prepare('SELECT id FROM channels WHERE name = ? AND stream_url = ?').get(ch.name, ch.stream_url);
    if (existing) continue;
    const id = uuidv4();
    await db.prepare(
      'INSERT INTO channels (id, name, group_name, logo_url, stream_url, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(id, ch.name, ch.category || 'عام', ch.logo || '', ch.stream_url, 0);
    count++;
  }
  res.json({ success: true, added: count });
});

module.exports = router;
