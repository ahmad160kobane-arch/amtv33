const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `ls /root/ma-streaming/cloud-server/lib/ && echo '---' && ls /root/ma-streaming/cloud-server/data/ 2>/dev/null || echo 'no data dir' && echo '---' && find /root/ma-streaming/cloud-server -name "*.db" 2>/dev/null && echo '---' && cat /root/ma-streaming/cloud-server/config.js | head -30`;
  c.exec(cmd, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
