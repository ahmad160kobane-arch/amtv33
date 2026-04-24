@echo off
chcp 65001 >nul
echo ════════════════════════════════════════════════════
echo   الاستعلام عن حلقات المسلسلات
echo ════════════════════════════════════════════════════
echo.
echo الاستخدام:
echo   check_series.bat [series_id]
echo   check_series.bat [series_id] [season]
echo   check_series.bat [series_id] [season] [episode]
echo.
echo أمثلة:
echo   check_series.bat 12345              جميع حلقات المسلسل
echo   check_series.bat 12345 1            حلقات الموسم 1
echo   check_series.bat 12345 1 5          الحلقة 5 من الموسم 1
echo.
echo ════════════════════════════════════════════════════
echo.

cd /d "%~dp0lulu-uploader"
node test-series-query.js %*

pause
