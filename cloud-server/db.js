/**
 * PostgreSQL wrapper for cloud-server
 * Same pattern as backend-api/db.js — async prepare/get/all/run
 */
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

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

  async exec(sql) {
    await pool.query(sql);
  },

  async query(sql, params) {
    return pool.query(sql, params);
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

// Init: create cloud-server specific tables + migrations
db.init = async function () {
  await pool.query(`
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

  // Migration: add device_info + ip + device_id columns if missing
  try { await pool.query("ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS device_info TEXT DEFAULT ''"); } catch(e) {}
  try { await pool.query("ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS ip TEXT DEFAULT ''"); } catch(e) {}
  try { await pool.query("ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT ''"); } catch(e) {}

  // ─── IPTV Accounts table (multi-account support) ───
  await pool.query(`
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

  // Migration: ensure xtream_channels has cloud-server columns
  try { await pool.query('ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS raw_cat TEXT DEFAULT \'\''); } catch(e) {}
  try { await pool.query('ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS cat_id TEXT DEFAULT \'\''); } catch(e) {}
  try { await pool.query('ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0'); } catch(e) {}
  try { await pool.query('ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS base_url TEXT DEFAULT \'\''); } catch(e) {}
  try { await pool.query('ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS account_id INTEGER DEFAULT 0'); } catch(e) {}

  // Ensure xtream_channels id is TEXT (cloud-server uses stream_id as text id)
  // If table doesn't exist yet, create it
  await pool.query(`
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

  // Migration: add is_streaming column to xtream_channels
  try { await pool.query("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS is_streaming BOOLEAN DEFAULT false"); } catch(e) {}
  // Migration: add is_continuous column for 24/7 channels
  try { await pool.query("ALTER TABLE xtream_channels ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN DEFAULT false"); } catch(e) {}

  // ─── Stream Errors log table (global error log for all channels) ───
  await pool.query(`
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

  // ─── Lulu Upload Accounts (API keys) ───
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lulu_upload_accounts (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT '',
      api_key    TEXT NOT NULL,
      main_folder_id INTEGER DEFAULT 0,
      created_at BIGINT DEFAULT 0
    );
  `);

  // ─── Lulu Uploaded Files (file codes stored permanently) ───
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lulu_uploaded_files (
      id              SERIAL PRIMARY KEY,
      file_code       TEXT NOT NULL,
      title           TEXT NOT NULL DEFAULT '',
      original_name   TEXT DEFAULT '',
      type            TEXT DEFAULT 'movie',
      cat_name        TEXT DEFAULT '',
      show_name       TEXT DEFAULT '',
      season          INTEGER DEFAULT 0,
      episode_num     INTEGER DEFAULT 0,
      iptv_stream_id  TEXT DEFAULT '',
      lulu_account_id INTEGER DEFAULT 0,
      iptv_account_id INTEGER DEFAULT 0,
      folder_id       INTEGER DEFAULT 0,
      job_id          INTEGER DEFAULT 0,
      status          TEXT DEFAULT 'ok',
      error_msg       TEXT DEFAULT '',
      created_at      BIGINT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_lulu_files_code ON lulu_uploaded_files(file_code);
    CREATE INDEX IF NOT EXISTS idx_lulu_files_cat ON lulu_uploaded_files(cat_name);
    CREATE INDEX IF NOT EXISTS idx_lulu_files_type ON lulu_uploaded_files(type);
    CREATE INDEX IF NOT EXISTS idx_lulu_files_lulu ON lulu_uploaded_files(lulu_account_id);
    CREATE INDEX IF NOT EXISTS idx_lulu_files_time ON lulu_uploaded_files(created_at);
  `);

  // ─── Lulu Upload Jobs (persistent job history) ───
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lulu_upload_jobs (
      id              SERIAL PRIMARY KEY,
      job_uuid        TEXT NOT NULL DEFAULT '',
      status          TEXT DEFAULT 'queued',
      type            TEXT DEFAULT 'vod',
      total           INTEGER DEFAULT 0,
      done            INTEGER DEFAULT 0,
      failed          INTEGER DEFAULT 0,
      cat_name        TEXT DEFAULT '',
      lulu_account_id INTEGER DEFAULT 0,
      iptv_account_id INTEGER DEFAULT 0,
      started_at      BIGINT DEFAULT 0,
      finished_at     BIGINT DEFAULT 0,
      created_at      BIGINT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_lulu_jobs_uuid ON lulu_upload_jobs(job_uuid);
    CREATE INDEX IF NOT EXISTS idx_lulu_jobs_status ON lulu_upload_jobs(status);
  `);

  console.log('[DB] PostgreSQL connected + tables ready');
};

module.exports = db;
