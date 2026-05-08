const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  // جلب حسابات IPTV
  const accs = await pool.query('SELECT id, server_url, username, password, status FROM iptv_accounts ORDER BY id');
  console.log('IPTV Accounts:');
  accs.rows.forEach(r => console.log(' ID:', r.id, '| Status:', r.status, '| URL:', r.server_url, '| User:', r.username));
  
  // جلب فيلم للاختبار
  const item = await pool.query('SELECT id, name, stream_id, ext FROM catalog WHERE type=\\'movie\\' AND lulu_file_code IS NULL LIMIT 1');
  if (item.rows.length) {
    const m = item.rows[0];
    console.log('\\nTest movie:', m.name, '| stream_id:', m.stream_id, '| ext:', m.ext);
    
    // بناء الرابط المباشر مع أول حساب نشط
    const acc = accs.rows.find(r => r.status === 'active');
    if (acc) {
      const u = new URL(acc.server_url);
      const base = u.protocol + '//' + u.hostname + ':' + (u.port || 8080);
      const url = base + '/movie/' + acc.username + '/' + acc.password + '/' + m.stream_id + '.' + (m.ext || 'mp4');
      console.log('\\nTest URL:', url);
    }
  }
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
