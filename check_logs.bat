@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   📋 عرض لوجات السيرفر
echo ════════════════════════════════════════════════════
echo.

ssh root@62.171.153.204 "pm2 logs cloud-server --lines 30 --nostream"

pause
