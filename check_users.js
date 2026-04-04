var db = require('better-sqlite3')('./data/cloud.db');
var users = db.prepare('SELECT id,username,plan,is_admin,is_blocked,role FROM users_cache').all();
console.log(JSON.stringify(users, null, 2));
