const {Client} = require('ssh2');
const jwt = require('jsonwebtoken');
const c = new Client();
const JWT_SECRET = 'ma-streaming-secret-key-change-in-production';

// Get current login_version and generate proper token
c.on('ready', () => {
  const script = `cd /root/ma-streaming/cloud-server && node -e "
    const db = require('./db');
    const jwt = require('jsonwebtoken');
    const config = require('./config');
    db.init().then(async () => {
      const u = await db.prepare('SELECT id, login_version, plan, is_admin, role, is_blocked FROM users WHERE id = ?').get('0cef8a1e-3b3e-494f-9736-c4085ab5eb14');
      const lv = Number(u.login_version) || 0;
      console.log('Current lv:', lv);
      
      // Generate token with CURRENT login_version
      const token = jwt.sign({ userId: u.id, lv }, config.JWT_SECRET, { expiresIn: '1h' });
      console.log('AUTH_TOKEN:' + token);
      
      // Generate st token
      const stToken = jwt.sign({ userId: u.id, streamId: '1017030', t: 'stream', lv }, config.JWT_SECRET, { expiresIn: '8h' });
      console.log('ST_TOKEN:' + stToken);
      
      process.exit();
    }).catch(e => { console.error(e.message); process.exit(1); });
  "`;
  c.exec(script, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => {
      console.log(o.substring(0, 3000));
      
      // Extract tokens
      const authMatch = o.match(/AUTH_TOKEN:(.+)/);
      const stMatch = o.match(/ST_TOKEN:(.+)/);
      if (!authMatch || !stMatch) { console.log('Failed to get tokens'); c.end(); return; }
      
      const authToken = authMatch[1].trim();
      const stToken = stMatch[1].trim();
      console.log('\\n=== Testing with fresh tokens ===');
      
      // Test stream request
      const cmd = `curl -s -m 15 -X POST "http://localhost:8090/api/stream/live/111017030" -H "Content-Type: application/json" -H "Authorization: Bearer ${authToken}" -d '{"deviceId":"test-device-123"}' 2>&1`;
      c.exec(cmd, (e2, s2) => {
        let o2 = '';
        s2.on('data', d => o2 += d);
        s2.stderr.on('data', d => o2 += d);
        s2.on('close', () => {
          console.log('Stream response:', o2.substring(0, 2000));
          c.end();
        });
      });
    });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
