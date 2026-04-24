@echo off
echo ========================================
echo Starting Backend API on VPS
echo ========================================

ssh root@62.171.153.204 "cd /root/ma-streaming/backend-api && pm2 start server.js --name backend-api --time || pm2 restart backend-api"

echo.
echo ========================================
echo Backend API Started!
echo ========================================
echo.
echo Check status: ssh root@62.171.153.204 "pm2 status"
echo Check logs: ssh root@62.171.153.204 "pm2 logs backend-api"
echo.
pause
