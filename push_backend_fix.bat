@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   📤 رفع إصلاح Backend إلى GitHub
echo ════════════════════════════════════════════════════
echo.

echo 🔧 التغييرات:
echo   ✓ إصلاح: القنوات المضافة يدوياً تظهر تلقائياً
echo   ✓ تعيين is_enabled = 1 عند الإضافة
echo.

echo 1️⃣ التحقق من التغييرات...
git status

echo.
echo 2️⃣ إضافة الملفات المحدثة...
git add backend-api/routes/admin.js
git add admin-dashboard/public/app.js
git add cloud-server/config.js
git add cloud-server/lib/stream-manager.js

echo.
echo 3️⃣ عمل Commit...
git commit -m "fix: القنوات المضافة يدوياً تظهر تلقائياً + تحسينات البث

- إصلاح: تعيين is_enabled = 1 تلقائياً عند إضافة قناة
- تحسين: تقليل MIN_SEGMENTS_READY إلى 0 للبث الفوري
- ميزة: إضافة قنوات يدوياً مع Direct Passthrough
- تحسين: اختيار الفئة من قائمة منسدلة
- تحسين: مؤشر بصري لنوع القناة (مباشر/FFmpeg)"

echo.
echo 4️⃣ رفع إلى GitHub...
git push origin main

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم رفع التحديثات إلى GitHub!
echo ════════════════════════════════════════════════════
echo.
echo 📡 Railway سيقوم بـ:
echo   1. اكتشاف التحديثات تلقائياً
echo   2. بناء Backend جديد
echo   3. نشر التحديثات (2-3 دقائق)
echo.
echo 🔍 لمتابعة النشر:
echo   https://railway.app/dashboard
echo.
echo ⏱️  انتظر 2-3 دقائق ثم اختبر:
echo   - أضف قناة جديدة من لوحة التحكم
echo   - تحقق من ظهورها في التطبيق
echo.
pause
