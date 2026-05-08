const {Client} = require('ssh2');
const c = new Client();

c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.log('sftp err:', err.message); c.end(); return; }
    sftp.fastPut(
      'c:/Users/princ/Desktop/ma/cloud-server/lib/lulu-uploader.js',
      '/root/cloud-server/lib/lulu-uploader.js',
      {},
      (err2) => {
        if (err2) { console.log('upload err:', err2.message); c.end(); return; }
        console.log('✓ lulu-uploader.js uploaded');
        c.exec('pm2 restart cloud-server && sleep 2 && pm2 logs cloud-server --lines 5 --nostream 2>&1', (_, s) => {
          let o = '';
          s.on('data', d => o += d);
          s.stderr.on('data', d => o += d);
          s.on('close', () => {
            console.log(o);
            c.end();
          });
        });
      }
    );
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
