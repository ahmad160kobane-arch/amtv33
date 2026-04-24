@echo off
echo ═══════════════════════════════════════════════════════
echo   Quick Stream Test - FFmpeg Mode
echo ═══════════════════════════════════════════════════════
echo.
echo Available Channels:
echo 1. BeIN Sports 1 HD (ID: 1017030)
echo 2. beIN SPORTS 2 UHD (ID: 707928)
echo 3. CA Bein Sports HD (ID: 3979)
echo.
set /p channel_id="Enter Channel ID (default: 1017030): "
if "%channel_id%"=="" set channel_id=1017030
echo.
echo ═══════════════════════════════════════════════════════
echo   Testing Channel: %channel_id%
echo ═══════════════════════════════════════════════════════
echo.
echo [1/5] Checking if FFmpeg is running for this channel...
ssh root@62.171.153.204 "ps aux | grep %channel_id% | grep ffmpeg | grep -v grep"
echo.
echo [2/5] Checking HLS directory...
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/hls/xtream_live_%channel_id%/ 2>/dev/null || echo 'Directory not found - Stream not started yet'"
echo.
echo [3/5] Checking playlist file...
ssh root@62.171.153.204 "test -f /root/ma-streaming/cloud-server/hls/xtream_live_%channel_id%/stream.m3u8 && echo 'Playlist EXISTS' || echo 'Playlist NOT FOUND'"
echo.
echo [4/5] Testing HLS URL...
echo URL: http://62.171.153.204:8090/hls/xtream_live_%channel_id%/stream.m3u8
ssh root@62.171.153.204 "curl -I http://localhost:8090/hls/xtream_live_%channel_id%/stream.m3u8 2>&1 | head -5"
echo.
echo [5/5] Stream Manager Status...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 100 --nostream | grep -E '(Stream|FFmpeg|%channel_id%)' | tail -10"
echo.
echo ═══════════════════════════════════════════════════════
echo   Test Complete!
echo ═══════════════════════════════════════════════════════
echo.
echo To watch in VLC:
echo vlc http://62.171.153.204:8090/hls/xtream_live_%channel_id%/stream.m3u8
echo.
echo To watch in browser:
echo http://62.171.153.204:8090/hls/xtream_live_%channel_id%/stream.m3u8
echo.
pause
