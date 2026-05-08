const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Also verify the webapp files in /home/webapp
  c.exec('echo "=== Webapp key files ===" && ls -la /home/webapp/src/components/LivePlayer.tsx 2>&1 && ls -la /home/webapp/src/constants/api.ts 2>&1 && echo "" && echo "=== Check .next build ===" && ls -la /home/webapp/.next/BUILD_ID 2>&1 && echo "" && echo "=== Check server.js at correct path ===" && grep -n "manifestQueryParams" /root/ma-streaming/cloud-server/server.js | head -5', (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
