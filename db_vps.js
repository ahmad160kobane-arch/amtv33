/**
 * PostgreSQL wrapper for cloud-server — with auto-retry + reconnection
 */
const { Pool } = require('pg');
const config = require('./config');

let pool;
let _ready = false;

function createPool() {
  const p = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  p.on('error', (err) => {
    console.error('[DB] Pool error:', err.code, err.message);
    if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === '57P01') {
      _ready = false;
      console.log('[DB] Connection lost — will auto-reconnect on next query');
    }
  });

  return p;
}

pool = createPool();

function _convert(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Retry wrapper: if query fails due to connection issue, recreate pool and retry
async function _queryWithRetry(sql, params, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await pool.query(sql, params);
      _ready = true;
      return result;
    } catch (e) {
      const retryable = ['ECONNRESET', 'ECONNREFUSED', '57P01', '08003', '08006', '57P03'];
      if (retryable.includes(e.code) && attempt <= retries) {
        console.warn(`[DB] Query failed (${e.code}), retry ${attempt}/${retries}...`);
        // Recreate pool on connection errors
        try { await pool.end(); } catch (_) {}
        pool = createPool();
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw e;
    }
  }
}

const db = {
  pool,
  get _pool() { return pool; },

  prepare(sql) {
    const pgSql = _convert(sql);
    return {
      async get(...params) {
        const { rows } = await _queryWithRetry(pgSql, params);
        return rows[0] || undefined;
      },
      async all(...params) {
        const { rows } = await _queryWithRetry(pgSql, params);
        return rows;
      },
      async run(...params) {
        const res = await _queryWithRetry(pgSql, params);
        return { changes: res.rowCount };
      },
    };
  },

  async exec(sql) {
    await _queryWithRetry(sql);
  },

  async query(sql, params) {
    return _queryWithRetry(sql, params);
  },

  async close() {
    await pool.end();
  },

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

// Init: create tables + migrations — with retry
db.init = async function () {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await _queryWithRetry(`
        CREATE TABLE IF NOT EXISTS active_sessions (
          id          TEXT PRIMARY KEY,
          user_id     TEXT NOT NULL,
          stream_id   TEXT NOT NULL,
          type        TEXT DEFAULT 'live',
          device_info TEXT DEFAULT '',
          ip          TEXT DEFAULT '',
          started_at  BIGINT NOT NULL,
          last_seen   BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_seen ON active_sessions(last_seen);
      `);

      try { await _queryWithRetry("ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS device_info TEXT DEFAULT ''"); } catch(e) {}
      try { await _queryWithRetry("ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS ip TEXT DEFAULT ''"); } catch(e) {}

      await _queryWithRetry(`
        CREATE TABLE IF NOT EXISTS iptv_accounts (
          id          SERIAL PRIMARY KEY,
          name        TEXT NOT NULL DEFAULT '',
          server_url  TEXT NOT NULL,
          username    TEXT NOT NULL,
          password    TEXT NOT NULL,
          max_connections INTEGER DEFAULT 1,
          status      TEXT DEFAULT 'active',
          created_at  BIGINT DEFAULT 0
        );
      `);

      try { await _queryWithRetry("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS raw_cat TEXT DEFAULT ''"); } catch(e) {}
      try { await _queryWithRetry("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS cat_id TEXT DEFAULT ''"); } catch(e) {}
      try { await _queryWithRetry("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0"); } catch(e) {}
      try { await _queryWithRetry("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS base_url TEXT DEFAULT ''"); } catch(e) {}
      try { await _queryWithRetry("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS account_id INTEGER DEFAULT 0"); } catch(e) {}

      await _queryWithRetry(`
        CREATE TABLE IF NOT EXISTS xtream_channels (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          logo       TEXT DEFAULT '',
          category   TEXT DEFAULT '',
          raw_cat    TEXT DEFAULT '',
          cat_id     TEXT DEFAULT '',
          stream_id  INTEGER NOT NULL,
          epg_id     TEXT DEFAULT '',
          sort_order INTEGER DEFAULT 99,
          base_url   TEXT DEFAULT '',
          updated_at BIGINT DEFAULT 0,
          account_id INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_xtream_cat ON xtream_channels(category);
        CREATE INDEX IF NOT EXISTS idx_xtream_sort ON xtream_channels(sort_order);
        CREATE INDEX IF NOT EXISTS idx_xtream_account ON xtream_channels(account_id);
      `);

      try { await _queryWithRetry("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT false"); } catch(e) {}

      await _queryWithRetry(`
        CREATE TABLE IF NOT EXISTS stream_errors (
          id          SERIAL PRIMARY KEY,
          account_id  INTEGER DEFAULT 0,
          channel_id  TEXT DEFAULT '',
          channel_name TEXT DEFAULT '',
          error_type  TEXT DEFAULT '',
          message     TEXT DEFAULT '',
          created_at  BIGINT DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_stream_errors_time ON stream_errors(created_at);
      `);

      await _queryWithRetry(`
        CREATE TABLE IF NOT EXISTS lulu_catalog_cache (
          id         INTEGER PRIMARY KEY DEFAULT 1,
          catalog    JSONB NOT NULL DEFAULT '[]',
          updated_at BIGINT NOT NULL DEFAULT 0
        );
      `);

      _ready = true;
      console.log('[DB] PostgreSQL connected + tables ready');
      return;
    } catch (e) {
      console.error(`[DB] Init attempt ${attempt}/${maxRetries} failed:`, e.code, e.message);
      if (attempt < maxRetries) {
        try { await pool.end(); } catch (_) {}
        pool = createPool();
        await new Promise(r => setTimeout(r, 3000 * attempt));
      } else {
        console.error('[DB] All init attempts failed — server will run with degraded DB');
      }
    }
  }
};

module.exports = db;
