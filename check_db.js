var db = require('better-sqlite3')('./data/cloud.db');
var rows = db.prepare('SELECT id, name, stream_url FROM channels LIMIT 3').all();
rows.forEach(function(r) { console.log(r.name, '|', r.stream_url); });
console.log('---');
console.log('total:', db.prepare('SELECT count(*) as c FROM channels').get().c);
var ch = db.prepare("SELECT name, stream_url FROM channels WHERE id = '2a3e5650-c46f-4afd-88bb-8b33715916f5'").get();
if (ch) console.log('Target:', ch.name, '|', ch.stream_url);
else console.log('Target channel not found');
