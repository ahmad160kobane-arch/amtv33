@echo off
chcp 65001 > nul
:: ============================================================
::  update_webapp.bat
::  تحديث سريع لتطبيق الويب على VPS (بدون إعادة إعداد كامل)
:: ============================================================

title Update WebApp on VPS

set VPS_IP=62.171.153.204
set VPS_USER=root
set WEBAPP_DIR=c:\Users\princ\Desktop\ma\web-app

echo.
echo ╔════════════════════════════════════════╗
echo ║  تحديث تطبيق الويب على VPS            ║
echo ╚════════════════════════════════════════╝
echo.

:: ─── 1. Push إلى GitHub ───────────────────────────────────
echo [1/3] رفع التغييرات على GitHub...
cd /d "%WEBAPP_DIR%"
git add -A
git commit -m "update: %date% %time%" 2>nul || echo     (لا تغييرات جديدة)
git push appwep main 2>&1
echo.

:: ─── 2. Pull وبناء على VPS ────────────────────────────────
echo [2/3] تحديث وبناء على VPS...
ssh -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "update-webapp"

if %errorlevel% neq 0 (
    echo [✗] التحديث فشل
    pause
    exit /b 1
)

:: ─── 3. فحص ───────────────────────────────────────────────
echo.
echo [3/3] فحص الحالة...
ssh -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "pm2 status webapp"

echo.
echo ✅ تم التحديث بنجاح!
echo    http://%VPS_IP%
echo.
pause
