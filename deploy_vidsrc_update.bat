@echo off
echo ========================================
echo Deploying VidSrc Advanced Resolver
echo ========================================
echo.

echo [1/6] Uploading vidsrc-advanced-resolver.js...
scp cloud-server/lib/vidsrc-advanced-resolver.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
if errorlevel 1 (
    echo ERROR: Failed to upload vidsrc-advanced-resolver.js
    pause
    exit /b 1
)
echo OK
echo.

echo [2/6] Uploading updated vidsrc-resolver.js...
scp cloud-server/lib/vidsrc-resolver.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
if errorlevel 1 (
    echo ERROR: Failed to upload vidsrc-resolver.js
    pause
    exit /b 1
)
echo OK
echo.

echo [3/6] Uploading updated package.json...
scp cloud-server/package.json root@62.171.153.204:/root/ma-streaming/cloud-server/
if errorlevel 1 (
    echo ERROR: Failed to upload package.json
    pause
    exit /b 1
)
echo OK
echo.

echo [4/6] Installing new dependencies (axios, jsdom)...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && npm install"
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK
echo.

echo [5/6] Restarting cloud-server...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server"
if errorlevel 1 (
    echo ERROR: Failed to restart cloud-server
    pause
    exit /b 1
)
echo OK
echo.

echo [6/6] Checking server status...
ssh root@62.171.153.204 "pm2 status cloud-server && pm2 logs cloud-server --lines 20 --nostream"
echo.

echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo VidSrc Advanced Resolver has been deployed successfully!
echo.
echo Features:
echo - Multiple VidSrc sources (vidsrc.to, vidsrc.xyz, vidsrc.net, vidsrc.pro)
echo - Direct HLS link extraction
echo - Automatic fallback between sources
echo - Better quality and stability
echo.
echo The system will now try to extract direct streaming links
echo instead of using embed URLs when possible.
echo.
pause
