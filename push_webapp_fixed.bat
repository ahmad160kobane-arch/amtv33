@echo off
chcp 65001 >nul
echo ========================================
echo Push Web-App Updates to Railway
echo ========================================
echo.

REM Create temp directory
echo [1/8] Creating temp directory...
if exist temp_webapp rmdir /s /q temp_webapp
mkdir temp_webapp
cd temp_webapp

REM Clone web-app repository
echo [2/8] Cloning web-app repository...
git clone https://github.com/ahmad160kobane-arch/appwep.git .
if errorlevel 1 (
    echo ERROR: Failed to clone repository
    cd ..
    pause
    exit /b 1
)

REM Configure git
echo [3/8] Configuring git...
git config user.email "ahmad160kobane@gmail.com"
git config user.name "Ahmad Kobane"

REM Copy updated files
echo [4/8] Copying updated files...
xcopy /Y /E /I ..\web-app\src src >nul
xcopy /Y ..\web-app\package.json . >nul 2>&1
xcopy /Y ..\web-app\tsconfig.json . >nul 2>&1
xcopy /Y ..\web-app\next.config.js . >nul 2>&1
xcopy /Y ..\web-app\tailwind.config.ts . >nul 2>&1
xcopy /Y ..\web-app\postcss.config.js . >nul 2>&1

REM Check git status
echo [5/8] Checking changes...
git status --short

REM Add changes
echo [6/8] Adding changes...
git add .

REM Commit
echo [7/8] Creating commit...
git commit -m "fix: HLS streaming with debug logs and direct VPS connection"

REM Push
echo [8/8] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo Trying master branch...
    git push origin master
)

if errorlevel 1 (
    echo.
    echo ERROR: Failed to push
    cd ..
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Railway will deploy in 2-3 min
echo ========================================
echo.

cd ..

REM Cleanup
echo Cleaning up temp directory...
rmdir /s /q temp_webapp

pause
