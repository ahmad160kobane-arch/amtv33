# 🔍 تعليمات فحص مشكلة البث

## الخطوات:

### 1️⃣ انتظر نشر Railway (2-3 دقائق)
Railway الآن ينشر النسخة الجديدة مع console.log مفصّل

### 2️⃣ افتح تطبيق الويب + Console
1. افتح تطبيق الويب على Railway
2. اضغط **F12** لفتح Developer Tools
3. اذهب لتبويب **Console**
4. امسح السجل (Clear console)

### 3️⃣ جرب تشغيل قناة
1. اذهب لصفحة "البث المباشر"
2. اختر أي قناة
3. راقب الرسائل في Console

### 4️⃣ ما الذي نبحث عنه:

#### ✅ إذا رأيت هذه الرسائل (يعني النظام يعمل):
```
[API] 🔄 Requesting stream for channel: xtream_live_273266
[API] ✅ Response data: {...}
[API] 📺 Initial streamUrl: /proxy/live/273266/index.m3u8
[API] 🔗 Converted to full URL: http://62.171.153.204:8090/proxy/live/273266/index.m3u8
[LivePlayer] 🎬 Starting stream: http://62.171.153.204:8090/proxy/live/273266/index.m3u8
[LivePlayer] 📺 HLS stream detected
[LivePlayer] 🔧 Loading HLS.js...
[LivePlayer] ✅ HLS.js already loaded
[LivePlayer] ✅ Creating HLS instance...
[LivePlayer] 🔗 Loading source: http://62.171.153.204:8090/proxy/live/273266/index.m3u8
[LivePlayer] 📥 Loading manifest...
[LivePlayer] ✅ Manifest loaded!
[LivePlayer] ✅ Manifest parsed - starting playback
```

#### ❌ إذا رأيت أخطاء:

**خطأ CORS:**
```
Access to fetch at 'http://62.171.153.204:8090/...' from origin 'https://...' has been blocked by CORS policy
```
**الحل:** نحتاج تفعيل CORS في السيرفر

**خطأ Network:**
```
[LivePlayer] ❌ HLS Error: networkError manifestLoadError
```
**الحل:** المشكلة في الاتصال بالسيرفر

**خطأ Media:**
```
[LivePlayer] ❌ HLS Error: mediaError
```
**الحل:** المشكلة في تنسيق الفيديو

### 5️⃣ اختبار مباشر للرابط

افتح هذا الرابط مباشرة في المتصفح:
```
http://62.171.153.204:8090/proxy/live/273266/index.m3u8
```

**إذا عمل الرابط مباشرة لكن لا يعمل في Player:**
- المشكلة في LivePlayer أو HLS.js
- أرسل لي رسائل Console كاملة

**إذا لم يعمل الرابط مباشرة:**
- المشكلة في السيرفر
- تحقق من أن VPS يعمل

### 6️⃣ اختبار بديل - صفحة HTML

افتح الملف `test_hls_player.html` في المتصفح:
```
file:///C:/Users/.../ma-streaming/test_hls_player.html
```

هذه الصفحة تختبر HLS.js بشكل مباشر بدون React

## 📋 أرسل لي:

1. **لقطة شاشة من Console** (F12)
2. **هل الرابط المباشر يعمل؟** (http://62.171.153.204:8090/proxy/live/273266/index.m3u8)
3. **أي رسائل خطأ** باللون الأحمر

## 🔧 حلول محتملة:

### إذا كانت المشكلة CORS:
نحتاج تعديل السيرفر ليسمح بـ HTTPS origins

### إذا كانت المشكلة في HLS.js:
نحتاج تغيير إعدادات Player

### إذا كانت المشكلة في الرابط:
نحتاج التحقق من السيرفر والـ proxy

---

**ملاحظة:** الآن النظام يطبع كل خطوة في Console، سيكون من السهل معرفة أين المشكلة بالضبط! 🎯
