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
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const config = require('./config');
const StreamManager = require('./lib/stream-manager');
const VodProxy = require('./lib/vod-proxy');
const IptvUpdater = require('./lib/iptv-updater');
const { resolveStream } = require('./lib/vidsrc-resolver');
const { extractStream } = require('./lib/stream-extractor');
const { scrapeEmbedSources } = require('./lib/embed-scraper');
const { puppeteerExtract } = require('./lib/puppeteer-extractor');
const HlsProxy = require('./lib/hls-proxy');
const LiveProxy = require('./lib/live-proxy');
const { syncXtreamChannels, XTREAM } = require('./lib/xtream');
const xtreamProxy = require('./lib/xtream-proxy');
const vidsrcApi = require('./lib/vidsrc-api'); // DISABLED — replaced by xtream-vod
const xtreamVod = require('./lib/xtream-vod');
const { fetchArabicSubtitles } = require('./lib/subtitle-fetcher');
const { initLuluStream, getLuluStream } = require('./lib/lulustream');

// ─── قاعدة بيانات محلية مستقلة ───────────────────────────
const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// إنشاء الجداول المطلوبة محلياً
db.exec(`
  CREATE TABLE IF NOT EXISTS users_cache (
    id          TEXT PRIMARY KEY,
    username    TEXT DEFAULT '',
    plan        TEXT DEFAULT 'free',
    expires_at  TEXT DEFAULT NULL,
    role        TEXT DEFAULT 'user',
    is_admin    INTEGER DEFAULT 0,
    is_blocked  INTEGER DEFAULT 0,
    cached_at   INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS channels (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    group_name  TEXT DEFAULT '',
    logo_url    TEXT DEFAULT '',
    stream_url  TEXT NOT NULL,
    is_enabled  INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS vod (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    vod_type     TEXT DEFAULT 'movie',
    stream_token TEXT DEFAULT '',
    xtream_id    TEXT DEFAULT '',
    container_ext TEXT DEFAULT '',
    tmdb_id      TEXT DEFAULT '',
    category     TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS episodes (
    id           TEXT PRIMARY KEY,
    vod_id       TEXT DEFAULT '',
    title        TEXT NOT NULL,
    season       INTEGER DEFAULT 1,
    episode_num  INTEGER DEFAULT 1,
    stream_token TEXT NOT NULL,
    container_ext TEXT DEFAULT '',
    xtream_id    TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS watch_history (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    item_id    TEXT NOT NULL,
    item_type  TEXT DEFAULT 'vod',
    watched_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS iptv_config (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    server_url  TEXT DEFAULT '',
    username    TEXT DEFAULT '',
    password    TEXT DEFAULT ''
  );
`);
console.log(`[DB] محلية: ${config.DB_PATH}`);

const app = express();
const streamManager = new StreamManager();
const vodProxy = new VodProxy();
const hlsProxy = new HlsProxy();
const liveProxy = new LiveProxy();

// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (!req.path.endsWith('.ts') && !req.path.endsWith('.m3u8') && !req.path.endsWith('.vtt') && !req.path.startsWith('/vod/proxy/') && !req.path.startsWith('/free-hls/')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
});

// --- User cache (5 min TTL) ---
const USER_CACHE_TTL = 5 * 60 * 1000;
const _upsertUser = db.prepare(`
  INSERT INTO users_cache (id, username, plan, expires_at, role, is_admin, is_blocked, cached_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    username=excluded.username, plan=excluded.plan, expires_at=excluded.expires_at,
    role=excluded.role, is_admin=excluded.is_admin, is_blocked=excluded.is_blocked,
    cached_at=excluded.cached_at
`);

