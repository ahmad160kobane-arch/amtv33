@echo off
chcp 65001 >nul
echo ========================================
echo    Aggressive Prefetch - DVR محسّن
echo ========================================
echo.
echo التحسينات الجديدة:
echo 1. Prefetch كل segments (ليس فقط آخر 6)
echo 2. DVR Buffer: 15 segments (90 ثانية)
echo 3. الحد الأدنى: 5 segments (30 ثانية)
echo 4. تحميل مسبق حتى بدون مشاهدين
echo.
echo النتيجة: DVR buffer يمتلئ بسرعة = لا تقطيع!
echo.
echo [1/2] رفع الملف المحدث...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ Aggressive Prefetch مفعّل!' && pm2 logs cloud-server --lines 25"
echo.
pause
