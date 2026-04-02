const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'data', 'ma_streaming.db');

const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create Tables ───────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT DEFAULT '',
    avatar_url    TEXT DEFAULT '',
    plan          TEXT DEFAULT 'free',
    expires_at    TEXT DEFAULT NULL,
    is_admin      INTEGER DEFAULT 0,
    is_blocked    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS channels (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    group_name  TEXT DEFAULT 'عام',
    logo_url    TEXT DEFAULT '',
    stream_url  TEXT NOT NULL,
    is_enabled  INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vod (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    vod_type     TEXT NOT NULL CHECK(vod_type IN ('movie','series')),
    category     TEXT DEFAULT '',
    poster_url   TEXT DEFAULT '',
    year         TEXT DEFAULT '',
    rating       TEXT DEFAULT '',
    stream_token TEXT DEFAULT '',
    description  TEXT DEFAULT '',
    plot         TEXT DEFAULT '',
    cast_list    TEXT DEFAULT '',
    director     TEXT DEFAULT '',
    genre        TEXT DEFAULT '',
    country      TEXT DEFAULT '',
    duration     TEXT DEFAULT '',
    duration_secs INTEGER DEFAULT 0,
    backdrop_url TEXT DEFAULT '',
    tmdb_id      TEXT DEFAULT '',
    trailer      TEXT DEFAULT '',
    xtream_id    TEXT DEFAULT '',
    container_ext TEXT DEFAULT '',
    source_rating REAL DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id           TEXT PRIMARY KEY,
    vod_id       TEXT NOT NULL REFERENCES vod(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    season       INTEGER DEFAULT 1,
    episode_num  INTEGER DEFAULT 1,
    stream_token TEXT NOT NULL,
    duration     TEXT DEFAULT '',
    duration_secs INTEGER DEFAULT 0,
    air_date     TEXT DEFAULT '',
    container_ext TEXT DEFAULT '',
    xtream_id    TEXT DEFAULT '',
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id      TEXT NOT NULL,
    item_type    TEXT NOT NULL CHECK(item_type IN ('channel','vod')),
    title        TEXT DEFAULT '',
    poster       TEXT DEFAULT '',
    content_type TEXT DEFAULT 'movie',
    created_at   TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, item_id, item_type)
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id    TEXT NOT NULL,
    item_type  TEXT NOT NULL CHECK(item_type IN ('channel','vod','episode')),
    watched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vod_id     TEXT NOT NULL REFERENCES vod(id) ON DELETE CASCADE,
    score      INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, vod_id)
  );

  CREATE TABLE IF NOT EXISTS iptv_config (
    id          INTEGER PRIMARY KEY DEFAULT 1,
    server_url  TEXT DEFAULT '',
    username    TEXT DEFAULT '',
    password    TEXT DEFAULT '',
    last_sync   TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS subscription_plans (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    price_usd    REAL NOT NULL DEFAULT 0,
    is_active    INTEGER DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activation_codes (
    id            TEXT PRIMARY KEY,
    code          TEXT UNIQUE NOT NULL,
    plan_id       TEXT NOT NULL REFERENCES subscription_plans(id),
    created_by    TEXT NOT NULL REFERENCES users(id),
    activated_by  TEXT DEFAULT NULL REFERENCES users(id),
    activated_at  TEXT DEFAULT NULL,
    status        TEXT DEFAULT 'unused' CHECK(status IN ('unused','used','expired','cancelled')),
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vod_type ON vod(vod_type);
  CREATE INDEX IF NOT EXISTS idx_episodes_vod ON episodes(vod_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
  CREATE INDEX IF NOT EXISTS idx_history_user ON watch_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(is_enabled);
  CREATE INDEX IF NOT EXISTS idx_ratings_vod ON ratings(vod_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
  CREATE INDEX IF NOT EXISTS idx_codes_agent ON activation_codes(created_by);
  CREATE INDEX IF NOT EXISTS idx_codes_status ON activation_codes(status);

  CREATE TABLE IF NOT EXISTS agent_transactions (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN ('credit','debit')),
    amount      REAL NOT NULL,
    balance_after REAL NOT NULL,
    description TEXT DEFAULT '',
    ref_id      TEXT DEFAULT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tx_agent ON agent_transactions(agent_id);
`);

// ─── Migrations: add columns if missing ─────────────────
const migrations = [
  "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
  'ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN created_by TEXT DEFAULT NULL',
  "ALTER TABLE vod ADD COLUMN plot TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN cast_list TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN director TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN genre TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN country TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN duration TEXT DEFAULT ''",
  'ALTER TABLE vod ADD COLUMN duration_secs INTEGER DEFAULT 0',
  "ALTER TABLE vod ADD COLUMN backdrop_url TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN tmdb_id TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN trailer TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN xtream_id TEXT DEFAULT ''",
  "ALTER TABLE vod ADD COLUMN container_ext TEXT DEFAULT ''",
  'ALTER TABLE vod ADD COLUMN source_rating REAL DEFAULT 0',
  "ALTER TABLE episodes ADD COLUMN duration TEXT DEFAULT ''",
  'ALTER TABLE episodes ADD COLUMN duration_secs INTEGER DEFAULT 0',
  "ALTER TABLE episodes ADD COLUMN air_date TEXT DEFAULT ''",
  "ALTER TABLE episodes ADD COLUMN container_ext TEXT DEFAULT ''",
  "ALTER TABLE episodes ADD COLUMN xtream_id TEXT DEFAULT ''",
  "ALTER TABLE channels ADD COLUMN xtream_id TEXT DEFAULT ''",
  "ALTER TABLE channels ADD COLUMN category TEXT DEFAULT ''",
  "ALTER TABLE favorites ADD COLUMN title TEXT DEFAULT ''",
  "ALTER TABLE favorites ADD COLUMN poster TEXT DEFAULT ''",
  "ALTER TABLE favorites ADD COLUMN content_type TEXT DEFAULT 'movie'",
  "ALTER TABLE watch_history ADD COLUMN title TEXT DEFAULT ''",
  "ALTER TABLE watch_history ADD COLUMN poster TEXT DEFAULT ''",
  "ALTER TABLE watch_history ADD COLUMN content_type TEXT DEFAULT 'vod'",
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
}

// ─── Seed: خطط الاشتراك الافتراضية ──────────────────────
const existingPlans = db.prepare('SELECT COUNT(*) as cnt FROM subscription_plans').get();
if (existingPlans.cnt === 0) {
  const insertPlan = db.prepare('INSERT INTO subscription_plans (id, name, duration_days, price_usd) VALUES (?, ?, ?, ?)');
  insertPlan.run('plan_weekly',  'أسبوعي',  7,   2.99);
  insertPlan.run('plan_monthly', 'شهري',    30,  7.99);
  insertPlan.run('plan_yearly',  'سنوي',    365, 59.99);
}

// Indexes on new columns (run after migrations)
const newIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_vod_xtream ON vod(xtream_id)',
  'CREATE INDEX IF NOT EXISTS idx_episodes_xtream ON episodes(xtream_id)',
  'CREATE INDEX IF NOT EXISTS idx_channels_xtream ON channels(xtream_id)',
];
for (const sql of newIndexes) {
  try { db.exec(sql); } catch (e) { /* ignore */ }
}

module.exports = db;
