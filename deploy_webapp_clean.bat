@echo off
chcp 65001 >nul
echo ========================================
echo رفع محتوى web-app فقط إلى GitHub
echo ========================================
echo.

REM Create temp directory
echo [1/6] Creating temp directory...
if exist temp_webapp_clean rmdir /s /q temp_webapp_clean
mkdir temp_webapp_clean
cd temp_webapp_clean

REM Initialize new git repo
echo [2/6] Initializing new repository...
git init
git config user.email "ahmad160kobane@gmail.com"
git config user.name "Ahmad Kobane"

REM Copy web-app contents only
echo [3/6] Copying web-app contents...
xcopy /Y /E /I ..\web-app\* . >nul

REM Add all files
echo [4/6] Adding files...
git add .

REM Create commit
echo [5/6] Creating commit...
git commit -m "Web app deployment - محتوى تطبيق الويب فقط"

REM Add remote and force push
echo [6/6] Pushing to GitHub (force)...
git remote add origin https://github.com/ahmad160kobane-arch/appwep.git
git push -f origin master:main

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
echo Cleaning up...
rmdir /s /q temp_webapp_clean

pause
