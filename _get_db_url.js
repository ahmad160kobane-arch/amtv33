const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec(`cat /root/ma-streaming/cloud-server/.env | grep DATABASE`, (_, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('DB URL:', o.substring(0, 300));
      c.end();
    });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7' });
