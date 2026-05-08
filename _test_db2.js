const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const script = `cd /root/ma-streaming/cloud-server && node -e "
    const db = require('./db');
    db.init().then(async () => {
      try {
        const admins = await db.prepare('SELECT id, username, plan, login_version, is_admin, role, expires_at FROM users WHERE is_admin = 1 OR role = ?').all('admin');
        console.log('Admins:', JSON.stringify(admins));
        const premium = await db.prepare('SELECT id, username, plan, login_version, expires_at FROM users WHERE plan = ?').all('premium');
        console.log('Premium users:', JSON.stringify(premium));
        const total = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
        console.log('Total users:', total.cnt);
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
