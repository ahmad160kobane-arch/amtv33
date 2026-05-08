const {Client} = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
  console.log('Uploading cloud-server files...');
  const sftp = conn.sftp((err, sftp) => {
    if(err) { console.error(err); conn.end(); return; }
    const files = [
      {local:'C:/Users/princ/Desktop/ma/cloud-server/lib/xtream-proxy.js',remote:'/root/cloud-server/lib/xtream-proxy.js'},
      {local:'C:/Users/princ/Desktop/ma/cloud-server/server.js',remote:'/root/cloud-server/server.js'},
    ];
    let done = 0;
    files.forEach(f => {
      const rs = fs.createReadStream(f.local);
      const ws = sftp.createWriteStream(f.remote);
      rs.pipe(ws);
      ws.on('close', () => {
        done++;
        console.log('Uploaded:', f.remote);
        if(done === files.length) {
          console.log('Restarting cloud-server...');
          let out = '';
          conn.exec('pm2 restart cloud-server && sleep 3 && pm2 status cloud-server && echo "===" && curl -sf http://localhost:8090/health', (err2, stream) => {
            if(err2) { console.error(err2); conn.end(); return; }
            stream.on('data', d => process.stdout.write(d));
            stream.stderr.on('data', d => process.stdout.write(d));
            stream.on('close', () => { console.log('\nCloud server updated!'); conn.end(); });
          });
        }
      });
      ws.on('error', e => { console.error('Write error:', e.message); c.end(); });
    });
  });
}).on('error', e => { console.error('SSH Error:', e.message); });
conn.connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7', readyTimeout:15000});
