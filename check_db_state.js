const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    // Check existing accounts
    const r1 = await pool.query("SELECT * FROM iptv_accounts ORDER BY id");
    console.log('Accounts:', JSON.stringify(r1.rows, null, 2));

    // Check channels base_url distribution
    const r2 = await pool.query("SELECT base_url, count(*) as cnt FROM xtream_channels GROUP BY base_url");
    console.log('Channel base_urls:', JSON.stringify(r2.rows));

    // Check is_streaming distribution
    const r3 = await pool.query("SELECT is_streaming, count(*) as cnt FROM xtream_channels GROUP BY is_streaming");
    console.log('is_streaming:', JSON.stringify(r3.rows));

    // Sample channel
    const r4 = await pool.query("SELECT id, name, stream_id, base_url, account_id, is_streaming FROM xtream_channels LIMIT 5");
    console.log('Sample channels:', JSON.stringify(r4.rows, null, 2));

  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}

run();
