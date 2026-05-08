const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.error(err); c.end(); return; }
    sftp.fastPut(
      path.join(__dirname, 'cloud-server/db.js'),
      '/root/ma-streaming/cloud-server/db.js',
      err => {
        if (err) { console.error('upload error:', err); c.end(); return; }
        console.log('✅ db.js uploaded');
        c.exec('cd /root/ma-streaming && pm2 restart cloud-server', (err, stream) => {
          stream.on('data', d => process.stdout.write(d.toString()));
          stream.stderr.on('data', d => process.stderr.write(d.toString()));
          stream.on('close', () => { console.log('✅ PM2 restarted'); c.end(); });
        });
      }
    );
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
