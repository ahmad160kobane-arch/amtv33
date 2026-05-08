const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Generate fresh token and test segment proxy
  const script = `cd /root/ma-streaming/cloud-server && node -e "
    const db = require('./db');
    const jwt = require('jsonwebtoken');
    const config = require('./config');
    db.init().then(async () => {
      const u = await db.prepare('SELECT id, login_version FROM users WHERE id = ?').get('0cef8a1e-3b3e-494f-9736-c4085ab5eb14');
      const lv = Number(u.login_version) || 0;
      const st = jwt.sign({userId:u.id, streamId:'1017030', t:'stream', lv}, config.JWT_SECRET, {expiresIn:'8h'});
      console.log('ST:' + st);
      console.log('LV:' + lv);
      process.exit();
    });
  "`;
  c.exec(script, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log(o.substring(0, 500));
      const stMatch = o.match(/ST:(.+)/);
      if (!stMatch) { console.log('Failed to get token'); c.end(); return; }
      const st = stMatch[1].trim();
      
      // Test segment proxy with fresh token
      const cmd = `curl -s -m 60 -w "\\n---HTTP:%{http_code} SIZE:%{size_download} TIME:%{time_total}s---" "http://localhost:8090/proxy/live/1017030/seg/http%3A%2F%2F185.191.124.204%3A2095%2Fmypro2025%2F82736475687819901262%2F2127?did=test&st=${st}" 2>&1`;
      c.exec(cmd, (e2, s2) => {
        let o2 = '';
        s2.on('data', d => o2 += d);
        s2.stderr.on('data', d => o2 += d);
        s2.on('close', () => { console.log(o2.substring(0, 2000)); c.end(); });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
