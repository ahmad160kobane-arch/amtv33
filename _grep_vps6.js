const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  // Get full out log after last restart
  conn.exec('pm2 logs cloud-server --nostream --lines 100 2>&1 | grep -A2 -B2 "beIN\\|preload\\|Restreamer\\|FFmpeg" | head -60', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).on('error', e => console.error(e.message));
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
