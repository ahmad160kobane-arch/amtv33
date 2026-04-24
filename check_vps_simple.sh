#!/bin/bash
# نفذ هذا على VPS مباشرة

echo "============================================"
echo "فحص حالة السيرفر"
echo "============================================"

echo ""
echo "[1] حالة PM2:"
pm2 status

echo ""
echo "[2] لوجات cloud-server (آخر 50 سطر):"
pm2 logs cloud-server --lines 50 --nostream

echo ""
echo "[3] فحص الملفات المهمة:"
ls -la /root/ma-streaming/cloud-server/.env
ls -la /root/ma-streaming/cloud-server/data/
ls -la /root/ma-streaming/cloud-server/lib/vidsrc-api-client.js

echo ""
echo "[4] اختبار API:"
curl -X POST http://localhost:8090/api/stream/vidsrc-full \
  -H "Content-Type: application/json" \
  -d '{"tmdbId":"1159559","type":"movie"}' | jq

echo ""
echo "============================================"
