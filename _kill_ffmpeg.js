const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('pkill -f ffmpeg; echo "FFmpeg killed"; pm2 restart cloud-server; pm2 logs cloud-server --nostream --lines 10', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).on('error', e => console.error(e.message));
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:20000});
