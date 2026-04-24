@echo off
chcp 65001 >nul
echo ========================================
echo    FFmpeg Re-streaming - الحل الجذري
echo ========================================
echo.
echo النظام الجديد:
echo 1. FFmpeg يتصل بـ IPTV مرة واحدة
echo 2. إعادة تغليف محلية (HLS)
echo 3. المستخدمون يشاهدون من السيرفر
echo 4. لا ضغط على حساب IPTV
echo 5. بث سلس 100%% بدون تقطيع
echo.
echo المتطلبات:
echo - FFmpeg مثبت على VPS
echo - مساحة تخزين للـ HLS segments
echo.
echo [1/3] رفع FFmpeg Restreamer...
scp cloud-server/lib/ffmpeg-restreamer.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/3] رفع Server.js المحدث...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
echo.
echo [3/3] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server && echo '✅ FFmpeg Re-streaming جاهز!' && pm2 logs cloud-server --lines 30"
echo.
echo ========================================
echo    كيفية الاستخدام:
echo ========================================
echo.
echo بدلاً من:
echo GET /api/xtream/stream/123
echo.
echo استخدم:
echo GET /api/xtream/restream/123
echo.
echo النتيجة: بث محلي بدون تقطيع!
echo.
pause