@echo off
echo ========================================
echo Restoring FFmpeg for IPTV Channels
echo ========================================

REM Upload cloud-server changes
echo.
echo [1/2] Uploading cloud-server/server.js...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/

echo.
echo [2/2] Restarting cloud-server...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server"

echo.
echo ========================================
echo Upload Complete!
echo ========================================
echo.
echo System Configuration:
echo - IPTV Channels: FFmpeg + HLS Files (restored)
echo - Manual Channels: Direct URL passthrough
echo.
pause
