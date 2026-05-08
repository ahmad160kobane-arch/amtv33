const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const script = `cd /root/ma-streaming/cloud-server && node -e "const {Client}=require('pg');const c=new Client({connectionString:'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway'});c.connect().then(()=>c.query(\\"UPDATE lulu_upload_jobs SET status='cancelled' WHERE status IN ('running','queued') RETURNING id,cat_name\\")).then(r=>{console.log('Cancelled:',JSON.stringify(r.rows));c.end();}).catch(e=>{console.error(e.message);c.end();})" 2>&1`;
  c.exec(script, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('Cancel result:', o); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
