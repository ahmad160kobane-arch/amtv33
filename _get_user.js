const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // pg is not installed globally, use the cloud-server's node_modules
  const script = `cd /root/cloud-server && node -e "const db=require('./db');db.init().then(async()=>{const u=await db.prepare('SELECT id, login_version, plan, is_admin, role, is_blocked FROM users WHERE id = ?').get('0cef8a1e-3b3e-494f-9736-c4085ab5eb14');console.log(JSON.stringify(u));process.exit()}).catch(e=>{console.error(e.message);process.exit(1)})"`;
  c.exec(script, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
