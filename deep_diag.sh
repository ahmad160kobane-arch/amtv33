#!/bin/bash
echo "=== [1] IPTV Subscription Info ==="
curl -s "http://myhand.org:8080/player_api.php?username=3302196097&password=2474044847" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const u=d.user_info;
console.log('max_connections:', u.max_connections);
console.log('active_cons:', u.active_cons);
console.log('status:', u.status);
console.log('exp_date:', u.exp_date);
" 2>/dev/null

echo ""
echo "=== [2] PM2 Process State ==="
pm2 list --no-color | grep cloud-server

echo ""
echo "=== [3] Last 40 lines output.log ==="
tail -40 /home/cloud-server/cloud-server/logs/output.log

echo ""
echo "=== [4] Last 40 lines error.log ==="
tail -40 /home/cloud-server/cloud-server/logs/error.log

echo ""
echo "=== [5] Unique error types count ==="
grep -oP '\[Proxy\].*?:' /home/cloud-server/cloud-server/logs/error.log | sort | uniq -c | sort -rn | head -20

echo ""
echo "=== [6] Running xtream-proxy.js version check ==="
head -5 /home/cloud-server/cloud-server/lib/xtream-proxy.js
grep 'SESSION_TTL\|MANIFEST_TTL\|MANIFEST_STALE\|COOLDOWN_403\|stale-while' /home/cloud-server/cloud-server/lib/xtream-proxy.js | head -10

echo ""
echo "=== [7] Server.js session management check ==="
grep -n 'SESSION_TIMEOUT\|checkConnectionLimit\|max_connections\|heartbeat' /home/cloud-server/cloud-server/server.js | head -20

echo ""
echo "=== [8] Active DB sessions ==="
cd /home/cloud-server/cloud-server && node -e "
const Database = require('better-sqlite3');
const db = new Database('./db/cloud.db');
try {
  const sessions = db.prepare('SELECT user_id, stream_id, type, started_at, last_seen FROM active_sessions').all();
  console.log('Total active sessions:', sessions.length);
  sessions.forEach(s => {
    const age = Math.round((Date.now() - s.last_seen)/1000);
    console.log('  user:', s.user_id, '| stream:', s.stream_id, '| age:', age+'s');
  });
  const users = db.prepare('SELECT id, plan, max_connections FROM users LIMIT 10').all();
  console.log('Users sample:');
  users.forEach(u => console.log('  id:', u.id, '| plan:', u.plan, '| max_conn:', u.max_connections));
} catch(e) { console.error(e.message); }
" 2>/dev/null
