# 🚀 دليل سريع: إضافة قنوات مباشرة

## ✅ تم التطبيق!

الآن يمكنك إضافة قنوات يدوياً **بدون إعادة بث** - الرابط يُمرر مباشرة للمستخدمين.

---

## 📝 الخطوات السريعة

### 1. افتح Admin Dashboard
```
http://62.171.153.204:3000
```

### 2. اذهب إلى "القنوات"

### 3. اضغط "+ يدوي"

### 4. املأ البيانات:
```
اسم القناة: Al Iraqia
المجموعة: عراقي
رابط البث: https://cdn.catiacast.video/abr/8d2ffb0aba244e8d9101a9488a7daa05/playlist.m3u8
رابط الشعار: https://i.imgur.com/4CmhXS1.png
✓ قناة مباشرة (Direct Passthrough) ← فعّل هذا!
```

### 5. اضغط "إضافة"

---

## 🎯 الفرق

### قبل (قنوات IPTV):
```
مستخدم → API → Cloud Server → IPTV → Cloud Server → مستخدم
⚠️ يستهلك موارد السيرفر
⚠️ قد يُحظر من IPTV
```

### بعد (قنوات مباشرة):
```
مستخدم → API → رابط مباشر → مستخدم
✅ لا يستهلك موارد
✅ لا حظر
✅ سريع
```

---

## 📺 أمثلة قنوات جاهزة (من IPTV-ORG)

### القنوات العراقية:

```
1. Al Iraqia
https://cdn.catiacast.video/abr/8d2ffb0aba244e8d9101a9488a7daa05/playlist.m3u8

2. Al Sharqiya
https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8

3. Kurdistan 24
https://d1x82nydcxndze.cloudfront.net/live/index.m3u8

4. Rudaw TV
https://svs.itworkscdn.net/rudawlive/rudawlive.smil/playlist.m3u8

5. MBC Iraq
https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-iraq/e38c44b1b43474e1c39cb5b90203691e/index.m3u8

6. Dijlah TV
https://ghaasiflu.online/Dijlah/index.m3u8

7. Al Rasheed TV
https://media1.livaat.com/static/AL-RASHEED-HD/playlist.m3u8

8. Kurdsat
https://iko-live.akamaized.net/KurdsatTV/master.m3u8

9. NRT TV
https://media.streambrothers.com:1936/8226/8226/playlist.m3u8

10. UTV
https://mn-nl.mncdn.com/utviraqi2/64c80359/index.m3u8
```

---

## 🔧 إضافة سريعة (نسخ ولصق)

### القناة 1: Al Iraqia
```
الاسم: Al Iraqia
المجموعة: عراقي
الرابط: https://cdn.catiacast.video/abr/8d2ffb0aba244e8d9101a9488a7daa05/playlist.m3u8
الشعار: https://i.imgur.com/4CmhXS1.png
✓ قناة مباشرة
```

### القناة 2: Al Sharqiya
```
الاسم: Al Sharqiya
المجموعة: عراقي
الرابط: https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8
الشعار: https://i.imgur.com/qNRQ7JY.png
✓ قناة مباشرة
```

### القناة 3: Kurdistan 24
```
الاسم: Kurdistan 24
المجموعة: كردستان
الرابط: https://d1x82nydcxndze.cloudfront.net/live/index.m3u8
الشعار: https://i.imgur.com/qHQlZq7.png
✓ قناة مباشرة
```

---

## ✅ التحقق

### 1. من Admin Dashboard:
```
القنوات → يجب أن ترى القنوات الجديدة
```

### 2. من Web App:
```
سجل دخول → القنوات المباشرة → اختر قناة → يجب أن تعمل فوراً
```

### 3. من Console (F12):
```javascript
// يجب أن ترى:
{
  url: "https://cdn.catiacast.video/...",
  direct: true,  // ← هذا يعني قناة مباشرة
  ready: true
}
```

---

## 📊 النتيجة

بعد إضافة 10 قنوات:
- ✅ 10 قنوات عراقية متاحة
- ✅ صفر استهلاك للسيرفر
- ✅ تظهر مع القنوات العادية
- ✅ تعمل للمستخدمين مباشرة

---

## 💡 نصائح

### متى تستخدم "قناة مباشرة"؟
- ✅ قنوات مجانية من الإنترنت
- ✅ قنوات من IPTV-ORG
- ✅ قنوات لا تحتاج إخفاء الرابط

### متى تستخدم "بحث IPTV"؟
- ✅ قنوات من اشتراك IPTV مدفوع
- ✅ قنوات تحتاج إخفاء الرابط
- ✅ قنوات تحتاج تحكم كامل

---

## 🔄 التحديث

للحصول على أحدث الروابط:
```
https://iptv-org.github.io/iptv/countries/iq.m3u
```

---

## 📞 مشاكل؟

### القناة لا تعمل:
```
1. اختبر الرابط في VLC
2. جرب رابط آخر من IPTV-ORG
3. تحقق من الإنترنت
```

### الرابط قديم:
```
1. احصل على رابط جديد من IPTV-ORG
2. عدّل القناة من Admin Dashboard
3. احفظ
```

---

## ✅ جاهز!

الآن يمكنك:
- ✅ إضافة قنوات مجانية بسرعة
- ✅ توفير موارد السيرفر
- ✅ تقديم قنوات أكثر للمستخدمين

**ابدأ بإضافة 10 قنوات الآن!** 🚀
