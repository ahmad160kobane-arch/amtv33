const {Client} = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -n "initXtreamFromDB\\|XTREAM.primary\\|bein" /root/ma-streaming/cloud-server/server.js | head -50', (err, stream) => {
    if(err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).on('error', e => console.error(e.message));
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
