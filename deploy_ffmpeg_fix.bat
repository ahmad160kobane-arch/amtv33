@echo off
echo ═══════════════════════════════════════════════════════
echo   Deploying FFmpeg Connection Fix
echo ═══════════════════════════════════════════════════════
echo.
echo [1/4] Uploading stream-manager.js...
scp cloud-server/lib/stream-manager.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/4] Restarting cloud-server...
ssh root@62.171.153.204 "pm2 restart cloud-server"
echo.
echo [3/4] Waiting 5 seconds...
timeout /t 5 >nul
echo.
echo [4/4] Starting test stream...
ssh root@62.171.153.204 "curl -s http://localhost:8090/test/start-stream/1017030"
echo.
echo.
echo Waiting 15 seconds for FFmpeg...
timeout /t 15 >nul
echo.
echo Checking FFmpeg process...
ssh root@62.171.153.204 "ps aux | grep ffmpeg | grep -v grep"
echo.
echo Checking HLS files...
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/hls/xtream_live_1017030/ 2>/dev/null || echo 'Not created yet'"
echo.
echo Checking FFmpeg logs...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 100 --nostream | grep -E '(FFmpeg|Stream|error|Error)' | tail -30"
echo.
echo ═══════════════════════════════════════════════════════
pause
