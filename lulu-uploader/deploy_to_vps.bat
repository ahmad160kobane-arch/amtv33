@echo off
echo ====================================
echo   نشر lulu-uploader على VPS
echo   (ملفات الأداة فقط)
echo ====================================

set VPS=root@62.171.153.204
set LOCAL=c:\Users\princ\Desktop\ma\lulu-uploader

echo.
echo [1/3] إنشاء المجلد على VPS...
ssh %VPS% "mkdir -p /root/lulu-uploader/src"

echo.
echo [2/3] نسخ ملفات الأداة فقط (بدون node_modules)...
scp "%LOCAL%\src\lulu-api.js"      %VPS%:/root/lulu-uploader/src/
scp "%LOCAL%\src\xtream-api.js"    %VPS%:/root/lulu-uploader/src/
scp "%LOCAL%\src\iptv-to-lulu.js"  %VPS%:/root/lulu-uploader/src/
scp "%LOCAL%\src\tmdb-api.js"      %VPS%:/root/lulu-uploader/src/
scp "%LOCAL%\src\db.js"            %VPS%:/root/lulu-uploader/src/
scp "%LOCAL%\iptv.js"              %VPS%:/root/lulu-uploader/
scp "%LOCAL%\package.json"         %VPS%:/root/lulu-uploader/
scp "%LOCAL%\iptv-state.json"      %VPS%:/root/lulu-uploader/

echo.
echo [3/3] تثبيت المكتبات وتشغيل pm2...
ssh %VPS% "cd /root/lulu-uploader && npm install --production --silent && pm2 delete lulu-uploader 2>/dev/null; pm2 start iptv.js --name lulu-uploader -- --mode all --limit 9999 && pm2 save && echo ✅ تم التشغيل بنجاح"

echo.
echo ====================================
echo   لمتابعة اللوج:
echo   ssh root@62.171.153.204
echo   pm2 logs lulu-uploader
echo ====================================
pause
