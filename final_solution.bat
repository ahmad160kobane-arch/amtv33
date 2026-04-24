@echo off
chcp 65001 >nul
echo ========================================
echo    الحل الجذري النهائي
echo ========================================
echo.
echo الحل:
echo 1. المستخدم الجديد ينتظر حتى يكون 5 segments جاهزة
echo 2. الانتظار الأقصى: 3 ثواني
echo 3. التحقق كل 500ms
echo 4. بمجرد جاهزية 5 segments → بث فوري
echo.
echo النتيجة:
echo - تأخير بدء: 0.5-3 ثواني (مرة واحدة فقط)
echo - بعد البدء: صفر تقطيع
echo - بث سلس 100%%
echo.
echo [1/2] رفع الملف المحدث...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ الحل الجذري مطبّق!' && pm2 logs cloud-server --lines 25"
echo.
pause
