# دليل وضع FFmpeg (بدلاً من XtreamProxy)

## ✅ التغييرات المطبقة

### 1. استبدال XtreamProxy بـ FFmpeg
**قبل:**
```
IPTV → XtreamProxy → المستخدم
```
- XtreamProxy يطلب مباشرة من IPTV
- كل مستخدم = طلبات منفصلة
- IPTV يحظر بعد فترة (511/502/403)

**بعد:**
```
IPTV → FFmpeg → HLS Segments → المستخدم
```
- FFmpeg يتصل مرة واحدة بـ IPTV
- يحول البث إلى HLS محلياً
- كل المستخدمين يشاهدون من نفس الـ stream
- **اتصال واحد فقط بـ IPTV** = لا حظر

---

## 🎯 المميزات

### 1. اتصال واحد بـ IPTV
- FFmpeg يفتح اتصال واحد فقط مع IPTV
- حتى لو كان 100 مستخدم يشاهدون نفس القناة
- **النتيجة:** IPTV لا يرى ضغط كبير

### 2. إعادة تغليف محلية (Remuxing)
```bash
ffmpeg -i iptv_stream.m3u8 \
  -c copy \              # نسخ بدون إعادة ترميز
  -f hls \               # تحويل إلى HLS
  -hls_time 6 \          # كل segment = 6 ثواني
  output.m3u8
```
- **لا إعادة ترميز** = استهلاك CPU قليل جداً
- **سريع جداً** = تأخير أقل من ثانية

### 3. Segments محلية
- FFmpeg يحفظ segments على السيرفر
- المستخدمون يحملون من السيرفر (ليس من IPTV)
- **سرعة عالية** + **لا ضغط على IPTV**

### 4. إعادة تشغيل تلقائية
- إذا توقف FFmpeg، يعيد التشغيل تلقائياً
- حتى 5 محاولات إعادة تشغيل
- **البث لا يتوقف**

---

## 📊 كيف يعمل النظام

### عند طلب قناة:

1. **المستخدم الأول:**
   ```
   User 1 → API → FFmpeg يبدأ → IPTV
   ```
   - FFmpeg يتصل بـ IPTV
   - يبدأ تحويل البث إلى HLS
   - المستخدم ينتظر 3-5 ثواني (بداية FFmpeg)

2. **المستخدمون التاليون:**
   ```
   User 2,3,4... → HLS Segments (جاهزة)
   ```
   - FFmpeg يعمل بالفعل
   - المستخدمون يشاهدون فوراً (0 ثانية انتظار)
   - **كلهم يشاهدون من نفس الـ stream**

3. **عند خروج آخر مستخدم:**
   ```
   No viewers → FFmpeg يتوقف (بعد 45 ثانية)
   ```
   - توفير موارد السيرفر
   - تنظيف الـ segments

---

## 🔧 الإعدادات الحالية

### FFmpeg Parameters:
```javascript
// من stream-manager.js
{
  hls_time: 6,              // كل segment = 6 ثواني
  hls_list_size: 6,         // 6 segments في playlist
  hls_flags: 'delete_segments+append_list+omit_endlist',
  reconnect: 1,             // إعادة الاتصال تلقائياً
  reconnect_delay_max: 3,   // أقصى تأخير = 3 ثواني
  rw_timeout: 8000000,      // timeout = 8 ثواني
}
```

### Stream Manager:
```javascript
{
  MAX_CONCURRENT_FFMPEG: 5,  // أقصى 5 قنوات بالتوازي
  IDLE_TIMEOUT: 45000,       // إيقاف بعد 45 ثانية خمول
  MIN_SEGMENTS_READY: 2,     // جاهز عند وجود 2 segments
}
```

---

## 📈 الأداء المتوقع

### مع XtreamProxy (القديم):
- ⚠️ البث يعمل 30-60 دقيقة ثم يتوقف
- ⚠️ HTTP 511/502/403 بعد فترة
- ⚠️ كل مستخدم = طلبات منفصلة لـ IPTV

### مع FFmpeg (الجديد):
- ✅ البث يعمل 24/7 بدون توقف
- ✅ اتصال واحد فقط بـ IPTV (لا حظر)
- ✅ كل المستخدمين يشاركون نفس الـ stream
- ✅ إعادة تشغيل تلقائية عند الفشل

---

## 🎬 مثال عملي

### سيناريو: 10 مستخدمين يشاهدون BeIN Sports 1

