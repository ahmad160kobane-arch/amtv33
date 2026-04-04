@echo off
ssh root@62.171.153.204 "cd /home/cloud-server && node -e \"var db=require('better-sqlite3')('./data/cloud.db');var rows=db.prepare('SELECT id,name,stream_url FROM channels LIMIT 3').all();rows.forEach(r=>console.log(r.name,'|',r.stream_url));console.log('---');console.log('total:',db.prepare('SELECT count(*) as c FROM channels').get().c);\""
