@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   عرض جميع المسلسلات في الكتالوج
echo ════════════════════════════════════════════════════
echo.

cd /d "%~dp0lulu-uploader"
node list-series.js

pause
