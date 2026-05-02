const db = require('./db');
(async () => {
  try {
    const users = await db.prepare('SELECT id, username, login_version, is_admin, role FROM users LIMIT 10').all();
    console.log(JSON.stringify(users, null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();
