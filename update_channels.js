const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    // 1. Update old channels base_url from myhand.org to proxpanel
    console.log('[1] Updating old channels base_url...');
    const r1 = await pool.query("UPDATE xtream_channels SET base_url = 'http://proxpanel.cc:80' WHERE base_url = 'http://myhand.org:8080'");
    console.log('Updated', r1.rowCount, 'channels from myhand to proxpanel');

    // 2. Also update account_id for old channels to point to proxpanel account
    const r2 = await pool.query("UPDATE xtream_channels SET account_id = 10 WHERE account_id = 0 AND base_url = 'http://proxpanel.cc:80'");
    console.log('Updated', r2.rowCount, 'channels account_id to 10');

    // 3. Verify
    const r3 = await pool.query("SELECT count(*) as cnt FROM xtream_channels WHERE base_url = 'http://proxpanel.cc:80'");
    console.log('Proxpanel channels:', r3.rows[0].cnt);

    const r4 = await pool.query("SELECT count(*) as cnt FROM xtream_channels WHERE base_url = 'http://myhand.org:8080'");
    console.log('Old myhand channels remaining:', r4.rows[0].cnt);

    // 4. Check top categories
    const r5 = await pool.query("SELECT category, count(*) as cnt FROM xtream_channels GROUP BY category ORDER BY cnt DESC LIMIT 10");
    console.log('Top categories:', JSON.stringify(r5.rows));

    console.log('\n[DONE] Channels updated. Restart cloud-server to re-sync.');
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}

run();