async function _fetchUserFromBackend(token) {
  try {
    const res = await fetch(`${config.BACKEND_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const u = data.user || data;
    if (!u || !u.id) return null;
    _upsertUser.run(u.id, u.username||'', u.plan||'free', u.expires_at||null,
      u.role||'user', u.is_admin?1:0, u.is_blocked?1:0, Date.now());
    return { id:u.id, username:u.username, plan:u.plan||'free', expires_at:u.expires_at,
      role:u.role||'user', is_admin:u.is_admin?1:0, is_blocked:u.is_blocked?1:0 };
  } catch (e) {
    console.log(`[Auth] Backend unreachable: ${e.message}`);
    return null;
  }
}

// --- Sync channels from Backend (PostgreSQL) into local SQLite ---
const _upsertChannel = db.prepare(`
  INSERT INTO channels (id, name, group_name, logo_url, stream_url, is_enabled)
  VALUES (?, ?, ?, ?, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, group_name=excluded.group_name,
    logo_url=excluded.logo_url, stream_url=excluded.stream_url,
    is_enabled=excluded.is_enabled
`);

let _lastChannelSync = 0;
const CHANNEL_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function syncChannelsFromBackend(force = false) {
  if (!force && Date.now() - _lastChannelSync < CHANNEL_SYNC_INTERVAL) return 0;
  try {
    console.log('[Sync] Fetching channels from backend PostgreSQL...');
    const res = await fetch(`${config.BACKEND_URL}/api/channels/export`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log('[Sync] Backend returned', res.status); return 0; }
    const data = await res.json();
    const channels = data.channels || [];
    if (channels.length === 0) { console.log('[Sync] No channels from backend'); return 0; }

    const syncMany = db.transaction((rows) => {
      db.prepare('DELETE FROM channels').run();
      for (const ch of rows) {
        _upsertChannel.run(ch.id, ch.name || '', ch.group_name || '', ch.logo_url || '', ch.stream_url || '');
      }
    });

    syncMany(channels);
    _lastChannelSync = Date.now();
    console.log(`[Sync] Synced ${channels.length} channels from backend PostgreSQL`);
    return channels.length;
  } catch (e) {
    console.error('[Sync] Error:', e.message);
    return 0;
  }
}

// --- Middleware: JWT auth + backend proxy ---
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try { decoded = jwt.verify(token, config.JWT_SECRET); }
  catch (e) { return res.status(401).json({ error: 'رمز الدخول غير صالح' }); }

  const cached = db.prepare('SELECT * FROM users_cache WHERE id = ?').get(decoded.userId);
  if (cached && (Date.now() - cached.cached_at) < USER_CACHE_TTL) {
    if (cached.is_blocked) return res.status(403).json({ error: 'الحساب محظور' });
    req.user = cached;
    return next();
  }

  _fetchUserFromBackend(token).then(user => {
    if (user) {
      if (user.is_blocked) return res.status(403).json({ error: 'الحساب محظور' });
      req.user = user;
      return next();
    }
    if (cached) { req.user = cached; return next(); }
    req.user = { id:decoded.userId, username:'', plan:'free', role:'user', is_admin:0, is_blocked:0 };
    next();
  }).catch(() => {
    if (cached) { req.user = cached; return next(); }
    req.user = { id:decoded.userId, username:'', plan:'free', role:'user', is_admin:0, is_blocked:0 };
    next();
  });
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
app.post('/api/stream/live/:channelId', requireAuth, requirePremium, async (req, res) => {
  const rawId = req.params.channelId;
  // -- Xtream live channel (xtream_live_<streamId> or bare numeric ID) --
  // Signed token redirect — credentials hidden from client, client connects directly to source
  // Signed token redirect — credentials hidden from client, client connects directly to source
  const xtreamMatch = rawId.match(/^xtream_live_(\d+)$/) || rawId.match(/^(\d+)$/);
  if (xtreamMatch) {
    const streamNumId = xtreamMatch[1];
    const xch = db.prepare('SELECT id, name, logo, category, stream_id, base_url FROM xtream_channels WHERE stream_id = ? OR id = ?').get(Number(streamNumId), streamNumId);
    if (xch) {
      const token = jwt.sign({ sid: String(xch.stream_id), t: 'xt' }, config.JWT_SECRET, { expiresIn: '6h' });
      return res.json({
        success: true,
        hlsUrl: `/xtream-play/${token}/index.m3u8`,
        ready: true,
        streamId: String(xch.stream_id),
        name: xch.name,
        logo: xch.logo,
      });
    }
  }
  let ch = db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);
  // Lazy sync: if channel not found locally, sync from backend PostgreSQL and retry
  if (!ch) {
    await syncChannelsFromBackend(true);
    ch = db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);
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

// Xtream Token Proxy — pipe HLS manifest & rewrite absolute segment URLs
app.get(['/xtream-play/:token', '/xtream-play/:token/index.m3u8'], async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, config.JWT_SECRET);
    if (payload.t !== 'xt' || !payload.sid) return res.status(403).end();

    const realUrl = `${XTREAM.primary}/live/${XTREAM.user}/${XTREAM.pass}/${payload.sid}.m3u8`;
    const upRes = await fetch(realUrl, {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
      redirect: 'follow',
    });
    if (!upRes.ok) return res.status(upRes.status).end();

    let body = await upRes.text();

    // Rewrite absolute IPTV URLs → proxy through /xtream-seg/:token/
    const iptvBase = `${XTREAM.primary}/live/${XTREAM.user}/${XTREAM.pass}/`;
    const escaped = iptvBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(escaped, 'g'), `/xtream-seg/${req.params.token}/`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-cache');
    res.send(body);
  } catch (e) {
    console.error('[Xtream-play] proxy error:', e.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

// Xtream Segment Proxy — pipe .ts segments so browsers don't face CORS
app.get('/xtream-seg/:token/:segment(*)', async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, config.JWT_SECRET);
    if (payload.t !== 'xt' || !payload.sid) return res.status(403).end();

    const segUrl = `${XTREAM.primary}/live/${XTREAM.user}/${XTREAM.pass}/${req.params.segment}`;
    const upRes = await fetch(segUrl, {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
      redirect: 'follow',
    });
    if (!upRes.ok) return res.status(upRes.status).end();

    res.set('Content-Type', upRes.headers.get('content-type') || 'video/mp2t');
    res.set('Access-Control-Allow-Origin', '*');
    if (upRes.headers.get('content-length')) res.set('Content-Length', upRes.headers.get('content-length'));

    const { Readable } = require('stream');
    Readable.fromWeb(upRes.body).pipe(res);
  } catch (e) {
    console.error('[Xtream-seg] proxy error:', e.message);
    res.status(403).end();
  }
});

// â•â•â• Direct Live Pipe â€” Ø¨Ø« Ù…Ø¨Ø§Ø´Ø± Ø¨Ø¯ÙˆÙ† FFmpeg (pipe) â•â•â•
app.get('/live-pipe/:channelId', requireAuth, async (req, res) => {
  const rawId = req.params.channelId;

  // Xtream channel proxy — server connects to IPTV source instead of client
  // Auth only (no premium check) — free channels also use this
  const xtreamPipeMatch = rawId.match(/^xtream_(\d+)$/);
  if (xtreamPipeMatch) {
    const streamId = xtreamPipeMatch[1];
    const sourceUrl = `${XTREAM.primary}/live/${XTREAM.user}/${XTREAM.pass}/${streamId}.m3u8`;
    console.log(`[LivePipe] Xtream #${streamId} (proxied)`);
    await liveProxy.streamToClient(`xtream_${streamId}`, sourceUrl, req, res);
    return;
  }

  // Local channels require premium
  const user = req.user;
  if (!user || !user.is_premium) return res.status(403).json({ error: 'Premium required' });

  const ch = db.prepare('SELECT id, name, stream_url FROM channels WHERE id = ? AND is_enabled = 1').get(rawId);
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

  // Ø¨Ø­Ø« Ø¨Ø§Ù„Ù€ id Ø£Ùˆ stream_token â€” Ø£ÙˆÙ„ÙˆÙŠØ©: episodes Ø«Ù… vod
  let item = null;
  let itemType = 'vod';
  let parentVod = null;

  // 1. Ø¨Ø­Ø« ÙÙŠ episodes Ø¨Ø§Ù„Ù€ id
  item = db.prepare('SELECT id, title, stream_token, container_ext, xtream_id, vod_id, season, episode_num FROM episodes WHERE id = ?').get(paramId);
  if (item) { itemType = 'episode'; }

  // 2. Ø¨Ø­Ø« ÙÙŠ vod Ø¨Ø§Ù„Ù€ id
  if (!item) {
    item = db.prepare('SELECT id, title, stream_token, vod_type, xtream_id, container_ext, tmdb_id AS tmdb FROM vod WHERE id = ?').get(paramId);
    itemType = 'vod';
  }

  // 3. Ø¨Ø­Ø« Ø¨Ø§Ù„Ù€ stream_token
  if (!item) {
    item = db.prepare('SELECT id, title, stream_token, container_ext, xtream_id, vod_id, season, episode_num FROM episodes WHERE stream_token = ?').get(paramId);
    if (item) itemType = 'episode';
  }
  if (!item) {
    item = db.prepare('SELECT id, title, stream_token, vod_type, xtream_id, container_ext, tmdb_id AS tmdb FROM vod WHERE stream_token = ?').get(paramId);
    if (item) itemType = 'vod';
  }

  if (!item) return res.status(404).json({ error: 'Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });

  // Ø¥Ø°Ø§ ÙƒØ§Ù† Ù…Ø³Ù„Ø³Ù„ â†’ Ø´ØºÙ‘Ù„ Ø£ÙˆÙ„ Ø­Ù„Ù‚Ø© Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† Ø§Ù„Ù…Ø³Ù„Ø³Ù„ Ù†ÙØ³Ù‡
  if (itemType === 'vod' && item.vod_type === 'series') {
    parentVod = item;
    const episode = db.prepare('SELECT id, title, stream_token, container_ext, xtream_id, vod_id, season, episode_num FROM episodes WHERE vod_id = ? ORDER BY season ASC, episode_num ASC LIMIT 1').get(item.id);
    if (episode) {
      item = episode;
      itemType = 'episode';
    } else {
      return res.status(400).json({ error: 'Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³Ù„Ø³Ù„ Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ø­Ù„Ù‚Ø§Øª Ø¨Ø¹Ø¯' });
    }
  }

  // â•â•â• Ø¬Ù„Ø¨ TMDb ID â€” Ù„Ù„Ø­Ù„Ù‚Ø§Øª Ù†Ø¬Ù„Ø¨Ù‡ Ù…Ù† Ø§Ù„Ù…Ø³Ù„Ø³Ù„ Ø§Ù„Ø£Ø¨ â•â•â•
  let tmdbId = item.tmdb || null;
  if (!tmdbId && itemType === 'episode' && item.vod_id) {
    const parent = parentVod || db.prepare('SELECT tmdb_id AS tmdb, vod_type FROM vod WHERE id = ?').get(item.vod_id);
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
    const cfg = db.prepare('SELECT server_url, username, password FROM iptv_config WHERE id = 1').get();
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
app.post('/api/stream/release/:streamId', requireAuth, (req, res) => {
  streamManager.releaseStream(req.params.streamId);
  vodProxy.releaseSession(req.params.streamId);
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
app.get(['/vod-play/:token', '/vod-play/:token/stream.mp4'], async (req, res) => {
  try {
    const payload = jwt.verify(req.params.token, config.JWT_SECRET);
    if (!payload.sid || !['vod', 'ser'].includes(payload.t)) return res.status(403).end();
    const ext = payload.ext || 'mp4';
    const path = payload.t === 'ser'
      ? `series/${XTREAM.user}/${XTREAM.pass}/${payload.sid}.${ext}`
      : `movie/${XTREAM.user}/${XTREAM.pass}/${payload.sid}.${ext}`;
    const upstream = `${XTREAM.primary}/${path}`;

    const range = req.headers.range;
    const headers = { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' };
    if (range) headers['Range'] = range;

    const upRes = await fetch(upstream, { headers, redirect: 'follow' });
    if (!upRes.ok && upRes.status !== 206) return res.status(upRes.status).end();

    res.status(upRes.status);
    res.set('Content-Type', upRes.headers.get('content-type') || 'video/mp4');
    if (upRes.headers.get('content-length')) res.set('Content-Length', upRes.headers.get('content-length'));
    if (upRes.headers.get('content-range'))  res.set('Content-Range', upRes.headers.get('content-range'));
    if (upRes.headers.get('accept-ranges'))  res.set('Accept-Ranges', upRes.headers.get('accept-ranges'));

    const { Readable } = require('stream');
    Readable.fromWeb(upRes.body).pipe(res);
  } catch (e) {
    console.error('[VOD-play] proxy error:', e.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
});

// ═══════════════════════════════════════════════════════
// DISABLED: Old VidSrc/TMDB Content API (kept for reference)
// ═══════════════════════════════════════════════════════
/*
app.get('/api/vidsrc/home', async (req, res) => { ... });
app.get('/api/vidsrc/browse', async (req, res) => { ... });
app.get('/api/vidsrc/search', async (req, res) => { ... });
app.get('/api/vidsrc/detail/:type/:id', async (req, res) => { ... });
app.get('/api/vidsrc/episodes', async (req, res) => { ... });
*/

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
  
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId Ù…Ø·Ù„ÙˆØ¨' });

  const streamId = `vidsrc_${type}_${tmdbId}${type === 'tv' ? `_s${season}e${episode}` : ''}`;
  const label = `tmdb=${tmdbId} type=${type}${type === 'tv' ? ` s${season}e${episode}` : ''}`;

  try {
    // Ø¥Ø±Ø¬Ø§Ø¹ Embed URL ÙÙˆØ±Ø§Ù‹ â€” Ø¨Ø¯ÙˆÙ† Ù…Ø­Ø§ÙˆÙ„Ø© Ø§Ø³ØªØ®Ø±Ø§Ø¬
    console.log(`[Stream] â†’ Embed URL (ÙÙˆØ±ÙŠ): ${label}`);
    const stream = await resolveStream(tmdbId, type, season, episode, imdbId);

    if (stream && stream.embedUrl) {
      console.log(`[Stream] âœ“ Embed: ${stream.provider} â€” ${stream.embedUrl}`);
      // ØªØ³Ø¬ÙŠÙ„ ÙÙŠ Ø³Ø¬Ù„ Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø©
      try {
        const { randomUUID } = require('crypto');
        db.prepare('INSERT OR IGNORE INTO watch_history (id, user_id, item_id, item_type) VALUES (?, ?, ?, ?)')
          .run(randomUUID(), req.user.id, tmdbId, 'vod');
      } catch (_) {}
      return res.json({
        success: true, 
        streamId, 
        ready: true,
        embedUrl: stream.embedUrl, 
        provider: stream.provider, 
        sources: stream.sources,
      });
    }

    return res.status(404).json({ success: false, error: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…ØµØ§Ø¯Ø± Ø¨Ø« Ù…ØªØ§Ø­Ø©' });
  } catch (e) {
    console.error(`[Stream] Error:`, e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// â•â•â• Ø¥Ù†Ø´Ø§Ø¡ Ø¬Ù„Ø³Ø© HLS Proxy Ù…Ù† Ø±Ø§Ø¨Ø· Ù…Ø³ØªØ®Ø±Ø¬ Ø¨Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ (WebView) â•â•â•
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

function recordWatchHistory(userId, itemId, itemType) {
  try {
    const { randomUUID } = require('crypto');
    db.prepare('INSERT OR IGNORE INTO watch_history (id, user_id, item_id, item_type) VALUES (?, ?, ?, ?)')
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
db.exec(`
  CREATE TABLE IF NOT EXISTS xtream_channels (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    logo       TEXT DEFAULT '',
    category   TEXT DEFAULT 'Ø¹Ø§Ù…',
    raw_cat    TEXT DEFAULT '',
    cat_id     TEXT DEFAULT '',
    stream_id  INTEGER NOT NULL,
    epg_id     TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 99,
    base_url   TEXT DEFAULT '',
    updated_at INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_xtream_cat ON xtream_channels(category);
  CREATE INDEX IF NOT EXISTS idx_xtream_sort ON xtream_channels(sort_order);
`);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Xtream Codes â€” Channel API
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * GET /api/xtream/channels
 * List channels with optional category/search filter + pagination
 * Iraqi channels first, then sorted by priority
 */
app.get('/api/xtream/channels', (req, res) => {
  try {
    const { category, search, limit, offset } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    let where = [];
    let params = [];

    if (category) { where.push('category = ?'); params.push(category); }
    if (search)   { where.push('name LIKE ?'); params.push(`%${search}%`); }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(
      `SELECT COUNT(*) as c FROM xtream_channels ${whereStr}`
    ).get(...params).c;

    // sort: Iraqi-named channels first (name contains Ø¹Ø±Ø§Ù‚/iraq), then by sort_order, then name
    const rows = db.prepare(`
      SELECT id, name, logo, category, stream_id, epg_id, sort_order, base_url
      FROM xtream_channels ${whereStr}
      ORDER BY
        CASE WHEN name LIKE '%Ø¹Ø±Ø§Ù‚%' OR name LIKE '%iraq%' OR name LIKE '%Iraqi%' THEN 0 ELSE 1 END,
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

    const categories = db.prepare(
      'SELECT DISTINCT category, MIN(sort_order) as p FROM xtream_channels GROUP BY category ORDER BY p'
    ).all().map(r => r.category);

    res.json({ success: true, channels, total, hasMore: off + lim < total, categories });
  } catch (e) {
    console.error('[Xtream] channels error:', e.message);
    res.status(500).json({ error: 'ÙØ´Ù„ Ø¬Ù„Ø¨ Ø§Ù„Ù‚Ù†ÙˆØ§Øª' });
  }
});

/**
 * GET /api/xtream/stream/:channelId
 * Returns the HLS proxy URL for a channel
 * The proxy handles viewer tracking + segment caching
 */
app.get('/api/xtream/stream/:channelId', (req, res) => {
  try {
    const ch = db.prepare(
      'SELECT id, name, logo, category, stream_id, base_url FROM xtream_channels WHERE id = ?'
    ).get(req.params.channelId);

    if (!ch) return res.status(404).json({ error: 'channel not found' });

    // Token manifest proxy — client gets m3u8 from VPS, segments from CDN directly
    const token = jwt.sign({ sid: String(ch.stream_id), t: 'xt' }, config.JWT_SECRET, { expiresIn: '6h' });
    const tokenUrl = `/xtream-play/${token}/index.m3u8`;

    res.json({
      success  : true,
      name     : ch.name,
      logo     : ch.logo,
      category : ch.category,
      proxyUrl : tokenUrl,
      directUrl: tokenUrl,
      streamId : ch.stream_id,
    });
  } catch (e) {
    console.error('[Xtream] stream error:', e.message);
    res.status(500).json({ error: 'ÙØ´Ù„ Ø¬Ù„Ø¨ Ø±Ø§Ø¨Ø· Ø§Ù„Ø¨Ø«' });
  }
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
  const viewers = xtreamProxy.getAllViewers();
  const total   = xtreamProxy.getTotalViewers();
  res.json({ success: true, viewers, total });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HLS Reverse Proxy â€” Xtream streams
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * GET /proxy/live/:streamId/index.m3u8
 * Proxy HLS manifest â€” rewrites segment URLs through our server
 * Viewer session tracked by ?sid param
 */
app.get('/proxy/live/:streamId/index.m3u8', async (req, res) => {
  const { streamId } = req.params;
  const sessionId = req.query.sid || req.ip || 'anon';
  const baseUrl   = req.query.base ? decodeURIComponent(req.query.base) : XTREAM.primary;
  const proxyBase = `${req.protocol}://${req.get('host')}`;

  try {
    const manifest = await xtreamProxy.getManifest(streamId, baseUrl, proxyBase, sessionId);
    res.set({
      'Content-Type'                : 'application/vnd.apple.mpegurl',
      'Cache-Control'               : 'no-cache, no-store',
      'Access-Control-Allow-Origin' : '*',
    });
    res.send(manifest);
  } catch (e) {
    console.error(`[Proxy] Manifest ${streamId}: ${e.message}`);
    res.status(502).json({ error: 'Ø§Ù„Ø¨Ø« ØºÙŠØ± Ù…ØªØ§Ø­ Ø­Ø§Ù„ÙŠØ§Ù‹' });
  }
});

/**
 * GET /proxy/live/:streamId/seg/:encodedPath
 * Proxy TS segment â€” cached, shared across viewers
 */
app.get('/proxy/live/:streamId/seg/:encodedPath(*)', async (req, res) => {
  const { streamId, encodedPath } = req.params;
  const sessionId = req.query.sid || req.ip || 'anon';
  const baseUrl   = req.query.base ? decodeURIComponent(req.query.base) : XTREAM.primary;

  try {
    const { buf, contentType } = await xtreamProxy.getSegment(streamId, encodedPath, baseUrl, sessionId);
    res.set({
      'Content-Type'                : contentType,
      'Content-Length'              : buf.length,
      'Cache-Control'               : 'public, max-age=10',
      'Access-Control-Allow-Origin' : '*',
    });
    res.send(buf);
  } catch (e) {
    console.error(`[Proxy] Segment ${streamId}: ${e.message}`);
    res.status(502).end();
  }
});

/**
 * GET /proxy/live/:streamId/sub/:encodedUrl
 * Proxy sub-manifest (quality variants)
 */
app.get('/proxy/live/:streamId/sub/:encodedUrl(*)', async (req, res) => {
  const { streamId, encodedUrl } = req.params;
  const sessionId = req.query.sid || req.ip || 'anon';
  const proxyBase = `${req.protocol}://${req.get('host')}`;

  try {
    const manifest = await xtreamProxy.getSubManifest(streamId, encodedUrl, proxyBase, sessionId);
    res.set({
      'Content-Type'                : 'application/vnd.apple.mpegurl',
      'Cache-Control'               : 'no-cache, no-store',
      'Access-Control-Allow-Origin' : '*',
    });
    res.send(manifest);
  } catch (e) {
    console.error(`[Proxy] Sub-manifest ${streamId}: ${e.message}`);
    res.status(502).end();
  }
});



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Health + Admin
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    activeStreams: streamManager.getActiveStreams().length,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
  });
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
    },
  });
});

app.use((req, res) => { res.status(404).json({ error: 'ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' }); });
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Ø®Ø·Ø£ Ø¯Ø§Ø®Ù„ÙŠ' });
});

// â”€â”€â”€ Ø¨Ø¯Ø¡ Ø§Ù„Ø³ÙŠØ±ÙØ± + ØªØ­Ø¯ÙŠØ« ØªÙ„Ù‚Ø§Ø¦ÙŠ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const server = app.listen(config.PORT, config.HOST, async () => {
  console.log(`\n  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);
  console.log(`  â•‘   IPTV Cloud Streaming Server v3.0               â•‘`);
  console.log(`  â•‘   Ø¨Ø« Ù…Ø¨Ø§Ø´Ø± + ØªØ­Ù‚Ù‚ JWT + ØªØ­Ø¯ÙŠØ« ØªÙ„Ù‚Ø§Ø¦ÙŠ             â•‘`);
  console.log(`  â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£`);
  console.log(`  â•‘   http://localhost:${config.PORT}                         â•‘`);
  console.log(`  â•‘   DB: ${path.basename(config.DB_PATH)}                       â•‘`);
  console.log(`  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);

  streamManager.start();
  vodProxy.start();
  hlsProxy.start();
  liveProxy.start();


  // Ù…Ø²Ø§Ù…Ù†Ø© Ù‚Ù†ÙˆØ§Øª Xtream Ø¹Ù†Ø¯ Ø§Ù„ØªØ´ØºÙŠÙ„
  syncXtreamChannels(db).catch(e => console.error('[Xtream] Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø© Ø¹Ù†Ø¯ Ø§Ù„ØªØ´ØºÙŠÙ„:', e.message));
  xtreamProxy.start();

  // Sync channels from backend PostgreSQL on startup
  syncChannelsFromBackend(true).catch(e => console.error('[Sync] Startup error:', e.message));
  // Periodic sync every 10 minutes
  setInterval(() => syncChannelsFromBackend(true).catch(() => {}), CHANNEL_SYNC_INTERVAL);
});

const shutdown = async () => {
  console.log('\n[Server] Ø¥ÙŠÙ‚Ø§Ù...');
  streamManager.stop();
  vodProxy.stop();
  hlsProxy.stop();
  xtreamProxy.stop();
  if (db) db.close();
  server.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
