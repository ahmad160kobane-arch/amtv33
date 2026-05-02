@echo off
echo ========================================
echo بناء ورفع تطبيق الويب
echo ========================================
echo.

echo [1/4] بناء التطبيق محلياً...
cd web-app
call npm run build
if errorlevel 1 (
    echo ❌ فشل البناء!
    pause
    exit /b 1
)
cd ..

echo.
echo [2/4] رفع مجلد .next المبني...
scp -r web-app/.next root@62.171.153.204:/root/ma-streaming/amtv33/web-app/

echo.
echo [3/4] رفع ملفات الإعدادات...
scp web-app/next.config.js root@62.171.153.204:/root/ma-streaming/amtv33/web-app/
scp web-app/package.json root@62.171.153.204:/root/ma-streaming/amtv33/web-app/

echo.
echo [4/4] إعادة تشغيل التطبيق...
ssh root@62.171.153.204 "pm2 restart web-app"

echo.
echo ========================================
echo ✅ تم التحديث بنجاح!
echo ========================================
echo.
pause
