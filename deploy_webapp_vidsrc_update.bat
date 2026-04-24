@echo off
echo ========================================
echo Deploying Web App VidSrc Update
echo ========================================
echo.

echo This will deploy the updated Web App to support:
echo - VidSrc Advanced Resolver
echo - Multiple streaming sources
echo - Better error handling
echo - Improved logging
echo.

echo [1/3] Committing changes to Git...
cd web-app
git add src/constants/api.ts
git commit -m "Update VidSrc API to support Advanced Resolver with multiple sources"
if errorlevel 1 (
    echo No changes to commit or commit failed
)
echo.

echo [2/3] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo ERROR: Failed to push to GitHub
    echo Please check your Git configuration
    cd ..
    pause
    exit /b 1
)
echo OK - Pushed to GitHub
cd ..
echo.

echo [3/3] Railway will auto-deploy in 2-3 minutes...
echo.

echo ========================================
echo Deployment Initiated!
echo ========================================
echo.
echo Changes pushed to GitHub successfully!
echo.
echo Railway will automatically:
echo 1. Detect the changes
echo 2. Build the new version
echo 3. Deploy to production
echo.
echo This usually takes 2-3 minutes.
echo.
echo You can monitor the deployment at:
echo https://railway.app/
echo.
echo What was updated:
echo - requestVidsrcStream() now supports:
echo   * Multiple VidSrc sources (vidsrc.to, vidsrc.xyz, vidsrc.net, vidsrc.pro)
echo   * Direct HLS links extraction
echo   * Better error handling
echo   * Improved logging
echo   * IMDb ID support
echo.
pause
