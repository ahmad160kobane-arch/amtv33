const db = require('better-sqlite3')('cloud.db');
const rows = db.prepare('SELECT id, name, server_url, username, password, status FROM iptv_accounts').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
