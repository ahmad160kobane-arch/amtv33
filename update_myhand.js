const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    // 1. Update iptv_accounts: update id=10 to myhand.org
    console.log('[1] Updating iptv_accounts id=10 to myhand.org...');
    const r1 = await pool.query(
      "UPDATE iptv_accounts SET name = 'myhand.org Family IPTV', server_url = 'http://myhand.org:8080', username = '07740338663', password = '11223344', max_connections = 1, status = 'active' WHERE id = 10"
    );
    console.log('Updated', r1.rowCount, 'accounts');

    // 2. Update all channels base_url to myhand.org
    console.log('[2] Updating all channels base_url to myhand.org...');
    const r2 = await pool.query("UPDATE xtream_channels SET base_url = 'http://myhand.org:8080' WHERE account_id = 10");
    console.log('Updated', r2.rowCount, 'channels');

    // 3. Set all channels is_streaming = true
    console.log('[3] Setting all channels is_streaming = true...');
    const r3 = await pool.query("UPDATE xtream_channels SET is_streaming = true WHERE is_streaming IS NOT TRUE");
    console.log('Updated', r3.rowCount, 'channels');

    // 4. Verify
    const r4 = await pool.query("SELECT id, name, server_url, username, status FROM iptv_accounts WHERE id = 10");
    console.log('Account:', JSON.stringify(r4.rows[0]));

    const r5 = await pool.query("SELECT count(*) as cnt FROM xtream_channels WHERE base_url = 'http://myhand.org:8080'");
    console.log('myhand.org channels:', r5.rows[0].cnt);

    const r6 = await pool.query("SELECT count(*) as cnt FROM xtream_channels WHERE is_streaming = true");
    console.log('Streaming channels:', r6.rows[0].cnt);

    console.log('\n[DONE] DB updated. Restart cloud-server.');
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}

run();
