const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  // فحص lulu_upload_jobs
  const jobs = await pool.query('SELECT id, status, total, done, failed, created_at FROM lulu_upload_jobs ORDER BY id DESC LIMIT 5');
  console.log('Jobs:', JSON.stringify(jobs.rows, null, 2));
  
  // فحص lulu_catalog
  const catCols = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name=\\'lulu_catalog\\' ORDER BY ordinal_position');
  console.log('\\nlulu_catalog cols:', catCols.rows.map(r=>r.column_name).join(', '));
  
  // فحص عناصر الجوب الأخير
  const jobRow = await pool.query('SELECT items_json FROM lulu_upload_jobs ORDER BY id DESC LIMIT 1');
  if (jobRow.rows.length && jobRow.rows[0].items_json) {
    const items = JSON.parse(jobRow.rows[0].items_json);
    console.log('\\nFirst item:', JSON.stringify(items[0], null, 2));
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
