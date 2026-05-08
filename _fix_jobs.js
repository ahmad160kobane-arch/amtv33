'use strict';
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
ssh.connect({ host: '62.171.153.204', username: 'root', password: 'Mustafa7' }).then(() =>
  ssh.execCommand(
    `node -e "const {Pool}=require('/root/ma-streaming/cloud-server/node_modules/pg');const db=new Pool({connectionString:'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway'});db.query('UPDATE lulu_upload_jobs SET status=\\'failed\\' WHERE status=\\'running\\'').then(r=>{console.log('fixed:',r.rowCount,'old jobs');db.end()}).catch(e=>{console.error(e);db.end()})"`,
    { cwd: '/root/cloud-server' }
  )
).then(r => {
  console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  ssh.dispose();
}).catch(e => { console.error(e); ssh.dispose(); });
