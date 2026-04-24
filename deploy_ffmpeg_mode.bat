@echo off
echo ═══════════════════════════════════════════════════════
echo   Deploying FFmpeg Mode (replacing XtreamProxy)
echo ═══════════════════════════════════════════════════════
echo.
echo [1/3] Uploading server.js...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
echo.
echo [2/3] Restarting cloud-server...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server"
echo.
echo [3/3] Checking logs...
timeout /t 3 >nul
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 30 --nostream | tail -40"
echo.
echo ═══════════════════════════════════════════════════════
echo   Deployment Complete!
echo   System now using FFmpeg instead of XtreamProxy
echo ═══════════════════════════════════════════════════════
pause
