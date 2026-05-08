const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test st token validation directly with node
  const script = `cd /root/ma-streaming/cloud-server && node -e "
    const jwt = require('jsonwebtoken');
    const config = require('./config');
    const db = require('./db');
    const stToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwY2VmOGExZS0zYjNlLTQ5NGYtOTczNi1jNDA4NWFiNWViMTQiLCJzdHJlYW1JZCI6IjEwMTcwMzAiLCJ0Ijoic3RyZWFtIiwibHYiOjI2LCJpYXQiOjE3Nzc3Mzc3OTksImV4cCI6MTc3Nzc2NjU5OX0.oCHe4MrID-G01nURJm_ipnc2nmQvhLyy2-l1DLABOec';
    
    db.init().then(async () => {
      try {
        const decoded = jwt.verify(stToken, config.JWT_SECRET);
        console.log('Decoded:', JSON.stringify(decoded));
        console.log('lv type:', typeof decoded.lv, 'value:', decoded.lv);
        
        const row = await db.prepare('SELECT login_version FROM users WHERE id = ?').get(decoded.userId);
        console.log('DB login_version:', row, 'type:', typeof row?.login_version);
        console.log('Number(decoded.lv):', Number(decoded.lv));
        console.log('Number(row.login_version):', Number(row?.login_version));
        console.log('Match:', Number(decoded.lv) === Number(row?.login_version));
        
        const user = await db.prepare('SELECT id, plan, is_admin, role, is_blocked FROM users WHERE id = ?').get(decoded.userId);
        console.log('User:', JSON.stringify(user));
      } catch(e) {
        console.error('Error:', e.message);
      }
      process.exit();
    });
  "`;
  c.exec(script, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 3000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
