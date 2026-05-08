const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Find which file exports initXtreamFromDB
  conn.exec('grep -rn "initXtreamFromDB\\|exports.initXtream\\|module.exports" /root/ma-streaming/cloud-server/lib/ | grep -i "xtream\\|init" | head -20', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      // Also check what accounts are in iptv_accounts table
      conn.exec('cd /root/ma-streaming/cloud-server && node -e "const {Pool}=require(\'pg\');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\'SELECT id,name,server_url,username FROM iptv_accounts LIMIT 10\').then(r=>{console.log(JSON.stringify(r.rows));p.end()}).catch(e=>{console.error(e.message);p.end()})" 2>&1', (err2, s2) => {
        s2.on('data', d => process.stdout.write(d));
        s2.on('close', () => conn.end());
      });
    });
  });
}).on('error', e => console.error(e.message));
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
