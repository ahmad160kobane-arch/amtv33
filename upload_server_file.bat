@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   📤 رفع server.js المحلي إلى السيرفر
echo ════════════════════════════════════════════════════
echo.

echo 1️⃣ عمل نسخة احتياطية من الملف القديم...
ssh root@62.171.153.204 "cp /root/ma-streaming/cloud-server/server.js /root/ma-streaming/cloud-server/server.js.backup"

echo.
echo 2️⃣ رفع الملف الجديد...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/

echo.
echo 3️⃣ إعادة تشغيل السيرفر...
ssh root@62.171.153.204 "pm2 restart cloud-server"

echo.
echo 4️⃣ انتظار 5 ثواني...
timeout /t 5 /nobreak >nul

echo.
echo 5️⃣ عرض اللوجات...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 30 --nostream"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم!
echo ════════════════════════════════════════════════════
pause
