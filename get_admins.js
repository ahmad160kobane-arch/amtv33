const db = require('./db');
process.env.DB_PATH = '/home/cloud-server/data/ma_streaming.db';
db.init().then(() => {
  const users = db.prepare('SELECT username, password_hash FROM users WHERE is_admin=1').all();
  console.log('--- ADMIN USERS ---');
  users.forEach(u => console.log('Username:', u.username, ' | Hash:', u.password_hash));
  console.log('-------------------');
  process.exit(0);
}).catch(console.error);
