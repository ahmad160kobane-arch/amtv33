const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const cmd = 'cd /root/ma-streaming/cloud-server && node -e "const db=require(\'./db\');db.prepare(\'SELECT id,username,login_version,role,plan FROM users LIMIT 5\').all().then(r=>console.log(JSON.stringify(r))).catch(e=>console.error(e.message))"';
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '62.171.153.204',
  port: 22,
  username: 'root',
  password: 'Mustafa7',
  readyTimeout: 30000,
});
