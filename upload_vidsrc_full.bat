@echo off
chcp 65001 >nul
echo ============================================
echo رفع تحديثات VidSrc Full على VPS
echo ============================================
echo.

echo [1] الاتصال بـ VPS...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && git pull origin master"

echo.
echo [2] تثبيت المكتبات...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && npm install"

echo.
echo [3] إعادة تشغيل السيرفر...
ssh root@62.171.153.204 "pm2 restart cloud-server"

echo.
echo [4] التحقق من الحالة...
ssh root@62.171.153.204 "pm2 status"

echo.
echo ============================================
echo ✓ تم الرفع بنجاح!
echo ============================================
echo.
echo للتحقق من اللوجات: ssh root@62.171.153.204 "pm2 logs cloud-server"
echo.
pause
