const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ma-streaming-secret-key-change-in-production';
const JWT_EXPIRES = '30d';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Middleware: require authentication
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }

  try {
    const decoded = verifyToken(header.slice(7));
    const user = db.prepare('SELECT id, username, email, display_name, plan, role, is_admin, is_blocked FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
    if (user.is_blocked) return res.status(403).json({ error: 'الحساب محظور' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'رمز غير صالح أو منتهي الصلاحية' });
  }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.is_admin && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'صلاحيات المشرف مطلوبة' });
    }
    next();
  });
}

// Middleware: require premium subscription
function requirePremium(req, res, next) {
  const user = req.user;
  // admins and agents always allowed
  if (user.is_admin || user.role === 'admin' || user.role === 'agent') return next();

  const db = require('../db');
  const fresh = db.prepare('SELECT plan, expires_at, role FROM users WHERE id = ?').get(user.id);
  if (!fresh) return res.status(401).json({ error: 'المستخدم غير موجود' });

  // allow admin/agent roles
  if (fresh.role === 'admin' || fresh.role === 'agent') return next();

  if (fresh.plan !== 'premium') {
    return res.status(403).json({
      error: 'subscription_required',
      message: 'هذا المحتوى يتطلب اشتراك بريميوم',
      requiresSubscription: true,
    });
  }

  if (fresh.expires_at && new Date(fresh.expires_at) < new Date()) {
    db.prepare("UPDATE users SET plan = 'free', expires_at = NULL WHERE id = ?").run(user.id);
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
