const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Use the cloud server's db module to query
  const script = `const db = require('./db'); db.init().then(() => db.prepare('SELECT id, email, role, plan FROM users LIMIT 5').all()).then(r => { console.log(JSON.stringify(r)); process.exit(); }).catch(e => { console.error(e.message); process.exit(1); })`;
  c.exec(`cd /root/cloud-server && node -e "${script.replace(/"/g, '\\"')}"`, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
