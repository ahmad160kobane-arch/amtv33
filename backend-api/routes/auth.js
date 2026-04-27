const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة (username, email, password)' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const exists = await db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (exists) {
      return res.status(409).json({ error: 'اسم المستخدم أو البريد مسجل مسبقاً' });
    }

    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 10);

    await db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, plan, login_version)
      VALUES (?, ?, ?, ?, ?, 'free', 0)
    `).run(id, username.trim(), email.trim().toLowerCase(), password_hash, display_name || username);

    const token = generateToken(id, 0);

    res.status(201).json({
      token,
      user: { id, username, email: email.toLowerCase(), display_name: display_name || username, plan: 'free' },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم/البريد وكلمة المرور' });
    }

    const user = await db.prepare(
      'SELECT id, username, email, password_hash, display_name, avatar_url, plan, expires_at, max_connections, is_admin, is_blocked, role FROM users WHERE username = ? OR email = ?'
    ).get(login.trim(), login.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'الحساب محظور - تواصل مع الدعم' });
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // ─── Session enforcement based on max_connections ──────────────
    // max_connections = 1 → increment login_version on every login
    //   → all other devices' JWTs become invalid immediately (kicked out)
    // max_connections > 1 → keep same login_version → multiple devices stay logged in
    const maxConn = user.max_connections || 1;
    let newLoginVersion;
    if (maxConn <= 1) {
      const updated = await db.prepare(
        'UPDATE users SET login_version = COALESCE(login_version, 0) + 1 WHERE id = ? RETURNING login_version'
      ).get(user.id);
      newLoginVersion = updated ? updated.login_version : 1;
    } else {
      // Multi-device plan: keep current login_version, don't invalidate other devices
      const current = await db.prepare('SELECT COALESCE(login_version, 0) as lv FROM users WHERE id = ?').get(user.id);
      newLoginVersion = current ? current.lv : 0;
    }

    const token = generateToken(user.id, newLoginVersion);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        plan: user.plan,
        expires_at: user.expires_at,
        max_connections: user.max_connections || 1,
        is_admin: !!user.is_admin,
        role: user.role || 'user',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/auth/me — lightweight user info (used by cloud-server)
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.prepare(
    'SELECT id, username, plan, expires_at, max_connections, is_admin, is_blocked, role FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ user: { ...user, max_connections: user.max_connections || 1, is_admin: !!user.is_admin, is_blocked: !!user.is_blocked, role: user.role || 'user' } });
});

// GET /api/auth/profile
router.get('/profile', requireAuth, async (req, res) => {
  const user = await db.prepare(
    'SELECT id, username, email, display_name, avatar_url, plan, expires_at, max_connections, is_admin, role, balance, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const favCount = await db.prepare('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?').get(req.user.id).c;
  const historyCount = await db.prepare('SELECT COUNT(*) as c FROM watch_history WHERE user_id = ?').get(req.user.id).c;

  // فحص انتهاء الاشتراك تلقائياً
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    await db.prepare("UPDATE users SET plan = 'free', expires_at = NULL WHERE id = ?").run(req.user.id);
    user.plan = 'free';
    user.expires_at = null;
  }

  res.json({
    ...user,
    is_admin: !!user.is_admin,
    role: user.role || 'user',
    stats: { favorites: favCount, watched: historyCount },
  });
});

// GET /api/auth/subscription
router.get('/subscription', requireAuth, async (req, res) => {
  const user = await db.prepare(
    'SELECT id, plan, expires_at, max_connections FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  // فحص انتهاء الاشتراك
  let plan = user.plan;
  let expires_at = user.expires_at;
  if (expires_at && new Date(expires_at) < new Date()) {
    await db.prepare("UPDATE users SET plan = 'free', expires_at = NULL WHERE id = ?").run(req.user.id);
    plan = 'free';
    expires_at = null;
  }

  const isPremium = plan === 'premium';
  let daysLeft = null;
  if (isPremium && expires_at) {
    const diff = new Date(expires_at) - new Date();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  res.json({ plan, expires_at, isPremium, daysLeft, max_connections: user.max_connections || 1 });
});

// POST /api/auth/activate-code
router.post('/activate-code', requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'الكود مطلوب' });

  const activation = await db.prepare(`
    SELECT ac.*, sp.duration_days, sp.max_connections as plan_max_connections, sp.name as plan_name
    FROM activation_codes ac
    JOIN subscription_plans sp ON ac.plan_id = sp.id
    WHERE ac.code = ?
  `).get(code.trim().toUpperCase());

  if (!activation) return res.status(404).json({ error: 'الكود غير صحيح' });
  if (activation.status !== 'unused') return res.status(400).json({ error: 'هذا الكود مستخدم أو ملغى' });

  const user = await db.prepare('SELECT plan, expires_at FROM users WHERE id = ?').get(req.user.id);

  // حساب تاريخ الانتهاء الجديد
  let newExpiry;
  if (user.plan === 'premium' && user.expires_at && new Date(user.expires_at) > new Date()) {
    // إضافة الأيام على الاشتراك الحالي
    newExpiry = new Date(user.expires_at);
  } else {
    newExpiry = new Date();
  }
  newExpiry.setDate(newExpiry.getDate() + activation.duration_days);
  const expiryStr = newExpiry.toISOString();

  const maxConn = activation.max_connections || activation.plan_max_connections || 1;

  await db.runTransaction(async (prepare) => {
    await prepare(
      "UPDATE activation_codes SET status = 'used', activated_by = ?, activated_at = NOW() WHERE id = ?"
    ).run(req.user.id, activation.id);
    await prepare(
      "UPDATE users SET plan = 'premium', expires_at = ?, max_connections = ? WHERE id = ?"
    ).run(expiryStr, maxConn, req.user.id);
  });

  res.json({
    success: true,
    plan: 'premium',
    expires_at: expiryStr,
    max_connections: maxConn,
    plan_name: activation.plan_name,
    duration_days: activation.duration_days,
    message: `تم تفعيل الاشتراك ${activation.plan_name} بنجاح!`,
  });
});

// POST /api/auth/history — record a watch event from the mobile player
router.post('/history', requireAuth, async (req, res) => {
  const { item_id, item_type = 'vod', title = '', poster = '', content_type = 'movie' } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id مطلوب' });

  try {
    // Upsert: update watched_at if already exists
    const existing = await db.prepare('SELECT id FROM watch_history WHERE user_id = ? AND item_id = ?').get(req.user.id, String(item_id));
    if (existing) {
      await db.prepare("UPDATE watch_history SET watched_at = NOW(), title = COALESCE(NULLIF(?, ''), title), poster = COALESCE(NULLIF(?, ''), poster), content_type = COALESCE(NULLIF(?, ''), content_type) WHERE id = ?")
        .run(title, poster, content_type, existing.id);
    } else {
      await db.prepare("INSERT INTO watch_history (id, user_id, item_id, item_type, title, poster, content_type) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(require('crypto').randomUUID(), req.user.id, String(item_id), item_type, title, poster, content_type);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('History record error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/auth/history
router.get('/history', requireAuth, async (req, res) => {
  const { limit = 30, offset = 0 } = req.query;
  const items = await db.prepare(`
    SELECT id, item_id, item_type, watched_at,
           COALESCE(title, item_id) as title,
           COALESCE(poster, '') as poster,
           COALESCE(content_type, 'movie') as content_type
    FROM watch_history
    WHERE user_id = ?
    ORDER BY watched_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, parseInt(limit), parseInt(offset));
  const total = await db.prepare('SELECT COUNT(*) as cnt FROM watch_history WHERE user_id = ?').get(req.user.id);
  res.json({ items, total: total.cnt });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  const { display_name, avatar_url } = req.body;

  await db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
    .run(display_name || null, avatar_url || null, req.user.id);

  res.json({ success: true });
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
  }

  const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }

  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(new_password, 10), req.user.id);

  res.json({ success: true });
});

// POST /api/auth/logout — invalidates all existing sessions for this user
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Increment login_version → all existing JWTs (other devices) become invalid
    await db.prepare(
      'UPDATE users SET login_version = COALESCE(login_version, 0) + 1 WHERE id = ?'
    ).run(req.user.id);

    // Also release all stream sessions
    await db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(req.user.id);

    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

module.exports = router;
