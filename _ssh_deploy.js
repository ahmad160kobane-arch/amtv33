const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected! Syncing code and rebuilding...');
  
  const cmds = [
    'cd /home/webapp && git pull appwep main 2>&1',
    'rm -rf /home/webapp/.next/cache',
    'cd /home/webapp && npm run build 2>&1 | tail -30',
    'pm2 restart webapp 2>&1',
    'sleep 5',
    'pm2 status 2>&1',
    'curl -sf http://localhost:3001 -o /dev/null -w "WEBAPP_STATUS:%{http_code}" 2>&1',
  ].join(' && ');

  conn.exec(cmds, (err, stream) => {
    if(err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => { console.log('\nDone.'); conn.end(); });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
