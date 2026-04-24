@echo off
echo ========================================
echo إجبار Railway على النشر
echo ========================================
echo.

echo 1. التحقق من حالة Git...
git status
echo.

echo 2. إنشاء commit فارغ لإجبار النشر...
git commit --allow-empty -m "chore: force Railway redeploy with HLS debug logs"
echo.

echo 3. دفع التحديثات...
git push origin master
echo.

echo ========================================
echo تم! Railway سينشر الآن خلال 2-3 دقائق
echo ========================================
echo.
echo إذا لم ينشر Railway تلقائياً:
echo 1. اذهب إلى لوحة Railway
echo 2. اختر مشروع web-app
echo 3. اضغط "Deploy" يدوياً
echo.
pause
