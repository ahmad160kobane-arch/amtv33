const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const localFile = path.join(__dirname, 'cloud-server/lib/xtream-proxy.js');
const remoteFile = '/root/cloud-server/lib/xtream-proxy.js';

const c = new Client();
c.on('ready', () => {
  const content = fs.readFileSync(localFile);
  console.log(`Uploading ${content.length} bytes to ${remoteFile}...`);
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); c.end(); return; }
    const stream = sftp.createWriteStream(remoteFile);
    stream.write(content);
    stream.end();
    stream.on('close', () => {
      console.log('Upload complete. Restarting cloud-server...');
      c.exec('pm2 restart cloud-server', (e, s) => {
        let o = '';
        s.on('data', d => o += d);
        s.stderr.on('data', d => o += d);
        s.on('close', () => { console.log(o); c.end(); });
      });
    });
    stream.on('error', (err) => { console.error('Write error:', err); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
