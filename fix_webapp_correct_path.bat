@echo off
echo ========================================
echo تحديث تطبيق الويب - المسار الصحيح
echo ========================================
echo.

echo [1/4] رفع ملف api.ts...
scp web-app/src/constants/api.ts root@62.171.153.204:/home/webapp/src/constants/api.ts

echo.
echo [2/4] رفع ملف next.config.js...
scp web-app/next.config.js root@62.171.153.204:/home/webapp/next.config.js

echo.
echo [3/4] إعادة بناء التطبيق على السيرفر...
ssh root@62.171.153.204 "cd /home/webapp && npm run build"

echo.
echo [4/4] إعادة تشغيل التطبيق...
ssh root@62.171.153.204 "pm2 restart webapp"

echo.
echo ========================================
echo ✅ تم التحديث بنجاح!
echo ========================================
echo.
echo الآن امسح الكاش من المتصفح (Ctrl+Shift+Delete)
echo ثم جرب القنوات المباشرة مرة أخرى
echo.
pause
