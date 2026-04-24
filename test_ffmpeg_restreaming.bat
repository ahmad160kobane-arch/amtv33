@echo off
chcp 65001 >nul
echo ========================================
echo    اختبار FFmpeg Re-streaming
echo ========================================
echo.
echo الحل الجذري للتقطيع:
echo 1. FFmpeg يتصل بـ IPTV مرة واحدة فقط
echo 2. إعادة تغليف محلية (HLS segments)
echo 3. المستخدمون يشاهدون من السيرفر
echo 4. لا ضغط على حساب IPTV
echo.
echo [1/4] اختبار الاتصال بالسيرفر...
curl -s http://62.171.153.204:8090/api/xtream/channels | head -c 100
echo.
echo.
echo [2/4] بدء إعادة البث للقناة 1017030...
curl -s "http://62.171.153.204:8090/api/xtream/restream/1017030"
echo.
echo.
echo [3/4] فحص إحصائيات إعادة البث...
timeout 3 >nul
curl -s "http://62.171.153.204:8090/api/xtream/restream/stats"
echo.
echo.
echo [4/4] فحص ملفات HLS المولدة...
echo انتظار 10 ثواني لتوليد segments...
timeout 10 >nul
curl -s -I "http://62.171.153.204:8090/hls/stream_1017030/playlist.m3u8"
echo.
echo ========================================
echo    النتيجة المتوقعة:
echo ========================================
echo.
echo ✅ بث سلس 100%% بدون تقطيع
echo ✅ اتصال واحد فقط بـ IPTV
echo ✅ إعادة بث محلية من السيرفر
echo ✅ لا ضغط على حساب IPTV
echo.
echo استخدم هذا الرابط في التطبيق:
echo http://62.171.153.204:8090/hls/stream_1017030/playlist.m3u8
echo.
pause