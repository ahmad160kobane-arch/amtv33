@echo off
echo ========================================
echo   Checking Deployment Status
echo ========================================
echo.

echo [1/3] Checking Railway API...
curl -s https://amtv33-production.up.railway.app/api/health
echo.
echo.

echo [2/3] Checking if new field exists...
echo (This will show 401 if not logged in - that's OK)
curl -s https://amtv33-production.up.railway.app/api/channels?limit=1
echo.
echo.

echo [3/3] Checking Admin Dashboard...
curl -I http://62.171.153.204:3000
echo.

echo ========================================
echo   Deployment Check Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Open Admin Dashboard: http://62.171.153.204:3000
echo 2. Go to Channels
echo 3. Click "+ Manual"
echo 4. You should see "Direct Passthrough" checkbox
echo.
pause
