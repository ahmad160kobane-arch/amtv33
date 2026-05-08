const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.log('SFTP err:', err.message); c.end(); return; }
    sftp.fastPut(
      'c:/Users/princ/Desktop/ma/cloud-server/lib/lulu-uploader.js',
      '/root/ma-streaming/cloud-server/lib/lulu-uploader.js',
      (err) => {
        if (err) { console.log('Upload err:', err.message); c.end(); return; }
        console.log('Uploaded OK');
        c.exec('pm2 restart cloud-server && echo RESTARTED', (_, s) => {
          let o = '';
          s.on('data', d => o += d);
          s.stderr.on('data', d => o += d);
          s.on('close', () => { console.log(o.substring(0, 400)); c.end(); });
        });
      }
    );
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
