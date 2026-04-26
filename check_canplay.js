const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    const r1 = await pool.query("SELECT canplay, COUNT(*) as cnt FROM lulu_catalog GROUP BY canplay");
    console.log('canplay distribution:', JSON.stringify(r1.rows));

    const r2 = await pool.query("SELECT canplay, COUNT(*) as cnt FROM lulu_episodes GROUP BY canplay");
    console.log('episodes canplay:', JSON.stringify(r2.rows));

    const r3 = await pool.query("SELECT id, title, canplay FROM lulu_catalog WHERE canplay = true LIMIT 3");
    console.log('canplay=true sample:', JSON.stringify(r3.rows));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
