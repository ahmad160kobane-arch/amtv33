const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected!');
  conn.exec('ls -la /home/webapp/.git/config 2>&1; echo "==="; cd /home/webapp && git remote -v 2>&1; echo "==="; cd /home/webapp && git log --oneline -3 2>&1; echo "==="; cd /home/webapp && git status --short 2>&1; echo "==="; ls /home/webapp/src/constants/api.ts 2>&1; echo "==="; head -5 /home/webapp/src/constants/api.ts 2>&1', (err, stream) => {
    if(err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => { console.log('\nDone.'); conn.end(); });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
