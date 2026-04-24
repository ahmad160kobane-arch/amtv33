#!/bin/bash
# رفع تحديثات VidSrc Full على VPS

echo "============================================"
echo "Uploading VidSrc Full updates to VPS"
echo "============================================"

# الاتصال بـ VPS وتحديث الكود
ssh root@62.171.153.204 << 'EOF'
cd /root/ma-streaming/cloud-server

echo "1. Pulling latest changes..."
git pull origin master

echo ""
echo "2. Installing dependencies..."
npm install

echo ""
echo "3. Restarting cloud-server..."
pm2 restart cloud-server

echo ""
echo "4. Checking status..."
pm2 status

echo ""
echo "============================================"
echo "✓ Upload completed!"
echo "============================================"
EOF

echo ""
echo "Done! Check VPS logs with: ssh root@62.171.153.204 'pm2 logs cloud-server'"
