const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cd /root/cloud-server && node -e "const db=require(\'./db\');db.init().then(async()=>{try{const r=await db.prepare(\'SELECT COUNT(*) as c FROM xtream_channels\').get();console.log(\'xtream_channels:\',r.c);const r2=await db.prepare(\'SELECT COUNT(*) as c FROM xtream_channels WHERE is_streaming=true\').get();console.log(\'streaming:\',r2.c);const cats=await db.prepare(\'SELECT DISTINCT category FROM xtream_channels LIMIT 10\').all();console.log(\'categories:\',cats.map(c=>c.category));}catch(e){console.error(e.message);}process.exit(0);})" 2>&1', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => { console.log('\nDone.'); conn.end(); });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
