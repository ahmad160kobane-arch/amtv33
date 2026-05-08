const { Pool } = require('pg');
const http = require('http');
const pool = new Pool({
  connectionString: 'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway',
  ssl: { rejectUnauthorized: false }
});

async function testIptv(name, url, username, password) {
  return new Promise(resolve => {
    const apiUrl = `http://${url}/player_api.php?username=${username}&password=${password}`;
    http.get(apiUrl, { timeout: 10000 }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try {
          const d = JSON.parse(b);
          const ui = d.user_info || {};
          resolve(`${name}: status=${ui.status} | exp=${ui.exp_date ? new Date(ui.exp_date*1000).toLocaleDateString() : 'N/A'} | max_conn=${ui.max_connections} | HTTP=${res.statusCode}`);
        } catch {
          resolve(`${name}: HTTP=${res.statusCode} parse_error`);
        }
      });
    }).on('error', e => resolve(`${name}: ERROR=${e.message}`));
  });
}

(async () => {
  const accs = await pool.query('SELECT id, name, server_url, username, password, status FROM iptv_accounts ORDER BY id');
  console.log(`Found ${accs.rows.length} accounts:\n`);
  for (const r of accs.rows) {
    try {
      const u = new URL(r.server_url);
      const host = `${u.hostname}:${u.port || 80}`;
      const result = await testIptv(`[ID:${r.id}] ${r.name || r.server_url}`, host, r.username, r.password);
      console.log(result);
    } catch(e) {
      console.log(`[ID:${r.id}]: ${e.message}`);
    }
  }
  await pool.end();
})();
