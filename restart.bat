@echo off
ssh root@62.171.153.204 "pm2 restart cloud-server && sleep 4 && pm2 logs cloud-server --lines 12 --nostream"
