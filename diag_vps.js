const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    // Old channels (account_id=0) by category
    const r1 = await pool.query("SELECT category, count(*) as cnt FROM xtream_channels WHERE account_id=0 GROUP BY category ORDER BY cnt DESC LIMIT 15");
    console.log('old_channels_by_cat:', JSON.stringify(r1.rows));

    // Sample old channels
    const r2 = await pool.query("SELECT id, name, logo, category, stream_id, base_url FROM xtream_channels WHERE account_id=0 LIMIT 3");
    console.log('sample_old:', JSON.stringify(r2.rows));

    // Direct channels count
    const r3 = await pool.query("SELECT count(*) as cnt FROM channels WHERE is_enabled=1");
    console.log('direct_channels_count:', r3.rows[0].cnt);

    // Direct channels sample
    const r4 = await pool.query("SELECT id, name, stream_url FROM channels WHERE is_enabled=1 LIMIT 5");
    console.log('direct_channels_sample:', JSON.stringify(r4.rows));

    // Lulu catalog
    const r5 = await pool.query("SELECT count(*) as cnt FROM lulu_catalog_cache");
    console.log('lulu_catalog_cache:', r5.rows[0].cnt);

    // Total xtream channels
    const r6 = await pool.query("SELECT count(*) as cnt FROM xtream_channels");
    console.log('total_xtream_channels:', r6.rows[0].cnt);

    // Account 10 channels
    const r7 = await pool.query("SELECT count(*) as cnt FROM xtream_channels WHERE account_id=10");
    console.log('account10_channels:', r7.rows[0].cnt);
  } catch (e) {
    console.error('DB ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}

run();
