@echo off
echo ========================================
echo اختبار القنوات المباشرة
echo ========================================
echo.

echo [1] اختبار API القنوات على السيرفر السحابي...
ssh root@62.171.153.204 "curl -s http://localhost:8090/api/xtream/channels?limit=3"

echo.
echo.
echo [2] اختبار API القنوات عبر تطبيق الويب...
ssh root@62.171.153.204 "curl -s http://localhost:3002/api/xtream/channels?limit=3"

echo.
echo.
echo [3] فحص حالة السيرفرات...
ssh root@62.171.153.204 "pm2 list"

echo.
echo.
echo [4] فحص ملف api.ts المحدث...
ssh root@62.171.153.204 "grep 'CLOUD_URL' /home/webapp/src/constants/api.ts"

echo.
echo ========================================
echo انتهى الاختبار
echo ========================================
pause
