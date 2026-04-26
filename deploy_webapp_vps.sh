#!/bin/bash
# ============================================================
#  deploy_webapp_vps.sh
#  نشر تطبيق الويب (Next.js) على VPS بجانب السيرفر السحابي
#  الاستخدام: bash deploy_webapp_vps.sh
# ============================================================

set -e

# ─── الألوان ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}══════════════════════════════════════${NC}"; echo -e "${CYAN}${BOLD}  $1${NC}"; echo -e "${CYAN}${BOLD}══════════════════════════════════════${NC}"; }

# ─── الإعدادات ─────────────────────────────────────────────
WEBAPP_REPO="https://github.com/ahmad160kobane-arch/appwep.git"
WEBAPP_DIR="/home/webapp"
WEBAPP_PORT=3001
WEBAPP_NAME="webapp"
NODE_VERSION="20"
BACKEND_URL="https://amtv33-production.up.railway.app"
CLOUD_URL="http://localhost:8090"

step "🚀 بدء نشر تطبيق الويب على VPS"
echo ""
info "الريبو  : $WEBAPP_REPO"
info "المجلد  : $WEBAPP_DIR"
info "البورت  : $WEBAPP_PORT"
info "Backend : $BACKEND_URL"
info "Cloud   : $CLOUD_URL"
echo ""

# ─── 1. تحديث النظام ──────────────────────────────────────
step "1. تحديث النظام"
apt-get update -qq && apt-get install -y -qq \
  curl git nginx certbot python3-certbot-nginx \
  build-essential ca-certificates gnupg lsb-release \
  > /dev/null 2>&1
log "تم تثبيت الحزم الأساسية"

# ─── 2. تثبيت Node.js ─────────────────────────────────────
step "2. تثبيت Node.js $NODE_VERSION"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  log "تم تثبيت Node.js $(node -v)"
else
  CURRENT_NODE=$(node -v | cut -d. -f1 | tr -d 'v')
  if [ "$CURRENT_NODE" -lt "$NODE_VERSION" ]; then
    warn "Node.js القديم: $(node -v) — جارٍ التحديث..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
    log "تم تحديث Node.js إلى $(node -v)"
  else
    log "Node.js موجود: $(node -v)"
  fi
fi

# ─── 3. تثبيت PM2 ─────────────────────────────────────────
step "3. تثبيت PM2"
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2 > /dev/null 2>&1
  log "تم تثبيت PM2 $(pm2 -v)"
else
  log "PM2 موجود: $(pm2 -v)"
fi

# ─── 4. استنساخ / تحديث الريبو ────────────────────────────
step "4. استنساخ تطبيق الويب"
if [ -d "$WEBAPP_DIR/.git" ]; then
  info "المجلد موجود — جارٍ التحديث..."
  cd "$WEBAPP_DIR"
  git fetch origin main 2>&1 | tail -3
  git reset --hard origin/main
  log "تم تحديث الكود إلى أحدث إصدار"
else
  info "استنساخ الريبو..."
  git clone "$WEBAPP_REPO" "$WEBAPP_DIR" 2>&1 | tail -3
  log "تم استنساخ الريبو"
fi

cd "$WEBAPP_DIR"

# ─── 5. إنشاء ملف .env.local ──────────────────────────────
step "5. إعداد المتغيرات البيئية"
cat > "$WEBAPP_DIR/.env.local" << EOF
# تطبيق الويب — إعدادات الـ VPS
NODE_ENV=production
PORT=$WEBAPP_PORT

# Backend API (Railway)
NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL

# Cloud Server (VPS local — أسرع بدون شبكة خارجية)
NEXT_PUBLIC_CLOUD_URL=$CLOUD_URL
EOF
log "تم إنشاء .env.local"

