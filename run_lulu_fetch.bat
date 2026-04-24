@echo off
chcp 65001 > nul
echo.
echo ████████████████████████████████████████████████████████
echo   LuluStream Catalog Fetcher — رفع وتشغيل على VPS
echo ████████████████████████████████████████████████████████
echo.

set VPS_IP=62.171.153.204
set VPS_USER=root
set REMOTE_DIR=/root/ma-streaming

echo [1] رفع السكربت إلى VPS...
scp "fetch_lulu_catalog.js" %VPS_USER%@%VPS_IP%:%REMOTE_DIR%/fetch_lulu_catalog.js
if %errorlevel% neq 0 (
    echo.
    echo ✗ فشل رفع الملف. تأكد من اتصال SSH.
    pause
    exit /b 1
)
echo ✓ تم رفع السكربت

echo.
echo [2] تشغيل السكربت على VPS...
echo     (هذا قد يستغرق وقتاً طويلاً حسب عدد الأفلام)
echo.

ssh %VPS_USER%@%VPS_IP% "cd %REMOTE_DIR% && node fetch_lulu_catalog.js"

if %errorlevel% neq 0 (
    echo.
    echo ✗ انتهى السكربت بخطأ
    pause
    exit /b 1
)

echo.
echo ████████████████████████████████████████████████████████
echo   ✓ اكتمل! الكتالوج محفوظ على VPS في:
echo   /root/ma-streaming/cloud-server/data/lulu_catalog.json
echo ████████████████████████████████████████████████████████
echo.

echo [3] تحميل الكتالوج الجديد في السيرفر...
ssh %VPS_USER%@%VPS_IP% "curl -s http://localhost:8090/api/lulu/reload || echo 'Reload endpoint not available'"

echo.
echo [4] تحميل نسخة الكتالوج على جهازك المحلي...
if not exist "lulu_output" mkdir "lulu_output"
scp %VPS_USER%@%VPS_IP%:%REMOTE_DIR%/cloud-server/data/lulu_catalog.json "lulu_output\lulu_catalog.json"
scp %VPS_USER%@%VPS_IP%:%REMOTE_DIR%/cloud-server/data/lulu_movies.json "lulu_output\lulu_movies.json" 2>nul
scp %VPS_USER%@%VPS_IP%:%REMOTE_DIR%/cloud-server/data/lulu_series.json "lulu_output\lulu_series.json" 2>nul
scp %VPS_USER%@%VPS_IP%:%REMOTE_DIR%/cloud-server/data/lulu_catalog.csv "lulu_output\lulu_catalog.csv" 2>nul

echo.
echo ✓ تم تحميل الملفات إلى مجلد: lulu_output\
echo.
pause
