#!/bin/bash
# ═══════════════════════════════════════════════════════
# سكريبت تثبيت سيرفر البث السحابي v3 على Contabo VPS
# Node.js + FFmpeg + PM2 + Nginx Reverse Proxy
# ═══════════════════════════════════════════════════════

set -e

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   تثبيت سيرفر البث السحابي v3                    ║"
echo "  ║   FFmpeg + HLS + Xtream + PM2 + Nginx            ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

# ─── إعدادات ──────────────────────────────────────────
read -p "  مسار قاعدة البيانات [../backend-api/data/ma_streaming.db]: " DB_PATH
DB_PATH=${DB_PATH:-../backend-api/data/ma_streaming.db}

read -p "  JWT Secret (نفس الباك اند) [ma-streaming-secret-key]: " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-ma-streaming-secret-key}

read -p "  الدومين (اتركه فارغاً لـ IP فقط): " DOMAIN

read -p "  البورت [8090]: " PORT
PORT=${PORT:-8090}

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── [1/6] تحديث النظام ──────────────────────────────
echo ""
echo "[1/6] تحديث النظام..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ─── [2/6] تثبيت Node.js 20 ──────────────────────────
echo "[2/6] تثبيت Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "  Node.js $(node -v) ✓"

# ─── [3/6] تثبيت FFmpeg + Puppeteer deps ─────────────
echo "[3/6] تثبيت FFmpeg + مكتبات Chromium..."
sudo apt-get install -y ffmpeg \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils wget gnupg2
echo "  FFmpeg ✓"

# ─── [4/6] تثبيت PM2 ─────────────────────────────────
echo "[4/6] تثبيت PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
echo "  PM2 $(pm2 -v) ✓"

# ─── [5/6] تثبيت الحزم ───────────────────────────────
echo "[5/6] تثبيت حزم Node.js..."
cd "$INSTALL_DIR"
npm install --production

# إنشاء مجلدات مطلوبة
mkdir -p hls vod-cache logs

# ─── إنشاء .env ──────────────────────────────────────
cat > "$INSTALL_DIR/.env" <<EOF
PORT=$PORT
NODE_ENV=production
DB_PATH=$DB_PATH
JWT_SECRET=$JWT_SECRET
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
EOF
echo "  .env ✓"

# ─── [6/6] تشغيل PM2 ─────────────────────────────────
echo "[6/6] تشغيل السيرفر بـ PM2..."
cd "$INSTALL_DIR"

# تحميل متغيرات البيئة
set -a; source .env; set +a

pm2 delete cloud-server 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $(whoami) --hp $HOME 2>/dev/null || true

# ─── Nginx Reverse Proxy (اختياري) ───────────────────
if [ -n "$DOMAIN" ]; then
    echo ""
    echo "  إعداد Nginx لـ $DOMAIN..."
    sudo apt-get install -y nginx certbot python3-certbot-nginx

    sudo tee /etc/nginx/sites-available/cloud-server > /dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    # WebSocket + Streaming headers
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # Streaming performance
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
    }

    # HLS segments cache
    location ~* \.(m3u8|ts)$ {
        proxy_pass http://127.0.0.1:$PORT;
        add_header Cache-Control "no-cache";
        add_header Access-Control-Allow-Origin *;
    }
}
NGINX

    sudo ln -sf /etc/nginx/sites-available/cloud-server /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl restart nginx

    # SSL
    echo "  طلب شهادة SSL..."
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || echo "  ⚠ SSL فشل — أعد المحاولة: sudo certbot --nginx -d $DOMAIN"
fi

# ─── ملخص ─────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║       ✅ تم التثبيت بنجاح!                       ║"
echo "  ╠══════════════════════════════════════════════════╣"
if [ -n "$DOMAIN" ]; then
echo "  ║  URL:      https://$DOMAIN"
else
echo "  ║  URL:      http://$SERVER_IP:$PORT"
fi
echo "  ║  Health:   /health"
echo "  ║  DB:       $DB_PATH"
echo "  ╠══════════════════════════════════════════════════╣"
echo "  ║  أوامر PM2:                                      ║"
echo "  ║    pm2 logs cloud-server                         ║"
echo "  ║    pm2 restart cloud-server                      ║"
echo "  ║    pm2 monit                                     ║"
echo "  ║    pm2 status                                    ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""
