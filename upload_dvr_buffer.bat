@echo off
chcp 65001 >nul
echo ========================================
echo    DVR Buffer - بث بدون تقطيع
echo ========================================
echo.
echo الميزات الجديدة:
echo 1. DVR Buffer - تخزين آخر 60 ثانية من البث
echo 2. المستخدم الجديد يبدأ من 30-60 ثانية للخلف
echo 3. لا انتظار - كل شيء جاهز في الcache
echo 4. بث سلس 100%% بدون تقطيع
echo.
echo [1/2] رفع xtream-proxy.js مع DVR...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ DVR Buffer مفعّل!' && pm2 logs cloud-server --lines 25"
echo.
pause
