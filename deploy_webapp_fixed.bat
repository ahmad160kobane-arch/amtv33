@echo off
chcp 65001 >nul
echo ========================================
echo رفع web-app المصحح
echo ========================================

if exist temp_webapp_clean rmdir /s /q temp_webapp_clean
mkdir temp_webapp_clean
cd temp_webapp_clean

git init
git config user.email "ahmad160kobane@gmail.com"
git config user.name "Ahmad Kobane"

xcopy /Y /E /I ..\web-app\* . >nul

git add .
git commit -m "Fix TypeScript errors and add genre sections"

git remote add origin https://github.com/ahmad160kobane-arch/appwep.git
git push -f origin master:main

cd ..
rmdir /s /q temp_webapp_clean

echo ========================================
echo تم! Railway سينشر خلال 2-3 دقائق
echo ========================================
pause
