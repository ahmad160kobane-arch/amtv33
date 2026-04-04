@echo off
ssh root@62.171.153.204 "sleep 5 && pm2 logs cloud-server --lines 15 --nostream"
