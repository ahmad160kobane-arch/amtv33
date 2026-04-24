# روابط البث للتحقق - FFmpeg Mode

## 🎯 كيفية التحقق من البث

### الطريقة 1: عبر المتصفح (الأسهل)

#### الخطوة 1: افتح Admin Dashboard
```
http://62.171.153.204:3000
```

#### الخطوة 2: اذهب إلى "Cloud Channels"
- ستجد قائمة القنوات المتاحة
- كل قناة لها زر "Toggle Stream"

#### الخطوة 3: شغّل القناة
- اضغط على "Toggle Stream" لتفعيل البث
- انتظر 5-10 ثواني (FFmpeg يبدأ)

#### الخطوة 4: احصل على رابط البث
القنوات المتاحة حالياً:
1. **BeIN Sports 1 HD** (ID: 1017030)
2. **beIN SPORTS 2 UHD** (ID: 707928)
3. **CA Bein Sports HD** (ID: 3979)

---

## 📺 روابط البث المباشرة

### القناة 1: BeIN Sports 1 HD
```
رابط FFmpeg HLS:
http://62.171.153.204:8090/hls/xtream_live_1017030/stream.m3u8
```

### القناة 2: beIN SPORTS 2 UHD
```
رابط FFmpeg HLS:
http://62.171.153.204:8090/hls/xtream_live_707928/stream.m3u8
```

### القناة 3: CA Bein Sports HD
```
رابط FFmpeg HLS:
http://62.171.153.204:8090/hls/xtream_live_3979/stream.m3u8
```

---

## 🔧 الطريقة 2: اختبار يدوي عبر Terminal

### 1. بدء البث لقناة معينة:
```bash
# مثال: بدء بث BeIN Sports 1 HD
ssh root@62.171.153.204 "cd /root/ma-streaming/cloud-server && node -e \"
const StreamManager = require('./lib/stream-manager');
const sm = new StreamManager();
sm.start();
sm.requestStream('xtream_live_1017030', 'live', 'http://myhand.org:8080/live/3061530197/1780036754/1017030.m3u8', 'BeIN Sports 1 HD')
  .then(r => console.log('Started:', r))
  .catch(e => console.error('Error:', e));
\""
```

### 2. التحقق من FFmpeg يعمل:
```bash
ssh root@62.171.153.204 "ps aux | grep ffmpeg | grep -v grep"
```
**يجب أن ترى:** عملية FFmpeg تعمل مع رابط IPTV

### 3. التحقق من الـ segments:
```bash
ssh root@62.171.153.204 "ls -lh /root/ma-streaming/cloud-server/hls/"
```
**يجب أن ترى:** مجلد `xtream_live_1017030` (أو رقم القناة)

### 4. التحقق من محتوى الـ playlist:
```bash
ssh root@62.171.153.204 "cat /root/ma-streaming/cloud-server/hls/xtream_live_1017030/stream.m3u8"
```
**يجب أن ترى:** قائمة segments (.ts files)

---

## 🎬 الطريقة 3: اختبار بـ VLC Player

### الخطوات:
1. افتح VLC Player
2. اذهب إلى: **Media → Open Network Stream**
3. الصق أحد الروابط:
   ```
   http://62.171.153.204:8090/hls/xtream_live_1017030/stream.m3u8
   ```
4. اضغط **Play**

**ملاحظة:** قد تحتاج لبدء البث أولاً عبر Admin Dashboard

---

## 🌐 الطريقة 4: اختبار عبر Web App

### إذا كان Web App يعمل:
```
https://your-webapp-url.railway.app
```

1. سجل دخول
2. اذهب إلى "القنوات المباشرة"
3. اختر قناة
4. اضغط "تشغيل"

**ملاحظة:** Web App يحتاج تحديث لاستخدام FFmpeg mode

---

## 🔍 التحقق من حالة النظام

### 1. التحقق من السيرفر يعمل:
```bash
ssh root@62.171.153.204 "pm2 status"
```

### 2. التحقق من اللوجات:
```bash
ssh root@62.171.153.204 "pm2 logs cloud-server --lines 50"
```

### 3. التحقق من القنوات النشطة:
```bash
ssh root@62.171.153.204 "curl -s http://localhost:8090/health"
```

---

## ⚠️ ملاحظات مهمة

### 1. البث لا يبدأ تلقائياً
- يجب **تفعيل القناة** أولاً عبر Admin Dashboard
- أو استخدام API: `POST /api/stream/live/:channelId`

### 2. الانتظار 5-10 ثواني
- FFmpeg يحتاج وقت لبدء التشغيل
- يجب انتظار إنشاء أول 2-3 segments

### 3. الرابط يعمل فقط بعد بدء FFmpeg
- إذا لم يبدأ FFmpeg، الرابط سيعطي 404
- تحقق من FFmpeg يعمل: `ps aux | grep ffmpeg`

### 4. البث يتوقف بعد 45 ثانية من الخمول
- إذا لم يكن هناك مشاهدين، FFmpeg يتوقف تلقائياً
- لإبقاء البث مستمر، يجب وجود مشاهد واحد على الأقل

---

## 🚀 اختبار سريع (نسخ ولصق)

### اختبار كامل بأمر واحد:
```bash
# 1. تحقق من السيرفر
ssh root@62.171.153.204 "pm2 status | grep cloud-server"

# 2. تحقق من FFmpeg
ssh root@62.171.153.204 "ps aux | grep ffmpeg | grep -v grep"

# 3. تحقق من HLS directory
ssh root@62.171.153.204 "ls -la /root/ma-streaming/cloud-server/hls/"

# 4. اختبر رابط البث (بعد بدء FFmpeg)
curl -I http://62.171.153.204:8090/hls/xtream_live_1017030/stream.m3u8
```

---

## 📊 النتيجة المتوقعة

### إذا كان كل شيء يعمل:
```bash
# ps aux | grep ffmpeg
root  12345  ffmpeg -i http://myhand.org:8080/live/.../1017030.m3u8 ...

# ls hls/
xtream_live_1017030/

# ls hls/xtream_live_1017030/
stream.m3u8  seg_0.ts  seg_1.ts  seg_2.ts  seg_3.ts

# curl -I http://62.171.153.204:8090/hls/xtream_live_1017030/stream.m3u8
HTTP/1.1 200 OK
Content-Type: application/vnd.apple.mpegurl
```

---

## 🎯 الخلاصة

**لاختبار البث:**
1. ✅ افتح Admin Dashboard: `http://62.171.153.204:3000`
2. ✅ فعّل قناة من "Cloud Channels"
3. ✅ انتظر 5-10 ثواني
4. ✅ افتح الرابط في VLC أو المتصفح:
   ```
   http://62.171.153.204:8090/hls/xtream_live_[CHANNEL_ID]/stream.m3u8
   ```

**أو استخدم VLC مباشرة:**
```
vlc http://62.171.153.204:8090/hls/xtream_live_1017030/stream.m3u8
```

---

## 💡 إذا لم يعمل

1. تحقق من FFmpeg مثبت: `ffmpeg -version`
2. تحقق من المجلد موجود: `ls /root/ma-streaming/cloud-server/hls/`
3. تحقق من اللوجات: `pm2 logs cloud-server`
4. أعد تشغيل السيرفر: `pm2 restart cloud-server`

**أخبرني إذا واجهت أي مشكلة!** 🚀
