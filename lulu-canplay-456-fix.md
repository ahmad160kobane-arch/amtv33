# إصلاح مشكلة توقف الرفع عند 85% (canplay_check) + IPTV 456

## المشكلة من اللوجز
```
[IPTV-PROXY] Streaming movie 1024835.mp4 via http://myhand.org:8080
[IPTV-PROXY] IPTV returned 456
[LuluCanplay] attempt 1: eggsabkugifj → 404 (1/10), elapsed=0s
[LuluCanplay] attempt 2: eggsabkugifj → 404 (2/10), elapsed=46s
[LuluCanplay] attempt 3: eggsabkugifj → 404 (3/10), elapsed=77s
```

## التحليل

### السبب 1: IPTV يرجع 456 Too Many Connections
عندما LuluStream يحاول تحميل الملف من البروكسي:
1. LuluStream → VPS Proxy (`/iptv-proxy/...`) → IPTV
2. IPTV يرجع **456** (اتصالات كثيرة)
3. البروكسي القديم يرجع 502 لـ LuluStream فورًا بدون إعادة محاولة
4. LuluStream يعتبر التحميل فاشل
5. الملف يبقى 404 → canplay لا يصبح true أبدًا

### السبب 2: كشف 404 خاطئ (تم إصلاحه سابقًا)
`info?.status === 404` لم يكن يُفحص

### السبب 3: لا يوجد fallback (تم إصلاحه سابقًا)
عند فشل remote upload → لا يوجد بديل

## الإصلاحات المُطبّقة

### ملف `server.js` — IPTV Proxy مع Retry لـ 456

**HEAD route** — إضافة 5 محاولات عند 456:
```
456 → انتظر 10s → أعد المحاولة
456 → انتظر 20s → أعد المحاولة  
456 → انتظر 30s → أعد المحاولة
... حتى 5 محاولات
```

**GET route** — إضافة 8 محاولات عند 456:
```
456 → انتظر 15s → أعد المحاولة
456 → انتظر 30s → أعد المحاولة
456 → انتظر 45s → أعد المحاولة
... حتى 8 محاولات (إجمالي ~8 دقائق انتظار)
```

### ملف `lulu-uploader.js` — تحسينات متعددة

1. **استخدام البروكسي** (تم سابقًا) — إرسال رابط البروكسي بدل IPTV مباشر
2. **كشف 404 صحيح** (تم سابقًا) — فحص `info?.status` أيضًا  
3. **Pipe fallback** (تم سابقًا) — عند فشل remote upload، جرّب رفع مباشر
4. **تقليل MAX_404**: 10 → 6 (اكتشاف فشل أسرع: 2 دقيقة بدل 5)
5. **تقليل canplay timeout**: 30 دقيقة → 10 دقائق
6. **تقليل canplay interval**: 30 ثانية → 20 ثانية

## مخطط التدفق الجديد
```
LuluStream يطلب التحميل من البروكسي
    ↓
بروكسي VPS يطلب من IPTV
    ↓
IPTV يرجع 456؟ → انتظر + أعد المحاولة (حتى 8 مرات)
    ↓ (إذا نجح)
LuluStream يحمّل الملف كاملًا
    ↓
canplay_check: كل 20 ثانية (بدل 30)
    ↓ (إذا 404 لـ 6 محاولات = 2 دقيقة)
فشل remote upload → جرّب pipe مباشر
    ↓
VPS يحمّل من IPTV ويرسل مباشرة إلى LuluStream
```

## للنشر
```bash
# نسخ الملفات إلى VPS
scp cloud-server/server.js root@62.171.153.204:/root/cloud-server/
scp cloud-server/lib/lulu-uploader.js root@62.171.153.204:/root/cloud-server/lib/

# إعادة التشغيل
ssh root@62.171.153.204 "cd /root/cloud-server && pm2 restart all"
```
