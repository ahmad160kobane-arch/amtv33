@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   🔍 اختبار Backend API - القنوات
echo ════════════════════════════════════════════════════
echo.

echo 1️⃣ اختبار Health Check...
curl -s https://amtv33-production.up.railway.app/api/health
echo.
echo.

echo 2️⃣ اختبار قائمة القنوات...
curl -s https://amtv33-production.up.railway.app/api/channels | jq ".channels[] | {id, name, group_name, is_enabled, is_direct_passthrough}"
echo.
echo.

echo 3️⃣ عدد القنوات...
curl -s https://amtv33-production.up.railway.app/api/channels | jq ".total"
echo.
echo.

echo ════════════════════════════════════════════════════
echo   ✅ تم!
echo ════════════════════════════════════════════════════
pause
