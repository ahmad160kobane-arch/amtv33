@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   رفع تحديثات لوحة تحكم المدير v2
echo ════════════════════════════════════════════════════
echo.

echo 1. رفع app.js...
scp admin-dashboard/public/app.js root@62.171.153.204:/root/ma-streaming/admin-dashboard/public/
if %errorlevel% neq 0 (
    echo فشل رفع app.js
    pause
    exit /b 1
)

echo 2. رفع style.css...
scp admin-dashboard/public/style.css root@62.171.153.204:/root/ma-streaming/admin-dashboard/public/
if %errorlevel% neq 0 (
    echo فشل رفع style.css
    pause
    exit /b 1
)

echo 3. رفع index.html...
scp admin-dashboard/public/index.html root@62.171.153.204:/root/ma-streaming/admin-dashboard/public/
if %errorlevel% neq 0 (
    echo فشل رفع index.html
    pause
    exit /b 1
)

echo 4. رفع server.js للسيرفر السحابي...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
if %errorlevel% neq 0 (
    echo فشل رفع server.js
    pause
    exit /b 1
)

echo 5. إعادة تشغيل الخدمات...
ssh root@62.171.153.204 "cd /root/ma-streaming && pm2 restart admin-dashboard && pm2 restart cloud-server"
if %errorlevel% neq 0 (
    echo فشل إعادة التشغيل
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════
echo   تم بنجاح! افتح لوحة التحكم واضغط Ctrl+Shift+R
echo ════════════════════════════════════════════════════
pause
