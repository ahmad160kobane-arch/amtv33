const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  // جلب أعمدة جدول vod
  const cols = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name=\\'vod\\' ORDER BY ordinal_position');
  console.log('VOD columns:', cols.rows.map(r=>r.column_name).join(', '));
  
  const row = await pool.query('SELECT * FROM vod LIMIT 1');
  if (row.rows.length) console.log('\\nSample row:', JSON.stringify(row.rows[0], null, 2));
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
