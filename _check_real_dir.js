const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Ah! The actual working directory is /root/ma-streaming/cloud-server, not /root/cloud-server
  c.exec('ls /root/ma-streaming/cloud-server/node_modules/ 2>&1 | head -20', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
