const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected!');
  let output = '';
  conn.exec('pm2 status 2>&1; echo "===SEP==="; systemctl status nginx --no-pager 2>&1 | head -20; echo "===SEP==="; cat /etc/nginx/sites-enabled/amlive* 2>/dev/null; cat /etc/nginx/conf.d/amlive* 2>/dev/null; echo "===SEP==="; curl -sf http://localhost:3001 -o /dev/null -w "WEBAPP:%{http_code}" 2>&1; echo ""; curl -sf http://localhost:8090/health 2>&1 | head -1; echo "===SEP==="; pm2 logs --nostream --lines 30 2>&1 | tail -40', (err, stream) => {
    if(err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => { console.log('\nDone.'); conn.end(); });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
