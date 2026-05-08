const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Try using the backend API on Railway to get a token
  const cmd = `curl -s -m 10 -X POST "https://amtv33-production.up.railway.app/api/auth/login" -H "Content-Type: application/json" -d '{"email":"mustafa@amlive.shop","password":"Mustafa7"}' 2>&1`;
  c.exec(cmd, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
