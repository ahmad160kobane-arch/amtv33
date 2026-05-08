const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('grep -n "Number(decoded.lv)" /root/ma-streaming/cloud-server/server.js', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o || 'NOT FOUND - deploy failed!'); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
