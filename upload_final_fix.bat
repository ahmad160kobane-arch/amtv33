@echo off
chcp 65001 >nul
echo ========================================
echo    الإصلاح النهائي للتقطيع
echo ========================================
echo.
echo التحسينات:
echo 1. MANIFEST_STALE: 300s (لا تقطيع عند انضمام مستخدمين)
echo 2. إصلاح خطأ segment destructuring
echo 3. Validation أفضل للبيانات
echo.
echo [1/3] رفع xtream-proxy.js...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/3] رفع server.js...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
echo.
echo [3/3] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ تم الإصلاح الكامل!' && pm2 logs cloud-server --lines 25"
echo.
pause
