/**

 * Ø§Ù„Ø³ÙŠØ±ÙØ± Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠ v3

 * 

 * - Ù…ØªØµÙ„ Ø¨Ù‚Ø§Ø¹Ø¯Ø© Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¨Ø§Ùƒ Ø§Ù†Ø¯ Ù…Ø¨Ø§Ø´Ø±Ø©

 * - ÙŠØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… (JWT) Ù‚Ø¨Ù„ Ø§Ù„Ø¨Ø«

 * - ÙŠØ­Ø¯Ù‘Ø« Ø±ÙˆØ§Ø¨Ø· Ø§Ù„Ø¨Ø« ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¹Ù†Ø¯ Ø§Ù„ØªØ´ØºÙŠÙ„

 * - ÙŠÙ‚Ø¯Ù… Ø§Ù„Ø¨Ø« Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù„ØªØ·Ø¨ÙŠÙ‚ (Ø¨Ø¯ÙˆÙ† ÙˆØ³ÙŠØ·)

 */

const express = require('express');

const cors = require('cors');

const path = require('path');

const fs = require('fs');

const http = require('http');

const https = require('https');

const jwt = require('jsonwebtoken');

const config = require('./config');

const db = require('./db');

const StreamManager = require('./lib/stream-manager');

const VodProxy = require('./lib/vod-proxy');

const IptvUpdater = require('./lib/iptv-updater');

const { resolveStream } = require('./lib/vidsrc-resolver');

const { resolveVidlinkStream } = require('./lib/vidlink-resolver');

const { resolveConsumetStream } = require('./lib/consumet-resolver');

const { extractStream } = require('./lib/stream-extractor');

const { extractVidSrcM3U8 } = require('./lib/vidsrc-m3u8-extractor');

const { scrapeEmbedSources } = require('./lib/embed-scraper');

const { puppeteerExtract } = require('./lib/puppeteer-extractor');

const HlsProxy = require('./lib/hls-proxy');

const LiveProxy = require('./lib/live-proxy');

const { XTREAM, searchAccountChannels, addChannelsToDB, getChannelAccount, refreshChannelStream, initXtreamFromDB } = require('./lib/xtream');

const vidsrcApi = require('./lib/vidsrc-api'); // DISABLED — replaced by xtream-vod

const xtreamVod = require('./lib/xtream-vod');

const { fetchArabicSubtitles } = require('./lib/subtitle-fetcher');

const { initLuluStream, getLuluStream } = require('./lib/lulustream');



// ─── PostgreSQL (shared with backend-api) ───────────────────

// db module handles connection + table init in db.init()



console.log('[DB] PostgreSQL mode');



const app = express();

const streamManager = new StreamManager();

const vodProxy = new VodProxy();

const hlsProxy = new HlsProxy();

const liveProxy = new LiveProxy();



// ─── HTTP Agents for upstream connections (keep-alive, high concurrency) ───

const upstreamHttpAgent = new http.Agent({

  keepAlive: true,

  keepAliveMsecs: 30000,

  maxSockets: 80,

  maxFreeSockets: 30,

  timeout: 120000,

});

const upstreamHttpsAgent = new https.Agent({

  keepAlive: true,

  keepAliveMsecs: 30000,

  maxSockets: 80,

  maxFreeSockets: 30,

  timeout: 120000,

  rejectUnauthorized: false,

});



// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle JSON parsing errors specifically
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err.message);
    return res.status(400).json({ error: 'بيانات غير صالحة (Invalid JSON)' });
  }
  next(err);
});

// ─── خدمة ملفات الترجمة ────────────────────────────────
app.use('/subs', express.static('/root/subs', {
  setHeaders: (res) => { res.set('Access-Control-Allow-Origin', '*'); }
}));

// ─── IPTV Pass-through Proxy (لـ LuluStream remote upload) ────────
// LuluStream لا يستطيع تحميل من IPTV مباشرة (محجوب)
// هذا البروكسي يمرر البيانات بدون تخزين: IPTV → VPS (pass) → LuluStream
const IPTV_PROXY_SECRET = 'lulu_iptv_proxy_2026';
app.get('/iptv-proxy/:secret/:type/:filename', (req, res) => {
  const { secret, type, filename } = req.params;
  if (secret !== IPTV_PROXY_SECRET) return res.status(403).end('Forbidden');
  const dotIdx = filename.lastIndexOf('.');
  const id  = dotIdx > 0 ? filename.substring(0, dotIdx) : filename;
  const ext = dotIdx > 0 ? filename.substring(dotIdx + 1) : 'mp4';

  // بيانات IPTV لرفع الأفلام والمسلسلات
  const iptvBase = 'http://myhand.org:8080';
  const iptvUser = '3302196097';
  const iptvPass = '2474044847';

  // movie or series
  const urlPath = type === 'series'
    ? `/series/${iptvUser}/${iptvPass}/${id}.${ext}`
    : `/movie/${iptvUser}/${iptvPass}/${id}.${ext}`;
  const iptvUrl = `${iptvBase}${urlPath}`;

  console.log(`[IPTV-PROXY] Streaming ${type} ${id}.${ext}`);

  const proxyReq = http.get(iptvUrl, { timeout: 600000 }, (iptvRes) => {
    if (iptvRes.statusCode !== 200) {
      console.log(`[IPTV-PROXY] IPTV returned ${iptvRes.statusCode}`);
      return res.status(502).end('IPTV error');
    }
    // تمرير headers مهمة
    if (iptvRes.headers['content-length']) res.set('Content-Length', iptvRes.headers['content-length']);
    if (iptvRes.headers['content-type'])   res.set('Content-Type', iptvRes.headers['content-type']);
    else res.set('Content-Type', 'video/mp4');

    iptvRes.pipe(res);
    iptvRes.on('error', () => res.end());
  });
  proxyReq.on('error', (e) => {
    console.log(`[IPTV-PROXY] Error: ${e.message}`);
    if (!res.headersSent) res.status(502).end('Proxy error');
  });
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).end('Timeout');
  });
  req.on('close', () => proxyReq.destroy());
});



app.use((req, res, next) => {

  const start = Date.now();

  res.on('finish', () => {

    if (!req.path.endsWith('.ts') && !req.path.endsWith('.m3u8') && !req.path.endsWith('.vtt') && !req.path.startsWith('/vod/proxy/') && !req.path.startsWith('/free-hls/')) {

      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);

    }

  });

  next();

});



// --- User lookup (direct PG — same database as backend) ---

async function _getUserById(userId) {

  return db.prepare(

    'SELECT id, username, plan, expires_at, max_connections, role, is_admin, is_blocked FROM users WHERE id = ?'

  ).get(userId);

}



// --- Middleware: JWT auth (direct PG) ---

async function requireAuth(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {

    return res.status(401).json({ error: 'يجب تسجيل الدخول' });

  }

  const token = authHeader.split(' ')[1];

  let decoded;

  try { decoded = jwt.verify(token, config.JWT_SECRET); }

  catch (e) { return res.status(401).json({ error: 'رمز الدخول غير صالح' }); }



  try {

    const user = await _getUserById(decoded.userId);

    if (user) {

      if (user.is_blocked) return res.status(403).json({ error: 'الحساب محظور' });

      req.user = user;

      return next();

    }

  } catch (e) {

    console.log(`[Auth] PG query error: ${e.message}`);

  }

  // Fallback if user not found in DB

  req.user = { id: decoded.userId, username: '', plan: 'free', max_connections: 1, role: 'user', is_admin: 0, is_blocked: 0 };

  next();

}



// --- Middleware: Premium check ---

function requirePremium(req, res, next) {

  const user = req.user;

  if (user.is_admin || user.role === 'admin' || user.role === 'agent') return next();

  if (user.plan !== 'premium') {

    return res.status(403).json({ error:'subscription_required', message:'هذا المحتوى يتطلب اشتراك بريميوم', requiresSubscription:true });

  }

  if (user.expires_at && new Date(user.expires_at) < new Date()) {

    return res.status(403).json({ error:'subscription_expired', message:'انتهت صلاحية اشتراكك يرجى التجديد', requiresSubscription:true });

  }

  next();

}



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// API Ø§Ù„Ø¨Ø« â€” Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙŠØªØµÙ„ Ù…Ø¨Ø§Ø´Ø±Ø© (Ù…Ø¹ JWT)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



/**

 * POST /api/stream/live/:channelId

 * Ø¨Ø¯Ø¡ Ø¨Ø« Ù‚Ù†Ø§Ø© Ù…Ø¨Ø§Ø´Ø±Ø©

 */

// ═══ Session / Connection Limit Management ═══════════════════

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 min — session expires if no heartbeat

const { randomUUID } = require('crypto');



// ─── User data cache — reduce DB pressure under high concurrency ───

const _userCache = new Map();

const USER_CACHE_TTL = 5000; // 5s — short enough to pick up plan changes quickly

async function _getCachedUser(userId) {

  const cached = _userCache.get(userId);

  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) return cached.data;

  const data = await db.prepare(

    'SELECT id, plan, expires_at, max_connections, is_admin, role, is_blocked FROM users WHERE id = ?'

  ).get(userId);

  _userCache.set(userId, { data, ts: Date.now() });

  // Prevent unbounded cache growth

  if (_userCache.size > 500) {

    const oldest = _userCache.keys().next().value;

    _userCache.delete(oldest);

  }

  return data;

}



// ─── Channel sync from backend PostgreSQL ───────────────────

const CHANNEL_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function syncChannelsFromBackend(force = false) {

  try {

    const rows = await db.prepare(

      'SELECT id, name, group_name, logo_url, stream_url, is_enabled, sort_order, xtream_id, category FROM channels'

    ).all();

    console.log(`[Sync] Synced ${rows.length} channels from backend PostgreSQL`);

  } catch (e) {

    console.error('[Sync] Channel sync error:', e.message);

  }

}



// ─── Async session helpers (all use PostgreSQL via shared db) ───

async function _cleanExpiredSessions() {

  return db.prepare('DELETE FROM active_sessions WHERE last_seen < ?').run(Date.now() - SESSION_TIMEOUT);

}



async function _getUserSessions(userId) {

  return db.prepare('SELECT * FROM active_sessions WHERE user_id = ? ORDER BY started_at ASC').all(userId);

}



async function _getSessionById(sessionId) {

  return db.prepare('SELECT * FROM active_sessions WHERE id = ?').get(sessionId);

}



