const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Use node to query DB directly
  const script = `
    const { Pool } = require('pg');
    const pool = new Pool({ host: 'localhost', port: 5432, database: 'amtv33', user: 'amtv33', password: 'amtv33' });
    pool.query('SELECT id, email, role, plan FROM users LIMIT 5').then(r => {
      console.log(JSON.stringify(r.rows));
      pool.end();
    }).catch(e => { console.error(e.message); pool.end(); });
  `;
  c.exec(`cd /root/cloud-server && node -e "${script.replace(/"/g, '\\"')}"`, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
