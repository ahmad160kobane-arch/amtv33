@echo off
chcp 65001 > nul
:: ============================================================
::  deploy_webapp_vps.bat
::  رفع تطبيق الويب (Next.js) على VPS بجانب السيرفر السحابي
::  الاستخدام: الضغط المزدوج أو تشغيله من CMD
:: ============================================================

title Deploy WebApp to VPS

set VPS_IP=62.171.153.204
set VPS_USER=root
set WEBAPP_DIR=c:\Users\princ\Desktop\ma\web-app

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║     رفع تطبيق الويب على VPS                         ║
echo ║     VPS: %VPS_IP%                                    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: ─── الخطوة 1: Push الكود إلى GitHub ─────────────────────
echo [1/4] رفع الكود على GitHub (appwep)...
cd /d "%WEBAPP_DIR%"

git add -A
git commit -m "deploy: update webapp for VPS deployment %date% %time%" 2>nul || echo     (لا يوجد تغييرات جديدة)
git push appwep main 2>&1

if %errorlevel% neq 0 (
    echo [!] تحذير: push فشل أو لا توجد تغييرات — سيستخدم السيرفر آخر كود محفوظ
)

echo     GitHub: ✓
echo.

:: ─── الخطوة 2: رفع سكريبت النشر على VPS ─────────────────
echo [2/4] رفع سكريبت النشر على VPS...
scp -o StrictHostKeyChecking=no "%~dp0deploy_webapp_vps.sh" %VPS_USER%@%VPS_IP%:/root/deploy_webapp_vps.sh

if %errorlevel% neq 0 (
    echo [✗] فشل رفع السكريبت — تحقق من اتصال SSH
    pause
    exit /b 1
)

echo     رفع السكريبت: ✓
echo.

:: ─── الخطوة 3: تشغيل سكريبت النشر على VPS ───────────────
echo [3/4] تشغيل سكريبت النشر على VPS...
echo       (قد يستغرق 5-10 دقائق للبناء...)
echo.
ssh -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "chmod +x /root/deploy_webapp_vps.sh && bash /root/deploy_webapp_vps.sh"

if %errorlevel% neq 0 (
    echo.
    echo [✗] فشل النشر — تحقق من الأخطاء أعلاه
    pause
    exit /b 1
)

echo.
:: ─── الخطوة 4: فحص التشغيل ───────────────────────────────
echo [4/4] فحص حالة التطبيق...
ssh -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "pm2 status && echo. && curl -sf http://localhost:3001 > nul && echo [OK] webapp يعمل على port 3001 || echo [!] webapp لم يستجب بعد"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  ✅ تم النشر!                                        ║
echo ║                                                      ║
echo ║  🌐 التطبيق: http://%VPS_IP%                        ║
echo ║  ⚡ مباشر  : http://%VPS_IP%:3001                   ║
echo ║  ☁️  السحابي: http://%VPS_IP%:8090                  ║
echo ║                                                      ║
echo ║  للتحديث لاحقاً: update_webapp.bat                  ║
echo ╚══════════════════════════════════════════════════════╝
echo.
pause
