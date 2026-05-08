const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('sleep 2 && pm2 logs cloud-server --lines 30 --nostream 2>&1', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 5000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
