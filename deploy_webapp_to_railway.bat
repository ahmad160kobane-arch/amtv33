@echo off
echo ========================================
echo نشر تطبيق الويب إلى Railway
echo ========================================
echo.

echo الخطوة 1: إنشاء مجلد مؤقت...
if exist temp_webapp rmdir /s /q temp_webapp
mkdir temp_webapp
cd temp_webapp

echo.
echo الخطوة 2: استنساخ repository تطبيق الويب...
git clone https://github.com/ahmad160kobane-arch/appwep.git .
if errorlevel 1 (
    echo ❌ فشل استنساخ repository
    cd ..
    pause
    exit /b 1
)

echo.
echo الخطوة 3: نسخ الملفات المحدثة...
xcopy /Y /E /I ..\web-app\src src
xcopy /Y ..\web-app\package.json .
xcopy /Y ..\web-app\tsconfig.json .
xcopy /Y ..\web-app\next.config.js .
xcopy /Y ..\web-app\tailwind.config.ts .
xcopy /Y ..\web-app\postcss.config.js .

echo.
echo الخطوة 4: إضافة التغييرات...
git add .

echo.
echo الخطوة 5: إنشاء commit...
git commit -m "fix: HLS streaming with debug logs and direct VPS connection"

echo.
echo الخطوة 6: دفع التحديثات...
git push origin master

echo.
cd ..
echo.
echo ========================================
echo ✅ تم! Railway سينشر التحديثات خلال 2-3 دقائق
echo ========================================
echo.
pause
