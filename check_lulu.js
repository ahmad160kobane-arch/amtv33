const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    // Check lulu_catalog schema
    const r1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lulu_catalog' ORDER BY ordinal_position");
    console.log('lulu_catalog columns:', JSON.stringify(r1.rows, null, 2));

    // Sample data
    const r2 = await pool.query("SELECT * FROM lulu_catalog LIMIT 3");
    console.log('lulu_catalog sample:', JSON.stringify(r2.rows, null, 2));

    // Count
    const r3 = await pool.query("SELECT vod_type, COUNT(*) as cnt FROM lulu_catalog GROUP BY vod_type");
    console.log('lulu_catalog counts:', JSON.stringify(r3.rows, null, 2));

    // Check lulu_episodes schema
    const r4 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lulu_episodes' ORDER BY ordinal_position");
    console.log('lulu_episodes columns:', JSON.stringify(r4.rows, null, 2));

    // Sample episodes
    const r5 = await pool.query("SELECT * FROM lulu_episodes LIMIT 3");
    console.log('lulu_episodes sample:', JSON.stringify(r5.rows, null, 2));

    // lulu_catalog_cache schema
    const r6 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lulu_catalog_cache' ORDER BY ordinal_position");
    console.log('lulu_catalog_cache columns:', JSON.stringify(r6.rows, null, 2));

  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}
run();
