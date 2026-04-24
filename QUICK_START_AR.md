# 🚀 دليل البدء السريع - رفع من IPTV إلى LuluStream

## 📋 الخطوات السريعة

### 1️⃣ الاختبار (بدون رفع فعلي)
```bash
cd lulu-uploader
node iptv.js --dry --mode movies --limit 3
```
هذا سيعرض لك الأفلام المتاحة بدون رفعها.

---

### 2️⃣ الرفع الفعلي

#### رفع فيلمين:
```bash
# الطريقة الأولى
cd lulu-uploader
node iptv.js --mode movies --limit 2

# الطريقة الثانية (أسهل)
upload_movies.bat
```

#### رفع 3 حلقات مسلسلات:
```bash
# الطريقة الأولى
cd lulu-uploader
node iptv.js --mode series --limit 3

# الطريقة الثانية (أسهل)
upload_series.bat
```

---

## 📊 الاستعلام عن المحتوى المرفوع

### عرض جميع المسلسلات:
```bash
list_series.bat
```

### عرض حلقات مسلسل محدد:
```bash
# جميع الحلقات
check_series.bat 12345

# حلقات موسم محدد
check_series.bat 12345 1

# حلقة محددة
check_series.bat 12345 1 5
```

---

## 🗂️ هيكل قاعدة البيانات

### جدول `lulu_catalog` - الأفلام والمسلسلات
```
id          | title              | vod_type | file_code | episode_count
------------|--------------------|---------|-----------|--------------
movie_123   | فيلم الهيبة        | movie   | abc123    | 0
series_456  | مسلسل الهيبة       | series  | def456    | 30
```

### جدول `lulu_episodes` - حلقات المسلسلات
```
catalog_id  | season | episode | title           | file_code
------------|--------|---------|-----------------|----------
series_456  | 1      | 1       | الحلقة الأولى   | xyz001
series_456  | 1      | 2       | الحلقة الثانية  | xyz002
series_456  | 2      | 1       | الحلقة الأولى   | xyz003
```

---

## 🔗 كيف يتم ربط المسلسل بحلقاته؟

### المثال:
```
المسلسل في lulu_catalog:
  id = "series_456"
  title = "مسلسل الهيبة"
  
الحلقات في lulu_episodes:
  catalog_id = "series_456"  ← نفس id المسلسل
  season = 1, episode = 1
  
  catalog_id = "series_456"  ← نفس id المسلسل
  season = 1, episode = 2
```

### الاستعلام SQL:
```sql
-- جميع حلقات المسلسل
SELECT * FROM lulu_episodes
WHERE catalog_id = 'series_456'
ORDER BY season, episode;

-- حلقات موسم محدد
SELECT * FROM lulu_episodes
WHERE catalog_id = 'series_456' AND season = 1;

-- حلقة محددة
SELECT * FROM lulu_episodes
WHERE catalog_id = 'series_456' AND season = 1 AND episode = 5;
```

---

## ⏱️ كم يستغرق الرفع؟

| النوع | الحجم | المدة المتوقعة |
|------|------|----------------|
| فيلم صغير | 500 MB | 30-60 ثانية |
| فيلم متوسط | 1-2 GB | 1-3 دقائق |
| فيلم كبير | 4+ GB | 5-10 دقائق |
| حلقة مسلسل | 300-500 MB | 30-90 ثانية |

### مثال: رفع فيلمين
- **الوقت الإجمالي**: 5-15 دقيقة
- **التأخير الأولي**: 8-13 ثانية
- **رفع الفيلم الأول**: 1-3 دقائق
- **تأخير بين الأفلام**: 5-8 ثواني
- **رفع الفيلم الثاني**: 1-3 دقائق

---

## 🛡️ الأمان والحماية

### ✅ ما يحدث:
1. السكريبت يقرأ الفيديو من IPTV
2. يرفعه مباشرة إلى LuluStream (stream pipe)
3. يحفظ المعلومات في PostgreSQL
4. **لا يتم حفظ الفيديو على جهازك**

### ✅ الحماية من Rate Limits:
- تأخير 1.2 ثانية قبل إنشاء كل مجلد
- تأخير 5-8 ثواني بعد كل رفع ناجح
- معالجة تسلسلية (فيلم واحد في كل مرة)

---

## 🔧 الأوامر المفيدة

