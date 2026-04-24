@echo off
chcp 65001 >nul
echo ========================================
echo    رفع xtream-proxy.js المحدث
echo ========================================
echo.
echo [1/2] رفع الملف...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ تم التحديث بنجاح!' && pm2 logs cloud-server --lines 30"
echo.
pause
