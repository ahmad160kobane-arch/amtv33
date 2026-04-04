const { Pool, types } = require('pg');

// Parse BIGINT (type 20) as JS Number instead of string
types.setTypeParser(20, val => parseInt(val, 10));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

// ─── SQLite-compatible async wrapper ─────────────────────
function _convert(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  pool,
  prepare(sql) {
    const pgSql = _convert(sql);
    return {
      async get(...params) {
        const { rows } = await pool.query(pgSql, params);
        return rows[0] || undefined;
      },
      async all(...params) {
        const { rows } = await pool.query(pgSql, params);
        return rows;
      },
      async run(...params) {
        const res = await pool.query(pgSql, params);
        return { changes: res.rowCount };
      },
    };
  },
  async exec(sql) { await pool.query(sql); },
  pragma() {},
  async close() { await pool.end(); },

  // PostgreSQL transaction helper (replaces SQLite db.transaction)
  async runTransaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const prepare = (sql) => {
        const pgSql = _convert(sql);
        return {
          async get(...p) { return (await client.query(pgSql, p)).rows[0] || undefined; },
          async all(...p) { return (await client.query(pgSql, p)).rows; },
          async run(...p) { return { changes: (await client.query(pgSql, p)).rowCount }; },
        };
      };
      const result = await fn(prepare);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

// ─── Async init: create tables + seed ────────────────────
const TS_DEFAULT = "TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')";

db.init = async function () {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      username        TEXT UNIQUE NOT NULL,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      display_name    TEXT DEFAULT '',
      avatar_url      TEXT DEFAULT '',
      plan            TEXT DEFAULT 'free',
      expires_at      TEXT DEFAULT NULL,
      max_connections INTEGER DEFAULT 1,
      is_admin        INTEGER DEFAULT 0,
      is_blocked      INTEGER DEFAULT 0,
      role            TEXT DEFAULT 'user',
      balance         REAL DEFAULT 0,
      created_by      TEXT DEFAULT NULL,
      created_at      TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS channels (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      group_name  TEXT DEFAULT '',
      logo_url    TEXT DEFAULT '',
      stream_url  TEXT NOT NULL,
      is_enabled  INTEGER DEFAULT 1,
      sort_order  INTEGER DEFAULT 0,
      xtream_id   TEXT DEFAULT '',
      category    TEXT DEFAULT '',
      created_at  TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS vod (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      vod_type      TEXT NOT NULL CHECK(vod_type IN ('movie','series')),
      category      TEXT DEFAULT '',
      poster_url    TEXT DEFAULT '',
      year          TEXT DEFAULT '',
      rating        TEXT DEFAULT '',
      stream_token  TEXT DEFAULT '',
      description   TEXT DEFAULT '',
      plot          TEXT DEFAULT '',
      cast_list     TEXT DEFAULT '',
      director      TEXT DEFAULT '',
      genre         TEXT DEFAULT '',
      country       TEXT DEFAULT '',
      duration      TEXT DEFAULT '',
      duration_secs INTEGER DEFAULT 0,
      backdrop_url  TEXT DEFAULT '',
      tmdb_id       TEXT DEFAULT '',
      trailer       TEXT DEFAULT '',
      xtream_id     TEXT DEFAULT '',
      container_ext TEXT DEFAULT '',
      source_rating REAL DEFAULT 0,
      created_at    TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id            TEXT PRIMARY KEY,
      vod_id        TEXT NOT NULL REFERENCES vod(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      season        INTEGER DEFAULT 1,
      episode_num   INTEGER DEFAULT 1,
      stream_token  TEXT NOT NULL,
      duration      TEXT DEFAULT '',
      duration_secs INTEGER DEFAULT 0,
      air_date      TEXT DEFAULT '',
      container_ext TEXT DEFAULT '',
      xtream_id     TEXT DEFAULT '',
      created_at    TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id      TEXT NOT NULL,
      item_type    TEXT NOT NULL CHECK(item_type IN ('channel','vod')),
      title        TEXT DEFAULT '',
      poster       TEXT DEFAULT '',
      content_type TEXT DEFAULT 'movie',
      created_at   TEXT DEFAULT ${TS_DEFAULT},
      UNIQUE(user_id, item_id, item_type)
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id      TEXT NOT NULL,
      item_type    TEXT NOT NULL CHECK(item_type IN ('channel','vod','episode')),
      title        TEXT DEFAULT '',
      poster       TEXT DEFAULT '',
      content_type TEXT DEFAULT 'vod',
      watched_at   TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vod_id     TEXT NOT NULL REFERENCES vod(id) ON DELETE CASCADE,
      score      INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      created_at TEXT DEFAULT ${TS_DEFAULT},
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
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      duration_days   INTEGER NOT NULL,
      max_connections INTEGER NOT NULL DEFAULT 1,
      price_usd       REAL NOT NULL DEFAULT 0,
      is_active       INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS activation_codes (
      id              TEXT PRIMARY KEY,
      code            TEXT UNIQUE NOT NULL,
      plan_id         TEXT NOT NULL REFERENCES subscription_plans(id),
      max_connections INTEGER DEFAULT 1,
      created_by      TEXT NOT NULL REFERENCES users(id),
      activated_by    TEXT DEFAULT NULL REFERENCES users(id),
      activated_at    TEXT DEFAULT NULL,
      status          TEXT DEFAULT 'unused' CHECK(status IN ('unused','used','expired','cancelled')),
      created_at      TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS agent_transactions (
      id            TEXT PRIMARY KEY,
      agent_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type          TEXT NOT NULL CHECK(type IN ('credit','debit')),
      amount        REAL NOT NULL,
      balance_after REAL NOT NULL,
      description   TEXT DEFAULT '',
      ref_id        TEXT DEFAULT NULL,
      created_at    TEXT DEFAULT ${TS_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS xtream_channels (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      logo       TEXT DEFAULT '',
      category   TEXT DEFAULT '',
      stream_id  INTEGER NOT NULL,
      epg_id     TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 999,
      base_url   TEXT DEFAULT ''
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
    CREATE INDEX IF NOT EXISTS idx_tx_agent ON agent_transactions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_vod_xtream ON vod(xtream_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_xtream ON episodes(xtream_id);
    CREATE INDEX IF NOT EXISTS idx_channels_xtream ON channels(xtream_id);
  `);

  // ─── Seed: default subscription plans (with connection variants) ───
  const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM subscription_plans');
  if (parseInt(rows[0].cnt) === 0) {
    await pool.query(`
      INSERT INTO subscription_plans (id, name, duration_days, max_connections, price_usd) VALUES
        ('plan_weekly_1',  'أسبوعي - جهاز واحد',   7,   1, 2.99),
        ('plan_weekly_2',  'أسبوعي - جهازين',       7,   2, 4.99),
        ('plan_weekly_3',  'أسبوعي - 3 أجهزة',      7,   3, 6.99),
        ('plan_monthly_1', 'شهري - جهاز واحد',      30,  1, 7.99),
        ('plan_monthly_2', 'شهري - جهازين',          30,  2, 12.99),
        ('plan_monthly_3', 'شهري - 3 أجهزة',         30,  3, 17.99),
        ('plan_yearly_1',  'سنوي - جهاز واحد',      365, 1, 59.99),
        ('plan_yearly_2',  'سنوي - جهازين',          365, 2, 89.99),
        ('plan_yearly_3',  'سنوي - 3 أجهزة',         365, 3, 119.99)
    `);
  }

  // ─── Migration: add max_connections columns if missing ──────
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1');
    await pool.query('ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1');
    await pool.query('ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS max_connections INTEGER DEFAULT 1');
  } catch (e) { /* columns already exist */ }

  // ─── Seed: default admin user ──────────────────────────
  const { rows: adminRows } = await pool.query("SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1");
  if (parseInt(adminRows[0].cnt) === 0) {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const adminId = uuidv4();
    const adminHash = bcrypt.hashSync('M@str3am!2026$Adm', 10);
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, display_name, plan, is_admin, role)
       VALUES ($1, 'admin', 'admin@ma-streaming.com', $2, 'المشرف', 'premium', 1, 'admin')
       ON CONFLICT (username) DO NOTHING`,
      [adminId, adminHash]
    );
    console.log('[DB] Admin user created');
  }

  console.log('[DB] PostgreSQL tables ready');
};

module.exports = db;
