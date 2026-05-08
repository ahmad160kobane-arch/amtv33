const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const iptv = await pool.query('SELECT id, server_url, username, password FROM iptv_accounts WHERE id=16');
  const r = iptv.rows[0];
  console.log('IPTV 16:', JSON.stringify(r));
  
  const vod = await pool.query('SELECT xtream_id, container_ext, title FROM vod LIMIT 1');
  const m = vod.rows[0];
  console.log('\\nVOD sample:', JSON.stringify(m));
  
  const u = new URL(r.server_url);
  const base = u.protocol + '//' + u.hostname + ':' + (u.port || 8080);
  const url = base + '/movie/' + r.username + '/' + r.password + '/' + m.xtream_id + '.' + (m.container_ext || 'mp4');
  console.log('\\nURL to test:', url);
  await pool.end();
})().catch(e => console.log('Error:', e.message));
" 2>&1`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
