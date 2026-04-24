@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   🔧 إصلاح ورفع تطبيق الويب
echo ════════════════════════════════════════════════════
echo.

echo 1️⃣ رفع الملف المعدل...
scp web-app/src/app/detail/page.tsx root@62.171.153.204:/root/ma-streaming/web-app/src/app/detail/

echo.
echo 2️⃣ بناء التطبيق على السيرفر...
ssh root@62.171.153.204 "cd /root/ma-streaming/web-app && npm run build"

echo.
echo 3️⃣ إعادة تشغيل التطبيق...
ssh root@62.171.153.204 "pm2 restart web-app"

echo.
echo 4️⃣ عرض الحالة...
ssh root@62.171.153.204 "pm2 list"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم! جرب تشغيل الفيديو الآن
echo ════════════════════════════════════════════════════
pause