async function _insertSession(id, userId, streamId, streamType, startedAt, lastSeen) {

  return db.prepare('INSERT INTO active_sessions (id, user_id, stream_id, type, started_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, streamId, streamType, startedAt, lastSeen);

}



async function _deleteSession(sessionId) {

  return db.prepare('DELETE FROM active_sessions WHERE id = ?').run(sessionId);

}



async function _deleteSessionByStream(userId, streamId) {

  return db.prepare('DELETE FROM active_sessions WHERE user_id = ? AND stream_id = ?').run(userId, streamId);

}



async function _updateHeartbeat(sessionId) {

  return db.prepare('UPDATE active_sessions SET last_seen = ? WHERE id = ?').run(Date.now(), sessionId);

}



/**

 * checkConnectionLimit — queries the real `users` table (shared PostgreSQL)

 * Returns: { allowed, sessionId, error?, message?, active?, max? }

 */

async function checkConnectionLimit(userId, streamId, streamType) {

  // Query with cache (5s TTL) — reduces DB pressure under high concurrency

  const user = await _getCachedUser(userId);

  const maxConn = (user && user.max_connections) || 1;

  const isAdmin = user && (user.is_admin || user.role === 'admin' || user.role === 'agent');



  // Check subscription validity (auto-expire if needed)

  if (user && !isAdmin) {

    if (user.plan === 'premium' && user.expires_at && new Date(user.expires_at) < new Date()) {

      await db.prepare("UPDATE users SET plan = 'free', expires_at = NULL WHERE id = ?").run(userId);

      return {

        allowed: false, error: 'subscription_expired',

        message: 'انتهت صلاحية اشتراكك، يرجى التجديد',

        active: 0, max: 1,

      };

    }

  }



  if (isAdmin) {

    await _deleteSessionByStream(userId, streamId);

    const sid = randomUUID();

    await _insertSession(sid, userId, streamId, streamType, Date.now(), Date.now());

    return { allowed: true, sessionId: sid };

  }



  // Clean expired sessions

  await _cleanExpiredSessions();

  const sessions = await _getUserSessions(userId);



  // If already watching this stream, just update heartbeat

  const existing = sessions.find(s => s.stream_id === streamId);

  if (existing) {

    await _updateHeartbeat(existing.id);

    return { allowed: true, sessionId: existing.id };

  }



  // Check connection limit based on subscription plan

  if (sessions.length >= maxConn) {

    return {

      allowed: false, error: 'connection_limit',

      message: `لقد وصلت للحد الأقصى من الاتصالات المتزامنة (${maxConn}). أغلق بثاً آخر أو قم بترقية اشتراكك.`,

      active: sessions.length, max: maxConn,

      sessions: sessions.map(s => ({ id: s.id, stream_id: s.stream_id, type: s.type, started_at: s.started_at })),

    };

  }



  const sid = randomUUID();

  await _insertSession(sid, userId, streamId, streamType, Date.now(), Date.now());

  return { allowed: true, sessionId: sid };

}



async function releaseUserSession(userId, streamId) { await _deleteSessionByStream(userId, streamId); }

async function releaseSessionById(sessionId) { await _deleteSession(sessionId); }

async function heartbeatSession(sessionId) { await _updateHeartbeat(sessionId); }



// Periodic cleanup of expired sessions

setInterval(async () => {

  try {

    const removed = await _cleanExpiredSessions();

    if (removed.changes > 0) console.log(`[Sessions] Cleaned ${removed.changes} expired sessions`);

  } catch (e) { console.error('[Sessions] Cleanup error:', e.message); }

}, 2 * 60 * 1000);



// POST /api/session/heartbeat

app.post('/api/session/heartbeat', requireAuth, async (req, res) => {

  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = await _getSessionById(sessionId);

  if (!session || session.user_id !== req.user.id) return res.status(404).json({ error: 'session not found' });

  await heartbeatSession(sessionId);

  res.json({ success: true });

});



// POST /api/session/release

app.post('/api/session/release', requireAuth, async (req, res) => {

  const { sessionId, streamId } = req.body;

  if (sessionId) await releaseSessionById(sessionId);

  else if (streamId) await releaseUserSession(req.user.id, streamId);

  res.json({ success: true });

});



// GET /api/session/active — user's active sessions with subscription info

app.get('/api/session/active', requireAuth, async (req, res) => {

  await _cleanExpiredSessions();

  const sessions = await _getUserSessions(req.user.id);

  const user = await db.prepare('SELECT plan, expires_at, max_connections FROM users WHERE id = ?').get(req.user.id);

  const maxConn = (user && user.max_connections) || 1;

  const plan = (user && user.plan) || 'free';

  const expires_at = (user && user.expires_at) || null;

  res.json({ sessions, active: sessions.length, max: maxConn, plan, expires_at });

});



// POST /api/session/force-release — force release a specific session (for users who hit limit)

app.post('/api/session/force-release', requireAuth, async (req, res) => {

  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId مطلوب' });

  const session = await _getSessionById(sessionId);

  if (!session || session.user_id !== req.user.id) return res.status(404).json({ error: 'الجلسة غير موجودة' });

  await releaseSessionById(sessionId);

  const remaining = await _getUserSessions(req.user.id);

  res.json({ success: true, active: remaining.length });

});



// POST /api/session/release-all — release all sessions for user

app.post('/api/session/release-all', requireAuth, async (req, res) => {

  await db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(req.user.id);

  res.json({ success: true, active: 0 });

});



// GET /api/session/subscription-info — subscription details + session limits

app.get('/api/session/subscription-info', requireAuth, async (req, res) => {

  const user = await db.prepare(

    'SELECT plan, expires_at, max_connections, is_admin, role FROM users WHERE id = ?'

  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });



  await _cleanExpiredSessions();

  const sessions = await _getUserSessions(req.user.id);



  const isPremium = user.plan === 'premium';

  let daysLeft = null;

  if (isPremium && user.expires_at) {

    const diff = new Date(user.expires_at) - new Date();

    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  }



  // Auto-expire

  if (isPremium && user.expires_at && new Date(user.expires_at) < new Date()) {

    await db.prepare("UPDATE users SET plan = 'free', expires_at = NULL WHERE id = ?").run(req.user.id);

    user.plan = 'free';

    user.expires_at = null;

    user.max_connections = 1;

  }



  res.json({

    plan: user.plan,

    isPremium: user.plan === 'premium',

    expires_at: user.expires_at,

    daysLeft,

    max_connections: user.max_connections || 1,

    active_sessions: sessions.length,

    sessions: sessions.map(s => ({

      id: s.id, stream_id: s.stream_id, type: s.type,

      started_at: s.started_at, last_seen: s.last_seen,

    })),

    is_admin: !!(user.is_admin || user.role === 'admin'),

  });

});



// ═══════════════════════════════════════════════════════════════



app.post('/api/stream/live/:channelId', requireAuth, requirePremium, async (req, res) => {

  const rawId = req.params.channelId;



  // ═══ Connection limit check ═══

  const connCheck = await checkConnectionLimit(req.user.id, `live_${rawId}`, 'live');

  if (!connCheck.allowed) {

    return res.status(429).json({ error: connCheck.error, message: connCheck.message, active: connCheck.active, max: connCheck.max });

  }



  // -- Xtream live channel (xtream_live_<streamId> or bare numeric ID) --

  // ═══ استخدام FFmpeg بدلاً من XtreamProxy ═══

  const xtreamMatch = rawId.match(/^xtream_live_(\d+)$/) || rawId.match(/^(\d+)$/);

  if (xtreamMatch) {

    const streamNumId = xtreamMatch[1];

    const xch = await db.prepare('SELECT id, name, logo, category, stream_id, base_url, account_id FROM xtream_channels WHERE stream_id = ? OR id = ?').get(Number(streamNumId), streamNumId);

    if (xch) {

      // الحصول على بيانات الحساب

      const account = await db.prepare('SELECT server_url, username, password FROM iptv_accounts WHERE id = ?').get(xch.account_id);

      if (!account) {

        return res.status(500).json({ error: 'حساب IPTV غير موجود' });

      }



      // بناء رابط IPTV المباشر

      const iptvUrl = `${account.server_url}/live/${account.username}/${account.password}/${xch.stream_id}.m3u8`;

      

      console.log(`[Live] Starting FFmpeg for channel ${xch.name} (${xch.stream_id})`);

      

      // بدء FFmpeg

      const result = await streamManager.requestStream(

        `xtream_live_${xch.stream_id}`,

        'live',

        iptvUrl,

        xch.name

      );



      if (!result.success) {

        return res.status(500).json({ error: 'فشل بدء البث', details: result.error });

      }



      return res.json({

        success: true,

        hlsUrl: `/hls/xtream_live_${xch.stream_id}/stream.m3u8`,

        ready: result.ready || false,

        waiting: result.waiting || false,

        streamId: String(xch.stream_id),

        sessionId: connCheck.sessionId,

        name: xch.name,

        logo: xch.logo,

        mode: 'ffmpeg',

      });

    }

  }

  let ch = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);

  // Lazy sync: if channel not found locally, sync from backend PostgreSQL and retry

  if (!ch) {

    await syncChannelsFromBackend(true);

    ch = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);

  }

  if (!ch) return res.status(404).json({ error: 'القناة غير متاحة' });

  if (!ch.stream_url) return res.status(400).json({ error: 'القناة بدون رابط بث' });



  // â•â•â• Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ: Direct Pipe (Ø¨Ø¯ÙˆÙ† FFmpeg â€” Ø¨Ø« ÙÙˆØ±ÙŠ) â•â•â•

  // Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙŠØªØµÙ„ Ø¨Ù€ /live-pipe/:channelId Ù…Ø¨Ø§Ø´Ø±Ø©

  // Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ: FFmpeg â†’ HLS (Ø¥Ø°Ø§ Ø·Ù„Ø¨ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙˆØ¶Ø¹ HLS)

  const mode = req.body.mode || 'pipe'; // 'pipe' Ø£Ùˆ 'hls'



  if (mode === 'hls') {

    const result = await streamManager.requestStream(ch.id, 'live', ch.stream_url, ch.name);

    return res.json({

      success: true,

      hlsUrl: `/hls/${ch.id}/stream.m3u8`,

      ready: result.ready || false,

      waiting: result.waiting || false,

      streamId: ch.id,

    });

  }



  // Direct pipe â€” Ø±Ø§Ø¨Ø· Ø§Ù„Ø¨Ø« Ø§Ù„Ù…Ø¨Ø§Ø´Ø± Ø¨Ø¯ÙˆÙ† FFmpeg

  res.json({

    success: true,

    vodUrl: `/live-pipe/${ch.id}`,

    ready: true,

    streamId: ch.id,

  });

});



// Xtream Token Redirect — DISABLED: was redirecting client directly to IPTV (exposes credentials + triggers bans)
// Now redirects to FFmpeg HLS system so only VPS connects to IPTV.
app.get(['/xtream-play/:token', '/xtream-play/:token/index.m3u8'], (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, config.JWT_SECRET);
    if (payload.t !== 'xt' || !payload.sid) return res.status(403).end();
    // Redirect to the FFmpeg HLS URL instead of IPTV directly
    res.redirect(302, `/hls/xtream_live_${payload.sid}/stream.m3u8`);
  } catch (e) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});



// Xtream Pipe — DISABLED: was using deprecated proxy. Now uses FFmpeg HLS.
app.get('/xtream-pipe/:token', async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, config.JWT_SECRET);
    if (payload.t !== 'xt' || !payload.sid) return res.status(403).end();
    res.redirect(302, `/hls/xtream_live_${payload.sid}/stream.m3u8`);
  } catch (e) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});



// â•â•â• Direct Live Pipe â€” Ø¨Ø« Ù…Ø¨Ø§Ø´Ø± Ø¨Ø¯ÙˆÙ† FFmpeg (pipe) â•â•â•

app.get('/live-pipe/:channelId', requireAuth, async (req, res) => {

  const rawId = req.params.channelId;



  // Xtream channels → redirect to FFmpeg HLS (no direct IPTV connection per viewer)
  const xtreamPipeMatch = rawId.match(/^xtream_(\d+)$/);
  if (xtreamPipeMatch) {
    const streamId = xtreamPipeMatch[1];
    // Start FFmpeg if not already running, then redirect to HLS
    const streamKey = `xtream_live_${streamId}`;
    const ch = await db.prepare(`
      SELECT c.stream_id, c.name, a.server_url, a.username, a.password
      FROM xtream_channels c LEFT JOIN iptv_accounts a ON c.account_id = a.id
      WHERE c.stream_id = ?
    `).get(Number(streamId));
    if (ch && ch.server_url) {
      const iptvUrl = `${ch.server_url}/live/${ch.username}/${ch.password}/${ch.stream_id}.m3u8`;
      await streamManager.requestStream(streamKey, 'live', iptvUrl, ch.name || `Xtream ${streamId}`);
    }
    return res.redirect(302, `/hls/${streamKey}/stream.m3u8`);
  }



  // Local channels require premium

  const user = req.user;

  if (!user || (user.plan !== 'premium' && !user.is_admin && user.role !== 'admin')) return res.status(403).json({ error: 'Premium required' });



  const ch = await db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);

  if (!ch || !ch.stream_url) return res.status(404).end();

  console.log(`[LivePipe] ${ch.name}`);

  await liveProxy.streamToClient(ch.id, ch.stream_url, req, res);

});



/**

 * POST /api/stream/vod/:id

 * Ø¨Ø¯Ø¡ Ø¨Ø« ÙÙŠÙ„Ù… Ø£Ùˆ Ø­Ù„Ù‚Ø©

 * Ø§Ù„Ù…ØµØ¯Ø±: vidsrc (embed.su / vidlink.pro) Ø¹Ø¨Ø± TMDb ID

 * IPTV ÙÙ‚Ø· ÙƒØ§Ø­ØªÙŠØ§Ø·ÙŠ Ø¥Ø°Ø§ Ù„Ø§ ÙŠÙˆØ¬Ø¯ TMDb ID

 */

