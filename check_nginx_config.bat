@echo off
echo ========================================
echo فحص إعدادات Nginx للدومين الجديد
echo ========================================
echo.

echo [1] فحص ملف إعدادات Nginx...
ssh root@62.171.153.204 "cat /etc/nginx/sites-available/ma-streaming"

echo.
echo [2] فحص حالة Nginx...
ssh root@62.171.153.204 "systemctl status nginx"

echo.
echo [3] فحص السيرفر السحابي...
ssh root@62.171.153.204 "pm2 list"

echo.
pause
