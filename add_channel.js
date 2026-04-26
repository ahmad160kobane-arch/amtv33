const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    // Insert BeIN Sports 1 HD with account_id=11 (myhand.org)
    const r1 = await pool.query(
      `INSERT INTO xtream_channels (id, name, logo, category, stream_id, base_url, account_id, is_streaming, sort_order)
       VALUES (111017030, 'BeIN Sports 1 HD', 'https://safiafamily.com/uploads/family/Bein_sports/Bein_1.png', 'beIN Sports', 1017030, 'http://myhand.org:8080', 11, true, 0)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         logo = EXCLUDED.logo,
         category = EXCLUDED.category,
         stream_id = EXCLUDED.stream_id,
         base_url = EXCLUDED.base_url,
         account_id = EXCLUDED.account_id,
         is_streaming = EXCLUDED.is_streaming`
    );
    console.log('Inserted/updated', r1.rowCount, 'channel(s)');

    // Verify
    const r2 = await pool.query("SELECT id, name, stream_id, base_url, account_id, is_streaming FROM xtream_channels");
    console.log('Channels now:', JSON.stringify(r2.rows, null, 2));

    // Test getChannelAccount query
    const r3 = await pool.query(
      "SELECT c.*, a.server_url AS acc_server, a.username AS acc_user, a.password AS acc_pass, a.id AS acc_id FROM xtream_channels c LEFT JOIN iptv_accounts a ON c.account_id = a.id WHERE c.id = $1 OR c.stream_id = $2",
      ['111017030', 1017030]
    );
    console.log('getChannelAccount:', JSON.stringify(r3.rows[0] || 'NOT FOUND', null, 2));
  } catch (e) {
    console.error('ERROR:', e.code, e.message);
  } finally {
    await pool.end();
  }
}
run();