app.post('/api/stream/vod/:id', requireAuth, requirePremium, async (req, res) => {

  const paramId = decodeURIComponent(req.params.id);



  // ═══ Connection limit check ═══

  const connCheck = await checkConnectionLimit(req.user.id, `vod_${paramId}`, 'vod');

  if (!connCheck.allowed) {

    return res.status(429).json({ error: connCheck.error, message: connCheck.message, active: connCheck.active, max: connCheck.max });

  }



  // Ø¨Ø­Ø« Ø¨Ø§Ù„Ù€ id Ø£Ùˆ stream_token — Ø£ÙˆÙ„ÙˆÙŠØ©: episodes Ø«Ù… vod

  let item = null;

  let itemType = 'vod';

  let parentVod = null;



  // 1. Ø¨Ø­Ø« ÙÙŠ episodes Ø¨Ø§Ù„Ù€ id

  item = await db.prepare('SELECT id, title, stream_token, container_ext, xtream_id, vod_id, season, episode_num FROM episodes WHERE id = ?').get(paramId);

  if (item) { itemType = 'episode'; }



  // 2. Ø¨Ø­Ø« ÙÙŠ vod Ø¨Ø§Ù„Ù€ id

  if (!item) {

    item = await db.prepare('SELECT id, title, stream_token, vod_type, xtream_id, container_ext, tmdb_id AS tmdb FROM vod WHERE id = ?').get(paramId);

    itemType = 'vod';

  }



  // 3. Ø¨Ø­Ø« Ø¨Ø§Ù„Ù€ stream_token

  if (!item) {

    item = await db.prepare('SELECT id, title, stream_token, container_ext, xtream_id, vod_id, season, episode_num FROM episodes WHERE stream_token = ?').get(paramId);

    if (item) itemType = 'episode';

  }

  if (!item) {

    item = await db.prepare('SELECT id, title, stream_token, vod_type, xtream_id, container_ext, tmdb_id AS tmdb FROM vod WHERE stream_token = ?').get(paramId);

    if (item) itemType = 'vod';

  }



  if (!item) return res.status(404).json({ error: 'Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });



  // Ø¥Ø°Ø§ ÙƒØ§Ù† Ù…Ø³Ù„Ø³Ù„ → Ø´ØºÙ'Ù„ Ø£ÙˆÙ„ Ø­Ù„Ù‚Ø© Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† Ø§Ù„Ù…Ø³Ù„Ø³Ù„ Ù†ÙØ³Ù‡

  if (itemType === 'vod' && item.vod_type === 'series') {

    parentVod = item;

    const episode = await db.prepare('SELECT id, title, stream_token, container_ext, xtream_id, vod_id, season, episode_num FROM episodes WHERE vod_id = ? ORDER BY season ASC, episode_num ASC LIMIT 1').get(item.id);

    if (episode) {

      item = episode;

      itemType = 'episode';

    } else {

      return res.status(400).json({ error: 'Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³Ù„Ø³Ù„ Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø­Ù„Ù‚Ø§Øª Ø¨Ø¹Ø¯' });

    }

  }



  // ═══ Ø¬Ù„Ø¨ TMDb ID — Ù„Ù„Ø­Ù„Ù‚Ø§Øª Ù†Ø¬Ù„Ø¨Ù‡ Ù…Ù† Ø§Ù„Ù…Ø³Ù„Ø³Ù„ Ø§Ù„Ø£Ø¨ ═══

  let tmdbId = item.tmdb || null;

  if (!tmdbId && itemType === 'episode' && item.vod_id) {

    const parent = parentVod || await db.prepare('SELECT tmdb_id AS tmdb, vod_type FROM vod WHERE id = ?').get(item.vod_id);

    if (parent) tmdbId = parent.tmdb;

  }



  // â•â•â• Ø§Ù„Ù…ØµØ¯Ø± Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ: Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ù…Ø¨Ø§Ø´Ø± Ø¹Ø¨Ø± @movie-web/providers â•â•â•

  if (tmdbId) {

    try {

      const type = itemType === 'episode' ? 'tv' : 'movie';

      const season = item.season || undefined;

      const episode = item.episode_num || undefined;



      console.log(`[VOD] Extract: tmdb=${tmdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''} â€” ${item.title}`);



      const extracted = await extractStream({

        tmdbId, type, title: item.title, releaseYear: 2024,

        season, episode,

      });



      if (extracted && extracted.url) {

        console.log(`[VOD] âœ“ Direct ${extracted.type}: ${extracted.sourceId} â€” ${extracted.url.substring(0, 80)}`);

        const directResult = buildDirectResultFromExtracted(extracted);

        recordWatchHistory(req.user.id, item.id, itemType);

        return res.json(await finalizeDirectStream({

          streamId: item.id,

          directResult,

        }));

      }



      // Ø§Ø­ØªÙŠØ§Ø·: embed URLs

      console.log(`[VOD] Direct extraction failed â€” trying embed resolver`);

      const stream = await resolveStream(tmdbId, type, season, episode);

      if (stream && stream.embedUrl) {

        res.json({

          success: true,

          embedUrl: stream.embedUrl,

          provider: stream.provider,

          sources: stream.sources,

          ready: true,

          streamId: item.id,

        });

        recordWatchHistory(req.user.id, item.id, itemType);

        return;

      }

    } catch (e) {

      console.error(`[VOD] Extract ÙØ´Ù„ â€” ${item.title}:`, e.message);

      // ØªØ§Ø¨Ø¹ Ù„Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ IPTV

    }

  }



  // â•â•â• Ø§Ø­ØªÙŠØ§Ø·ÙŠ: IPTV (Ø¥Ø°Ø§ Ù„Ø§ ÙŠÙˆØ¬Ø¯ TMDb ID Ø£Ùˆ ÙØ´Ù„ vidsrc) â•â•â•

  let sourceUrl = item.stream_token;

  if (item.xtream_id) {

    const cfg = await db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();

    if (cfg && cfg.server_url) {

      const ext = item.container_ext || 'mkv';

      const urlType = itemType === 'episode' ? 'series' : 'movie';

      sourceUrl = `${cfg.server_url}/${urlType}/${cfg.username}/${cfg.password}/${item.xtream_id}.${ext}`;

    }

  }

  if (!sourceUrl) return res.status(400).json({ error: 'Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ø¨Ø¯ÙˆÙ† Ø±Ø§Ø¨Ø· Ø¨Ø«' });



  const ext = item.container_ext || 'mp4';

  try {

    const result = await vodProxy.initSession(item.id, sourceUrl, item.title, ext);

    res.json({

      success: true,

      vodUrl: result.proxyUrl,

      ready: true,

      duration: result.duration || 0,

      contentLength: result.contentLength,

      acceptRanges: result.acceptRanges,

      streamId: item.id,

    });

  } catch (e) {

    console.error(`[VOD] Ø®Ø·Ø£ ØªÙ‡ÙŠØ¦Ø© Ø§Ù„Ø¨Ø«:`, e.message);

    return res.status(500).json({ error: 'Ø®Ø·Ø£ ÙÙŠ ØªÙ‡ÙŠØ¦Ø© Ø§Ù„Ø¨Ø«' });

  }



  // Ø³Ø¬Ù‘Ù„ ÙÙŠ ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø©

  recordWatchHistory(req.user.id, item.id, itemType);

});



/**

 * POST /api/stream/release/:streamId

 * Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø©

 */

app.post('/api/stream/release/:streamId', requireAuth, async (req, res) => {

  streamManager.releaseStream(req.params.streamId);

  vodProxy.releaseSession(req.params.streamId);

  // Release active session for this stream

  await releaseUserSession(req.user.id, `live_${req.params.streamId}`);

  await releaseUserSession(req.user.id, `vod_${req.params.streamId}`);

  await releaseUserSession(req.user.id, req.params.streamId);

  res.json({ success: true });

});



/**

 * GET /api/stream/ready/:streamId

 * ÙØ­Øµ Ø¬Ù‡ÙˆØ²ÙŠØ© Ø§Ù„Ø¨Ø« â€” HLS VOD Ø£Ùˆ Live

 */

app.get('/api/stream/ready/:streamId', requireAuth, (req, res) => {

  const streamId = req.params.streamId;



  // ÙØ­Øµ VOD proxy Ø£ÙˆÙ„Ø§Ù‹

  const session = vodProxy.getSession(streamId);

  if (session) {

    return res.json({

      ready: true,

      type: 'vod',

      duration: session.duration || 0,

    });

  }



  // ÙØ­Øµ Live/HLS stream

  const info = streamManager.getStreamInfo(streamId);

  if (info) {

    return res.json({ ready: info.ready, type: info.type });

  }



  res.json({ ready: false });

});



/**

 * GET /api/stream/info/:streamId

 * Ø¬Ù„Ø¨ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø¨Ø« + Ø§Ù„Ù…Ø¯Ø© â€” ÙŠÙØ³ØªØ¯Ø¹Ù‰ Ø¨Ø´ÙƒÙ„ Ø¯ÙˆØ±ÙŠ Ø­ØªÙ‰ ØªØªÙˆÙØ± Ø§Ù„Ù…Ø¯Ø©

 */

app.get('/api/stream/info/:streamId', requireAuth, (req, res) => {

  const streamId = req.params.streamId;

  const info = streamManager.getStreamInfo(streamId);

  const session = vodProxy.getSession(streamId);

  if (!info && !session) return res.status(404).json({ error: 'Ø§Ù„Ø¬Ù„Ø³Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });

  res.json({

    name: info ? info.name : (session ? session.name : ''),

    type: info ? info.type : 'vod',

    completed: info ? info.completed : false,

    ready: info ? info.ready : true,

    duration: session ? session.duration : 0,

  });

});



/**

 * POST /api/stream/seek/:streamId

 * Seeking ÙÙŠ VOD â€” Ø¥Ø¹Ø§Ø¯Ø© Ø¨Ø¯Ø¡ FFmpeg Ù…Ù† Ù…ÙˆØ¶Ø¹ Ø¬Ø¯ÙŠØ¯

 */

app.post('/api/stream/seek/:streamId', requireAuth, async (req, res) => {

  const { position } = req.body; // Ø¨Ø§Ù„Ø«ÙˆØ§Ù†ÙŠ

  if (typeof position !== 'number' || position < 0) {

    return res.status(400).json({ error: 'Ù…ÙˆØ¶Ø¹ ØºÙŠØ± ØµØ­ÙŠØ­' });

  }

  try {

    const result = await streamManager.seekVodStream(req.params.streamId, position);

    res.json(result);

  } catch (e) {

    res.status(500).json({ error: e.message });

  }

});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ÙˆØ³Ø§Ø¦Ø· â€” Ø§Ù„Ø¬ÙˆØ¯Ø© + Ø§Ù„ØªØ±Ø¬Ù…Ø© + Ø§Ù„ØµÙˆØª

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



app.get('/api/stream/media-info/:streamId', requireAuth, (req, res) => {

  const info = vodProxy.getMediaInfo(req.params.streamId);

  if (!info) return res.status(404).json({ error: 'Ø§Ù„Ø¬Ù„Ø³Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });

  res.json(info);

});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Ø§Ø³ØªØ®Ø±Ø§Ø¬ ØªØ±Ø¬Ù…Ø© â€” WebVTT

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



app.get('/vod/subtitle/:id/:trackIndex', async (req, res) => {

  try {

    const vttPath = await vodProxy.extractSubtitle(req.params.id, parseInt(req.params.trackIndex));

    if (!vttPath) return res.status(404).json({ error: 'Ø§Ù„ØªØ±Ø¬Ù…Ø© ØºÙŠØ± Ù…ØªÙˆÙØ±Ø©' });

    res.set({ 'Content-Type': 'text/vtt', 'Access-Control-Allow-Origin': '*' });

    fs.createReadStream(vttPath).pipe(res);

  } catch (e) {

    res.status(500).json({ error: 'Ø®Ø·Ø£ ÙÙŠ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„ØªØ±Ø¬Ù…Ø©' });

  }

});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// IPTV VOD API — أفلام ومسلسلات من Xtream

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



app.get('/api/xtream/vod/home', async (req, res) => {

  try {

    const data = await xtreamVod.getHome();

    res.json(data);

  } catch (e) {

    console.error('[VOD] home:', e.message);

    res.status(500).json({ error: 'فشل جلب البيانات' });

  }

});



app.get('/api/xtream/vod/categories', async (req, res) => {

  try { res.json(await xtreamVod.getVodCategories()); }

  catch (e) { res.status(500).json({ error: e.message }); }

});



app.get('/api/xtream/vod/categories-with-movies', async (req, res) => {

  try {

    const perCategory = parseInt(req.query.per_category) || 12;

    const maxCategories = parseInt(req.query.max_categories) || 40;

    const filter = req.query.filter || '';

    const data = await xtreamVod.getVodByCategory({ perCategory, maxCategories, filter });

    res.json(data);

  } catch (e) {

    console.error('[categories-with-movies]', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/vod/streams', async (req, res) => {

  try {

    const { category_id, page, limit, search } = req.query;

    const data = await xtreamVod.getVodStreams({

      categoryId: category_id,

      page: parseInt(page) || 1,

      limit: parseInt(limit) || 20,

      search: search || undefined,

    });

    res.json(data);

  } catch (e) {

    console.error('[VOD] streams:', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/vod/info/:vodId', async (req, res) => {

  try {

    const data = await xtreamVod.getVodInfo(req.params.vodId);

    res.json(data);

  } catch (e) {

    console.error('[VOD] info:', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/vod/stream/:vodId', (req, res) => {

  try {

    const info = { id: req.params.vodId, ext: req.query.ext || 'mp4' };

    const token = jwt.sign({ sid: info.id, ext: info.ext, t: 'vod' }, config.JWT_SECRET, { expiresIn: '6h' });

    res.json({ success: true, streamUrl: `/vod-play/${token}/stream.mp4` });

  } catch (e) {

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/series/categories', async (req, res) => {

  try { res.json(await xtreamVod.getSeriesCategories()); }

  catch (e) { res.status(500).json({ error: e.message }); }

});



app.get('/api/xtream/series/list', async (req, res) => {

  try {

    const { category_id, page, limit, search } = req.query;

    const data = await xtreamVod.getSeriesList({

      categoryId: category_id,

      page: parseInt(page) || 1,

      limit: parseInt(limit) || 20,

      search: search || undefined,

    });

    res.json(data);

  } catch (e) {

    console.error('[Series] list:', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/series/info/:seriesId', async (req, res) => {

  try {

    const data = await xtreamVod.getSeriesInfo(req.params.seriesId);

    res.json(data);

  } catch (e) {

    console.error('[Series] info:', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/series/stream/:episodeId', (req, res) => {

  try {

    const token = jwt.sign(

      { sid: req.params.episodeId, ext: req.query.ext || 'mp4', t: 'ser' },

      config.JWT_SECRET,

      { expiresIn: '6h' }

    );

    res.json({ success: true, streamUrl: `/vod-play/${token}/stream.mp4` });

  } catch (e) {

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/xtream/vod/search', async (req, res) => {

  try {

    const { q, page } = req.query;

    const data = await xtreamVod.search(q || '', parseInt(page) || 1);

    res.json(data);

  } catch (e) {

    res.status(500).json({ error: e.message });

  }

});



// VOD Token Proxy — pipe the IPTV stream through cloud server so browsers don't face CORS/mixed-content

// Uses keep-alive agents for connection reuse across 100+ concurrent VOD users

app.get(['/vod-play/:token', '/vod-play/:token/stream.mp4'], (req, res) => {

  try {

    const payload = jwt.verify(req.params.token, config.JWT_SECRET);

    if (!payload.sid || !['vod', 'ser'].includes(payload.t)) return res.status(403).end();

    const ext = payload.ext || 'mp4';

    const vodPath = payload.t === 'ser'

      ? `series/${XTREAM.user}/${XTREAM.pass}/${payload.sid}.${ext}`

      : `movie/${XTREAM.user}/${XTREAM.pass}/${payload.sid}.${ext}`;

    const upstreamUrl = `${XTREAM.primary}/${vodPath}`;



    const parsed = new URL(upstreamUrl);

    const isHttps = parsed.protocol === 'https:';

    const httpMod = isHttps ? https : http;

    const agent = isHttps ? upstreamHttpsAgent : upstreamHttpAgent;



    const reqHeaders = {

      'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',

      'Accept': '*/*',

      'Connection': 'keep-alive',

    };

    if (req.headers.range) reqHeaders['Range'] = req.headers.range;



    const proxyReq = httpMod.get(upstreamUrl, {

      headers: reqHeaders,

      agent,

      timeout: 60000,

    }, (upRes) => {

      // Follow redirects

      if (upRes.statusCode >= 300 && upRes.statusCode < 400 && upRes.headers.location) {

        upRes.resume();

        const redirectUrl = upRes.headers.location;

        const rParsed = new URL(redirectUrl);

        const rHttps = rParsed.protocol === 'https:';

        const rMod = rHttps ? https : http;

        const rAgent = rHttps ? upstreamHttpsAgent : upstreamHttpAgent;

        const rReq = rMod.get(redirectUrl, { headers: reqHeaders, agent: rAgent, timeout: 60000 }, (rRes) => {

          _pipeVodResponse(rRes, req, res);

        });

        rReq.on('error', (e) => { if (!res.headersSent) res.status(502).end(); });

        rReq.on('timeout', () => { rReq.destroy(); if (!res.headersSent) res.status(504).end(); });

        return;

      }

      _pipeVodResponse(upRes, req, res);

    });

    proxyReq.on('error', (e) => {

      console.error('[VOD-play] proxy error:', e.message);

      if (!res.headersSent) res.status(502).end();

    });

    proxyReq.on('timeout', () => {

      proxyReq.destroy();

      if (!res.headersSent) res.status(504).end();

    });

  } catch (e) {

    console.error('[VOD-play] token error:', e.message);

    if (!res.headersSent) res.status(403).json({ error: 'Invalid or expired token' });

  }

});



function _pipeVodResponse(upRes, req, res) {

  if (upRes.statusCode !== 200 && upRes.statusCode !== 206) {

    upRes.resume();

    if (!res.headersSent) res.status(upRes.statusCode || 502).end();

    return;

  }

  if (!res.headersSent) {

    res.status(upRes.statusCode);

    res.set('Content-Type', upRes.headers['content-type'] || 'video/mp4');

    res.set('Accept-Ranges', 'bytes');

    res.set('Access-Control-Allow-Origin', '*');

    res.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (upRes.headers['content-length']) res.set('Content-Length', upRes.headers['content-length']);

    if (upRes.headers['content-range']) res.set('Content-Range', upRes.headers['content-range']);

  }

  upRes.pipe(res);

  upRes.on('error', () => { try { res.end(); } catch {} });

  req.on('close', () => { upRes.destroy(); });

}



// ═══════════════════════════════════════════════════════

// VidSrc/TMDB Content API

// ═══════════════════════════════════════════════════════



app.get('/api/vidsrc/home', async (req, res) => {

  try {

    const data = await vidsrcApi.getHome();

    res.json(data);

  } catch (e) {

    console.error('[vidsrc/home]', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/vidsrc/browse', async (req, res) => {

  try {

    const { type, page = 1, category = 'popular' } = req.query;

    const data = await vidsrcApi.browse({ type, page: parseInt(page), category });

    res.json(data);

  } catch (e) {

    console.error('[vidsrc/browse]', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/vidsrc/search', async (req, res) => {

  try {

    const { q, page = 1 } = req.query;

    if (!q) return res.json({ items: [], hasMore: false });

    const data = await vidsrcApi.search(q, parseInt(page));

    res.json(data);

  } catch (e) {

    console.error('[vidsrc/search]', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/vidsrc/detail/:type/:id', async (req, res) => {

  try {

    const { type, id } = req.params;

    const tmdbId = id.startsWith('tmdb_') ? id.replace('tmdb_', '') : id;

    const data = await vidsrcApi.getDetail(tmdbId, type);

    if (!data) return res.status(404).json({ error: 'not found' });

    res.json(data);

  } catch (e) {

    console.error('[vidsrc/detail]', e.message);

    res.status(500).json({ error: e.message });

  }

});



app.get('/api/vidsrc/episodes', async (req, res) => {

  try {

    const { page = 1 } = req.query;

    const data = await vidsrcApi.getLatestEpisodes(parseInt(page));

    res.json({ items: data, hasMore: false });

  } catch (e) {

    console.error('[vidsrc/episodes]', e.message);

    res.status(500).json({ error: e.message });

  }

});



// ─── LuluStream: جلب المحتوى مباشرةً من LuluStream API ──────────────────────
const LULU_KEY         = '268476xsqgnehs76lhfq0q';
const LULU_ROOT_FLD    = 74466;  // [AR] Arabic Movies
const LULU_API         = 'https://api.lulustream.com/api';
const LULU_CACHE_TTL   = 60 * 60 * 1000; // ساعة كاملة (كان 5 دقائق — سبب rate limit)
const LULU_CACHE_FILE  = path.join(__dirname, 'data', 'lulu_catalog.json');

let _luluCatalog       = null;
let _luluCatalogTs     = 0;
let _luluRebuildActive = false; // يمنع تشغيل rebuild متعدد
let _luluLastFailTs    = 0;     // وقت آخر فشل للـ rebuild (لتجنب retry متكرر)
const LULU_RETRY_COOLDOWN = 65 * 1000; // 65 ثانية بين المحاولات الفاشلة (rate limit يُعاد بعد 60 ثانية)

// ─── تحميل الكاش من القرص عند بدء التشغيل ───────────────────────────────────
function _loadLuluCacheFromDisk() {
  try {
    if (fs.existsSync(LULU_CACHE_FILE)) {
      const raw = fs.readFileSync(LULU_CACHE_FILE, 'utf8');
      const { catalog, ts } = JSON.parse(raw);
      if (Array.isArray(catalog) && catalog.length > 0) {
        _luluCatalog   = catalog;
        _luluCatalogTs = ts || 0;
        console.log(`[Lulu] Loaded ${catalog.length} items from disk cache`);
      }
    }
  } catch (e) {
    console.warn('[Lulu] Could not load disk cache:', e.message);
  }
}
_loadLuluCacheFromDisk();

// ─── حفظ الكاش على القرص ─────────────────────────────────────────────────────
function _saveLuluCacheToDisk(catalog) {
  try {
    const dir = path.dirname(LULU_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LULU_CACHE_FILE, JSON.stringify({ catalog, ts: Date.now() }), 'utf8');
    console.log(`[Lulu] Disk cache saved: ${catalog.length} items`);
  } catch (e) {
    console.warn('[Lulu] Could not save disk cache:', e.message);
  }
}

async function luluGet(endpoint, params = {}) {
  const url = new URL(`${LULU_API}${endpoint}`);
  url.searchParams.set('key', LULU_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
  const d = await r.json();
  if (d.status !== 200) throw new Error(d.msg || 'LuluStream API error');
  return d.result;
}

// يجلب قائمة المجلدات الفرعية مع pagination حتى يحصل على الكل
async function luluGetAllSubfolders(parentFldId) {
  const folders = [];
  let page = 1;
  while (true) {
    const res = await luluGet('/folder/list', { fld_id: parentFldId, page, per_page: 100 });
    const batch = res?.folders || [];
    folders.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return folders;
}

// يبني الكتالوج من المجلدات الفرعية (كل مجلد = فيلم أو مسلسل)
async function buildLuluCatalog() {
  const now = Date.now();
  const cacheValid = _luluCatalog && (now - _luluCatalogTs < LULU_CACHE_TTL);

  // ── إذا الكاش صالح → أرجعه فوراً بدون أي طلب خارجي ──
  if (cacheValid) return _luluCatalog;

  // ── إذا يوجد كاش قديم → أرجعه فوراً وابن الجديد في الخلفية ──
  if (_luluCatalog && !_luluRebuildActive) {
    _luluRebuildActive = true;
    _rebuildLuluCatalogInBackground();
    return _luluCatalog; // لا تُوقف الطلب
  }

  // ── cooldown: إذا فشل مؤخراً، لا تُعيد المحاولة قبل 90 ثانية ──
  if (!_luluRebuildActive && (now - _luluLastFailTs < LULU_RETRY_COOLDOWN)) {
    return []; // انتظر انتهاء cooldown
  }

  // ── أول تشغيل بعد الكاش الفارغ (بعد restart بدون ملف قرص) → انتظر ──
  if (!_luluRebuildActive) {
    _luluRebuildActive = true;
    await _rebuildLuluCatalogInBackground(true); // true = انتظر النتيجة
  }

  return _luluCatalog || [];
}

async function _rebuildLuluCatalogInBackground(wait = false) {
  const doRebuild = async () => {
    try {
      const folders = await luluGetAllSubfolders(LULU_ROOT_FLD);
      const CONCURRENCY = 2; // تقليل لتجنب rate limit مع uploader يعمل في الخلفية
      const BATCH_DELAY  = 2500; // 2.5 ثانية بين الدفعات → ~48 طلب/دقيقة كحد أقصى
      const items = [];
      for (let i = 0; i < folders.length; i += CONCURRENCY) {
        const batch = folders.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (folder) => {
          try {
            const filesRes = await luluGet('/file/list', { fld_id: folder.fld_id, per_page: 20 });
            const files = filesRes?.files || [];
            const mainFile = files.find(f => f.canplay === 1) || files[0];
            if (!mainFile) return null;
            return {
              id           : String(folder.fld_id),
              fld_id       : folder.fld_id,
              title        : folder.name,
              poster       : mainFile.thumbnail || '',
              fileCode     : mainFile.file_code,
              embedUrl     : `https://luluvdo.com/e/${mainFile.file_code}`,
              hlsUrl       : `https://luluvdo.com/hls/${mainFile.file_code}/master.m3u8`,
              vod_type     : files.length > 2 ? 'series' : 'movie',
              episodeCount : files.length,
              ts           : new Date(mainFile.uploaded || 0).getTime(),
              canplay      : mainFile.canplay === 1,
            };
          } catch { return null; }
        }));
        items.push(...results.filter(Boolean));
        // حفظ تدريجي: احفظ كل 20 عنصر ناجح لضمان عدم ضياع البيانات
        if (items.length > 0 && items.length % 20 === 0) {
          _luluCatalog = [...items];
          _saveLuluCacheToDisk(items);
        }
        // توقف بين الدفعات لتجنب rate limit
        if (i + CONCURRENCY < folders.length) {
          await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
      }
      if (items.length > 0) {
        _luluCatalog   = items;
        _luluCatalogTs = Date.now();
        _saveLuluCacheToDisk(items);
        console.log(`[Lulu] Catalog rebuilt: ${items.length} items from ${folders.length} folders`);
      }
    } catch (e) {
      console.error('[Lulu] buildLuluCatalog error:', e.message);
      _luluLastFailTs = Date.now(); // سجّل وقت الفشل
    } finally {
      _luluRebuildActive = false;
    }
  };

  if (wait) {
    await doRebuild();
  } else {
    doRebuild(); // بدون await — لا تُوقف الطلب الحالي
  }
}

// GET /api/lulu/home
app.get('/api/lulu/home', async (req, res) => {
  try {
    const catalog = await buildLuluCatalog();
    const sorted  = [...catalog].sort((a, b) => b.ts - a.ts);
    res.json({
      latestMovies : sorted.filter(i => i.vod_type === 'movie').slice(0, 24),
      latestSeries : sorted.filter(i => i.vod_type === 'series').slice(0, 24),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lulu/list?type=movie|series&page=1&search=
app.get('/api/lulu/list', async (req, res) => {
  try {
    const { type = 'movie', page = '1', search = '' } = req.query;
    const catalog = await buildLuluCatalog();
    const pg      = Math.max(1, parseInt(page));
    const limit   = 24;
    const q       = String(search).toLowerCase();

    let items = catalog.filter(i => i.vod_type === type);
    if (q) items = items.filter(i => i.title.toLowerCase().includes(q));
    items = [...items].sort((a, b) => b.ts - a.ts);

    const total = items.length;
    res.json({ items: items.slice((pg - 1) * limit, pg * limit), page: pg, total, hasMore: pg * limit < total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lulu/detail?id={fld_id}
app.get('/api/lulu/detail', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'missing id' });

    // ابحث في الكتالوج
    const catalog = await buildLuluCatalog();
    const item    = catalog.find(i => i.id === String(id));
    const title   = item?.title || '';

    // جلب كل ملفات المجلد
    const filesRes = await luluGet('/file/list', { fld_id: id, per_page: 100 });
    const files    = filesRes?.files || [];

    if (!files.length) return res.status(404).json({ error: 'not found' });

    const mainFile = files.find(f => f.canplay === 1) || files[0];
    const isMovie  = files.length <= 2;

    if (isMovie) {
      return res.json({
        id, title, vod_type: 'movie',
        poster      : mainFile.thumbnail || '',
        backdrop    : mainFile.thumbnail || '',
        fileCode    : mainFile.file_code,
        embedUrl    : `https://luluvdo.com/e/${mainFile.file_code}`,
        hlsUrl      : `https://luluvdo.com/hls/${mainFile.file_code}/master.m3u8`,
        canplay     : mainFile.canplay === 1,
      });
    }

    // مسلسل: كل ملف = حلقة
    const episodes = files.map((f, idx) => ({
      id          : f.file_code,
      episode     : idx + 1,
      season      : 1,
      title       : f.title || `الحلقة ${idx + 1}`,
      fileCode    : f.file_code,
      embedUrl    : `https://luluvdo.com/e/${f.file_code}`,
      hlsUrl      : `https://luluvdo.com/hls/${f.file_code}/master.m3u8`,
      canplay     : f.canplay === 1,
      thumbnail   : f.thumbnail || '',
    }));

    return res.json({
      id, title, vod_type: 'series',
      poster   : mainFile.thumbnail || '',
      backdrop : mainFile.thumbnail || '',
      seasons  : [{ season: 1, episodes }],
      episodes,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lulu/stream?file_code={fc}  أو  ?id={fld_id}
app.get('/api/lulu/stream', async (req, res) => {
  try {
    const { file_code, id } = req.query;
    let fc = file_code;

    if (!fc && id) {
      // جلب أول ملف من المجلد
      const filesRes = await luluGet('/file/list', { fld_id: id, per_page: 1 });
      const files    = filesRes?.files || [];
      if (!files.length) return res.json({ available: false });
      fc = files[0].file_code;
    }

    if (!fc) return res.json({ available: false });

    const info = await luluGet('/file/info', { file_code: fc });
    const f    = Array.isArray(info) ? info[0] : info;
    const canplay = f?.canplay === 1;

    res.json({
      available : canplay,
      fileCode  : fc,
      hlsUrl    : `https://luluvdo.com/hls/${fc}/master.m3u8`,
      embedUrl  : `https://luluvdo.com/e/${fc}`,
      title     : f?.file_title || '',
      reason    : canplay ? undefined : 'encoding',
    });
  } catch (e) {
    res.status(500).json({ available: false, error: e.message });
  }
});



/**

 * POST /api/stream/vidsrc

 * Ø¨Ø« Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… TMDB ID â€” Ø¥Ø±Ø¬Ø§Ø¹ Ø±Ø§Ø¨Ø· Embed ÙÙˆØ±ÙŠ Ù„Ù„Ø¹Ø±Ø¶ ÙÙŠ WebView

 * body: { tmdbId, type: 'movie'|'tv', season?, episode? }

 *

 * Ù…Ù„Ø§Ø­Ø¸Ø©: ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ù…Ø­Ø§ÙˆÙ„Ø§Øª Ø§Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬ (Puppeteer/Scraper) Ù„Ø£Ù†Ù‡Ø§ Ø¨Ø·ÙŠØ¦Ø© ÙˆØªÙØ´Ù„ ØºØ§Ù„Ø¨Ø§Ù‹

 * WebView ÙÙŠ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙŠØªØ¹Ø§Ù…Ù„ Ù…Ø¹ Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª ÙˆØ§Ù„ØªØ´ØºÙŠÙ„ Ù…Ø¨Ø§Ø´Ø±Ø©

 */

app.post('/api/stream/vidsrc', requireAuth, requirePremium, async (req, res) => {

  const { tmdbId, imdbId, type = 'movie' } = req.body;

  const season = type === 'tv' ? (parseInt(req.body.season) || 1) : undefined;

  const episode = type === 'tv' ? (parseInt(req.body.episode) || 1) : undefined;



  // ملاحظة: لا يوجد فحص لحد الاتصالات هنا — VidSrc embed يذهب للمصادر الخارجية مباشرةً

  // ولا يستهلك موارد السيرفر (عكس البث المباشر IPTV)



  if (!tmdbId) return res.status(400).json({ error: 'tmdbId مطلوب' });



  const streamId = `vidsrc_${type}_${tmdbId}${type === 'tv' ? `_s${season}e${episode}` : ''}`;

  const label = `tmdb=${tmdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''}`;



  try {

    const { randomUUID } = require('crypto');



    const recordHistory = async () => {

      try {

        await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')

          .run(randomUUID(), req.user.id, tmdbId, 'vod');

      } catch (_) {}

    };



    // ═══ 0. Arabic subtitles — fetch in parallel (Subdl + OpenSubtitles) ═══

    const arabicSubsPromise = fetchArabicSubtitles({ tmdbId, imdbId, type, season, episode }).catch(() => []);



    // ═══ 1. Consumet — HLS مباشر (بدون إعلانات) ═══

    try {

      let englishTitle = req.body.title || '';

      let year;

      try {

        const meta = await vidsrcApi.getDetail(tmdbId, type);

        if (meta) {

          englishTitle = meta.original_title || meta.title || englishTitle;

          year = meta.year;

        }

      } catch (_) {}



      if (englishTitle) {

        console.log(`[Stream] → Consumet: "${englishTitle}" (${type})`);

        const consumet = await resolveConsumetStream({ tmdbId, title: englishTitle, type, year, season, episode });

        if (consumet && consumet.url) {

          console.log(`[Stream] ✓ HLS via ${consumet.provider}`);

          await recordHistory();

          const arabicSubs = await arabicSubsPromise;

          // Arabic subs first, then provider subs (English etc.)

          const allSubs = [

            ...arabicSubs,

            ...(consumet.subtitles || []).map(s => ({ ...s, label: s.language })),

          ];

          return res.json({

            success: true, streamId, ready: true,

            hlsUrl: consumet.url,

            provider: consumet.provider,

            headers: consumet.headers || {},

            subtitles: allSubs,

          });

        }

      }

    } catch (ce) {

      console.log(`[Stream] Consumet failed: ${ce.message}`);

    }



    // ═══ 2.5. VidSrc M3U8 Extractor — استخراج m3u8 مباشر من VidSrc ═══
    try {
      console.log(`[Stream] → VidSrc M3U8 Extractor: ${label}`);
      const vidsrcM3u8 = await extractVidSrcM3U8({
        tmdbId,
        imdbId,
        type,
        season,
        episode,
      });
      
      if (vidsrcM3u8 && vidsrcM3u8.url) {
        console.log(`[Stream] ✓ VidSrc M3U8: ${vidsrcM3u8.provider}`);
        await recordHistory();
        const arabicSubs = await arabicSubsPromise;
        return res.json({
          success: true, streamId, ready: true,
          hlsUrl: vidsrcM3u8.url,
          provider: vidsrcM3u8.provider,
          quality: vidsrcM3u8.quality,
          subtitles: arabicSubs,
        });
      }
    } catch (vme) {
      console.log(`[Stream] VidSrc M3U8 failed: ${vme.message}`);
    }



    // ═══ 3. Fallback: VidSrc Embed URLs (full VidSrc mode) ═══
    console.log(`[Stream] → VidSrc embed fallback: ${label}`);

    const [stream, arabicSubs] = await Promise.all([
      resolveStream(tmdbId, type, season, episode, imdbId),
      arabicSubsPromise,
    ]);

    if (stream && stream.embedUrl) {
      const proxiedUrl = `/api/embed-proxy?url=${encodeURIComponent(stream.embedUrl)}`;
      console.log(`[Stream] ✓ VidSrc embed proxy: ${stream.provider} — ${stream.embedUrl}`);

      await recordHistory();

      return res.json({
        success: true, streamId, ready: true,
        embedUrl: proxiedUrl,
        provider: stream.provider,
        sources: (stream.sources || []).map(s => ({ ...s, url: `/api/embed-proxy?url=${encodeURIComponent(s.url)}` })),
        allEmbedUrls: (stream.allEmbedUrls || []).map(u => `/api/embed-proxy?url=${encodeURIComponent(u)}`),
        subtitles: arabicSubs,
      });
    }

    return res.status(404).json({ success: false, error: 'لا توجد مصادر بث متاحة' });

  } catch (e) {

    res.status(500).json({ success: false, error: e.message });

  }

});



// ═══ Embed HTML Proxy — يدعم vidsrc.icu + يحجب الإعلانات والروابط العشوائية ═══

const ALLOWED_EMBED_HOSTS = [
  'vidsrcme.vidsrc.icu',
  'vidsrc.icu', 'www.vidsrc.icu',
  'vidsrc-embed.ru', 'www.vidsrc-embed.ru',
  '2embed.cc', 'www.2embed.cc',
  'vidlink.pro', 'www.vidlink.pro',
  // VidSrc Advanced Resolver sources
  'vidsrc.xyz', 'www.vidsrc.xyz',
  'vidsrc.pro', 'www.vidsrc.pro',
  'vidsrc.to', 'www.vidsrc.to',
  'vidsrc.net', 'www.vidsrc.net',
  // LuluStream player domains
  'luluvdo.com', 'www.luluvdo.com',
  'lulustream.com', 'www.lulustream.com',
];

app.get('/api/embed-proxy', async (req, res) => {

  const rawUrl = req.query.url;

  if (!rawUrl) return res.status(400).end();

  const targetUrl = decodeURIComponent(rawUrl);

  let parsedTarget;
  try { parsedTarget = new URL(targetUrl); } catch { return res.status(400).end(); }
  if (!ALLOWED_EMBED_HOSTS.includes(parsedTarget.hostname)) return res.status(403).end();



  try {

    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'iframe',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Referer': 'https://vidsrc.icu/',
        'Origin': 'https://vidsrc.icu',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });



    let html = await response.text();

    const baseHref = `${parsedTarget.protocol}//${parsedTarget.host}/`;
    const inject = `<base href="${baseHref}">`;


    if (html.includes('<head>')) {

      html = html.replace('<head>', '<head>' + inject);

    } else if (html.includes('<html')) {

      html = html.replace(/<html[^>]*>/, (m) => m + inject);

    } else {

      html = inject + html;

    }



    res.removeHeader('X-Frame-Options');

    res.removeHeader('Content-Security-Policy');

    res.set('Content-Type', 'text/html; charset=utf-8');

    res.send(html);

  } catch (e) {

    console.error('[EmbedProxy]', e.message);

    res.status(502).send('<html><body></body></html>');

  }

});



// ═══ HLS Proxy session from WebView-extracted URL ═══

app.post('/api/stream/proxy-hls', requireAuth, requirePremium, (req, res) => {

  const { url, referer, streamId } = req.body;

  if (!url) return res.status(400).json({ error: 'url Ù…Ø·Ù„ÙˆØ¨' });



  try {

    const sessionId = hlsProxy.createSession(url, referer || '', []);

    const proxiedUrl = `/free-hls/${sessionId}/master.m3u8`;

    console.log(`[HlsProxy] Client-extracted session: ${sessionId} â€” ${url.substring(0, 80)}`);

    res.json({ success: true, hlsUrl: proxiedUrl, sessionId });

  } catch (e) {

    console.error(`[HlsProxy] proxy-hls error:`, e.message);

    res.status(500).json({ success: false, error: e.message });

  }

});



// â•â•â• Ø¬Ù„Ø¨ ØªØ±Ø¬Ù…Ø§Øª Ø¹Ø±Ø¨ÙŠØ© â•â•â•

app.get('/api/subtitles', async (req, res) => {

  const { tmdbId, imdbId, type = 'movie', season, episode } = req.query;

  if (!tmdbId && !imdbId) return res.status(400).json({ error: 'tmdbId Ø£Ùˆ imdbId Ù…Ø·Ù„ÙˆØ¨' });



  try {

    const subs = await fetchArabicSubtitles({

      tmdbId: tmdbId || '',

      imdbId: imdbId || '',

      type: type === 'tv' ? 'tv' : 'movie',

      season: season ? parseInt(season) : undefined,

      episode: episode ? parseInt(episode) : undefined,

    });



    res.json({ success: true, subtitles: subs });

  } catch (e) {

    console.error('[Subtitles] Error:', e.message);

    res.status(500).json({ success: false, error: e.message });

  }

});



// â•â•â• Ø¨Ø±ÙˆÙƒØ³ÙŠ ØªØ±Ø¬Ù…Ø§Øª (Ù„ØªØ¬Ø§ÙˆØ² CORS) â•â•â•

app.get('/api/subtitle-proxy', async (req, res) => {

  const url = req.query.url;

  if (!url) return res.status(400).send('url required');

  try {

    const r = await fetch(url, {

      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36' },

    });

    if (!r.ok) return res.status(r.status).send('Subtitle fetch failed');

    const ct = r.headers.get('content-type') || 'text/plain';

    res.set('Content-Type', ct);

    res.set('Access-Control-Allow-Origin', '*');

    const buf = Buffer.from(await r.arrayBuffer());

    res.send(buf);

  } catch (e) {

    res.status(500).send(e.message);

  }

});



function langLabel(code) {

  const map = {

    ar: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', ara: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', en: 'English', eng: 'English',

    fr: 'FranÃ§ais', fre: 'FranÃ§ais', de: 'Deutsch', ger: 'Deutsch',

    es: 'EspaÃ±ol', spa: 'EspaÃ±ol', it: 'Italiano', ita: 'Italiano',

    pt: 'PortuguÃªs', por: 'PortuguÃªs', tr: 'TÃ¼rkÃ§e', tur: 'TÃ¼rkÃ§e',

    ru: 'Ð ÑƒÑÑÐºÐ¸Ð¹', rus: 'Ð ÑƒÑÑÐºÐ¸Ð¹', ja: 'æ—¥æœ¬èªž', jpn: 'æ—¥æœ¬èªž',

    ko: 'í•œêµ­ì–´', kor: 'í•œêµ­ì–´', zh: 'ä¸­æ–‡', zho: 'ä¸­æ–‡', chi: 'ä¸­æ–‡',

    hi: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€', hin: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€', und: 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯',

  };

  return map[code] || code || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯';

}



function normalizeDirectSubtitles(subtitles = []) {

  return subtitles

    .filter((sub) => sub && sub.url)

    .map((sub) => ({

      language: sub.language || 'und',

      label: sub.label || langLabel(sub.language || 'und'),

      url: sub.url,

      type: sub.type || 'vtt',

    }));

}



function buildDirectResultFromExtracted(extracted, referer = '') {

  return {

    provider: extracted.sourceId || extracted.provider || 'unknown',

    url: extracted.url,

    type: extracted.type || 'mp4',

    referer: referer || '',

    qualities: extracted.qualities || {},

    headers: extracted.headers || {},

    subtitles: normalizeDirectSubtitles(extracted.captions || extracted.subtitles || []),

  };

}



async function finalizeDirectStream({ streamId, directResult }) {

  const normalizedResult = {

    provider: directResult.provider || 'unknown',

    url: directResult.url,

    type: directResult.type || 'mp4',

    referer: directResult.referer || '',

    headers: directResult.headers || {},

    qualities: directResult.qualities || {},

    subtitles: normalizeDirectSubtitles(directResult.subtitles || []),

  };



  if (normalizedResult.type === 'hls' && Object.keys(normalizedResult.qualities).length === 0) {

    normalizedResult.qualities = await buildHlsQualities(normalizedResult.url, normalizedResult.referer || '');

  }



  if (Object.keys(normalizedResult.qualities).length === 0) {

    normalizedResult.qualities = {

      auto: { url: normalizedResult.url, type: normalizedResult.type || 'mp4' },

    };

  }



  return buildDirectStreamResponse({ streamId, ...normalizedResult });

}



async function recordWatchHistory(userId, itemId, itemType) {

  try {

    await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')

      .run(randomUUID(), userId, itemId, itemType);

  } catch {}

}



async function buildHlsQualities(streamUrl, referer = '') {

  const qualities = {

    auto: { url: streamUrl, type: 'hls' },

  };



  try {

    const body = await hlsProxy._fetch(streamUrl, referer);

    const text = body.toString('utf8');

    if (!text.includes('#EXT-X-STREAM-INF')) return qualities;



    const lines = text.split(/\r?\n/);

    const baseUrl = hlsProxy._getBaseUrl(streamUrl);



    for (let i = 0; i < lines.length; i += 1) {

      const infoLine = (lines[i] || '').trim();

      if (!infoLine.startsWith('#EXT-X-STREAM-INF')) continue;



      let playlistLine = '';

      for (let j = i + 1; j < lines.length; j += 1) {

        const candidate = (lines[j] || '').trim();

        if (!candidate) continue;

        if (candidate.startsWith('#')) continue;

        playlistLine = candidate;

        i = j;

        break;

      }



      if (!playlistLine) continue;

      const resolutionMatch = infoLine.match(/RESOLUTION=\d+x(\d+)/i);

      if (!resolutionMatch) continue;



      const key = resolutionMatch[1];

      const fullUrl = hlsProxy._resolveUrl(baseUrl, playlistLine);

      qualities[key] = {

        url: fullUrl,

        type: 'hls',

      };

    }

  } catch (e) {

    console.log(`[Stream] HLS quality parse failed: ${e.message}`);

  }



  return qualities;

}



function resolvePlaybackHeaders(headers = {}, referer = '') {

  const resolvedHeaders = headers && Object.keys(headers).length > 0 ? { ...headers } : {};

  if (Object.keys(resolvedHeaders).length === 0 && referer) {

    try {

      resolvedHeaders.Referer = referer;

      resolvedHeaders.Origin = new URL(referer).origin;

    } catch {

      resolvedHeaders.Referer = referer;

    }

  }

  return resolvedHeaders;

}



async function buildDirectStreamResponse({ streamId, provider, url, type, referer = '', subtitles = [], qualities = {}, headers = {} }) {

  const normalizedSubs = subtitles.map((sub) => ({

    language: sub.language || 'und',

    label: sub.label || langLabel(sub.language || 'und'),

    url: sub.url,

    type: sub.type || 'vtt',

  }));



  const resolvedHeaders = resolvePlaybackHeaders(headers, referer);

  const resolvedQualities = qualities && Object.keys(qualities).length > 0

    ? qualities

    : (type === 'hls' ? await buildHlsQualities(url, referer) : { auto: { url, type: type || 'mp4' } });



  return {

    success: true,

    streamId,

    ready: true,

    provider,

    ...(type === 'hls' ? { hlsUrl: url } : { vodUrl: url }),

    qualities: resolvedQualities,

    subtitles: normalizedSubs,

    headers: resolvedHeaders,

  };

}



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// HLS Proxy Routes â€” Ø¨Ø« m3u8 + segments (vidsrc) Ø¨Ø¯ÙˆÙ† Ø¥Ø¹Ù„Ø§Ù†Ø§Øª

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get('/free-hls/:sessionId/master.m3u8', (req, res) => {

  hlsProxy.proxyPlaylist(req.params.sessionId, 'master.m3u8', req, res);

});



app.get('/free-hls/:sessionId/playlist/:encodedUrl', (req, res) => {

  const targetUrl = req.params.encodedUrl;

  const session = hlsProxy.getSession(req.params.sessionId);

  if (!session) return res.status(404).json({ error: 'Ø¬Ù„Ø³Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });

  // Ø­Ø¯Ù‘Ø« baseUrl Ù„Ù„Ù€ playlist Ø§Ù„ÙØ±Ø¹ÙŠ

  session.baseUrl = hlsProxy._getBaseUrl(targetUrl);

  hlsProxy.proxyPlaylist(req.params.sessionId, targetUrl, req, res);

});



app.get('/free-hls/:sessionId/seg/:encodedUrl', (req, res) => {

  const targetUrl = req.params.encodedUrl;

  hlsProxy.proxySegment(req.params.sessionId, targetUrl, req, res);

});



app.get('/free-hls/:sessionId/sub/:index', (req, res) => {

  hlsProxy.proxySubtitle(req.params.sessionId, parseInt(req.params.index), req, res);

});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// VOD Proxy â€” Ø¨Ø« ØªØ¯Ø±ÙŠØ¬ÙŠ Ù…Ø«Ù„ YouTube (seeking ÙÙˆØ±ÙŠ ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø­Ù…Ù„Ø©)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



app.get('/vod/proxy/:filename', (req, res) => {

  const filename = req.params.filename;

  const id = filename.replace(/\.[^.]+$/, '');

  vodProxy.proxyRequest(id, req, res);

});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// HLS Files â€” ØªÙ‚Ø¯ÙŠÙ… Ù…Ù„ÙØ§Øª Ø§Ù„Ø¨Ø« Ø§Ù„Ù…Ø¨Ø§Ø´Ø±

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



app.get('/hls/:streamId/:file', (req, res) => {

  serveHlsFile(path.join(config.HLS_DIR, req.params.streamId, req.params.file), req.params.file, res);

});



app.get('/hls/vod/:streamId/:file', (req, res) => {

  serveHlsFile(path.join(config.HLS_DIR, 'vod', req.params.streamId, req.params.file), req.params.file, res);

});



function serveHlsFile(filePath, fileName, res) {

  if (!fs.existsSync(filePath)) {

    return res.status(404).json({ error: 'Ø§Ù„Ù…Ù„Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });

  }

  let contentType = 'application/octet-stream';

  if (fileName.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';

  else if (fileName.endsWith('.ts')) contentType = 'video/MP2T';

  else if (fileName.endsWith('.vtt')) contentType = 'text/vtt';



  res.set({

    'Content-Type': contentType,

    'Access-Control-Allow-Origin': '*',

    'Cache-Control': fileName.endsWith('.ts') ? 'public, max-age=3600' : 'no-cache, no-store',

  });

  const stat = fs.statSync(filePath);

  res.set('Content-Length', stat.size);

  fs.createReadStream(filePath).pipe(res);

}



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Xtream Channels DB

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// xtream_channels table is created in db.init() — no sync db.exec() needed



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Xtream Codes â€” Channel API

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



/**

 * GET /api/xtream/channels

 * List channels with optional category/search filter + pagination

 * Iraqi channels first, then sorted by priority

 */

app.get('/api/xtream/channels', async (req, res) => {

  try {

    const { category, search, limit, offset } = req.query;

    const lim = Math.min(parseInt(limit) || 50, 200);

    const off = parseInt(offset) || 0;



    let where = ['is_streaming = true'];

    let params = [];



    if (category) { where.push('category = ?'); params.push(category); }

    if (search)   { where.push('name ILIKE ?'); params.push(`%${search}%`); }



    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';



    const totalRow = await db.prepare(

      `SELECT COUNT(*) as c FROM xtream_channels ${whereStr}`

    ).get(...params);

    const total = totalRow ? totalRow.c : 0;



    const rows = await db.prepare(`

      SELECT id, name, logo, category, stream_id, epg_id, sort_order, base_url

      FROM xtream_channels ${whereStr}

      ORDER BY

        CASE WHEN name ILIKE '%عراق%' OR name ILIKE '%iraq%' THEN 0 ELSE 1 END,

        sort_order,

        name

      LIMIT ${lim} OFFSET ${off}

    `).all(...params);



    const channels = rows.map(r => ({

      id       : r.id,

      name     : r.name,

      logo     : r.logo,

      category : r.category,

      streamId : r.stream_id,

    }));



    const catRows = await db.prepare(

      'SELECT DISTINCT category, MIN(sort_order) as p FROM xtream_channels WHERE is_streaming = true GROUP BY category ORDER BY p'

    ).all();

    const categories = catRows.map(r => r.category);



    res.json({ success: true, channels, total, hasMore: off + lim < total, categories });

  } catch (e) {

    console.error('[Xtream] channels error:', e.message);

    res.status(500).json({ error: 'فشل جلب القنوات' });

  }

});



/**

 * GET /api/xtream/stream/:channelId

 * Returns the HLS proxy URL for a channel

 * The proxy handles viewer tracking + segment caching

 */

app.get('/api/xtream/stream/:channelId', async (req, res) => {
  try {
    // Look up channel + its IPTV account (each channel has its own account)
    const ch = await db.prepare(`
      SELECT c.id, c.name, c.logo, c.category, c.stream_id, c.account_id,
             a.server_url, a.username, a.password
      FROM xtream_channels c
      LEFT JOIN iptv_accounts a ON c.account_id = a.id
      WHERE c.id = ? OR c.stream_id = ?
    `).get(req.params.channelId, Number(req.params.channelId) || -1);

    if (!ch)            return res.status(404).json({ error: 'channel not found' });
    if (!ch.server_url) return res.status(400).json({ error: 'القناة غير مرتبطة بحساب IPTV' });

    // Build Xtream live URL — stream-manager will rewrite .m3u8 → .ts automatically
    const iptvUrl = `${ch.server_url}/live/${ch.username}/${ch.password}/${ch.stream_id}.m3u8`;
    const streamKey = `xtream_live_${ch.stream_id}`;

    const result = await streamManager.requestStream(streamKey, 'live', iptvUrl, ch.name);
    if (!result.success) {
      console.error('[Xtream] start failed:', ch.name, result.error);
      return res.status(500).json({ error: 'فشل بدء البث', details: result.error });
    }

    res.json({
      success : true,
      name    : ch.name,
      logo    : ch.logo,
      category: ch.category,
      hlsUrl  : result.hlsUrl,              // /hls/xtream_live_<id>/stream.m3u8
      ready   : result.ready,
      waiting : result.waiting,
      streamId: ch.stream_id,
    });
  } catch (e) {
    console.error('[Xtream] stream error:', e.message);
    res.status(500).json({ error: 'فشل جلب رابط البث' });
  }
});

// GET /api/xtream/stream-ready/:streamId — poll readiness (first segment available)
app.get('/api/xtream/stream-ready/:streamId', (req, res) => {
  const key = `xtream_live_${req.params.streamId}`;
  const ready = streamManager.isReady(key, 'live');
  const info  = streamManager.getStreamInfo(key);
  res.json({ ready, info });
});



/**

 * GET /api/xtream/refresh

 * Re-sync channels from Xtream provider (admin only)

 */

app.get('/api/xtream/refresh', requireAuth, async (req, res) => {

  const user = req.user;

  if (!user || (user.role !== 'admin' && !req.user.is_admin)) {

    return res.status(403).json({ error: 'ØºÙŠØ± Ù…ØµØ±Ø­' });

  }

  res.json({ success: true, message: 'Ø¬Ø§Ø±Ù Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ù‚Ù†ÙˆØ§Øª...' });

  syncXtreamChannels(db).catch(e => console.error('[Xtream] Refresh error:', e.message));

});



/**

 * GET /api/xtream/viewers

 * Active viewer counts per channel (admin)

 */

app.get('/api/xtream/viewers', requireAuth, (req, res) => {

  const user = req.user;

  if (!user || (user.role !== 'admin' && !req.user.is_admin)) {

    return res.status(403).json({ error: 'ØºÙŠØ± Ù…ØµØ±Ø­' });

  }

  res.json({ success: true, viewers: {}, total: 0 });

});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// HLS Reverse Proxy â€” Xtream streams

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



// Legacy /proxy/live/* routes removed.
// Xtream live channels now flow through POST /api/stream/live/:channelId → StreamManager (FFmpeg).





// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Health + Admin

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



app.get('/health', (req, res) => {

  const mem = process.memoryUsage();

  res.json({

    status: 'ok',

    uptime: Math.floor(process.uptime()),

    activeStreams: streamManager.getActiveStreams().length,

    vodSessions: vodProxy.getActiveSessions().length,

    hlsSessions: hlsProxy.sessions.size,

    memory: {

      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',

      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',

      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',

    },

  });

});



// ═══ TEST ENDPOINT - بدء بث بدون JWT (للاختبار فقط) ═══

app.get('/test/start-stream/:channelId', async (req, res) => {

  const channelId = req.params.channelId;

  

  try {

    // الحصول على معلومات القناة

    const xch = await db.prepare('SELECT id, name, logo, category, stream_id, base_url, account_id FROM xtream_channels WHERE stream_id = ? OR id = ?').get(Number(channelId), channelId);

    

    if (!xch) {

      return res.status(404).json({ error: 'القناة غير موجودة', channelId });

    }



    // الحصول على بيانات الحساب

    const account = await db.prepare('SELECT server_url, username, password FROM iptv_accounts WHERE id = ?').get(xch.account_id);

    

    if (!account) {

      return res.status(500).json({ error: 'حساب IPTV غير موجود', channelId: xch.stream_id });

    }



    // بناء رابط IPTV المباشر

    const iptvUrl = `${account.server_url}/live/${account.username}/${account.password}/${xch.stream_id}.m3u8`;

    

    console.log(`[TEST] Starting FFmpeg for channel ${xch.name} (${xch.stream_id})`);

    

    // بدء FFmpeg

    const result = await streamManager.requestStream(

      `xtream_live_${xch.stream_id}`,

      'live',

      iptvUrl,

      xch.name

    );



    if (!result.success) {

      return res.status(500).json({ error: 'فشل بدء البث', details: result.error });

    }



    res.json({

      success: true,

      message: 'تم بدء البث بنجاح',

      channelId: xch.stream_id,

      channelName: xch.name,

      hlsUrl: `/hls/xtream_live_${xch.stream_id}/stream.m3u8`,

      fullUrl: `http://62.171.153.204:8090/hls/xtream_live_${xch.stream_id}/stream.m3u8`,

      ready: result.ready || false,

      waiting: result.waiting || false,

      instructions: 'انتظر 5-10 ثواني ثم افتح fullUrl في VLC',

    });

  } catch (error) {

    console.error('[TEST] Error:', error);

    res.status(500).json({ error: error.message });

  }

});



app.get('/api/stream/status', requireAuth, (req, res) => {

  res.json({ streams: streamManager.getActiveStreams() });

});



app.get('/', (req, res) => {

  res.json({

    name: 'IPTV Cloud Streaming Server',

    version: '3.0.0',

    endpoints: {

      stream_live: 'POST /api/stream/live/:channelId (JWT)',

      stream_vod: 'POST /api/stream/vod/:id (JWT)',

      stream_seek: 'POST /api/stream/seek/:streamId (JWT)',

      stream_info: 'GET /api/stream/info/:streamId (JWT)',

      stream_release: 'POST /api/stream/release/:streamId (JWT)',

      stream_ready: 'GET /api/stream/ready/:streamId (JWT)',

      hls_live: '/hls/:streamId/stream.m3u8',

      hls_vod: '/hls/vod/:streamId/stream.m3u8',

      health: '/health',

      sessions: 'GET /api/session/active (JWT)',

      session_info: 'GET /api/session/subscription-info (JWT)',

    },

  });

});



// ═══ Admin Session Management API ═══════════════════════════

app.get('/api/admin/sessions', requireAuth, async (req, res) => {

  if (!req.user.is_admin && req.user.role !== 'admin') {

    return res.status(403).json({ error: 'admin required' });

  }

  await _cleanExpiredSessions();

  const sessions = await db.prepare(`

    SELECT s.*, u.username, u.plan, u.max_connections

    FROM active_sessions s

    LEFT JOIN users u ON s.user_id = u.id

    ORDER BY s.started_at DESC

  `).all();

  const totalUsers = new Set(sessions.map(s => s.user_id)).size;

  res.json({ sessions, total: sessions.length, totalUsers });

});



app.post('/api/admin/sessions/kill', requireAuth, async (req, res) => {

  if (!req.user.is_admin && req.user.role !== 'admin') {

    return res.status(403).json({ error: 'admin required' });

  }

  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  await _deleteSession(sessionId);

  res.json({ success: true });

});



app.post('/api/admin/sessions/kill-user', requireAuth, async (req, res) => {

  if (!req.user.is_admin && req.user.role !== 'admin') {

    return res.status(403).json({ error: 'admin required' });

  }

  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId required' });

  await db.prepare('DELETE FROM active_sessions WHERE user_id = ?').run(userId);

  res.json({ success: true });

});



app.post('/api/admin/sessions/kill-all', requireAuth, async (req, res) => {

  if (!req.user.is_admin && req.user.role !== 'admin') {

    return res.status(403).json({ error: 'admin required' });

  }

  await db.prepare('DELETE FROM active_sessions').run();

  res.json({ success: true });

});



app.get('/api/admin/sessions/stats', requireAuth, async (req, res) => {

  if (!req.user.is_admin && req.user.role !== 'admin') {

    return res.status(403).json({ error: 'admin required' });

  }

  await _cleanExpiredSessions();

  const total = await db.prepare('SELECT COUNT(*) as c FROM active_sessions').get();

  const byType = await db.prepare('SELECT type, COUNT(*) as c FROM active_sessions GROUP BY type').all();

  const byUser = await db.prepare(`

    SELECT s.user_id, u.username, u.plan, u.max_connections, COUNT(*) as active_count

    FROM active_sessions s

    LEFT JOIN users u ON s.user_id = u.id

    GROUP BY s.user_id

    ORDER BY active_count DESC

  `).all();

  const overLimit = byUser.filter(u => u.active_count > (u.max_connections || 1));

  res.json({

    total: total.c,

    byType: byType.reduce((acc, r) => { acc[r.type] = r.c; return acc; }, {}),

    byUser,

    overLimit,

  });

});



// ═══════════════════════════════════════════════════════════════
// Admin IPTV Multi-Account API (runs on cloud-server directly)
// ═══════════════════════════════════════════════════════════════

function _isAdmin(req) {
  return req.user && (req.user.is_admin || req.user.role === 'admin');
}

// ─── IPTV Accounts CRUD ──────────────────────────────────────

app.get('/api/admin/iptv-accounts', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const accounts = await db.prepare('SELECT id, name, server_url, username, password, max_connections, status, created_at FROM iptv_accounts ORDER BY id').all();
  // Count channels per account
  for (const acc of accounts) {
    const row = await db.prepare('SELECT COUNT(*) as c FROM xtream_channels WHERE account_id = ?').get(acc.id);
    acc.channel_count = row ? row.c : 0;
  }
  res.json({ accounts });
});

app.post('/api/admin/iptv-accounts', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const { name, server_url, username, password, max_connections } = req.body;
  if (!server_url || !username || !password) return res.status(400).json({ error: 'server_url, username, password مطلوبة' });
  // Verify account works
  try {
    const { apiCall } = require('./lib/xtream');
    const info = await apiCall(server_url, username, password, 'get_live_categories');
    if (!Array.isArray(info)) throw new Error('Invalid response');
  } catch (e) {
    return res.status(400).json({ error: 'فشل الاتصال بالسيرفر: ' + e.message });
  }
  const result = await db.prepare(
    'INSERT INTO iptv_accounts (name, server_url, username, password, max_connections, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).get(name || '', server_url, username, password, max_connections || 1, 'active', Date.now());
  res.json({ success: true, id: result.id });
});

app.put('/api/admin/iptv-accounts/:id', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const { name, server_url, username, password, max_connections, status } = req.body;
  await db.prepare(
    'UPDATE iptv_accounts SET name=COALESCE(?,name), server_url=COALESCE(?,server_url), username=COALESCE(?,username), password=COALESCE(?,password), max_connections=COALESCE(?,max_connections), status=COALESCE(?,status) WHERE id=?'
  ).run(name||null, server_url||null, username||null, password||null, max_connections||null, status||null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/iptv-accounts/:id', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const accId = req.params.id;
  // Delete channels linked to this account
  await db.prepare('DELETE FROM xtream_channels WHERE account_id = ?').run(accId);
  await db.prepare('DELETE FROM iptv_accounts WHERE id = ?').run(accId);
  res.json({ success: true });
});

// ─── Channel Search (within a specific IPTV account) ─────────

app.get('/api/admin/iptv-search', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const { account_id, q } = req.query;
  if (!account_id) return res.status(400).json({ error: 'account_id مطلوب' });
  if (!q || q.length < 2) return res.status(400).json({ error: 'أدخل حرفين على الأقل' });
  const account = await db.prepare('SELECT * FROM iptv_accounts WHERE id = ?').get(account_id);
  if (!account) return res.status(404).json({ error: 'الحساب غير موجود' });
  try {
    const result = await searchAccountChannels(account, q);
    res.json({ channels: result.channels.slice(0, 200), total: result.total });
  } catch (e) {
    res.status(500).json({ error: 'فشل البحث: ' + e.message });
  }
});

// ─── Add Channels (from search results, linked to account) ───

app.post('/api/admin/iptv-add-channels', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const { account_id, channels } = req.body;
  if (!account_id || !channels || !channels.length) return res.status(400).json({ error: 'account_id و channels مطلوبة' });
  const account = await db.prepare('SELECT * FROM iptv_accounts WHERE id = ?').get(account_id);
  if (!account) return res.status(404).json({ error: 'الحساب غير موجود' });
  try {
    const result = await addChannelsToDB(db, account, channels);
    res.json({ success: true, added: result.added });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Cloud Channel Management ────────────────────────────────

app.get('/api/admin/cloud-channels', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const rows = await db.prepare(`
    SELECT c.*, a.name as account_name, a.server_url as account_server
    FROM xtream_channels c
    LEFT JOIN iptv_accounts a ON c.account_id = a.id
    ORDER BY c.sort_order, c.name
  `).all();
  res.json({ channels: rows });
});

app.delete('/api/admin/cloud-channels/:id', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  await db.prepare('DELETE FROM xtream_channels WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/cloud-channels', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  await db.prepare('DELETE FROM xtream_channels').run();
  res.json({ success: true });
});

// ─── Refresh Channel Stream (re-verify with IPTV) ────────────

app.post('/api/admin/channel-refresh/:id', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  try {
    const result = await refreshChannelStream(db, req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Test IPTV Account Connection ────────────────────────────

app.post('/api/admin/iptv-test', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const { server_url, username, password } = req.body;
  if (!server_url || !username || !password) return res.status(400).json({ error: 'بيانات الاتصال مطلوبة' });
  try {
    const { apiCall } = require('./lib/xtream');
    const cats = await apiCall(server_url, username, password, 'get_live_categories');
    const streams = await apiCall(server_url, username, password, 'get_live_streams');
    res.json({
      success: true,
      categories: Array.isArray(cats) ? cats.length : 0,
      channels: Array.isArray(streams) ? streams.length : 0,
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─── Toggle Channel Streaming (start/stop) ───────────────

app.post('/api/admin/channel-toggle-stream/:id', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const channelId = req.params.id;
  const { streaming } = req.body;
  const isStreaming = !!streaming;

  // If starting stream, just confirm channel is linked to an IPTV account.
  // Actual playback errors are logged by FFmpeg stderr via StreamManager.
  if (isStreaming) {
    const info = await getChannelAccount(db, channelId);
    if (!info || !info.account) {
      return res.status(400).json({ error: 'القناة غير مرتبطة بحساب IPTV' });
    }
  }

  await db.prepare('UPDATE xtream_channels SET is_streaming = ? WHERE id = ?').run(isStreaming, channelId);
  res.json({ success: true, is_streaming: isStreaming });
});

// ─── Batch Toggle Streaming for all channels of an account ─

app.post('/api/admin/account-toggle-stream/:accountId', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const { streaming } = req.body;
  await db.prepare('UPDATE xtream_channels SET is_streaming = ? WHERE account_id = ?').run(!!streaming, req.params.accountId);
  res.json({ success: true });
});

// ─── Stream Error Log APIs ────────────────────────────────

app.get('/api/admin/stream-errors', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const rows = await db.prepare('SELECT * FROM stream_errors ORDER BY created_at DESC LIMIT ' + limit).all();
  res.json({ errors: rows });
});

app.delete('/api/admin/stream-errors', requireAuth, async (req, res) => {
  if (!_isAdmin(req)) return res.status(403).json({ error: 'admin required' });
  await db.prepare('DELETE FROM stream_errors').run();
  res.json({ success: true });
});

// ─── Log stream error helper (used internally) ────────────
async function logStreamError(accountId, channelId, channelName, errorType, message) {
  try {
    await db.prepare('INSERT INTO stream_errors (account_id, channel_id, channel_name, error_type, message, created_at) VALUES (?,?,?,?,?,?)').run(
      accountId || 0, channelId || '', channelName || '', errorType || 'unknown', message || '', Date.now()
    );
    // Keep only last 1000 errors
    await db.prepare('DELETE FROM stream_errors WHERE id NOT IN (SELECT id FROM stream_errors ORDER BY created_at DESC LIMIT 1000)').run();
  } catch (e) { console.error('[StreamErrors] Log error:', e.message); }
}

app.use((req, res) => { res.status(404).json({ error: 'غير موجود' }); });

app.use((err, req, res, next) => {

  console.error('Server error:', err);

  res.status(500).json({ error: 'Ø®Ø·Ø£ Ø¯Ø§Ø®Ù„ÙŠ' });

});



// â”€â”€â”€ Ø¨Ø¯Ø¡ Ø§Ù„Ø³ÙŠØ±ÙØ± + ØªØ­Ø¯ÙŠØ« ØªÙ„Ù‚Ø§Ø¦ÙŠ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ═══ Graceful error handling — prevent crashes under high concurrency ═══

process.on('uncaughtException', (err) => {

  console.error('[FATAL] Uncaught exception:', err.message, err.stack?.split('\n')[1]);

});

process.on('unhandledRejection', (reason) => {

  console.error('[WARN] Unhandled rejection:', reason instanceof Error ? reason.message : reason);

});



db.init().then(() => {

const server = app.listen(config.PORT, config.HOST, async () => {

  // ═══ Server tuning for 100+ concurrent users ═══

  server.keepAliveTimeout = 65000;    // Keep connections alive (must > proxy timeout)

  server.headersTimeout = 70000;      // Must be > keepAliveTimeout

  server.maxConnections = 0;          // Unlimited (OS limit applies)

  server.timeout = 0;                 // No timeout for streaming connections



  console.log(`\n  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);

  console.log(`  â•‘   IPTV Cloud Streaming Server v3.0               â•‘`);

  console.log(`  â•‘   Ø¨Ø« Ù…Ø¨Ø§Ø´Ø± + ØªØ­Ù‚Ù‚ JWT + ØªØ­Ø¯ÙŠØ« ØªÙ„Ù‚Ø§Ø¦ÙŠ             â•‘`);

  console.log(`  â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£`);

  console.log(`  â•‘   http://localhost:${config.PORT}                         â•‘`);

  console.log(`  â•‘   DB: PostgreSQL (shared)                       â•‘`);

  console.log(`  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);



  console.log(`  ║   keepAlive: 65s | maxSockets: 80 upstream      ║`);

  console.log(`  ╚══════════════════════════════════════════════════╝\n`);



  streamManager.start();

  vodProxy.start();

  hlsProxy.start();

  liveProxy.start();

  // Initialize Xtream from DB (load default account for legacy compat)
  initXtreamFromDB(db).catch(e => console.error('[Init] Xtream init error:', e.message));

  // Sync channels from backend PostgreSQL on startup
  syncChannelsFromBackend(true).catch(e => console.error('[Sync] Startup error:', e.message));
  setInterval(() => syncChannelsFromBackend(true).catch(() => {}), CHANNEL_SYNC_INTERVAL);

  // ─── بناء كتالوج LuluStream في الخلفية ───
  // نُعطي rate limit وقت كافي للإعادة (65 ثانية) قبل أول طلب
  if (_luluCatalog && _luluCatalog.length > 0) {
    console.log(`[Lulu] Disk cache loaded: ${_luluCatalog.length} items`);
  } else {
    console.log('[Lulu] No cache — will start build in 65s (rate limit cooldown)...');
    setTimeout(() => {
      if (!_luluCatalog || _luluCatalog.length === 0) {
        console.log('[Lulu] Starting background catalog build...');
        _luluRebuildActive = true;
        _rebuildLuluCatalogInBackground(false);
      }
    }, 65000); // انتظر 65 ثانية لضمان تجدد rate limit
  }



  // Pre-warm VOD cache on startup (fetch latest movies & series)

  try {

    console.log('[VOD] Pre-warming cache...');

    const home = await xtreamVod.getHome();

    console.log(`[VOD] Pre-warmed: ${home.latestMovies?.length || 0} movies, ${home.latestSeries?.length || 0} series`);

    

    // Also pre-load categories for better UX

    const [vodCats, seriesCats] = await Promise.all([

      xtreamVod.getVodCategories(),

      xtreamVod.getSeriesCategories(),

    ]);

    console.log(`[VOD] Categories loaded: ${vodCats?.length || 0} VOD, ${seriesCats?.length || 0} Series`);

  } catch (e) {

    console.error('[VOD] Pre-warm error:', e.message);

  }

  // ═══ Always-On: Pre-warm ALL live Xtream channels on startup ═══
  // Starts FFmpeg for every channel so they're instantly ready when viewers tune in.
  setTimeout(async () => {
    try {
      const channels = await db.prepare(`
        SELECT c.id, c.name, c.stream_id, c.account_id,
               a.server_url, a.username, a.password
        FROM xtream_channels c
        LEFT JOIN iptv_accounts a ON c.account_id = a.id
        WHERE c.is_streaming = true AND a.server_url IS NOT NULL
      `).all();

      if (!channels || channels.length === 0) {
        console.log('[PreWarm] No xtream channels found to pre-warm');
        return;
      }

      console.log(`[PreWarm] 🔥 Starting ${channels.length} always-on channels...`);
      let ok = 0, fail = 0;

      for (const ch of channels) {
        const iptvUrl = `${ch.server_url}/live/${ch.username}/${ch.password}/${ch.stream_id}.m3u8`;
        const streamKey = `xtream_live_${ch.stream_id}`;

        try {
          const result = await streamManager.requestStream(streamKey, 'live', iptvUrl, ch.name);
          if (result.success) {
            streamManager.markPermanent(streamKey);
            ok++;
          } else {
            fail++;
            console.error(`[PreWarm] ❌ ${ch.name}: ${result.error}`);
          }
        } catch (e) {
          fail++;
          console.error(`[PreWarm] ❌ ${ch.name}: ${e.message}`);
        }

        // Small stagger to avoid hammering IPTV provider all at once
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`[PreWarm] ✅ ${ok} channels started, ${fail} failed`);
    } catch (e) {
      console.error('[PreWarm] Error:', e.message);
    }
  }, 5000); // Wait 5s after startup for DB sync to complete

});



const shutdown = async () => {

  console.log('\n[Server] Ø¥ÙŠÙ‚Ø§Ù...');

  streamManager.stop();

  vodProxy.stop();

  hlsProxy.stop();

  if (db) db.close();

  server.close();

  process.exit(0);

};

process.on('SIGTERM', shutdown);

process.on('SIGINT', shutdown);

}).catch(err => {

  console.error('[DB] Failed to initialize:', err.message);

  process.exit(1);

});

