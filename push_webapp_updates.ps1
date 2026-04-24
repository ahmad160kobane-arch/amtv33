# نشر تحديثات تطبيق الويب إلى Railway
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "نشر تطبيق الويب إلى Railway" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# التحقق من وجود مجلد web-app
if (-not (Test-Path "web-app")) {
    Write-Host "❌ مجلد web-app غير موجود!" -ForegroundColor Red
    pause
    exit 1
}

# إنشاء مجلد مؤقت
Write-Host "📁 إنشاء مجلد مؤقت..." -ForegroundColor Yellow
if (Test-Path "temp_webapp") {
    Remove-Item -Recurse -Force temp_webapp
}
New-Item -ItemType Directory -Path temp_webapp | Out-Null
Set-Location temp_webapp

# استنساخ repository
Write-Host "📥 استنساخ repository تطبيق الويب..." -ForegroundColor Yellow
git clone https://github.com/ahmad160kobane-arch/appwep.git .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل استنساخ repository" -ForegroundColor Red
    Set-Location ..
    pause
    exit 1
}

# نسخ الملفات المحدثة
Write-Host "📋 نسخ الملفات المحدثة..." -ForegroundColor Yellow

# نسخ src
if (Test-Path "..\web-app\src") {
    Copy-Item -Path "..\web-app\src\*" -Destination "src\" -Recurse -Force
}

# نسخ ملفات التكوين
$configFiles = @(
    "package.json",
    "tsconfig.json", 
    "next.config.js",
    "tailwind.config.ts",
    "postcss.config.js"
)

foreach ($file in $configFiles) {
    if (Test-Path "..\web-app\$file") {
        Copy-Item -Path "..\web-app\$file" -Destination "." -Force
        Write-Host "  ✓ $file" -ForegroundColor Green
    }
}

# إضافة التغييرات
Write-Host ""
Write-Host "➕ إضافة التغييرات..." -ForegroundColor Yellow
git add .

# إنشاء commit
Write-Host "💾 إنشاء commit..." -ForegroundColor Yellow
git commit -m "fix: HLS streaming with debug logs and direct VPS connection

- Add detailed console logging for debugging
- Fix streamUrl conversion to full VPS URL
- Enable HLS.js debug mode
- Improve error handling and reporting"

# دفع التحديثات
Write-Host "🚀 دفع التحديثات إلى GitHub..." -ForegroundColor Yellow
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ تم بنجاح!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Railway سينشر التحديثات خلال 2-3 دقائق" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ فشل دفع التحديثات" -ForegroundColor Red
}

# العودة للمجلد الأصلي
Set-Location ..

Write-Host ""
pause
