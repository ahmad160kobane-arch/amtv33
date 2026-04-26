const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  try {
    const r1 = await pool.query('SELECT id, name, server_url, username, status FROM iptv_accounts');
    console.log('accounts:', JSON.stringify(r1.rows));

    const r2 = await pool.query('SELECT count(*) as cnt, account_id FROM xtream_channels GROUP BY account_id');
    console.log('channels_by_account:', JSON.stringify(r2.rows));

    const r3 = await pool.query('SELECT id, name, stream_url FROM channels WHERE is_enabled = 1 LIMIT 10');
    console.log('direct_channels:', JSON.stringify(r3.rows));

    console.log('\n[UPDATE] Setting account 10 to proxpanel...');
    await pool.query("UPDATE iptv_accounts SET name='ProxPanel Primary', server_url='http://proxpanel.cc:80', username='8045446010', password='2963249691', status='active' WHERE id=10");
    const r4 = await pool.query('SELECT id, name, server_url, username, status FROM iptv_accounts WHERE id = 10');
    console.log('updated:', JSON.stringify(r4.rows[0]));

    console.log('\n[TEST] Fetching categories from proxpanel...');
    const resp = await fetch('http://proxpanel.cc:80/player_api.php?username=8045446010&password=2963249691&action=get_live_categories', {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
      signal: AbortSignal.timeout(15000),
    });
    const cats = await resp.json();
    console.log('categories count:', Array.isArray(cats) ? cats.length : 'error');
    if (Array.isArray(cats) && cats.length > 0) console.log('sample:', JSON.stringify(cats.slice(0, 5)));

    console.log('\n[TEST] Fetching streams from proxpanel...');
    const resp2 = await fetch('http://proxpanel.cc:80/player_api.php?username=8045446010&password=2963249691&action=get_live_streams', {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
      signal: AbortSignal.timeout(30000),
    });
    const streams = await resp2.json();
    console.log('streams count:', Array.isArray(streams) ? streams.length : 'error');

    console.log('\n[DONE] Restart cloud-server to re-sync.');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}

run();
