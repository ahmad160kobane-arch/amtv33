const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ma-streaming-secret-key-change-in-production';
const JWT_EXPIRES = '30d';

function generateToken(userId, loginVersion = 0) {
  return jwt.sign({ userId, lv: loginVersion }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ─── In-memory login_version cache (5s TTL) to reduce DB pressure ───
const _lvCache = new Map();
const LV_CACHE_TTL = 5000;

async function _getLoginVersion(userId) {
  const cached = _lvCache.get(userId);
  if (cached && Date.now() - cached.ts < LV_CACHE_TTL) return cached.lv;
  const row = await db.prepare('SELECT login_version FROM users WHERE id = ?').get(userId);
  const lv = row ? (row.login_version || 0) : 0;
  _lvCache.set(userId, { lv, ts: Date.now() });
  return lv;
}

// Middleware: require authentication
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }

  try {
    const decoded = verifyToken(header.slice(7));
    const user = await db.prepare('SELECT id, username, email, display_name, plan, role, is_admin, is_blocked, login_version FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
    if (user.is_blocked) return res.status(403).json({ error: 'الحساب محظور' });

    // ─── Single-session enforcement: check login_version matches ───
    const dbLv = user.login_version || 0;
    const jwtLv = decoded.lv ?? 0;
    if (dbLv !== jwtLv) {
      _lvCache.delete(decoded.userId);
      return res.status(401).json({
        error: 'session_invalidated',
        code: 'SESSION_INVALIDATED',
        message: 'تم تسجيل الدخول من جهاز آخر. يرجى تسجيل الدخول مجدداً.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'رمز غير صالح أو منتهي الصلاحية' });
  }
}

// Middleware: require admin role
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.user.is_admin && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'صلاحيات المشرف مطلوبة' });
    }
    next();
  });
}

// Middleware: require premium subscription
async function requirePremium(req, res, next) {
  const user = req.user;
  if (user.is_admin || user.role === 'admin' || user.role === 'agent') return next();

  const fresh = await db.prepare('SELECT plan, expires_at, role FROM users WHERE id = ?').get(user.id);
  if (!fresh) return res.status(401).json({ error: 'المستخدم غير موجود' });
  if (fresh.role === 'admin' || fresh.role === 'agent') return next();

  if (fresh.plan !== 'premium') {
    return res.status(403).json({
      error: 'subscription_required',
      message: 'هذا المحتوى يتطلب اشتراك بريميوم',
      requiresSubscription: true,
    });
  }

  if (fresh.expires_at && new Date(fresh.expires_at) < new Date()) {
    await db.prepare("UPDATE users SET plan = 'free', expires_at = NULL WHERE id = ?").run(user.id);
    return res.status(403).json({
      error: 'subscription_expired',
      message: 'انتهت صلاحية اشتراكك، يرجى التجديد',
      requiresSubscription: true,
      expired: true,
    });
  }

  next();
}

module.exports = { generateToken, verifyToken, requireAuth, requireAdmin, requirePremium, JWT_SECRET };
