# 🎯 إصلاح: سلوك طبيعي مثل المستخدم العادي

## المشكلة السابقة:
- النظام كان يرسل **طلبات كثيرة جداً** إلى IPTV
- IPTV يحظر الحساب بعد 30 دقيقة (HTTP 403/511/502)
- Prefetching كان يحمل segments قبل الحاجة
- طلبات متزامنة كثيرة (200 manifest + 500 segments)

## الحل المطبق:

### 1️⃣ تقليل الطلبات المتزامنة
```javascript
MAX_MANIFEST_PARALLEL = 1   // كان 200 → الآن 1 فقط (مثل مستخدم واحد)
MAX_SEG_PARALLEL = 3         // كان 500 → الآن 3 فقط (مثل player عادي)
MAX_PROACTIVE_PER_CYCLE = 1 // كان 50 → الآن 1 فقط
```

### 2️⃣ زيادة مدة الـ Cache
```javascript
MANIFEST_TTL = 10000   // 10 ثواني (كان 6s)
SEG_TTL = 300000       // 5 دقائق (كان 2 دقيقة)
MANIFEST_STALE = 300000 // 5 دقائق (كان 2 دقيقة)
```

### 3️⃣ تأخير عشوائي طبيعي
```javascript
// Manifest: تأخير 100-500ms (مثل latency طبيعي)
await new Promise(r => setTimeout(r, 100 + Math.random() * 400));

// Segments: تأخير 50-200ms بين كل segment
await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
```

### 4️⃣ تعطيل Prefetching
```javascript
_prefetchSegments() {
  // DISABLED - يسبب طلبات كثيرة
  // الآن: فقط on-demand (عند الحاجة فقط)
  return;
}
```

### 5️⃣ Retry أطول وأكثر صبراً
```javascript
SEGMENT_TIMEOUT = 30000  // 30 ثانية (كان 15s)
// Retry delays: 3s, 6s (كان 1s, 2s)
// مثل مستخدم صبور ينتظر
```

### 6️⃣ Cooldown أطول بعد الأخطاء
```javascript
COOLDOWN_403 = 60000  // دقيقة كاملة بعد 403
COOLDOWN_ERR = 20000  // 20 ثانية بعد أي خطأ
```

## النتيجة المتوقعة:

✅ **سلوك طبيعي 100%**
- طلب واحد manifest في الوقت الواحد
- 3 segments فقط متزامنة (مثل HLS player عادي)
- تأخير عشوائي بين الطلبات
- لا prefetching (فقط on-demand)

✅ **لا حظر من IPTV**
- الطلبات قليلة جداً
- تبدو كأنها من مستخدم واحد عادي
- Cache طويل = طلبات أقل

✅ **يعمل على مدار اليوم**
- لا توقف بعد 30 دقيقة
- لا HTTP 403/511/502
- استقرار كامل

## الاختبار:

1. شغّل قناة واحدة
2. راقب logs: `ssh root@62.171.153.204 "pm2 logs cloud-server --lines 50"`
3. يجب أن ترى:
   - `MAX_MANIFEST_PARALLEL = 1`
   - `MAX_SEG_PARALLEL = 3`
   - طلبات قليلة جداً
   - لا أخطاء 403/511

## ملاحظات:

- **البث قد يكون أبطأ قليلاً** في البداية (بسبب on-demand)
- لكن **أكثر استقراراً** على المدى الطويل
- **لا حظر** = بث مستمر 24/7
- Cache الطويل يعوض البطء الأولي

---

**التحديث:** تم رفعه إلى VPS وإعادة تشغيل السيرفر ✅
