@echo off
type check_db.js | ssh root@62.171.153.204 "cd /home/cloud-server && node -"
