# أوامر للتنفيذ على VPS

## 1. التحقق من حالة السيرفر
```bash
pm2 status
pm2 logs cloud-server --lines 50
```

## 2. التحقق من الملفات
```bash
# التحقق من وجود الملف الجديد
ls -la /root/ma-streaming/amtv33/cloud-server/lib/vidsrc-api-client.js

# التحقق من .env
cat /root/ma-streaming/amtv33/cloud-server/.env | head -5
```

## 3. نسخ الملفات المهمة
```bash
# نسخ .env
cp /root/ma-streaming/cloud-server/.env /root/ma-streaming/amtv33/cloud-server/.env

# نسخ قاعدة البيانات
cp -r /root/ma-streaming/cloud-server/data /root/ma-streaming/amtv33/cloud-server/

# نسخ HLS
cp -r /root/ma-streaming/cloud-server/hls /root/ma-streaming/amtv33/cloud-server/
```

## 4. استبدال المجلدات
```bash
# إيقاف السيرفر
pm2 stop cloud-server

# نسخ احتياطي
mv /root/ma-streaming/cloud-server /root/ma-streaming/cloud-server-backup

# نقل الجديد
mv /root/ma-streaming/amtv33/cloud-server /root/ma-streaming/cloud-server

# تحديث PM2
cd /root/ma-streaming/cloud-server
pm2 delete cloud-server
pm2 start server.js --name cloud-server

# التحقق
pm2 status
pm2 logs cloud-server --lines 30
```

## 5. اختبار API الجديد
```bash
# اختبار بدون token (سيفشل لكن يظهر إذا كان endpoint موجود)
curl -X POST http://localhost:8090/api/stream/vidsrc-full \
  -H "Content-Type: application/json" \
  -d '{"tmdbId":"1159559","type":"movie"}'

# يجب أن يرجع: {"error":"Unauthorized"} أو شيء مشابه
# إذا رجع 404 = endpoint غير موجود
```

## 6. إذا كانت هناك مشاكل
```bash
# عرض الأخطاء
pm2 logs cloud-server --err --lines 50

# إعادة تشغيل
pm2 restart cloud-server

# إعادة تحميل
pm2 reload cloud-server
```

## 7. العودة للنسخة القديمة (إذا لزم الأمر)
```bash
pm2 stop cloud-server
rm -rf /root/ma-streaming/cloud-server
mv /root/ma-streaming/cloud-server-backup /root/ma-streaming/cloud-server
pm2 restart cloud-server
```
