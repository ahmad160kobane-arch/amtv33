const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // فحص لوج السيرفر للأخطاء
  c.exec('pm2 logs cloud-server --lines 50 --nostream 2>&1', (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('=== LOGS ===');
      console.log(o.substring(0, 3000));
      c.end();
    });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
