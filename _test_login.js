const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Wait for cloud-server to fully start, then test the actual stream request
  // First get a JWT token by logging in
  const cmd1 = `curl -s -m 10 -X POST "http://localhost:8090/api/auth/login" -H "Content-Type: application/json" -d '{"username":"test","password":"test"}' 2>&1`;
  c.exec(cmd1, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log('Login response:', o.substring(0, 500));
      c.end();
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
