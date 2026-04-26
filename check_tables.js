const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    const r1 = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    console.log('Tables:', r1.rows.map(r => r.tablename));

    // Check if lulu_catalog exists
    const r2 = await pool.query("SELECT tablename FROM pg_tables WHERE tablename = 'lulu_catalog'");
    console.log('lulu_catalog exists:', r2.rows.length > 0);

    // Check lulu_progress data on VPS
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}
run();
