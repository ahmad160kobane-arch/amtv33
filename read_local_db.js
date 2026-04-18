const sqlite3 = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'backend-api', 'data', 'ma_streaming.db');

try {
  const db = new sqlite3(dbPath, { readonly: true });
  const admins = db.prepare('SELECT username, password_hash FROM users WHERE is_admin=1').all();
  console.log('--- ADMIN USERS IN LOCAL DB ---');
  admins.forEach(u => console.log('Username:', u.username, ' | Hash:', u.password_hash));
  console.log('-------------------------------');
} catch (e) {
  console.error('Error reading local DB:', e.message);
}
