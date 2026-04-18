const dbPath = './data/ma_streaming.db';
const sqlite3 = require('better-sqlite3');
const db = new sqlite3(dbPath, { readonly: true });
const admins = db.prepare('SELECT username, password_hash FROM users WHERE is_admin=1').all();
console.log('--- ADMIN USERS IN LOCAL DB ---');
admins.forEach(u => console.log('Username:', u.username, ' | Hash:', u.password_hash));
console.log('-------------------------------');
