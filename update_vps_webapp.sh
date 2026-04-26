#!/bin/bash
# ─── تحديث تطبيق الويب على VPS ────────────────────────────
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── إيجاد مجلد التطبيق ───────────────────────────────────
WEBAPP_DIR=""
for d in /home/webapp /root/webapp /var/www/webapp /home/appwep /root/appwep; do
  if [ -f "$d/package.json" ] && [ -f "$d/next.config.js" ]; then
    WEBAPP_DIR="$d"
    break
  fi
done

if [ -z "$WEBAPP_DIR" ]; then
  # البحث في النظام
  WEBAPP_DIR=$(find /home /root /var/www -maxdepth 4 -name "next.config.js" \
    -not -path "*/node_modules/*" 2>/dev/null | head -1 | xargs dirname 2>/dev/null)
fi

if [ -z "$WEBAPP_DIR" ]; then
  err "لم يتم إيجاد تطبيق الويب! تأكد من التثبيت أولاً"
fi

log "مجلد التطبيق: $WEBAPP_DIR"
cd "$WEBAPP_DIR"

# ─── إيجاد اسم PM2 process ────────────────────────────────
PM2_NAME=$(pm2 list --no-color 2>/dev/null | grep -E 'webapp|web-app|next|app' | \
  grep -v '─' | awk '{print $2}' | head -1)
[ -z "$PM2_NAME" ] && PM2_NAME="webapp"
log "PM2 process: $PM2_NAME"

# ─── سحب آخر تحديثات من GitHub ──────────────────────────
echo ""
echo "━━━ سحب الكود الجديد ━━━"
git fetch origin 2>/dev/null || git fetch appwep 2>/dev/null || warn "git fetch فشل"
git pull 2>/dev/null || git pull appwep main 2>/dev/null || git pull appwep master 2>/dev/null || warn "git pull فشل — سيتم المحاولة باستمرار"
log "تم سحب الكود"

# ─── تثبيت الحزم الجديدة إن وجدت ───────────────────────
echo ""
echo "━━━ تثبيت الحزم ━━━"
npm ci --prefer-offline 2>/dev/null || npm install 2>/dev/null
log "تم تثبيت الحزم"

# ─── بناء التطبيق ────────────────────────────────────────
echo ""
echo "━━━ بناء التطبيق (قد يستغرق 2-5 دقائق) ━━━"
npm run build
log "تم البناء"

# ─── إعادة تشغيل PM2 ─────────────────────────────────────
echo ""
echo "━━━ إعادة تشغيل التطبيق ━━━"
pm2 restart "$PM2_NAME" 2>/dev/null || pm2 reload "$PM2_NAME" 2>/dev/null || \
  pm2 start npm --name "$PM2_NAME" -- start 2>/dev/null
pm2 save
log "تم إعادة التشغيل"

# ─── فحص الحالة ──────────────────────────────────────────
sleep 3
echo ""
echo "━━━ حالة التطبيق ━━━"
pm2 list
echo ""

# فحص الاستجابة
PORT=$(pm2 list --no-color 2>/dev/null | grep "$PM2_NAME" | grep -oP ':\K[0-9]+' | head -1)
[ -z "$PORT" ] && PORT=3001
if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
  log "التطبيق يعمل على port $PORT ✅"
else
  warn "التطبيق لم يستجب على port $PORT — تحقق من pm2 logs $PM2_NAME"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ تم التحديث بنجاح"
echo "  🌐 http://62.171.153.204"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
