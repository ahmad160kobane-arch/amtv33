@echo off
chcp 65001 >nul
echo ========================================
echo    إصلاح تقطيع عند انضمام مستخدم جديد
echo ========================================
echo.
echo التحسينات:
echo - MANIFEST_STALE: 300s (5 دقائق)
echo - Stale-while-revalidate محسّن
echo - المستخدمون الجدد لا يسببون تقطيع
echo.
echo [1/2] رفع الملف المحدث...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ تم الإصلاح!' && pm2 logs cloud-server --lines 20"
echo.
pause
