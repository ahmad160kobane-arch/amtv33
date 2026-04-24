#!/bin/bash
# إصلاح التعريف المكرر لـ _luluCatalog

cd /root/ma-streaming/cloud-server

# البحث عن السطر المكرر
echo "🔍 البحث عن التعريف المكرر..."
grep -n "let _luluCatalog" server.js

# حذف التعريف المكرر في السطر 2092 (إذا وجد)
echo "🔧 إصلاح الملف..."
sed -i '2092s/let _luluCatalog = \[\];/\/\/ Removed duplicate declaration/' server.js

echo "✅ تم الإصلاح!"
echo ""
echo "📋 التحقق من الإصلاح..."
grep -n "_luluCatalog = \[\]" server.js | head -5

echo ""
echo "🔄 إعادة تشغيل السيرفر..."
pm2 restart cloud-server

echo ""
echo "⏳ انتظار 3 ثواني..."
sleep 3

echo ""
echo "📊 عرض اللوجات..."
pm2 logs cloud-server --lines 20 --nostream
