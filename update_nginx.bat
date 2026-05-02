@echo off
echo ========================================
echo تحديث إعدادات Nginx
echo ========================================
echo.

echo [1/4] رفع ملف الإعدادات الجديد...
scp nginx_config_fix.conf root@62.171.153.204:/etc/nginx/sites-available/web-amlive

echo.
echo [2/4] اختبار إعدادات Nginx...
ssh root@62.171.153.204 "nginx -t"

echo.
echo [3/4] إعادة تحميل Nginx...
ssh root@62.171.153.204 "systemctl reload nginx"

echo.
echo [4/4] فحص حالة Nginx...
ssh root@62.171.153.204 "systemctl status nginx --no-pager -l"

echo.
echo ========================================
echo ✅ تم التحديث!
echo ========================================
echo.
echo الآن جرب الموقع: https://www.amlive.shop
echo.
pause
