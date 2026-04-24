@echo off
chcp 65001 >nul
echo ========================================
echo رفع تحديثات web-app إلى GitHub
echo ========================================
echo.

REM Create temp directory
echo [1/6] Creating temp directory...
if exist temp_deploy rmdir /s /q temp_deploy
mkdir temp_deploy

REM Initialize new git repo
echo [2/6] Initializing new repository...
cd temp_deploy
git init
git config user.email "ahmad160kobane@gmail.com"
git config user.name "Ahmad Kobane"

REM Copy web-app contents
echo [3/6] Copying web-app contents...
xcopy /E /I /Y ..\web-app\* .

REM Add all files
echo [4/6] Adding files...
git add -A

REM Create commit
echo [5/6] Creating commit...
git commit -m "Fix logo, mylist page, channel logos visibility, and add auth prompt component"

REM Add remote and force push
echo [6/6] Pushing to GitHub (force)...
git remote add origin https://github.com/ahmad160kobane-arch/appwep.git
git push -f origin master:main

cd ..

if errorlevel 1 (
    echo.
    echo ERROR: Failed to push
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Railway will deploy in 2-3 min
echo ========================================
echo.

REM Cleanup
echo Cleaning up...
rmdir /s /q temp_deploy

pause
