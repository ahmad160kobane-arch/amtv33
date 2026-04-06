#!/bin/bash
# إعداد IPTV → LuluStream Sync على VPS

set -e
echo "═══ تثبيت متطلبات IPTV→LuluStream Sync ═══"

# تثبيت ffmpeg إذا غير موجود
if ! command -v ffmpeg &>/dev/null; then
  echo "► تثبيت ffmpeg..."
  apt-get update -q && apt-get install -y ffmpeg
fi

# تثبيت Node.js إذا غير موجود
if ! command -v node &>/dev/null; then
  echo "► تثبيت Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# إنشاء مجلد العمل
mkdir -p /root/iptv-to-lulu
cd /root/iptv-to-lulu

# نسخ الملفات
cp /tmp/sync.js /root/iptv-to-lulu/sync.js

# إنشاء package.json
cat > /root/iptv-to-lulu/package.json <<'EOF'
{
  "name": "iptv-to-lulu",
  "version": "1.0.0",
  "description": "IPTV VOD to LuluStream auto-sync",
  "main": "sync.js",
  "scripts": {
    "start": "node sync.js",
    "status": "node status.js"
  }
}
EOF

# إنشاء PM2 ecosystem
cat > /root/iptv-to-lulu/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'iptv-lulu-sync',
    script: '/root/iptv-to-lulu/sync.js',
    autorestart: false,
    watch: false,
    env: {
      LULU_KEY: process.env.LULU_KEY || '',
      MAX_TMP_GB: '4',
      DELAY_MS: '3000',
      USE_FFMPEG: '1',
    }
  }]
};
EOF

echo ""
echo "═══ الإعداد اكتمل ═══"
echo ""
echo "للبدء:"
echo "  LULU_KEY=xxxxxxxxx node /root/iptv-to-lulu/sync.js"
echo ""
echo "أو مع PM2:"
echo "  LULU_KEY=xxxxxxxxx pm2 start /root/iptv-to-lulu/ecosystem.config.js"
echo "  pm2 logs iptv-lulu-sync"
