#!/bin/bash
# === MA Cloud Server Auto-Deploy ===
# Run: curl -sL https://raw.githubusercontent.com/ahmad160kobane-arch/amtv33/cloud-server/auto-deploy.sh | bash
set -e

echo "========================================="
echo "  MA Cloud Server - Auto Deploy"
echo "========================================="

# 1. Enable SSH + Open Firewall
echo "[1/8] Enabling SSH & Firewall..."
systemctl enable --now sshd 2>/dev/null || systemctl enable --now ssh 2>/dev/null || true
iptables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 8090 -j ACCEPT 2>/dev/null || true
iptables-save > /etc/iptables.rules 2>/dev/null || true

# 2. Install Node.js 20
echo "[2/8] Installing Node.js 20..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)"

# 3. Install system deps
echo "[3/8] Installing FFmpeg, Chromium deps..."
apt-get update -qq
apt-get install -y ffmpeg git \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libxshmfence1 2>/dev/null || true

# 4. Install PM2
echo "[4/8] Installing PM2..."
npm install -g pm2 2>/dev/null || true

# 5. Clone cloud-server
echo "[5/8] Cloning cloud-server..."
cd /home
if [ -d "cloud-server" ]; then
  cd cloud-server
  git fetch origin cloud-server
  git reset --hard origin/cloud-server
else
  git clone -b cloud-server https://github.com/ahmad160kobane-arch/amtv33.git cloud-server
  cd cloud-server
fi

# 6. Create .env
echo "[6/8] Creating .env..."
cat > .env << 'ENVEOF'
PORT=8090
NODE_ENV=production
BACKEND_URL=https://amtv33-production.up.railway.app
DB_PATH=./data/cloud.db
JWT_SECRET=ma-streaming-secret-key-change-in-production
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
ENVEOF

mkdir -p data

# 7. Install npm deps
echo "[7/8] Installing npm packages..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# 8. Start with PM2
echo "[8/8] Starting with PM2..."
pm2 delete cloud-server 2>/dev/null || true
pm2 start ecosystem.config.js --env production 2>/dev/null || pm2 start server.js --name cloud-server
pm2 save
pm2 startup 2>/dev/null || true

sleep 3
echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
pm2 status
echo ""
echo "Testing health..."
curl -s http://localhost:8090/health 2>/dev/null || echo "(waiting for startup...)"
echo ""
echo "Done! Cloud server running on port 8090"
