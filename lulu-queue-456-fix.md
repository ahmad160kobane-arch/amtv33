# إصلاح "already_in_queue_retry_later" + IPTV 456

## المشكلتان من اللوجز

### مشكلة 1: ❌ already_in_queue_retry_later
```
[LuluUpload] API response: {"status":400,"msg":"This URL already in upload queue"}
[LuluUpload] URL already in queue, searching existing files...
[LuluUpload] File not found by title, waiting for queue processing...
[LuluJob] ✗✗✗ FAILED: قشموع [Ar ] — already_in_queue_retry_later
```

**السبب**: عندما يُعاد رفع نفس الرابط، LuluStream يقول "already in queue" لكن لا يرجع الـ filecode. الكود يحاول البحث بالعنوان (غير موثوق مع العربية) وينتظر 30 ثانية فقط ثم يفشل.

### مشكلة 2: 456 Too Many Connections (متكررة)
```
[IPTV-PROXY] Streaming movie 998317.mp4 via http://myhand.org:8080
[IPTV-PROXY] Streaming movie 998317.mp4 via http://myhand.org:8080
[IPTV-PROXY] 456 Too Many Connections for 998317.mp4 — retry 1/8 in 15s...
[IPTV-PROXY] 456 Too Many Connections for 998317.mp4 — retry 1/8 in 15s...
```

**السبب**: LuluStream يرسل عدة طلبات متزامنة (HEAD + GET + Range) إلى البروكسي في نفس الوقت. كل طلب يضرب IPTV ← 456.

## الإصلاحات

### ملف `lulu-uploader.js`

#### 1. كاش URL → filecode
```javascript
const _uploadCache = new Map(); // srcUrl → { fileCode, ts }
```
- عند نجاح الرفع: حفظ `srcUrl → fileCode` في الكاش
- عند "already in queue": البحث في الكاش أولاً (صالح لمدة ساعة)
- هذا يحل مشكلة "فقدان الـ filecode بين الـ jobs"

#### 2. معالجة أفضل لـ "already in queue"
بدلًا من الفشل فورًا:
1. تحقق من الكاش → إذا وُجد، أرجعه فورًا ✅
2. ابحث في ملفات المجلد بالعنوان
3. ابحث عن أحدث ملف في المجلد (`luluFindRecentFile` — جديد)
4. انتظر وبول لمدة 5 دقائق (10 محاولات × 30 ثانية)
5. في كل محاولة: ابحث بالعنوان + أحدث ملف

#### 3. دالة جديدة: `luluFindRecentFile`
```javascript
async function luluFindRecentFile(apiKey, fldId = 0) {
  // يجلب أول 5 ملفات في المجلد (مرتبة بالتاريخ)
  // يرجع file_code لأحدث ملف
}
```
مفيدة عندما الملف لا يزال يُعالج وعنوانه لم يُحدّث بعد.

### ملف `server.js`

#### 4. IPTV Connection Semaphore (محدّد اتصالات)
```javascript
const _iptvSem = { active: 0, queue: [], max: 2 };

function _acquireIptv() { /* انتظر دورك */ }
function _releaseIptv() { /* حرّر المكان */ }
```

**كيف يعمل:**
- HEAD route: ينتظر `_acquireIptv()` قبل الاتصال بـ IPTV، ثم `_releaseIptv()` بعد الرد
- GET route: ينتظر `_acquireIptv()` قبل الاتصال، ثم `_releaseIptv()` بعد بدء البث
- الحد الأقصى: 2 اتصال متزامن إلى IPTV (بدلًا من غير محدود)

**النتيجة:** LuluStream يرسل HEAD + GET + Range في نفس الوقت → البروكسي يخدمها واحدًا تلو الآخر → IPTV لا يرجع 456

## مخطط التدفق الجديد

```
LuluJob: رفع فيلم جديد
    ↓
luluRemoteUpload(proxyUrl)
    ↓
الكاش يحتوي على filecode؟ → نعم → استخدمه مباشرة ✅
    ↓ لا
LuluStream API: "already in queue"؟
    ↓ نعم
ابحث بالعنوان → ابحث بأحدث ملف → بول 5 دقائق
    ↓
وجد filecode → انتقل لـ canplay_check
    ↓
في نفس الوقت:
  البروكسي يتلقى طلبات HEAD + GET من LuluStream
    ↓
  Semaphore يحددها: اتصال واحد في كل مرة → لا 456!
    ↓
  IPTV يخدم الفيديو ← LuluStream يحمّله بنجاح
    ↓
  canplay = true ✅
```

## للنشر
```bash
scp cloud-server/server.js root@62.171.153.204:/root/cloud-server/
scp cloud-server/lib/lulu-uploader.js root@62.171.153.204:/root/cloud-server/lib/
ssh root@62.171.153.204 "pm2 restart all"
```
