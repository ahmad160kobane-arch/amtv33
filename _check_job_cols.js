const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `cd /root/ma-streaming/cloud-server && node -e "
const { Pool } = require('pg');
const config = require('./config');
const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const jobCols = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name=\\'lulu_upload_jobs\\' ORDER BY ordinal_position');
  console.log('lulu_upload_jobs cols:', jobCols.rows.map(r=>r.column_name).join(', '));
  
  const job = await pool.query('SELECT * FROM lulu_upload_jobs ORDER BY id DESC LIMIT 1');
  if (job.rows.length) {
    const r = job.rows[0];
    delete r.results_json; // حذف results
    // عرض أول 200 حرف من items
    if (r.items) r.items = (typeof r.items === 'string' ? r.items : JSON.stringify(r.items)).substring(0, 200);
    console.log('\\nLatest job:', JSON.stringify(r, null, 2));
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
