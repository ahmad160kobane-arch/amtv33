const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('grep -n "luluDirectUpload" /root/ma-streaming/cloud-server/lib/lulu-uploader.js | head -10', (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('Direct upload check:', o || 'NOT FOUND - still old code!');
      c.end();
    });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
