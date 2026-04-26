@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   🔧 إصلاح: القنوات المضافة لا تظهر
echo ════════════════════════════════════════════════════
echo.

echo 🐛 المشكلة:
echo   القنوات المضافة يدوياً لا تظهر في التطبيق
echo.
echo ✅ الحل:
echo   تعيين is_enabled = 1 تلقائياً عند الإضافة
echo.

echo 1️⃣ عمل نسخة احتياطية...
ssh root@62.171.153.204 "cp /root/ma-streaming/amtv33/backend-api/routes/admin.js /root/ma-streaming/amtv33/backend-api/routes/admin.js.backup"

echo.
echo 2️⃣ رفع admin.js المحدث...
scp backend-api/routes/admin.js root@62.171.153.204:/root/ma-streaming/amtv33/backend-api/routes/

echo.
echo 3️⃣ إعادة تشغيل Backend API...
ssh root@62.171.153.204 "pm2 restart amtv33"

echo.
echo 4️⃣ انتظار 5 ثواني...
timeout /t 5 /nobreak >nul

echo.
echo 5️⃣ عرض اللوجات...
ssh root@62.171.153.204 "pm2 logs amtv33 --lines 20 --nostream"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم إصلاح المشكلة!
echo ════════════════════════════════════════════════════
echo.
echo 📝 الآن:
echo   - القنوات المضافة يدوياً ستظهر تلقائياً
echo   - is_enabled = 1 بشكل افتراضي
echo   - لا حاجة لتفعيلها يدوياً
echo.
echo 🧪 للاختبار:
echo   1. افتح لوحة التحكم
echo   2. أضف قناة جديدة (+ يدوي)
echo   3. افتح التطبيق
echo   4. تحقق من ظهور القناة في القنوات المباشرة
echo.
pause
