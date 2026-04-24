# 🎯 دليل استخدام القنوات العراقية المجانية

## 📁 الملفات المتوفرة

1. **`iraqi_channels.m3u`** - ملف M3U قياسي (25 قناة)
2. **`قنوات_عراقية_مجانية_IPTV.txt`** - دليل شامل مع التفاصيل

---

## 🚀 طرق الاستخدام

### الطريقة 1: VLC Player (الأسهل)

```bash
# افتح VLC
# File → Open File
# اختر: iraqi_channels.m3u
# أو:
# Media → Open Network Stream
# الصق رابط قناة واحدة
```

**مثال:**
```
https://cdn.catiacast.video/abr/78054972db7708422595bc96c6e024ac/playlist.m3u8
```

---

### الطريقة 2: IPTV Smarters (للموبايل)

```
1. حمّل IPTV Smarters من:
   - Google Play (Android)
   - App Store (iOS)

2. افتح التطبيق

3. اختر "Add New User"

4. اختر "Load Your Playlist or File/URL"

5. الصق رابط الملف:
   https://raw.githubusercontent.com/YOUR_REPO/iraqi_channels.m3u

6. أو ارفع الملف مباشرة
```

---

### الطريقة 3: إضافة إلى نظامك (Backend)

#### الخطوة 1: رفع الملف إلى VPS

```bash
# على جهازك المحلي
scp iraqi_channels.m3u root@62.171.153.204:/root/ma-streaming/

# على VPS
ssh root@62.171.153.204
cd /root/ma-streaming
```

#### الخطوة 2: إنشاء سكريبت لإضافة القنوات

```bash
# إنشاء سكريبت
nano add_iraqi_channels.js
```

```javascript
// add_iraqi_channels.js
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const channels = [
  {
    id: 'iraq_iraqiya',
    name: 'العراقية الأولى',
    logo: 'https://i.imgur.com/4CmhXS1.png',
    stream_url: 'https://cdn.catiacast.video/abr/78054972db7708422595bc96c6e024ac/playlist.m3u8',
    category: 'عراقي',
    enabled: true
  },
  {
    id: 'iraq_sharqiya',
    name: 'الشرقية',
    logo: 'https://i.imgur.com/qNRQ7JY.png',
    stream_url: 'https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8',
    category: 'عراقي',
    enabled: true
  },
  {
    id: 'iraq_baghdadia',
    name: 'البغدادية',
    logo: 'https://i.imgur.com/k4IBMVj.png',
    stream_url: 'https://live.baghdadiatv.net/Baghdadia/index.m3u8',
    category: 'عراقي',
    enabled: true
  },
  // أضف باقي القنوات...
];

async function addChannels() {
  for (const ch of channels) {
    try {
      await pool.query(
        `INSERT INTO channels (id, name, logo, stream_url, category, enabled, is_streaming, viewers)
         VALUES ($1, $2, $3, $4, $5, $6, false, 0)
         ON CONFLICT (id) DO UPDATE SET
         name = $2, logo = $3, stream_url = $4, category = $5, enabled = $6`,
        [ch.id, ch.name, ch.logo, ch.stream_url, ch.category, ch.enabled]
      );
      console.log(`✅ Added: ${ch.name}`);
    } catch (err) {
      console.error(`❌ Error adding ${ch.name}:`, err.message);
    }
  }
  console.log('✅ Done!');
  process.exit(0);
}

addChannels();
```

```bash
# تشغيل السكريبت
node add_iraqi_channels.js
```

---

### الطريقة 4: إضافة عبر Admin Dashboard

```
1. افتح: http://62.171.153.204:3000

2. اذهب إلى "Channels" أو "Add Channel"

3. لكل قناة، أدخل:
   - Name: اسم القناة
   - Logo: رابط الشعار
   - Stream URL: رابط البث
   - Category: عراقي
   - Enabled: ✓

4. Save
```

---

### الطريقة 5: استخدام API مباشرة

```bash
# إضافة قناة واحدة
curl -X POST http://62.171.153.204:8090/api/admin/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id": "iraq_iraqiya",
    "name": "العراقية الأولى",
    "logo": "https://i.imgur.com/4CmhXS1.png",
    "stream_url": "https://cdn.catiacast.video/abr/78054972db7708422595bc96c6e024ac/playlist.m3u8",
    "category": "عراقي",
    "enabled": true
  }'
```

---

## 🧪 اختبار القنوات

### اختبار سريع لكل القنوات:

```bash
# إنشاء سكريبت اختبار
nano test_iraqi_channels.sh
```

```bash
#!/bin/bash

echo "🧪 Testing Iraqi Channels..."

channels=(
  "https://cdn.catiacast.video/abr/78054972db7708422595bc96c6e024ac/playlist.m3u8"
  "https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8"
  "https://live.baghdadiatv.net/Baghdadia/index.m3u8"
  "https://media1.livaat.com/AL-RASHEED-HD/index.m3u8"
  "https://svs.itworkscdn.net/rudawlive/rudawlive.smil/playlist.m3u8"
)

for url in "${channels[@]}"; do
  echo "Testing: $url"
  status=$(curl -s -o /dev/null -w "%{http_code}" -I "$url")
  if [ "$status" -eq 200 ]; then
    echo "✅ Working"
  else
    echo "❌ Failed (HTTP $status)"
  fi
  echo "---"
done
```

