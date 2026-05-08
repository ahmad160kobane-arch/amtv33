const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Check the actual cloud server logs to see what's happening with real user requests
  const cmd = `pm2 logs cloud-server --lines 20 --nostream 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 5000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