# ─── 6. تعديل next.config.js لاستخدام localhost للـ cloud ──
step "6. تحديث next.config.js للـ VPS"
cat > "$WEBAPP_DIR/next.config.js" << 'NEXTCONFIG'
/** @type {import('next').NextConfig} */
// VPS deployment — cloud server runs locally on port 8090
const BACKEND_URL = 'https://amtv33-production.up.railway.app';
const CLOUD_URL   = 'http://localhost:8090';

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()', 'microphone=()', 'payment=()',
      'usb=()', 'autoplay=*', 'fullscreen=*',
    ].join(', '),
  },
];

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'img.lulucdn.com' },
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: { proxyTimeout: 120000 },
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      {
        source: '/proxy/live/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/free-hls/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/vod-play/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Expose-Headers', value: 'Content-Range, Content-Length, Accept-Ranges' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/api/vidsrc/:path*',  destination: `${CLOUD_URL}/api/vidsrc/:path*`  },
      { source: '/api/stream/:path*',  destination: `${CLOUD_URL}/api/stream/:path*`  },
      { source: '/api/xtream/:path*',  destination: `${CLOUD_URL}/api/xtream/:path*`  },
      { source: '/api/embed-proxy',    destination: `${CLOUD_URL}/api/embed-proxy`    },
      { source: '/proxy/live/:path*',  destination: `${CLOUD_URL}/proxy/live/:path*`  },
      { source: '/free-hls/:path*',    destination: `${CLOUD_URL}/free-hls/:path*`    },
      { source: '/xtream-play/:path*', destination: `${CLOUD_URL}/xtream-play/:path*` },
      { source: '/xtream-pipe/:path*', destination: `${CLOUD_URL}/xtream-pipe/:path*` },
      { source: '/hls/:path*',         destination: `${CLOUD_URL}/hls/:path*`         },
      { source: '/vod-play/:path*',    destination: `${CLOUD_URL}/vod-play/:path*`    },
      { source: '/api/:path*',         destination: `${BACKEND_URL}/api/:path*`       },
    ];
  },
};

module.exports = nextConfig;
NEXTCONFIG
log "تم تحديث next.config.js"

# ─── 7. تثبيت الحزم وبناء التطبيق ────────────────────────
step "7. تثبيت الحزم"
cd "$WEBAPP_DIR"
npm ci --prefer-offline 2>&1 | tail -5
log "تم تثبيت الحزم"

step "8. بناء تطبيق Next.js"
info "البناء قد يستغرق 2-5 دقائق..."
npm run build 2>&1 | tail -20
log "تم بناء التطبيق بنجاح"

# ─── 9. إعداد PM2 ─────────────────────────────────────────
step "9. إعداد PM2 لتشغيل التطبيق"
cat > "$WEBAPP_DIR/ecosystem.webapp.config.js" << EOF
module.exports = {
  apps: [{
    name: '$WEBAPP_NAME',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '$WEBAPP_DIR',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: $WEBAPP_PORT,
    },
    error_file: '/var/log/webapp-error.log',
    out_file: '/var/log/webapp-output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }],
};
EOF

# إيقاف النسخة القديمة إن وجدت
pm2 stop "$WEBAPP_NAME" 2>/dev/null || true
pm2 delete "$WEBAPP_NAME" 2>/dev/null || true

# تشغيل النسخة الجديدة
pm2 start "$WEBAPP_DIR/ecosystem.webapp.config.js"
pm2 save

log "تم تشغيل التطبيق على البورت $WEBAPP_PORT"

# ─── 10. إعداد Nginx ───────────────────────────────────────
step "10. إعداد Nginx كـ Reverse Proxy"

# احذف الإعداد القديم إن وجد
rm -f /etc/nginx/sites-enabled/webapp
rm -f /etc/nginx/sites-available/webapp

VPS_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "62.171.153.204")

