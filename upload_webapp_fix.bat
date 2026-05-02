@echo off
echo ========================================
echo تحديث ملفات تطبيق الويب فقط
echo ========================================
echo.

echo [1/3] رفع ملف api.ts المحدث...
scp web-app/src/constants/api.ts root@62.171.153.204:/root/ma-streaming/amtv33/web-app/src/constants/api.ts

echo.
echo [2/3] رفع ملف next.config.js المحدث...
scp web-app/next.config.js root@62.171.153.204:/root/ma-streaming/amtv33/web-app/next.config.js

echo.
echo [3/3] إعادة تشغيل التطبيق...
ssh root@62.171.153.204 "pm2 restart web-app"

echo.
echo ========================================
echo ✅ تم التحديث بنجاح!
echo ========================================
echo.
echo ملاحظة: التطبيق سيعيد البناء تلقائياً عند التشغيل
echo إذا لم تعمل القنوات، قد تحتاج لإعادة بناء التطبيق يدوياً على السيرفر
echo.
pause
