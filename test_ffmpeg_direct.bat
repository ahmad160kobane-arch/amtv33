@echo off
echo ═══════════════════════════════════════════════════════
echo   Testing FFmpeg Mode (Direct Test)
echo ═══════════════════════════════════════════════════════
echo.
echo [1] Checking if FFmpeg is installed...
ssh root@62.171.153.204 "ffmpeg -version | head -1"
echo.
echo [2] Checking HLS directory...
ssh root@62.171.153.204 "ls -la /root/ma-streaming/cloud-server/hls/ | head -10"
echo.
echo [3] Checking active FFmpeg processes...
ssh root@62.171.153.204 "ps aux | grep ffmpeg | grep -v grep"
echo.
echo [4] Checking StreamManager status...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 100 --nostream | grep -E '(StreamManager|FFmpeg|Stream)' | tail -10"
echo.
echo [5] Testing XtreamProxy routes (should return 410)...
ssh root@62.171.153.204 "curl -s http://localhost:8090/proxy/live/1017030/index.m3u8 | head -5"
echo.
echo ═══════════════════════════════════════════════════════
pause