cat > /etc/nginx/sites-available/webapp << EOF
# ─── تطبيق الويب — Nginx Reverse Proxy ───────────────────
server {
    listen 80;
    listen [::]:80;
    server_name $VPS_IP _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               application/vnd.apple.mpegurl video/MP2T;

    # Timeouts للبث
    proxy_connect_timeout       120s;
    proxy_send_timeout          120s;
    proxy_read_timeout          120s;

    # ─── Next.js App ─────────────────────────────────────
    location / {
        proxy_pass         http://127.0.0.1:$WEBAPP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://127.0.0.1:$WEBAPP_PORT;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ─── HLS Streaming (no buffering) ────────────────────
    location ~* \.(m3u8|ts)$ {
        proxy_pass         http://127.0.0.1:$WEBAPP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_buffering    off;
        proxy_cache        off;
        add_header         Cache-Control "no-cache, no-store";
        add_header         Access-Control-Allow-Origin "*";
    }

    # ─── Cloud Server API (direct passthrough) ───────────
    location /api/cloud/ {
        proxy_pass         http://127.0.0.1:8090/;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
    }

    # ─── Health Check ─────────────────────────────────────
    location /health {
        return 200 'webapp-ok';
        add_header Content-Type text/plain;
    }

    # Logs
    access_log /var/log/nginx/webapp-access.log;
    error_log  /var/log/nginx/webapp-error.log;
}
EOF

ln -sf /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/webapp

# حذف الإعداد الافتراضي إن كان يتعارض
if [ -f /etc/nginx/sites-enabled/default ]; then
  warn "حذف إعداد Nginx الافتراضي لتجنب التعارض على البورت 80"
  rm -f /etc/nginx/sites-enabled/default
fi

# فحص إعداد Nginx
nginx -t
systemctl reload nginx
log "تم إعداد Nginx وإعادة تشغيله"

# ─── 11. إعداد PM2 للإقلاع التلقائي ──────────────────────
step "11. إعداد الإقلاع التلقائي"
pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || true
pm2 save
log "تم إعداد الإقلاع التلقائي"

# ─── 12. فتح البورت في الجدار الناري ─────────────────────
step "12. إعداد الجدار الناري"
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp 2>/dev/null || true
  ufw allow 443/tcp 2>/dev/null || true
  ufw allow "$WEBAPP_PORT/tcp" 2>/dev/null || true
  log "تم فتح البورتات 80, 443, $WEBAPP_PORT"
fi

# ─── 13. فحص التشغيل ──────────────────────────────────────
step "13. فحص التشغيل"
sleep 3

if curl -sf "http://localhost:$WEBAPP_PORT" > /dev/null 2>&1; then
  log "التطبيق يعمل على البورت $WEBAPP_PORT ✓"
else
  warn "التطبيق لم يستجب بعد — قد يحتاج لبضع ثوانٍ للإقلاع"
fi

if curl -sf "http://localhost" > /dev/null 2>&1; then
  log "Nginx يعيد التوجيه بشكل صحيح على البورت 80 ✓"
fi

# ─── 14. سكريبت التحديث ───────────────────────────────────
step "14. إنشاء سكريبت التحديث السريع"
cat > /usr/local/bin/update-webapp << 'UPDATESCRIPT'
#!/bin/bash
# تحديث تطبيق الويب بسرعة
set -e
echo "🔄 تحديث تطبيق الويب..."
cd /home/webapp
git pull origin main
npm ci --prefer-offline
npm run build
pm2 restart webapp
echo "✅ تم التحديث بنجاح!"
pm2 status webapp
UPDATESCRIPT
chmod +x /usr/local/bin/update-webapp
log "سكريبت التحديث: /usr/local/bin/update-webapp"

# ─── ملخص نهائي ───────────────────────────────────────────
VPS_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "62.171.153.204")

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║        ✅ تم النشر بنجاح!                   ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║${NC}  🌐 رابط التطبيق : http://$VPS_IP"
echo -e "${GREEN}${BOLD}║${NC}  ⚡ البورت المباشر: http://$VPS_IP:$WEBAPP_PORT"
echo -e "${GREEN}${BOLD}║${NC}  📁 مجلد التطبيق : $WEBAPP_DIR"
echo -e "${GREEN}${BOLD}║${NC}  🔄 تحديث التطبيق: update-webapp"
echo -e "${GREEN}${BOLD}║${NC}  📊 مراقبة PM2   : pm2 monit"
echo -e "${GREEN}${BOLD}║${NC}  📋 سجلات الأخطاء: pm2 logs webapp"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 السيرفر السحابي لا يزال يعمل على: http://$VPS_IP:8090${NC}"
echo -e "${YELLOW}💡 لأضافة SSL: certbot --nginx -d your-domain.com${NC}"
echo ""

pm2 status
