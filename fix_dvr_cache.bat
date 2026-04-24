@echo off
chcp 65001 >nul
echo ========================================
echo    إصلاح DVR Buffer - التحقق من Cache
echo ========================================
echo.
echo الإصلاحات:
echo 1. التحقق من وجود segments في cache قبل DVR
echo 2. زيادة SEG_TTL إلى 300s (5 دقائق)
echo 3. إرجاع manifest عادي إذا كان DVR غير كافي
echo.
echo [1/2] رفع الملف المحدث...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ DVR محسّن!' && pm2 logs cloud-server --lines 25"
echo.
pause
