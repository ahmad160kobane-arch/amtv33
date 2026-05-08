const {Client} = require('ssh2');
const c = new Client();
c.on('ready', () => {
  // Use the PM2-running cloud-server process to query - or use an HTTP endpoint
  // Actually, let's just use the /api/session/subscription-info endpoint with a real browser token
  // Or better: create a temp script that uses node_modules path correctly
  
  const script = `const db = require('/root/cloud-server/node_modules/better-sqlite3')('/root/cloud-server/data.db'); try { const r = db.prepare('SELECT id, login_version, plan FROM users LIMIT 5').all(); console.log(JSON.stringify(r)); } catch(e) { console.log('sqlite error:', e.message); } try { const { Pool } = require('/root/cloud-server/node_modules/pg'); const pool = new Pool({host:'localhost',port:5432,database:'amtv33',user:'amtv33',password:'amtv33'}); pool.query('SELECT id, login_version, plan, is_admin FROM users LIMIT 5').then(r => { console.log(JSON.stringify(r.rows)); pool.end(); }).catch(e => { console.log('pg error:', e.message); pool.end(); }); } catch(e) { console.log('pg require error:', e.message); }`;
  
  c.exec(`node -e "${script.replace(/"/g, '\\"')}"`, (e, s) => {
    let o = '';
    s.on('data', d => o += d);
    s.stderr.on('data', d => o += d);
    s.on('close', () => { console.log(o.substring(0, 2000)); c.end(); });
  });
}).connect({host:'62.171.153.204', port:22, username:'root', password:'Mustafa7'});
