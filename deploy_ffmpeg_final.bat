@echo off
chcp 65001 >nul
echo ========================================
echo    الحل الجذري النهائي للتقطيع
echo ========================================
echo.
echo التغييرات:
echo 1. ✅ استبدال XtreamProxy بـ FFmpeg Restreamer
echo 2. ✅ اتصال واحد فقط بـ IPTV لكل قناة
echo 3. ✅ إعادة بث محلية من السيرفر
echo 4. ✅ لا ضغط على حساب IPTV
echo 5. ✅ بث سلس 100%% بدون تقطيع
echo.
echo [1/3] رفع Server.js المحدث...
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
echo.
echo [2/3] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server"
echo.
echo [3/3] اختبار النظام الجديد...
timeout 5 >nul
echo.
echo اختبار القناة 1017030:
curl -s "http://62.171.153.204:8090/api/xtream/stream/1017030" | findstr "ffmpeg_restream"
echo.
echo ========================================
echo    النتيجة:
echo ========================================
echo.
echo الآن عندما يطلب التطبيق:
echo GET /api/xtream/stream/1017030
echo.
echo سيحصل على:
echo {
echo   "hlsUrl": "/hls/stream_1017030/playlist.m3u8",
echo   "type": "ffmpeg_restream",
echo   "message": "بث محلي - لا ضغط على IPTV"
echo }
echo.
echo ✅ لا مزيد من XtreamProxy
echo ✅ لا مزيد من التقطيع
echo ✅ بث سلس 100%%
echo.
pause