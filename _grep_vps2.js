const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -n "723898\\|bein1\\|XTREAM\\|preload\\|initXtream" /root/ma-streaming/cloud-server/server.js | head -40', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      // Also check .env file
      conn.exec('cat /root/ma-streaming/cloud-server/.env 2>/dev/null || echo "NO .env"', (err2, s2) => {
        s2.on('data', d => process.stdout.write(d));
        s2.on('close', () => conn.end());
      });
    });
  });
}).on('error', e => console.error(e.message));
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
