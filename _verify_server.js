const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Check the server.js at the CORRECT path for our manifestQueryParams fix
  c.exec('grep -n "manifestQueryParams" /root/ma-streaming/cloud-server/server.js | head -5', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('server.js fixes:', o || 'NOT FOUND - need to deploy!'); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
