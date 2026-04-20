# VidSrc M3U8 Extractor — دليل حل المشاكل

## المشاكل الشائعة وحلولها

### 1. "فشل تشغيل الفيديو" لا يزال يظهر ❌

**الأسباب المحتملة:**
- المحتوى غير متاح على أي من المصادر (Consumet, Vidlink, VidSrc)
- مشكلة في الاتصال بالإنترنت
- الاشتراك Premium منتهي

**الحل:**
```bash
# 1. تحقق من اللوجات
ssh root@62.171.153.204
pm2 logs cloud-server --lines 100

# 2. ابحث عن:
# - [Stream] → Consumet
# - [Stream] → Vidlink HLS
# - [Stream] → VidSrc M3U8 Extractor
# - [Stream] → Embed fallback

# 3. إذا كانت جميع المصادر فشلت:
# [Consumet] ✗ Timeout
# [Vidlink] API returned 403
# [VidSrc M3U8 Extractor] ✗ No m3u8 found
# [Stream] ✓ Embed proxy

# هذا يعني أن المحتوى غير متاح، جرب محتوى آخر
```

### 2. المستخرج لا يعمل ❌

**التحقق:**
```bash
# 1. تأكد من وجود الملف
ssh root@62.171.153.204
ls -la /root/ma-streaming/cloud-server/lib/vidsrc-m3u8-extractor.js

# 2. تحقق من اللوجات
pm2 logs cloud-server --lines 50 | grep "VidSrc M3U8"

# 3. إذا لم تجد أي سطر يحتوي على "VidSrc M3U8"
# أعد تشغيل السيرفر:
pm2 restart cloud-server
```

### 3. الفيديو يعمل لكن مع إعلانات ⚠️

**السبب:**
- المستخرج لم يجد رابط m3u8 مباشر
- النظام عاد إلى Embed URLs (احتياطي)

**التحقق:**
```bash
pm2 logs cloud-server --lines 50

# ابحث عن:
[VidSrc M3U8 Extractor] ✗ No m3u8 found from any source
[Stream] ✓ Embed proxy: vidsrc.xyz
```

**الحل:**
- هذا طبيعي لبعض المحتوى
- جرب محتوى آخر
- أو انتظر حتى يتم تحديث المصادر

### 4. الفيديو بطيء أو يتقطع 🐌

**الأسباب:**
- مشكلة في الاتصال بالإنترنت
- السيرفر محمل بطلبات كثيرة
- المصدر بطيء

**الحل:**
```bash
# 1. تحقق من استخدام الموارد
ssh root@62.171.153.204
pm2 status
htop  # اضغط q للخروج

# 2. إذا كان CPU أو Memory عالي جداً
pm2 restart cloud-server

# 3. تحقق من سرعة الإنترنت
speedtest-cli
```

### 5. خطأ "getaddrinfo ENOTFOUND" ❌

**السبب:**
- مشكلة في DNS
- المصدر محجوب أو غير متاح

**من اللوجات:**
```
[VidSrc.pro M3U8] Error: getaddrinfo ENOTFOUND embed.su
```

**الحل:**
- هذا طبيعي، المستخرج سيحاول المصادر الأخرى تلقائياً
- إذا فشلت جميع المصادر، سيعود إلى Embed URLs

### 6. "Failed to initialize" في اللوجات ⚠️

**السبب:**
- مشكلة في الاتصال بقاعدة البيانات PostgreSQL

**الحل:**
```bash
# 1. تحقق من حالة PostgreSQL
ssh root@62.171.153.204
systemctl status postgresql

# 2. إذا كان متوقف، شغله:
systemctl start postgresql

# 3. أعد تشغيل السيرفر
pm2 restart cloud-server
```

## أوامر مفيدة 🛠️

### مشاهدة اللوجات الحية
```bash
ssh root@62.171.153.204
pm2 logs cloud-server
```

### مشاهدة آخر 100 سطر
```bash
pm2 logs cloud-server --lines 100 --nostream
```

### البحث في اللوجات
```bash
pm2 logs cloud-server --lines 200 --nostream | grep "VidSrc M3U8"
pm2 logs cloud-server --lines 200 --nostream | grep "Stream"
pm2 logs cloud-server --lines 200 --nostream | grep "Error"
```

### إعادة تشغيل السيرفر
```bash
pm2 restart cloud-server
```

### مشاهدة حالة السيرفر
```bash
pm2 status
```

### مشاهدة استخدام الموارد
```bash
pm2 monit
```

## فهم اللوجات 📋

### نجاح الاستخراج ✅
```
[Stream] → VidSrc M3U8 Extractor: tmdb=550 type=movie
[VidSrc.xyz M3U8] Fetching: https://vidsrc.xyz/embed/movie/550
[VidSrc.xyz M3U8] ✓ Found: https://example.com/playlist.m3u8...
[VidSrc M3U8 Extractor] ✓ Success: vidsrc.xyz — https://example.com/playlist.m3u8...
[Stream] ✓ VidSrc M3U8: vidsrc.xyz
```

### فشل الاستخراج (عودة إلى Embed) ⚠️
```
[Stream] → VidSrc M3U8 Extractor: tmdb=550 type=movie
[VidSrc.xyz M3U8] Fetching: https://vidsrc.xyz/embed/movie/550
[VidSrc.to M3U8] Fetching: https://vidsrc.to/embed/movie/tt0137523
[VidSrc M3U8 Extractor] ✗ No m3u8 found from any source
[Stream] → Embed fallback: tmdb=550 type=movie
[Stream] ✓ Embed proxy: vidsrc.xyz — https://vidsrc.xyz/embed/movie/550
```

### خطأ في المصدر ❌
```
[VidSrc.xyz M3U8] Error: timeout of 15000ms exceeded
[VidSrc.to M3U8] Error: getaddrinfo ENOTFOUND vidsrc.to
[VidSrc M3U8 Extractor] ✗ No m3u8 found from any source
```

## متى تتصل بالدعم 📞

اتصل إذا:
1. ❌ السيرفر لا يعمل (status: stopped)
2. ❌ جميع الأفلام/المسلسلات لا تعمل
3. ❌ خطأ "Failed to initialize" مستمر
4. ❌ استخدام CPU أو Memory 100% باستمرار

لا تتصل إذا:
1. ✅ فيلم/مسلسل واحد لا يعمل (جرب محتوى آخر)
2. ✅ الفيديو يعمل لكن مع إعلانات (طبيعي لبعض المحتوى)
3. ✅ "No m3u8 found" في اللوجات (طبيعي، سيعود إلى Embed)

## الخلاصة 🎯

### النظام يعمل بشكل صحيح إذا:
- ✅ السيرفر status: online
- ✅ تظهر رسائل `[VidSrc M3U8 Extractor]` في اللوجات
- ✅ بعض الأفلام/المسلسلات تعمل بدون إعلانات

### النظام به مشكلة إذا:
- ❌ السيرفر status: stopped
- ❌ لا تظهر رسائل `[VidSrc M3U8 Extractor]` في اللوجات
- ❌ جميع الأفلام/المسلسلات لا تعمل

---

**تاريخ التحديث:** 2026-04-20
