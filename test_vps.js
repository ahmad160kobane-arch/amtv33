// VPS diagnostic — account & channel health check
process.chdir('/root/ma-streaming/cloud-server');
const db = require('/root/ma-streaming/cloud-server/db');
const http = require('http');

function httpStatus(url) {
  return new Promise(resolve => {
    const req = http.get(url, { timeout: 5000, headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' } }, res => {
      resolve(res.statusCode);
      res.destroy();
    });
    req.on('error', e => resolve('ERR:' + e.message));
    req.on('timeout', () => { req.destroy(); resolve('TIMEOUT'); });
  });
}

(async () => {
  try {
    // All accounts with passwords
    const accts = await db.query('SELECT id, name, server_url, username, password, status FROM iptv_accounts');
    console.log('=== IPTV ACCOUNTS ===');
    for (const a of accts.rows) {
      console.log(`  [${a.id}] ${a.name || '(no name)'} | ${a.server_url} | ${a.username}/${a.password} | status=${a.status}`);
      // Test account API
      const apiUrl = `${a.server_url}/player_api.php?username=${a.username}&password=${a.password}&action=get_live_streams&category_id=1`;
      const st = await httpStatus(apiUrl);
      console.log(`    API test: HTTP ${st}`);
    }

    // Channels bound to accounts
    const chans = await db.query(`
      SELECT c.id, c.stream_id, c.name, c.account_id, a.server_url, a.username, a.password
      FROM xtream_channels c
      LEFT JOIN iptv_accounts a ON c.account_id = a.id
      WHERE a.id IS NOT NULL
      LIMIT 5
    `);
    console.log('\n=== CHANNELS WITH ACCOUNTS ===');
    for (const c of chans.rows) {
      const tsUrl = `${c.server_url.replace(/\/+$/, '')}/live/${c.username}/${c.password}/${c.stream_id}.ts`;
      const st = await httpStatus(tsUrl);
      console.log(`  [${c.stream_id}] ${c.name} (acct=${c.account_id}) → .ts HTTP ${st}`);
      if (st === 302 || st === 200) {
        const m3u8Url = `${c.server_url.replace(/\/+$/, '')}/live/${c.username}/${c.password}/${c.stream_id}.m3u8`;
        const st2 = await httpStatus(m3u8Url);
        console.log(`    .m3u8 HTTP ${st2}`);
      }
    }

    // Also check channel 3979 specifically
    const ch3979 = await db.query(`
      SELECT c.id, c.stream_id, c.name, c.account_id, a.server_url, a.username, a.password
      FROM xtream_channels c
      LEFT JOIN iptv_accounts a ON c.account_id = a.id
      WHERE c.stream_id = 3979
    `);
    console.log('\n=== CHANNEL 3979 DETAIL ===');
    for (const c of ch3979.rows) {
      console.log(`  id=${c.id} stream_id=${c.stream_id} name=${c.name} account_id=${c.account_id}`);
      if (c.server_url) {
        const tsUrl = `${c.server_url.replace(/\/+$/, '')}/live/${c.username}/${c.password}/${c.stream_id}.ts`;
        console.log(`  URL: ${tsUrl}`);
        const st = await httpStatus(tsUrl);
        console.log(`  HTTP: ${st}`);
      } else {
        console.log('  NO ACCOUNT BOUND');
      }
    }
  } catch (e) {
    console.error('ERROR:', e.message, e.stack);
  }
  process.exit(0);
})();
