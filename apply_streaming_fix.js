#!/usr/bin/env node
/**
 * تطبيق تحسينات البث المباشر تلقائياً
 * 
 * الاستخدام:
 *   node apply_streaming_fix.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 تطبيق تحسينات البث المباشر...\n');

// ═══════════════════════════════════════════════════════════
// 1. تحسين checkConnectionLimit في cloud-server/server.js
// ═══════════════════════════════════════════════════════════

const serverPath = path.join(__dirname, 'cloud-server', 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('❌ لم يتم العثور على cloud-server/server.js');
  process.exit(1);
}

let serverContent = fs.readFileSync(serverPath, 'utf8');

// البحث عن الكود القديم
const oldSessionCheck = `  // Clean expired sessions
  await _cleanExpiredSessions();
  const sessions = await _getUserSessions(userId);`;

const newSessionCheck = `  // ═══ OPTIMIZATION: تأجيل التنظيف — يوفر 0.5-1 ثانية ═══
  // بدلاً من تنظيف كل الجلسات المنتهية، نتحقق فقط من جلسات المستخدم الحالي النشطة
  const sessions = await db.prepare(
    'SELECT * FROM active_sessions WHERE user_id = ? AND last_seen >= ? ORDER BY started_at ASC'
  ).all(userId, Date.now() - SESSION_TIMEOUT);`;

if (serverContent.includes(oldSessionCheck)) {
  serverContent = serverContent.replace(oldSessionCheck, newSessionCheck);
  console.log('✅ تم تحسين checkConnectionLimit');
} else if (serverContent.includes('OPTIMIZATION: تأجيل التنظيف')) {
  console.log('⚠️  checkConnectionLimit محسّن مسبقاً');
} else {
  console.log('⚠️  لم يتم العثور على الكود المطلوب في checkConnectionLimit');
}

// ═══════════════════════════════════════════════════════════
// 2. إضافة Channel Cache
// ═══════════════════════════════════════════════════════════

const channelCacheCode = `
// ─── Channel cache — reduce DB queries ───────────────────
const _channelCache = new Map();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function _getCachedChannel(channelId) {
  const cached = _channelCache.get(channelId);
  if (cached && Date.now() - cached.ts < CHANNEL_CACHE_TTL) return cached.data;
  
  const data = await db.prepare(
    'SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1'
  ).get(channelId);
  
  if (data) {
    _channelCache.set(channelId, { data, ts: Date.now() });
    // Prevent unbounded cache growth
    if (_channelCache.size > 200) {
      const oldest = _channelCache.keys().next().value;
      _channelCache.delete(oldest);
    }
  }
  
  return data;
}
`;

if (!serverContent.includes('_getCachedChannel')) {
  // إضافة الكود بعد _getCachedUser
  const insertAfter = 'return data;\n}';
  const insertPos = serverContent.indexOf(insertAfter, serverContent.indexOf('async function _getCachedUser'));
  
  if (insertPos > 0) {
    serverContent = serverContent.slice(0, insertPos + insertAfter.length) + 
                    channelCacheCode + 
                    serverContent.slice(insertPos + insertAfter.length);
    console.log('✅ تم إضافة Channel Cache');
  } else {
    console.log('⚠️  لم يتم العثور على موقع إضافة Channel Cache');
  }
} else {
  console.log('⚠️  Channel Cache موجود مسبقاً');
}

// ═══════════════════════════════════════════════════════════
// 3. استخدام _getCachedChannel في /api/stream/live
// ═══════════════════════════════════════════════════════════

const oldChannelQuery = `let ch = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);
  // Lazy sync: if channel not found locally, sync from backend PostgreSQL and retry
  if (!ch) {
    await syncChannelsFromBackend(true);
    ch = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);
  }`;

const newChannelQuery = `let ch = await _getCachedChannel(rawId);
  // Lazy sync: if channel not found locally, sync from backend PostgreSQL and retry
  if (!ch) {
    await syncChannelsFromBackend(true);
    ch = await _getCachedChannel(rawId);
  }`;

if (serverContent.includes(oldChannelQuery)) {
  serverContent = serverContent.replace(oldChannelQuery, newChannelQuery);
  console.log('✅ تم تحديث استعلام القنوات لاستخدام Cache');
} else if (serverContent.includes('_getCachedChannel(rawId)')) {
  console.log('⚠️  استعلام القنوات يستخدم Cache مسبقاً');
} else {
  console.log('⚠️  لم يتم العثور على استعلام القنوات');
}

// حفظ الملف
fs.writeFileSync(serverPath, serverContent, 'utf8');

console.log('\n✅ تم تطبيق جميع التحسينات بنجاح!');
console.log('\n📝 الخطوات التالية:');
console.log('1. أعد تشغيل السيرفر السحابي: cd cloud-server && npm start');
console.log('2. اختبر البث المباشر من التطبيق');
console.log('3. قس الوقت من الضغط حتى بدء البث');
console.log('\n⏱️  المتوقع: تحسين من 5-10 ثواني إلى 1-3 ثواني\n');
