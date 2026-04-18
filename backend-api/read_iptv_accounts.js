const dbPath = './data/ma_streaming.db';
const sqlite3 = require('better-sqlite3');
const db = new sqlite3(dbPath, { readonly: true });
console.log('--- IPTV ACCOUNTS ---');
console.log(db.prepare('SELECT * FROM iptv_accounts').all());
console.log('-------------------------------');
