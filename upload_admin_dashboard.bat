@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   📤 رفع تحديثات لوحة تحكم المدير
echo ════════════════════════════════════════════════════
echo.

echo 📋 التحسينات:
echo   ✓ إضافة قنوات مباشرة يدوياً مع Direct Passthrough
echo   ✓ اختيار الفئة من قائمة منسدلة (أخبار، رياضة، إلخ)
echo   ✓ مؤشر بصري لنوع القناة (مباشر / FFmpeg)
echo   ✓ واجهة محسّنة مع تعليمات واضحة
echo.

echo 1️⃣ عمل نسخة احتياطية...
ssh root@62.171.153.204 "cp /root/ma-streaming/admin-dashboard/public/app.js /root/ma-streaming/admin-dashboard/public/app.js.backup"

echo.
echo 2️⃣ رفع app.js المحسّن...
scp admin-dashboard/public/app.js root@62.171.153.204:/root/ma-streaming/admin-dashboard/public/

echo.
echo 3️⃣ رفع ملف التعليمات...
scp إضافة_قنوات_مباشرة_يدوياً.md root@62.171.153.204:/root/ma-streaming/

echo.
echo 4️⃣ إعادة تشغيل لوحة التحكم...
ssh root@62.171.153.204 "cd /root/ma-streaming && pm2 restart admin-dashboard"

echo.
echo 5️⃣ انتظار 3 ثواني...
timeout /t 3 /nobreak >nul

echo.
echo 6️⃣ عرض الحالة...
ssh root@62.171.153.204 "pm2 list"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم رفع التحديثات بنجاح!
echo ════════════════════════════════════════════════════
echo.
echo 📝 كيفية الاستخدام:
echo   1. افتح لوحة التحكم
echo   2. انتقل إلى صفحة "القنوات"
echo   3. اضغط "+ يدوي"
echo   4. املأ البيانات:
echo      - اسم القناة
echo      - الفئة (أخبار، رياضة، إلخ)
echo      - رابط البث
echo      - رابط الشعار (اختياري)
echo      - فعّل "Direct Passthrough"
echo   5. اضغط "إضافة القناة"
echo.
echo 📖 للتفاصيل الكاملة، راجع:
echo   /root/ma-streaming/إضافة_قنوات_مباشرة_يدوياً.md
echo.
pause
