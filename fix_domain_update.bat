@echo off
echo ========================================
echo تحديث الدومين للقنوات المباشرة
echo ========================================
echo.

echo [1/3] رفع ملفات تطبيق الويب المحدثة...
scp -r web-app/src/constants/api.ts root@62.171.153.204:/root/ma/web-app/src/constants/
scp web-app/next.config.js root@62.171.153.204:/root/ma/web-app/

echo.
echo [2/3] إعادة بناء تطبيق الويب...
ssh root@62.171.153.204 "cd /root/ma/web-app && npm run build"

echo.
echo [3/3] إعادة تشغيل تطبيق الويب...
ssh root@62.171.153.204 "pm2 restart web-app"

echo.
echo ========================================
echo ✅ تم التحديث بنجاح!
echo ========================================
echo.
echo الآن يجب أن تعمل القنوات المباشرة على www.amlive.shop
echo.
pause
