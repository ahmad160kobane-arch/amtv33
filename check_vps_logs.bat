@echo off
chcp 65001 >nul
echo ============================================
echo فحص لوجات VPS
echo ============================================
echo.

echo [1] حالة PM2:
ssh root@62.171.153.204 "pm2 status"

echo.
echo [2] لوجات cloud-server (آخر 100 سطر):
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 100 --nostream"

echo.
echo [3] لوجات الأخطاء:
ssh root@62.171.153.204 "pm2 logs cloud-server --err --lines 50 --nostream"

echo.
echo ============================================
pause
