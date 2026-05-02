@echo off
echo ========================================
echo إعادة بناء التطبيق بالكامل
echo ========================================
echo.

echo [1/4] إيقاف التطبيق...
ssh root@62.171.153.204 "pm2 stop webapp"

echo.
echo [2/4] حذف البناء القديم...
ssh root@62.171.153.204 "cd /home/webapp && rm -rf .next"

echo.
echo [3/4] إعادة البناء (قد يستغرق دقيقتين)...
ssh root@62.171.153.204 "cd /home/webapp && npm run build"

echo.
echo [4/4] تشغيل التطبيق...
ssh root@62.171.153.204 "pm2 start webapp"

echo.
echo ========================================
echo ✅ انتهى!
echo ========================================
echo.
echo الآن امسح كاش المتصفح (Ctrl+Shift+Delete)
echo ثم جرب الموقع: https://www.amlive.shop
echo.
pause
