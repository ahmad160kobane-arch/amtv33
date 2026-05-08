const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Test the DB connection from cloud server
  const script = `cd /root/ma-streaming/cloud-server && node -e "
    const db = require('./db');
    db.init().then(async () => {
      try {
        const users = await db.prepare('SELECT id, username, plan, login_version, is_admin, role FROM users LIMIT 3').all();
        console.log('Users:', JSON.stringify(users));
        const sessions = await db.prepare('SELECT * FROM active_sessions LIMIT 5').all();
        console.log('Active sessions:', JSON.stringify(sessions));
      } catch(e) { console.error('Query error:', e.message); }
      process.exit();
    }).catch(e => { console.error('Init error:', e.message); process.exit(1); });
  "`;
  c.exec(script, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 5000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