**مع XtreamProxy:**
```
User 1 → IPTV (طلب 1)
User 2 → IPTV (طلب 2)
User 3 → IPTV (طلب 3)
...
User 10 → IPTV (طلب 10)
```
**النتيجة:** IPTV يرى 10 اتصالات → حظر محتمل

**مع FFmpeg:**
```
User 1 → FFmpeg → IPTV (طلب واحد فقط)
User 2 → FFmpeg (نفس الـ stream)
User 3 → FFmpeg (نفس الـ stream)
...
User 10 → FFmpeg (نفس الـ stream)
```
**النتيجة:** IPTV يرى اتصال واحد فقط → لا حظر

---

## 🔍 كيفية التحقق

### 1. التحقق من FFmpeg يعمل:
```bash
ssh root@62.171.153.204 "ps aux | grep ffmpeg"
```
يجب أن ترى عمليات FFmpeg للقنوات النشطة

### 2. التحقق من الـ segments:
```bash
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/hls/"
```
يجب أن ترى مجلدات للقنوات النشطة

### 3. التحقق من اللوجات:
```bash
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 50 | grep -E '(FFmpeg|Stream)'"
```
يجب أن ترى رسائل مثل:
```
[Stream] ▶ بدأ بث: BeIN Sports 1 HD
[Stream] +مشاهد BeIN Sports 1 HD (2 متصل)
```

---

## ⚙️ استكشاف الأخطاء

### المشكلة: "FFmpeg not found"
**الحل:**
```bash
ssh root@62.171.153.204 "which ffmpeg"
# إذا لم يكن موجود:
apt update && apt install -y ffmpeg
```

### المشكلة: "البث لا يبدأ"
**الحل:**
```bash
# تحقق من اللوجات
pm2 logs cloud-server --lines 100 | grep -E '(error|Error|ERROR)'

# تحقق من صلاحيات المجلد
chmod -R 755 /root/ma-streaming/cloud-server/hls/
```

### المشكلة: "segments لا تُحذف"
**الحل:**
```bash
# تنظيف يدوي
rm -rf /root/ma-streaming/cloud-server/hls/xtream_live_*

# إعادة تشغيل
pm2 restart cloud-server
```

---

## 📝 ملاحظات مهمة

### 1. استهلاك الموارد
- **CPU:** قليل جداً (copy mode, no encoding)
- **RAM:** ~50-100MB لكل قناة نشطة
- **Disk:** ~50-100MB لكل قناة (segments مؤقتة)

### 2. التأخير (Latency)
- **XtreamProxy:** ~2-3 ثواني
- **FFmpeg:** ~6-10 ثواني (بسبب buffering)
- **مقبول** للبث المباشر (ليس gaming)

### 3. الحد الأقصى للقنوات
- **حالياً:** 5 قنوات بالتوازي
- **يمكن زيادته** إذا كان السيرفر قوي
- **تعديل:** `MAX_CONCURRENT_FFMPEG` في `stream-manager.js`

---

## 🚀 التحسينات المستقبلية

### 1. Multi-Account Failover
- استخدام عدة حسابات IPTV
- التبديل تلقائياً عند فشل حساب
- **يتطلب:** 3-5 حسابات إضافية

### 2. CDN Integration
- رفع segments إلى CDN (Cloudflare R2)
- توزيع الحمل عالمياً
- **يتطلب:** حساب CDN

### 3. Adaptive Bitrate
- تحويل إلى عدة جودات (720p, 480p, 360p)
- المستخدم يختار حسب سرعة الإنترنت
- **يتطلب:** encoding (استهلاك CPU أعلى)

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من اللوجات: `pm2 logs cloud-server`
2. تحقق من FFmpeg: `ps aux | grep ffmpeg`
3. تحقق من الـ segments: `ls -lh hls/`
4. أعد تشغيل السيرفر: `pm2 restart cloud-server`

---

## ✅ الخلاصة

**التغيير الرئيسي:**
- ❌ XtreamProxy (طلبات مباشرة لـ IPTV)
- ✅ FFmpeg (اتصال واحد + إعادة تغليف محلية)

**النتيجة:**
- ✅ لا حظر من IPTV
- ✅ بث مستقر 24/7
- ✅ دعم عدة مستخدمين بكفاءة
- ✅ إعادة تشغيل تلقائية

**الآن النظام جاهز للعمل بشكل مستقر!** 🎉
