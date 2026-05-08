const db = require('/root/ma-streaming/cloud-server/node_modules/better-sqlite3')('/root/ma-streaming/cloud-server/data/cloud.db');
const users = db.prepare('SELECT id, username, role, plan FROM users LIMIT 5').all();
console.log(JSON.stringify(users));
