# ⚖️ الإعدادات المتوازنة - سرعة + استقرار

## المشكلة:
- الإعدادات السابقة كانت **بطيئة جداً** (تقطيع كثير)
- نحتاج توازن بين **السرعة** و **عدم الحظر**

## الحل المتوازن:

### 📊 الطلبات المتزامنة
```javascript
MAX_MANIFEST_PARALLEL = 5   // متوسط (لا 1 ولا 200)
MAX_SEG_PARALLEL = 15        // متوسط (لا 3 ولا 500)
MAX_PROACTIVE_PER_CYCLE = 3  // متوسط
```

### ⏱️ Timeouts معقولة
```javascript
MANIFEST_TIMEOUT = 12s  // معقول
SEGMENT_TIMEOUT = 20s   // معقول
```

### 💾 Cache متوسط
```javascript
MANIFEST_TTL = 6s      // تحديث سريع
SEG_TTL = 2 minutes    // cache معقول
```

### 🎯 Prefetch محدود
```javascript
// فقط 2 segments قادمة (ليس كل الـ segments)
prefetched = 0;
for (segment) {
  if (prefetched >= 2) break;
  prefetch(segment);
  prefetched++;
}
```

### ⏳ تأخير بسيط
```javascript
// Manifest: 50-150ms (بسيط)
// Segments: 20-80ms (بسيط جداً)
```

## النتيجة المتوقعة:

✅ **سرعة جيدة**
- 5 manifests متزامنة
- 15 segments متزامنة
- prefetch 2 segments قادمة
- تأخير بسيط فقط

✅ **استقرار جيد**
- ليس كثير مثل 200/500
- ليس قليل مثل 1/3
- متوازن تماماً

✅ **لا تقطيع**
- prefetch يجهز segments قبل الحاجة
- cache معقول
- retry سريع

✅ **لا حظر**
- طلبات معقولة (ليست كثيرة)
- تأخير بسيط بين الطلبات
- cooldown بعد الأخطاء

## المقارنة:

| الإعداد | قبل | بطيء جداً | متوازن ✅ |
|---------|-----|-----------|----------|
| Manifest Parallel | 200 | 1 | **5** |
| Segment Parallel | 500 | 3 | **15** |
| Prefetch | All | None | **2 only** |
| Delays | None | 100-500ms | **20-150ms** |
| النتيجة | حظر بعد 30 دقيقة | تقطيع كثير | **سلس** |

---

**الحالة:** تم التطبيق على VPS ✅  
**الاختبار:** جرب الآن - يجب أن يعمل بسلاسة!
