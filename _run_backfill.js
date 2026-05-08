const {Client} = require('ssh2');
const fs = require('fs');
const path = require('path');

const c = new Client();
c.on('ready', () => {
  console.log('SSH connected');
  c.sftp((err, sftp) => {
    if (err) { console.error(err); c.end(); return; }
    sftp.fastPut(
      path.join(__dirname, 'cloud-server/backfill_catalog.js'),
      '/root/ma-streaming/cloud-server/backfill_catalog.js',
      err => {
        if (err) { console.error('upload error:', err); c.end(); return; }
        console.log('✅ سكربت رُفع، بدء التحديث...\n');
        c.exec('cd /root/ma-streaming/cloud-server && node backfill_catalog.js', {env:{FORCE_COLOR:'0'}}, (err, stream) => {
          stream.on('data', d => process.stdout.write(d.toString()));
          stream.stderr.on('data', d => process.stderr.write(d.toString()));
          stream.on('close', code => {
            console.log('\n✅ انتهى (exit code:', code, ')');
            c.end();
          });
        });
      }
    );
  });
}).connect({host:'62.171.153.204',port:22,username:'root',password:'Mustafa7'});
