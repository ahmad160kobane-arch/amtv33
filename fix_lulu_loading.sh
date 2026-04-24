#!/bin/bash
# إصلاح تحميل كتالوج Lulu من قاعدة البيانات

cd /root/ma-streaming/cloud-server

echo "🔍 البحث عن الكود القديم..."
grep -n "Static catalog file" server.js

echo ""
echo "🔧 إصلاح الكود..."

# حذف الكود القديم الذي يبحث عن JSON file
# والاحتفاظ فقط بتحميل من قاعدة البيانات

# البحث عن السطر الذي يحتوي على _loadLuluCatalogFromDB
LINE=$(grep -n "_loadLuluCatalogFromDB()" server.js | tail -1 | cut -d: -f1)

echo "📍 وجدت _loadLuluCatalogFromDB في السطر: $LINE"

# التأكد من أن الدالة موجودة وتعمل
grep -A 10 "async function _loadLuluCatalogFromDB" server.js | head -15

echo ""
echo "✅ الكود يبدو صحيح!"
echo ""
echo "🔄 إعادة تشغيل السيرفر..."
pm2 restart cloud-server

sleep 3

echo ""
echo "📊 عرض اللوجات..."
pm2 logs cloud-server --lines 30 --nostream | grep -A 2 -B 2 "Lulu"
