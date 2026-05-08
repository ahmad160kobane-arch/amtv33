const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  // جلب فيلم للاختبار من جدول vod
  const item = await pool.query('SELECT id, name, stream_id, ext, container_extension FROM vod WHERE lulu_file_code IS NULL LIMIT 3');
  console.log('VOD items:', JSON.stringify(item.rows, null, 2));
  
  // بناء رابط مع حساب kojplusma (id=16)
  const acc = await pool.query('SELECT server_url, username, password FROM iptv_accounts WHERE id=16');
  if (acc.rows.length && item.rows.length) {
    const r = acc.rows[0];
    const m = item.rows[0];
    const u = new URL(r.server_url);
    const base = u.protocol + '//' + u.hostname + ':' + (u.port || 8080);
    const ext = m.container_extension || m.ext || 'mp4';
    const url = base + '/movie/' + r.username + '/' + r.password + '/' + m.stream_id + '.' + ext;
    console.log('\\nTest URL:', url);
  }
  await pool.end();
})().catch(e => console.log('Error:', e.message));
" 2>&1`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 3000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
