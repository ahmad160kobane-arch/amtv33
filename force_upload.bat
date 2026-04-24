@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   🔥 رفع قسري للملف الجديد
echo ════════════════════════════════════════════════════
echo.

echo 1️⃣ إيقاف السيرفر...
ssh root@62.171.153.204 "pm2 stop cloud-server"

echo.
echo 2️⃣ حذف الملف القديم...
ssh root@62.171.153.204 "rm -f /root/ma-streaming/cloud-server/server.js"

echo.
echo 3️⃣ رفع الملف الجديد...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/

echo.
echo 4️⃣ التحقق من الرفع...
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/server.js"

echo.
echo 5️⃣ البحث عن _loadLuluCatalogFromDB في الملف الجديد...
ssh root@62.171.153.204 "grep -c '_loadLuluCatalogFromDB' /root/ma-streaming/cloud-server/server.js"

echo.
echo 6️⃣ بدء السيرفر...
ssh root@62.171.153.204 "pm2 start cloud-server"

echo.
echo 7️⃣ انتظار 5 ثواني...
timeout /t 5 /nobreak >nul

echo.
echo 8️⃣ عرض اللوجات...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 35 --nostream"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم!
echo ════════════════════════════════════════════════════
pause
