@echo off
echo ========================================
echo Pushing VidSrc Update to GitHub
echo ========================================
echo.
echo Repository: https://github.com/ahmad160kobane-arch/appwep.git
echo.

echo [1/4] Adding updated api.ts file...
git add web-app/src/constants/api.ts
if errorlevel 1 (
    echo ERROR: Failed to add file
    pause
    exit /b 1
)
echo OK
echo.

echo [2/4] Committing changes...
git commit -m "Update VidSrc API to support Advanced Resolver with multiple sources - Support IMDb IDs - Extract direct HLS links - Multiple fallback sources - Better error handling and logging"
if errorlevel 1 (
    echo No changes to commit or commit failed
    echo This might be OK if already committed
)
echo.

echo [3/4] Pushing to GitHub (appwep repository)...
git push https://github.com/ahmad160kobane-arch/appwep.git main
if errorlevel 1 (
    echo ERROR: Failed to push to GitHub
    echo.
    echo Possible reasons:
    echo - Authentication required
    echo - Network issue
    echo - Branch name mismatch
    echo.
    echo Try manual push:
    echo git push origin main
    pause
    exit /b 1
)
echo OK - Pushed to GitHub
echo.

echo [4/4] Waiting for Railway auto-deploy...
echo.

echo ========================================
echo Push Complete!
echo ========================================
echo.
echo Changes pushed to:
echo https://github.com/ahmad160kobane-arch/appwep.git
echo.
echo Railway will automatically:
echo 1. Detect the changes (30 seconds)
echo 2. Build the new version (1-2 minutes)
echo 3. Deploy to production (30 seconds)
echo.
echo Total time: ~2-3 minutes
echo.
echo You can monitor deployment at:
echo https://railway.app/
echo.
echo What was updated:
echo ✅ requestVidsrcStream() now supports:
echo    - Multiple VidSrc sources (vidsrc.to, xyz, net, pro)
echo    - Direct HLS links extraction
echo    - IMDb ID support
echo    - Better error handling
echo    - Improved logging
echo.
echo ✅ Cloud Server already updated and running
echo ✅ Web App will be live in 2-3 minutes
echo.
pause