```bash
# تشغيل الاختبار
chmod +x test_iraqi_channels.sh
./test_iraqi_channels.sh
```

---

## 📺 القنوات المتوفرة (25 قناة)

### القنوات الرئيسية:
1. ✅ العراقية الأولى
2. ✅ العراقية الإخبارية
3. ✅ العراقية الرياضية
4. ✅ الشرقية
5. ✅ الشرقية نيوز
6. ✅ البغدادية
7. ✅ الرشيد
8. ✅ الفلوجة
9. ✅ الفرات
10. ✅ دجلة

### القنوات الدينية:
11. ✅ العهد
12. ✅ الأنوار
13. ✅ الأنوار 2
14. ✅ الفيحاء

### القنوات الكردية:
15. ✅ كردستان 24
16. ✅ روداو
17. ✅ كردماكس
18. ✅ كردماكس بيبسي
19. ✅ كردماكس موزيك
20. ✅ كردسات

### قنوات أخرى:
21. ✅ السومرية
22. ✅ الحرة عراق
23. ✅ الغدير
24. ✅ الاتجاه
25. ✅ الرافدين

---

## 🔧 استكشاف الأخطاء

### المشكلة: القناة لا تعمل

**الحل:**
```bash
# 1. اختبر الرابط
curl -I "CHANNEL_URL"

# 2. جرب في VLC
vlc "CHANNEL_URL"

# 3. تحقق من الإنترنت
ping 8.8.8.8

# 4. استخدم VPN إذا كانت محجوبة
```

### المشكلة: بطء في التحميل

**الحل:**
```
1. تحقق من سرعة الإنترنت
2. اختر جودة أقل إن أمكن
3. استخدم سيرفر VPN قريب
4. أغلق التطبيقات الأخرى
```

### المشكلة: الصوت بدون صورة

**الحل:**
```
1. أعد تشغيل Player
2. جرب player آخر
3. تحقق من codec support
4. حدّث VLC/Player
```

---

## 💡 نصائح مهمة

### للحصول على أفضل أداء:

1. **استخدم VPN** للقنوات المحجوبة
2. **اختبر القنوات** قبل إضافتها للنظام
3. **احتفظ بنسخة احتياطية** من الروابط العاملة
4. **تحقق من التحديثات** شهرياً

### للاستخدام في الإنتاج:

1. **اختبر كل قناة** قبل النشر
2. **راقب الأداء** بانتظام
3. **احتفظ بروابط بديلة** لكل قناة
4. **استخدم CDN** إن أمكن

---

## 🔄 التحديثات

### كيفية الحصول على روابط محدثة:

```bash
# 1. من GitHub
git clone https://github.com/iptv-org/iptv
cd iptv
# ابحث عن ملفات العراق

# 2. من IPTV-ORG مباشرة
curl https://iptv-org.github.io/iptv/countries/iq.m3u > iraq_updated.m3u

# 3. من Free-TV
curl https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_iraq.m3u8 > iraq_freetv.m3u
```

---

## 📊 إحصائيات الاستخدام

بعد إضافة القنوات، يمكنك مراقبة:

```bash
# عدد المشاهدين
curl http://62.171.153.204:8090/api/admin/stats

# القنوات النشطة
curl http://62.171.153.204:8090/api/admin/cloud-channels

# الأخطاء
curl http://62.171.153.204:8090/api/admin/stream-errors
```

---

## 🌐 مصادر إضافية

### GitHub Repositories:
- **iptv-org/iptv**: https://github.com/iptv-org/iptv
- **Free-TV/IPTV**: https://github.com/Free-TV/IPTV
- **Iraq-IPTV/TV**: https://github.com/Iraq-IPTV/TV

### مواقع مفيدة:
- **IPTV-ORG**: https://iptv-org.github.io/
- **Daily IPTV**: https://www.dailyiptvlist.com/
- **Free IPTV**: https://www.free-iptv.com/

---

## 📞 الدعم

إذا واجهت مشاكل:

1. **تحقق من الملفات**:
   - `قنوات_عراقية_مجانية_IPTV.txt` - دليل كامل
   - `iraqi_channels.m3u` - ملف M3U

2. **اختبر الروابط** في VLC أولاً

3. **استخدم VPN** للقنوات المحجوبة

4. **تحقق من GitHub** للتحديثات

---

## ✅ الخلاصة

الآن لديك:
- ✅ 25 قناة عراقية مجانية
- ✅ ملف M3U جاهز للاستخدام
- ✅ دليل شامل للتطبيق
- ✅ سكريبتات للاختبار والإضافة

**ابدأ الآن:**
```bash
# اختبر في VLC
vlc iraqi_channels.m3u

# أو أضف إلى نظامك
node add_iraqi_channels.js
```

**استمتع بالمشاهدة!** 🎉
