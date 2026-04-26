@echo off
chcp 65001 > nul
title Update WebApp on VPS

set VPS_IP=62.171.153.204
set VPS_USER=root
set VPS_PASS=Mustafa7

echo.
echo ========================================
echo   تحديث تطبيق الويب على VPS
echo   VPS: %VPS_IP%
echo ========================================
echo.

:: أولاً: رفع الكود الجديد على GitHub (appwep)
echo [1/3] رفع الكود على GitHub (appwep)...
cd /d "c:\Users\princ\Desktop\ma\web-app"
git add -A
git commit -m "update: lulu detail/stream auth fix + session management + direct cloud stream" 2>nul
git push appwep main 2>&1
if %errorlevel% neq 0 (
    git push appwep master 2>&1
)
echo     GitHub: تم
echo.

:: ثانياً: رفع سكريبت التحديث على VPS
echo [2/3] رفع سكريبت التحديث...
scp -o StrictHostKeyChecking=no "c:\Users\princ\Desktop\ma\update_vps_webapp.sh" %VPS_USER%@%VPS_IP%:/root/update_vps_webapp.sh
echo     SCP: تم
echo.

:: ثالثاً: تشغيل التحديث على VPS
echo [3/3] تشغيل التحديث على VPS...
ssh -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "chmod +x /root/update_vps_webapp.sh && bash /root/update_vps_webapp.sh"
echo.
echo ========================================
echo   تم التحديث!
echo ========================================
pause
