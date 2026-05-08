const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('tail -30 /root/.pm2/logs/cloud-server-out.log', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => { out += d; process.stdout.write(d); });
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      // Check jobs in DB
      conn.exec(`cd /root/ma-streaming/cloud-server && node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT id,status,progress,items_total,items_done FROM lulu_jobs ORDER BY id DESC LIMIT 5').then(r=>{console.log(JSON.stringify(r.rows,null,2));p.end()}).catch(e=>{console.error(e.message);p.end()})
"`, (err2, s2) => {
        s2.on('data', d => process.stdout.write(d));
        s2.stderr.on('data', d => process.stderr.write(d));
        s2.on('close', () => conn.end());
      });
    });
  });
}).on('error', e => console.error(e.message));
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
