@echo off
chcp 65001 >nul
echo ========================================
echo    Cache Warm-up - الحل النهائي
echo ========================================
echo.
echo الحل الجديد:
echo 1. المستخدم الجديد ينتظر 2 ثانية
echo 2. خلال الانتظار: prefetch يملأ الcache
echo 3. بعد 2 ثانية: كل segments جاهزة
echo 4. بث سلس 100%% بدون تقطيع
echo.
echo المقايضة: تأخير 2 ثانية عند البدء
echo الفائدة: صفر تقطيع بعد البدء
echo.
echo [1/2] رفع الملف المحدث...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ Cache Warm-up مفعّل!' && pm2 logs cloud-server --lines 25"
echo.
pause
