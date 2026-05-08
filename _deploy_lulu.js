const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const localFile = path.join(__dirname, 'cloud-server/lib/lulu-uploader.js');
const remoteFile = '/root/ma-streaming/cloud-server/lib/lulu-uploader.js';

const c = new Client();
c.on('ready', () => {
  console.log('SSH connected');
  c.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); c.end(); return; }
    sftp.fastPut(localFile, remoteFile, (err) => {
      if (err) { console.error('Upload error:', err); }
      else { console.log('✅ lulu-uploader.js uploaded to VPS'); }
      // restart pm2
      c.exec('cd /root/ma-streaming && pm2 restart cloud-server', (err, stream) => {
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => { console.log('✅ PM2 restarted'); c.end(); });
      });
    });
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
