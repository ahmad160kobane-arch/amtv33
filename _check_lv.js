const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("cd /root/ma-streaming/cloud-server && node -e \"const db=require('./db');db.prepare('SELECT id,username,login_version,plan,expires_at FROM users WHERE id=\\x270cef8a1e-3b3e-494f-9736-c4085ab5eb14\\x27').get().then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(e.message))\"", (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => { console.log(out); conn.end(); });
  });
}).connect({ host: '62.171.153.204', port: 22, username: 'root', password: 'Mustafa7', readyTimeout: 30000 });
