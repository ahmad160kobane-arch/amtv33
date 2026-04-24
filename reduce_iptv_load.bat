@echo off
chcp 65001 >nul
echo ========================================
echo    تقليل الضغط على IPTV Server
echo ========================================
echo.
echo التحسينات:
echo 1. MANIFEST_TTL: 10s (كان 5s)
echo 2. MANIFEST_TIMEOUT: 20s (كان 10s)
echo 3. SEGMENT_TIMEOUT: 30s (كان 20s)
echo.
echo الفائدة:
echo - طلبات أقل لـ IPTV (نصف العدد)
echo - وقت انتظار أطول للـ IPTV البطيء
echo - أخطاء أقل
echo.
echo [1/2] رفع الملف المحدث...
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
echo.
echo [2/2] إعادة تشغيل الخادم...
ssh root@62.171.153.204 "pm2 restart cloud-server && echo '✅ تم تقليل الضغط على IPTV!' && pm2 logs cloud-server --lines 25"
echo.
pause
