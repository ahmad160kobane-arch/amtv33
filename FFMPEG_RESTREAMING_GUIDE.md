# 🎬 دليل FFmpeg Re-streaming - الحل النهائي

## ✅ النظام يعمل الآن!

### 📊 البنية الحالية:

```
┌─────────────┐
│ IPTV Server │
└──────┬──────┘
       │ اتصال واحد فقط
       ▼
┌─────────────────┐
│  XtreamProxy    │ ◄── وسيط للاتصال بـ IPTV
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     FFmpeg      │ ◄── إعادة تغليف وإنتاج HLS
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   HLS Files     │ ◄── ملفات محلية على السيرفر
│  (segments.ts)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   المستخدمون    │ ◄── يشاهدون من السيرفر
└─────────────────┘
```

---

## 🚀 كيف يستخدم المستخدمون النظام:

### 1️⃣ التطبيق المحمول:

```javascript
// الطلب
GET http://62.171.153.204:8090/api/xtream/stream/1017030

// الرد
{
  "success": true,
  "name": "BeIN Sports 1 HD",
  "hlsUrl": "/hls/stream_1017030/playlist.m3u8",
  "type": "ffmpeg_restream",
  "message": "بث محلي - لا ضغط على IPTV"
}

// التشغيل
http://62.171.153.204:8090/hls/stream_1017030/playlist.m3u8
```

### 2️⃣ المتصفح (Web App):

```html
<video controls>
  <source src="http://62.171.153.204:8090/hls/stream_1017030/playlist.m3u8" type="application/x-mpegURL">
</video>
```

### 3️⃣ VLC Player:

```
افتح → شبكة → أدخل:
http://62.171.153.204:8090/hls/stream_1017030/playlist.m3u8
```

---

## 📁 ملفات HLS المولدة:

```bash
/root/ma-streaming/cloud-server/hls/stream_1017030/
├── playlist.m3u8          # قائمة التشغيل الرئيسية
├── segment_043.ts         # مقطع فيديو (6 ثواني)
├── segment_044.ts
├── segment_045.ts
├── segment_046.ts
├── segment_047.ts
├── segment_048.ts
├── segment_049.ts
├── segment_050.ts
├── segment_051.ts
├── segment_052.ts
└── segment_053.ts
```

**ملاحظة:** FFmpeg يحتفظ بآخر 10 segments فقط ويحذف القديمة تلقائياً.

---

## 🎯 المميزات:

### ✅ لا ضغط على IPTV
- اتصال واحد فقط بـ IPTV (عبر XtreamProxy)
- مهما كان عدد المستخدمين، الضغط على IPTV ثابت

### ✅ بث سلس 100%
- كل المستخدمين يشاهدون نفس الـ segments
- لا تقطيع عند انضمام مستخدمين جدد
- FFmpeg ينتج segments بشكل مستمر

### ✅ استخدام موارد السيرفر
- FFmpeg يستخدم CPU للتغليف
- الملفات تُخزن مؤقتاً على الديسك
- الباندويث من السيرفر للمستخدمين

### ✅ إدارة ذكية
- FFmpeg يبدأ عند أول مشاهد
- يستمر طالما هناك مشاهدين
- يتوقف تلقائياً عند عدم وجود مشاهدين

---

## 🔍 مراقبة النظام:

### عرض الإحصائيات:
```bash
curl http://62.171.153.204:8090/api/xtream/restream/stats
```

**النتيجة:**
```json
{
  "success": true,
  "totalStreams": 1,
  "ffmpegPath": "/usr/bin/ffmpeg",
  "proxyBridge": "http://localhost:8090",
  "streams": {
    "1017030": {
      "viewers": 2,
      "uptime": 120,
      "hlsPath": "/hls/stream_1017030/playlist.m3u8",
      "proxyUrl": "http://localhost:8090/proxy/live/1017030/index.m3u8",
      "status": "running"
    }
  }
}
```

### فحص عمليات FFmpeg:
```bash
ps aux | grep ffmpeg
```

### فحص ملفات HLS:
```bash
ls -lh /root/ma-streaming/cloud-server/hls/stream_1017030/
```

### فحص الـ logs:
```bash
pm2 logs cloud-server --lines 50
```

---

## 🛠️ استكشاف الأخطاء:

### المشكلة: FFmpeg لا يبدأ
**الحل:**
```bash
# تحقق من FFmpeg
/usr/bin/ffmpeg -version

# تحقق من الصلاحيات
ls -la /root/ma-streaming/cloud-server/hls/

# أعد تشغيل السيرفر
pm2 restart cloud-server
```

### المشكلة: لا توجد ملفات HLS
**الحل:**
```bash
# تحقق من عمليات FFmpeg
ps aux | grep ffmpeg

# تحقق من الـ logs
tail -50 /root/.pm2/logs/cloud-server-out.log | grep FFmpeg
```

### المشكلة: التقطيع لا يزال موجود
**الحل:**
- تأكد أن التطبيق يستخدم `/hls/stream_*/playlist.m3u8`
- تحقق من سرعة الإنترنت للمستخدم
- تحقق من موارد السيرفر (CPU/RAM)

---

## 📊 متطلبات الموارد:

### لكل قناة نشطة:
- **CPU:** ~5-10% (نسخ بدون إعادة ترميز)
- **RAM:** ~50-100 MB
- **Disk:** ~30-50 MB (10 segments × 3-5 MB)
- **Bandwidth:** حسب عدد المشاهدين

### مثال: 10 قنوات نشطة
- **CPU:** ~50-100%
- **RAM:** ~500 MB - 1 GB
- **Disk:** ~300-500 MB
- **Bandwidth:** حسب عدد المشاهدين لكل قناة

---

## 🎉 النتيجة النهائية:

✅ **النظام يعمل بنجاح**
✅ **FFmpeg مثبت ويعمل**
✅ **XtreamProxy كوسيط للاتصال بـ IPTV**
✅ **HLS segments تُنتج بشكل مستمر**
✅ **المستخدمون يشاهدون بث سلس بدون تقطيع**
✅ **لا ضغط على حساب IPTV**

---

## 📞 الدعم:

إذا واجهت أي مشاكل:
1. تحقق من الـ logs: `pm2 logs cloud-server`
2. تحقق من عمليات FFmpeg: `ps aux | grep ffmpeg`
3. تحقق من ملفات HLS: `ls -lh /root/ma-streaming/cloud-server/hls/`
4. أعد تشغيل السيرفر: `pm2 restart cloud-server`

---

**تاريخ التحديث:** 2026-04-18
**الإصدار:** 1.0 - FFmpeg Re-streaming Final Solution