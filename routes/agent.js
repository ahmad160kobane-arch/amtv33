const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Middleware: تحقق من أن المستخدم وكيل أو مشرف
function requireAgent(req, res, next) {
  const role = req.user.role;
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'هذه الصفحة للوكلاء فقط' });
  }
  next();
}

// ─── GET /api/agent/info ─────────────────────────────────
// معلومات الوكيل: الرصيد، إجمالي الكودات، الكودات المستخدمة
router.get('/info', requireAuth, requireAgent, async (req, res) => {
  const user = await db.prepare(
    'SELECT id, username, display_name, balance, role, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  const totalCodes = await db.prepare(
    'SELECT COUNT(*) as cnt FROM activation_codes WHERE created_by = ?'
  ).get(req.user.id);

  const usedCodes = await db.prepare(
    "SELECT COUNT(*) as cnt FROM activation_codes WHERE created_by = ? AND status = 'used'"
  ).get(req.user.id);

  const unusedCodes = await db.prepare(
    "SELECT COUNT(*) as cnt FROM activation_codes WHERE created_by = ? AND status = 'unused'"
  ).get(req.user.id);

  res.json({
    agent: user,
    stats: {
      totalCodes: totalCodes.cnt,
      usedCodes: usedCodes.cnt,
      unusedCodes: unusedCodes.cnt,
    },
  });
});

// ─── GET /api/agent/plans ────────────────────────────────
// جلب خطط الاشتراك المتاحة مع الأسعار
router.get('/plans', requireAuth, requireAgent, async (req, res) => {
  const plans = await db.prepare(
    'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY duration_days ASC'
  ).all();
  res.json({ plans });
});

// ─── POST /api/agent/create-code ────────────────────────
// إنشاء كود تفعيل جديد
// body: { plan_id, quantity? }
router.post('/create-code', requireAuth, requireAgent, async (req, res) => {
  const { plan_id, quantity = 1 } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id مطلوب' });

  const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 50); // max 50 كود دفعة واحدة

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1').get(plan_id);
  if (!plan) return res.status(404).json({ error: 'الخطة غير موجودة' });

  // التحقق من رصيد الوكيل
  const agent = await db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
  const totalCost = plan.price_usd * qty;
  if (agent.balance < totalCost) {
    return res.status(400).json({
      error: `رصيدك غير كافٍ. المطلوب: $${totalCost.toFixed(2)} | رصيدك: $${agent.balance.toFixed(2)}`,
    });
  }

  // إنشاء الكودات
  const codes = [];

  await db.runTransaction(async (prepare) => {
    for (let i = 0; i < qty; i++) {
      const codeId = uuidv4();
      const rawCode = uuidv4().replace(/-/g, '').toUpperCase().substring(0, 12);
      const formattedCode = `MA-${rawCode.substring(0,4)}-${rawCode.substring(4,8)}-${rawCode.substring(8,12)}`;
      await prepare('INSERT INTO activation_codes (id, code, plan_id, created_by) VALUES (?, ?, ?, ?)').run(codeId, formattedCode, plan_id, req.user.id);
      codes.push({ id: codeId, code: formattedCode });
    }
    await prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(totalCost, req.user.id);
    const bal = await prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    await prepare('INSERT INTO agent_transactions (id, agent_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), req.user.id, 'debit', totalCost, bal.balance, `شراء ${qty} كود - ${plan.name}`);
  });

  const updatedAgent = await db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);

  res.json({
    success: true,
    codes,
    plan: { name: plan.name, duration_days: plan.duration_days },
    cost: totalCost,
    remaining_balance: updatedAgent.balance,
  });
});

