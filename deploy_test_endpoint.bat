@echo off
echo ═══════════════════════════════════════════════════════
echo   Deploying Test Endpoint
echo ═══════════════════════════════════════════════════════
echo.
echo [1/3] Uploading server.js...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
echo.
echo [2/3] Restarting cloud-server...
ssh root@62.171.153.204 "pm2 restart cloud-server"
echo.
echo [3/3] Waiting for server...
timeout /t 3 >nul
echo.
echo ═══════════════════════════════════════════════════════
echo   Testing Stream Start
echo ═══════════════════════════════════════════════════════
echo.
echo Starting BeIN Sports 1 HD (1017030)...
ssh root@62.171.153.204 "curl -s http://localhost:8090/test/start-stream/1017030"
echo.
echo.
echo Waiting 10 seconds for FFmpeg to start...
timeout /t 10 >nul
echo.
echo Checking FFmpeg process...
ssh root@62.171.153.204 "ps aux | grep ffmpeg | grep -v grep"
echo.
echo Checking HLS directory...
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/hls/"
echo.
echo Checking stream files...
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/hls/xtream_live_1017030/ 2>/dev/null || echo 'Not ready yet'"
echo.
echo ═══════════════════════════════════════════════════════
echo   Stream URL:
echo   http://62.171.153.204:8090/hls/xtream_live_1017030/stream.m3u8
echo ═══════════════════════════════════════════════════════
pause
