const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected');
  
  const localFile = 'C:/Users/princ/Desktop/ma/_vps_check.js';
  const remoteFile = '/tmp/_vps_check.js';
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    const rs = fs.createReadStream(localFile);
    const ws = sftp.createWriteStream(remoteFile);
    ws.on('close', () => {
      console.log('Uploaded check script');
      
      conn.exec('node /tmp/_vps_check.js', (e, stream) => {
        let out = '';
        stream.on('data', d => out += d);
        stream.stderr.on('data', d => out += d);
        stream.on('close', () => {
          console.log('Output:', out.trim());
          conn.end();
        });
      });
    });
    rs.pipe(ws);
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
