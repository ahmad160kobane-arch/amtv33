@echo off
echo ============================================
echo Deploy VidSrc API to Vercel
echo ============================================
echo.

REM Clone the repo
git clone https://github.com/cool-dev-guy/vidsrc-api.git vidsrc-api-deploy
cd vidsrc-api-deploy

REM Install Vercel CLI
npm i -g vercel

REM Deploy
echo.
echo Deploying to Vercel...
vercel deploy --prod

echo.
echo ============================================
echo Done! Copy the URL from above
echo ============================================
pause
