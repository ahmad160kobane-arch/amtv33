#!/bin/bash
echo "=== IPTV Subscription Info ==="
curl -s "http://myhand.org:8080/player_api.php?username=3302196097&password=2474044847" | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const u=d.user_info;
console.log('max_connections:', u.max_connections);
console.log('active_cons:', u.active_cons);
console.log('status:', u.status);
console.log('exp_date:', new Date(u.exp_date*1000).toLocaleDateString());
"
echo ""
echo "=== Current Proxy State ==="
tail -5 /home/cloud-server/cloud-server/logs/output.log
echo ""
echo "=== Recent Errors (last 20) ==="
tail -20 /home/cloud-server/cloud-server/logs/error.log
