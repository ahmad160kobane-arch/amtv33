# إصلاح مشكلة توقف الرفع عند 85% (canplay_check)

## المشكلة
عند رفع الأفلام والمسلسلات إلى IPTV عبر LuluStream، يتوقف التقدم عند **85%** في مرحلة `canplay_check` ولا يتجاوزها.

## الأسباب الجذرية

### 1. السبب الرئيسي: إرسال رابط IPTV المباشر إلى LuluStream ❌
الكود كان يرسل رابط IPTV الخام مباشرة إلى LuluStream:
```
http://iptv-server:8080/movie/username/password/12345.mp4
```

**لكن سيرفرات LuluStream لا تستطيع التحميل من IPTV** — لأن IPTV يحجب الاتصالات من IPs خارجية (geo-blocking، IP restrictions).

البروكسي `/iptv-proxy/` موجود في `server.js` خصيصًا لهذا الغرض، **لكن لم يكن يُستخدم!**

### 2. السبب الثانوي: خطأ في كشف الـ 404 في canplay_check
في `luluCheckCanplay`، الفحص يتحقق فقط من `data?.status === 404` (حالة API العليا)، لكن LuluStream API يرجع:
```json
{ "status": 200, "result": { "status": 404, "canplay": undefined } }
```
- `data.status = 200` ✅ (الـ API نفسه نجح)
- `info.status = 404` ← **هذا هو الذي يعني أن الملف غير موجود/فشل الرفع**

بسبب هذا الخطأ، `consecutive404` لم يزد أبدًا، والفحص ينتظر 30 دقيقة بدون فائدة.

### 3. لماذا 85% بالضبط؟
حساب التقدم: `60 + Math.min(25, attempt * 2)`
- المحاولة 12: `60 + 24 = 84%`
- المحاولة 13+: `60 + 25 = 85%` (وصلنا للحد الأقصى)

## الإصلاحات المُطبّقة

### الإصلاح 1: استخدام بروكسي VPS بدلًا من رابط IPTV المباشر
```javascript
// قبل (خاطئ):
const fileCode = await luluRemoteUpload(job.apiKey, iptvDirectUrl, title, targetFolderId);

// بعد (صحيح):
const proxyPath = `/iptv-proxy/${job.proxySecret}/${iptvId}/${proxyType}/${item.streamId}.${ext}`;
const remoteUploadUrl = job.vpsUrl + proxyPath;
// مثال: http://62.171.153.204:8090/iptv-proxy/lulu_iptv_proxy_2026/1/movie/12345.mp4
const fileCode = await luluRemoteUpload(job.apiKey, remoteUploadUrl, title, targetFolderId);
```

البروكسي يعمل كوسيط: `LuluStream → VPS Proxy → IPTV` بدلًا من `LuluStream → IPTV (محجوب)`

### الإصلاح 2: كشف الـ 404 بشكل صحيح
```javascript
// قبل (خاطئ):
if (data?.status === 404 || data?.status === '404' || (!info && data?.msg?.includes('not found')))

// بعد (صحيح):
const isNotFound = data?.status === 404 || data?.status === '404'
  || info?.status === 404 || info?.status === '404'  // ← إضافة فحص info
  || (!info && data?.msg?.includes('not found'));
```

الآن عند 10 محاولات 404 متتالية (5 دقائق)، يُعتبر الرفع فاشلًا بدلًا من الانتظار 30 دقيقة.

### الإصلاح 3: معالجة فشل Remote Upload + Fallback
عندما يُكتشف أن الـ remote upload فشل (404 مستمر):
1. **يُحذف entry بـ canplay=false من القاعدة** (لا نريد بيانات فارغة)
2. **يُجرّب رفع مباشر (pipe) كبديل** — VPS يحمّل من IPTV ويُرسل مباشرة إلى LuluStream
3. إذا نجح الـ pipe + canplay → يُحفظ في القاعدة ✅
4. إذا فشل كل شيء → يُعتبر العنصر فاشل ❌

## كيفية النشر
1. ارفع الملف المُعدّل: `cloud-server/lib/lulu-uploader.js`
2. أعد تشغيل السيرفر: `pm2 restart all` أو `pm2 restart cloud-server`
3. تأكد أن `VPS_URL` معرّف (أو أن الـ fallback IP `62.171.153.204` صحيح)

## مخطط التدفق بعد الإصلاح
```
IPTV URL
    ↓
بناء رابط البروكسي (VPS_URL/iptv-proxy/...)
    ↓
LuluStream يحمّل من البروكسي ← VPS يمرر من IPTV
    ↓
canplay_check: كشف 404 بشكل صحيح
    ↓ (إذا فشل)
حذف entry الفاشل + تجربة pipe مباشر
    ↓ (إذا فشل pipe)
تسجيل كـ failed → الانتقال للعنصر التالي
```
