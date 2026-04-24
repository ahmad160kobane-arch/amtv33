@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   🔧 إصلاح السيرفر مباشرة
echo ════════════════════════════════════════════════════
echo.

echo 1️⃣ حذف التعريف المكرر...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && grep -n 'let _luluCatalog' server.js"

echo.
echo 2️⃣ إصلاح الملف...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && sed -i '2092d' server.js"

echo.
echo 3️⃣ إعادة تشغيل السيرفر...
ssh root@62.171.153.204 "pm2 restart cloud-server"

echo.
echo 4️⃣ انتظار 3 ثواني...
timeout /t 3 /nobreak >nul

echo.
echo 5️⃣ عرض اللوجات...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 25 --nostream"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم!
echo ════════════════════════════════════════════════════
pause
