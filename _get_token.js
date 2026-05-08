const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Get the actual user's login_version from the cloud server DB
  // Use the cloud server's own requireAuth to check
  const script = `
    const db = require('./db');
    const config = require('./config');
    const jwt = require('jsonwebtoken');
    db.init().then(async () => {
      const user = await db.prepare('SELECT id, login_version, plan, is_admin, role, is_blocked FROM users WHERE id = ?').get('0cef8a1e-3b3e-494f-9736-c4085ab5eb14');
      console.log('User from DB:', JSON.stringify(user));
      if (user) {
        const token = jwt.sign({ userId: user.id, lv: user.login_version || 0 }, config.JWT_SECRET, { expiresIn: '1h' });
        console.log('TOKEN:' + token);
      }
      process.exit();
    }).catch(e => { console.error(e.message); process.exit(1); });
  `;
  c.exec(`cd /root/cloud-server && node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
