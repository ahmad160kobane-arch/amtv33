const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/nginx/sites-enabled/* 2>/dev/null; echo "===SEP==="; ls /etc/nginx/sites-enabled/ 2>/dev/null; echo "===SEP==="; cat /etc/nginx/conf.d/*.conf 2>/dev/null; echo "===SEP==="; nginx -t 2>&1; echo "===SEP==="; curl -sf http://localhost:3001 -o /dev/null -w "WEBAPP:%{http_code}" 2>&1; echo ""; curl -sf http://localhost:8090/health 2>&1 | head -1; echo ""; curl -sk -o /dev/null -w "HTTPS:%{http_code}" https://www.amlive.shop/ 2>&1; echo ""; curl -sk -o /dev/null -w "HTTP:%{http_code}" http://62.171.153.204/ 2>&1', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => { console.log('\nDone.'); conn.end(); });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
