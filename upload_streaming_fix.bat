@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   🚀 رفع تحسينات البث المباشر إلى VPS
echo ════════════════════════════════════════════════════
echo.

echo 📋 الملفات المحسّنة:
echo   - cloud-server/config.js (MIN_SEGMENTS_READY = 0)
echo   - cloud-server/lib/stream-manager.js (تحسين FFmpeg)
echo   - حل_مشكلة_البث_البطيء.md (التعليمات)
echo   - fix_streaming_performance.md (التفاصيل التقنية)
echo.

echo 1️⃣ عمل نسخة احتياطية من الملفات القديمة...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && cp config.js config.js.backup && cp lib/stream-manager.js lib/stream-manager.js.backup"

echo.
echo 2️⃣ رفع config.js المحسّن...
scp cloud-server/config.js root@62.171.153.204:/root/ma-streaming/cloud-server/

echo.
echo 3️⃣ رفع stream-manager.js المحسّن...
scp cloud-server/lib/stream-manager.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/

echo.
echo 4️⃣ رفع ملفات التعليمات...
scp حل_مشكلة_البث_البطيء.md root@62.171.153.204:/root/ma-streaming/
scp fix_streaming_performance.md root@62.171.153.204:/root/ma-streaming/

echo.
echo 5️⃣ إعادة تشغيل السيرفر السحابي...
ssh root@62.171.153.204 "cd /root/ma-streaming && pm2 restart cloud-server"

echo.
echo 6️⃣ انتظار 5 ثواني...
timeout /t 5 /nobreak >nul

echo.
echo 7️⃣ عرض اللوجات...
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 30 --nostream"

echo.
echo ════════════════════════════════════════════════════
echo   ✅ تم رفع التحسينات بنجاح!
echo ════════════════════════════════════════════════════
echo.
echo 📊 النتيجة المتوقعة:
echo   - قبل: 5-10 ثواني
echo   - بعد: 1-3 ثواني
echo   - تحسين: 70-80%%
echo.
echo 📝 للتحسينات الإضافية، راجع:
echo   /root/ma-streaming/حل_مشكلة_البث_البطيء.md
echo.
pause
