const ssh2 = require('ssh2');
const conn = new ssh2.Client();
const fs = require('fs');

conn.on('ready', () => {
  console.log('Connected to VPS');
  
  const files = [
    { local: 'C:/Users/princ/Desktop/ma/cloud-server/lib/ffmpeg-restreamer.js', remote: '/root/ma-streaming/cloud-server/lib/ffmpeg-restreamer.js' },
    { local: 'C:/Users/princ/Desktop/ma/cloud-server/lib/xtream-proxy.js', remote: '/root/ma-streaming/cloud-server/lib/xtream-proxy.js' },
    { local: 'C:/Users/princ/Desktop/ma/cloud-server/server.js', remote: '/root/ma-streaming/cloud-server/server.js' },
  ];
  
  let uploaded = 0;
  for (const f of files) {
    conn.sftp((err, sftp) => {
      if (err) { console.error('SFTP error:', err); conn.end(); return; }
      const readStream = fs.createReadStream(f.local);
      const writeStream = sftp.createWriteStream(f.remote);
      writeStream.on('close', () => {
        console.log('Uploaded:', f.remote);
        uploaded++;
        if (uploaded === files.length) {
          conn.exec('cd /root/ma-streaming/cloud-server && pm2 restart cloud-server --update-env', (err, stream) => {
            if (err) console.error('Restart error:', err);
            stream.on('data', (data) => console.log(data.toString()));
            stream.on('close', () => {
              console.log('Cloud server restarted');
              conn.end();
            });
          });
        }
      });
      readStream.pipe(writeStream);
    });
  }
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