### معلومات حساب IPTV:
```bash
cd lulu-uploader
node iptv.js account
```

### عرض التصنيفات العربية:
```bash
cd lulu-uploader
node iptv.js categories
```

### رفع من تصنيف محدد:
```bash
cd lulu-uploader
node iptv.js --mode movies --category "مترجم" --limit 5
```

---

## 📁 الملفات المهمة

### ملفات التكوين:
- `lulu-uploader/.env` - بيانات الاعتماد (IPTV, LuluStream, TMDB, Database)

### ملفات الحالة:
- `lulu-uploader/iptv-state.json` - تتبع المحتوى المرفوع
- `lulu-uploader/iptv-results.json` - سجل النتائج

### ملفات التشغيل:
- `upload_movies.bat` - رفع أفلام
- `upload_series.bat` - رفع مسلسلات
- `list_series.bat` - عرض المسلسلات
- `check_series.bat` - الاستعلام عن حلقات مسلسل

---

## 🐛 حل المشاكل الشائعة

### المشكلة: "Requests limit reached: 60 per min"
**السبب**: محاولة إنشاء مجلدات كثيرة دفعة واحدة  
**الحل**: السكريبت الآن يعالج كل فيلم بالكامل قبل الانتقال للتالي ✅

### المشكلة: "MaxListenersExceededWarning"
**السبب**: عدد كبير من الاتصالات المتزامنة  
**الحل**: تم زيادة الحد إلى 100 ✅

### المشكلة: "IPTV account not Active"
**السبب**: انتهاء صلاحية اشتراك IPTV  
**الحل**: تحقق من الحساب:
```bash
cd lulu-uploader
node iptv.js account
```

---

## 📊 مثال على النتائج

بعد تشغيل `upload_movies.bat`:
```
══════════════════════════════════════════════════
  IPTV → LuluStream
  الوضع  : movies
  الحد   : 2 عنصر
  الاختبار: لا (رفع حقيقي)
══════════════════════════════════════════════════

[DB] ✓ قاعدة البيانات جاهزة
⏳ تأخير البداية: 10.3s (لتجنب تعارض الاتصالات)...

جاري التحقق من حساب IPTV...
  المستخدم : 5577554210
  الحالة   : Active
  الانتهاء : 22‏/4‏/2026
  الاتصالات: 0 / 2

══ الأفلام العربية ══
  التصنيفات: [AR] Arabic Movies

  [تصنيف] [AR] Arabic Movies

  [⬆ رفع] فيلم الهيبة
  [📁] إنشاء المجلدات...
  [📤] جاري الرفع...
  [✅] اكتمل الرفع - File Code: abc123xyz
  [💾] حفظ في قاعدة البيانات...
  [💾 DB] ✓ تم الحفظ
  ✅ abc123xyz  →  https://lulustream.com/abc123xyz.html

  [⬆ رفع] فيلم آخر
  [📁] إنشاء المجلدات...
  [📤] جاري الرفع...
  [✅] اكتمل الرفع - File Code: def456uvw
  [💾] حفظ في قاعدة البيانات...
  [💾 DB] ✓ تم الحفظ
  ✅ def456uvw  →  https://lulustream.com/def456uvw.html

══════════════════════════════════════════════════
  ✅ نجح: 2  |  ⏭ تخطي: 0  |  ❌ فشل: 0
  النتائج: iptv-results.json
  الكتالوج محفوظ في: PostgreSQL
══════════════════════════════════════════════════
```

---

## 📚 للمزيد من التفاصيل

- **التوثيق الكامل**: `lulu-uploader/README.md`
- **هيكل قاعدة البيانات**: `lulu-uploader/DATABASE_SCHEMA.md`
- **الدوال المتاحة**: راجع `lulu-uploader/src/db.js`

---

## ✅ الخلاصة

### للرفع:
```bash
upload_movies.bat    # رفع أفلام
upload_series.bat    # رفع مسلسلات
```

### للاستعلام:
```bash
list_series.bat           # عرض جميع المسلسلات
check_series.bat 12345    # عرض حلقات مسلسل محدد
```

### النتيجة:
- ✅ الفيديوهات مرفوعة على LuluStream
- ✅ المعلومات محفوظة في PostgreSQL
- ✅ روابط التشغيل جاهزة
- ✅ لا توجد ملفات محلية (stream pipe مباشر)

---

**🎉 جاهز للاستخدام!**
