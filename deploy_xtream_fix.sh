#!/bin/bash
echo "========================================="
echo "نشر إصلاح Xtream Proxy إلى VPS"
echo "========================================="
echo ""

# رفع الملف المحدث
echo "1. رفع xtream-proxy.js المحدث..."
scp cloud-server/lib/xtream-proxy.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/

# إعادة تشغيل السيرفر
echo ""
echo "2. إعادة تشغيل cloud-server..."
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && pm2 restart cloud-server"

echo ""
echo "3. عرض الـ logs..."
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 20 --nostream"

echo ""
echo "========================================="
echo "تم! السيرفر يعمل الآن بإعدادات محسّنة"
echo "========================================="