// ─── GET /api/agent/codes ────────────────────────────────
// جلب الكودات التي أنشأها الوكيل مع حالة كل كود
router.get('/codes', requireAuth, requireAgent, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT ac.id, ac.code, ac.status, ac.created_at, ac.activated_at,
           sp.name as plan_name, sp.duration_days,
           u.username as activated_by_username
    FROM activation_codes ac
    JOIN subscription_plans sp ON ac.plan_id = sp.id
    LEFT JOIN users u ON ac.activated_by = u.id
    WHERE ac.created_by = ?
  `;
  const params = [req.user.id];

  if (status) {
    query += ' AND ac.status = ?';
    params.push(status);
  }

  query += ' ORDER BY ac.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const codes = await db.prepare(query).all(...params);

  const total = await db.prepare(
    `SELECT COUNT(*) as cnt FROM activation_codes WHERE created_by = ?${status ? ' AND status = ?' : ''}`
  ).get(...(status ? [req.user.id, status] : [req.user.id]));

  res.json({ codes, total: total.cnt });
});

// ─── POST /api/agent/cancel-code ────────────────────────
// إلغاء كود غير مستخدم واسترجاع الرصيد
router.post('/cancel-code', requireAuth, requireAgent, async (req, res) => {
  const { code_id } = req.body;
  if (!code_id) return res.status(400).json({ error: 'code_id مطلوب' });

  const code = await db.prepare(
    'SELECT ac.*, sp.price_usd FROM activation_codes ac JOIN subscription_plans sp ON ac.plan_id = sp.id WHERE ac.id = ? AND ac.created_by = ?'
  ).get(code_id, req.user.id);

  if (!code) return res.status(404).json({ error: 'الكود غير موجود' });
  if (code.status !== 'unused') return res.status(400).json({ error: 'لا يمكن إلغاء كود مستخدم أو ملغى' });

  await db.runTransaction(async (prepare) => {
    await prepare("UPDATE activation_codes SET status = 'cancelled' WHERE id = ?").run(code_id);
    await prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(code.price_usd, req.user.id);
    const bal = await prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
    await prepare(
      'INSERT INTO agent_transactions (id, agent_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), req.user.id, 'credit', code.price_usd, bal.balance, `استرجاع كود: ${code.code}`);
  });

  const updated = await db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, refunded: code.price_usd, balance: updated.balance });
});

// ─── GET /api/agent/transactions ─────────────────────────
// سجل المعاملات المالية للوكيل
router.get('/transactions', requireAuth, requireAgent, async (req, res) => {
  const { limit = 30, offset = 0 } = req.query;
  const txs = await db.prepare(
    'SELECT * FROM agent_transactions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(req.user.id, parseInt(limit), parseInt(offset));
  const total = await db.prepare('SELECT COUNT(*) as cnt FROM agent_transactions WHERE agent_id = ?').get(req.user.id);
  res.json({ transactions: txs, total: total.cnt });
});

// ─── GET /api/agent/all-plans (للمشرف: تعديل الأسعار) ───
router.get('/all-plans', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'للمشرفين فقط' });
  const plans = await db.prepare('SELECT * FROM subscription_plans ORDER BY duration_days ASC').all();
  res.json({ plans });
});

// ─── PUT /api/agent/plan/:id (للمشرف: تعديل سعر الخطة) ──
router.put('/plan/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'للمشرفين فقط' });

  const { price_usd, name, is_active } = req.body;
  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'الخطة غير موجودة' });

  await db.prepare(`
    UPDATE subscription_plans SET
      price_usd = COALESCE(?, price_usd),
      name = COALESCE(?, name),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    price_usd ?? null,
    name ?? null,
    is_active ?? null,
    req.params.id
  );

  res.json({ success: true, plan: await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(req.params.id) });
});

// ─── POST /api/agent/add-balance (للمشرف: شحن رصيد وكيل) ─
router.post('/add-balance', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'للمشرفين فقط' });

  const { agent_id, amount } = req.body;
  if (!agent_id || !amount || amount <= 0) return res.status(400).json({ error: 'agent_id و amount مطلوبان' });

  const agent = await db.prepare("SELECT id, username, balance FROM users WHERE id = ? AND role = 'agent'").get(agent_id);
  if (!agent) return res.status(404).json({ error: 'الوكيل غير موجود' });

  await db.runTransaction(async (prepare) => {
    await prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, agent_id);
    const bal = await prepare('SELECT balance FROM users WHERE id = ?').get(agent_id);
    await prepare(
      'INSERT INTO agent_transactions (id, agent_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), agent_id, 'credit', amount, bal.balance, `شحن رصيد من المشرف`);
  });
  const updated = await db.prepare('SELECT balance FROM users WHERE id = ?').get(agent_id);

  res.json({ success: true, agent_id, added: amount, new_balance: updated.balance });
});

// ─── GET /api/agent/list (للمشرف: قائمة الوكلاء) ─────────
router.get('/list', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'للمشرفين فقط' });

  const agents = await db.prepare(`
    SELECT u.id, u.username, u.display_name, u.balance, u.created_at,
           COUNT(ac.id) as total_codes,
           SUM(CASE WHEN ac.status = 'used' THEN 1 ELSE 0 END) as used_codes
    FROM users u
    LEFT JOIN activation_codes ac ON u.id = ac.created_by
    WHERE u.role = 'agent'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  res.json({ agents });
});

// ─── POST /api/agent/set-role (للمشرف: تعيين وكيل) ──────
router.post('/set-role', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'للمشرفين فقط' });

  const { user_id, role } = req.body;
  if (!user_id || !role) return res.status(400).json({ error: 'user_id و role مطلوبان' });
  if (!['user', 'agent', 'admin'].includes(role)) return res.status(400).json({ error: 'role يجب أن يكون user أو agent أو admin' });

  const target = await db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });

  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user_id);
  res.json({ success: true, user_id, role });
});

module.exports = router;
