const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test manifest directly through the proxy (without auth to see raw error)
  const cmd = `curl -s -m 15 "http://localhost:8090/proxy/live/1017030/index.m3u8" 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log('Manifest response:', o.substring(0, 2000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
