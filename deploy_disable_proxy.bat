@echo off
echo ═══════════════════════════════════════════════════════
echo   Disabling XtreamProxy - Forcing FFmpeg Mode
echo ═══════════════════════════════════════════════════════
echo.
echo [1/4] Uploading updated server.js...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
echo.
echo [2/4] Restarting cloud-server...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server"
echo.
echo [3/4] Waiting for server to start...
timeout /t 5 >nul
echo.
echo [4/4] Testing FFmpeg mode...
echo.
echo Testing channel 1017030...
ssh root@62.171.153.204 "curl -s -X POST http://localhost:8090/api/stream/live/1017030 -H 'Authorization: Bearer test' | head -20"
echo.
echo.
echo Checking server logs...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 30 --nostream | tail -40"
echo.
echo ═══════════════════════════════════════════════════════
echo   XtreamProxy DISABLED - FFmpeg Mode ACTIVE
echo ═══════════════════════════════════════════════════════
pause
