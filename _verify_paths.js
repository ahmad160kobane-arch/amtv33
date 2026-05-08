const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  c.exec('echo "=== PM2 Processes ===" && pm2 show cloud-server 2>&1 | grep -E "script path|exec cwd" && echo "" && pm2 show webapp 2>&1 | grep -E "script path|exec cwd" && echo "" && echo "=== Verify xtream-proxy fix ===" && grep -n "EXTM3U" /root/ma-streaming/cloud-server/lib/xtream-proxy.js && echo "" && echo "=== Old wrong path check ===" && ls /root/cloud-server/lib/xtream-proxy.js 2>&1 && grep -n "EXTM3U" /root/cloud-server/lib/xtream-proxy.js 2>&1', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
