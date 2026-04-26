const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    const r1 = await pool.query("SELECT id, stream_id, name, account_id, base_url FROM xtream_channels LIMIT 5");
    console.log('Channels:', JSON.stringify(r1.rows, null, 2));

    const r2 = await pool.query("SELECT id, server_url, username, status FROM iptv_accounts ORDER BY id");
    console.log('Accounts:', JSON.stringify(r2.rows, null, 2));

    // Test getChannelAccount query with id=111017030
    const r3 = await pool.query(
      "SELECT c.*, a.server_url AS acc_server, a.username AS acc_user, a.password AS acc_pass, a.id AS acc_id FROM xtream_channels c LEFT JOIN iptv_accounts a ON c.account_id = a.id WHERE c.id = $1 OR c.stream_id = $2",
      [111017030, 1017030]
    );
    console.log('getChannelAccount result:', JSON.stringify(r3.rows, null, 2));
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}
run();
