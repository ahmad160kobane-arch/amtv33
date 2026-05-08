const {Client} = require('ssh2');
const fs = require('fs');
const c = new Client();

c.on('ready', () => {
  c.sftp((err, sftp) => {
    if (err) { console.log('sftp err:', err.message); c.end(); return; }
    sftp.fastPut(
      'c:/Users/princ/Desktop/ma/cloud-server/server.js',
      '/root/cloud-server/server.js',
      {},
      (err2) => {
        if (err2) { console.log('upload err:', err2.message); c.end(); return; }
        console.log('✓ server.js uploaded');
        c.exec('pm2 restart cloud-server && sleep 3 && curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://62.171.153.204:8090/iptv-proxy/lulu_iptv_proxy_2026/16/movie/549019.mp4"', (_, s) => {
          let o = '';
          s.on('data', d => o += d);
          s.stderr.on('data', d => o += d);
          s.on('close', () => {
            console.log('HTTP status after fix:', o);
            c.end();
          });
        });
      }
    );
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
