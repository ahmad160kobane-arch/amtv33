# 🚀 IPTV to LuluStream Uploader

نظام متكامل لرفع الأفلام والمسلسلات من IPTV إلى LuluStream مع حفظ الكتالوج في PostgreSQL.

---

## ✨ المميزات

- ✅ رفع تلقائي من IPTV إلى LuluStream (stream pipe - بدون حفظ محلي)
- ✅ دعم الأفلام والمسلسلات العربية
- ✅ جلب البيانات من TMDB (صور، معلومات، تقييمات)
- ✅ حفظ الكتالوج في PostgreSQL
- ✅ تتبع الحالة (uploaded/failed)
- ✅ تجنب التكرار (skip uploaded items)
- ✅ معالجة تسلسلية (فيلم واحد في كل مرة)
- ✅ حماية من rate limits (تأخيرات ذكية)

---

## 📦 التثبيت

```bash
cd lulu-uploader
npm install
```

### المتطلبات:
- Node.js 16+
- حساب IPTV نشط
- حساب LuluStream
- قاعدة بيانات PostgreSQL

---

## ⚙️ الإعداد

### 1. ملف `.env`:
```env
# IPTV Credentials
IPTV_URL=http://your-iptv-server.com
IPTV_USERNAME=your_username
IPTV_PASSWORD=your_password

# LuluStream API
LULU_API_KEY=your_lulustream_api_key

# TMDB API (اختياري - لجلب البيانات)
TMDB_API_KEY=your_tmdb_api_key

# PostgreSQL Database
DATABASE_URL=postgresql://user:pass@host:port/database
```

### 2. تهيئة قاعدة البيانات:
```bash
node -e "require('./src/db').ensureTables().then(() => process.exit())"
```

---

## 🎬 الاستخدام

### 1️⃣ رفع الأفلام

#### اختبار (بدون رفع فعلي):
```bash
node iptv.js --dry --mode movies --limit 3
```

#### رفع فعلي:
```bash
# رفع فيلمين
node iptv.js --mode movies --limit 2

# أو استخدم bat file
upload_movies.bat
```

---

### 2️⃣ رفع المسلسلات

#### اختبار:
```bash
node iptv.js --dry --mode series --limit 3
```

#### رفع فعلي:
```bash
# رفع 5 حلقات
node iptv.js --mode series --limit 5

# أو استخدم bat file
upload_series.bat
```

---

### 3️⃣ رفع الكل (أفلام + مسلسلات)

```bash
node iptv.js --limit 10
```

---

### 4️⃣ تصنيف محدد فقط

```bash
# أفلام من تصنيف معين
node iptv.js --mode movies --category "مترجم" --limit 5

# مسلسلات من تصنيف معين
node iptv.js --mode series --category "رمضان" --limit 10
```

---

## 📊 الاستعلامات

### عرض جميع المسلسلات:
```bash
node list-series.js
# أو
list_series.bat
```

### الاستعلام عن مسلسل محدد:
```bash
# جميع حلقات المسلسل
node test-series-query.js 12345

# حلقات موسم محدد
node test-series-query.js 12345 1

# حلقة محددة
node test-series-query.js 12345 1 5
```

### باستخدام bat files:
```bash
check_series.bat 12345
check_series.bat 12345 1
check_series.bat 12345 1 5
```

---

## 🗂️ هيكل المجلدات في LuluStream

### الأفلام:
```
[AR] Arabic Movies/
  ├── فيلم 1/
  │   └── فيلم 1.mkv
  ├── فيلم 2/
  │   └── فيلم 2.mkv
  └── ...
```

### المسلسلات:
```
[AR] Arabic Series/
  ├── مسلسل الهيبة/
  │   ├── الموسم 1/
  │   │   ├── الحلقة 01.mkv
  │   │   ├── الحلقة 02.mkv
  │   │   └── ...
  │   ├── الموسم 2/
  │   │   ├── الحلقة 01.mkv
  │   │   └── ...
  │   └── ...
  └── ...
```

---

## 💾 قاعدة البيانات

### الجداول:

#### 1. `lulu_catalog` - الكتالوج الرئيسي
- الأفلام: `vod_type = 'movie'`
- المسلسلات: `vod_type = 'series'`

#### 2. `lulu_episodes` - حلقات المسلسلات
- يرتبط بـ `lulu_catalog` عبر `catalog_id`
- كل حلقة لها `season` و `episode`

📖 **للمزيد**: راجع [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

---

## 📝 الملفات المهمة

### ملفات الحالة:
- `iptv-state.json` - تتبع الأفلام/الحلقات المرفوعة
- `iptv-results.json` - سجل النتائج

### ملفات التكوين:
- `.env` - بيانات الاعتماد
- `src/xtream-api.js` - IPTV API client
- `src/lulu-api.js` - LuluStream API client
- `src/tmdb-api.js` - TMDB API client
- `src/db.js` - PostgreSQL operations

---

## 🔧 الأوامر المتقدمة

### معلومات حساب IPTV:
```bash
node iptv.js account
```

### عرض التصنيفات العربية:
```bash
node iptv.js categories
```

### تفعيل وضع Debug:
```bash
DEBUG=1 node iptv.js --mode movies --limit 2
```

---

## ⚡ الأداء والحدود

### التأخيرات الذكية:
- **بداية التشغيل**: 8-13 ثانية (تجنب تعارض الاتصالات)
- **إنشاء مجلد**: 1.2 ثانية (تجنب 60 req/min limit)
- **بعد كل رفع**: 5-8 ثواني (تجنب rate limits)

### مدة الرفع:
- **فيلم صغير** (500 MB): ~30-60 ثانية
- **فيلم متوسط** (1-2 GB): ~1-3 دقائق
- **فيلم كبير** (4+ GB): ~5-10 دقائق
- **حلقة مسلسل** (300-500 MB): ~30-90 ثانية

### الحدود الموصى بها:
- **اختبار**: `--limit 2-3`
- **رفع يومي**: `--limit 10-20`
- **رفع مكثف**: `--limit 50-100` (مع مراقبة)

---

## 🛡️ الأمان

- ✅ لا يتم حفظ الفيديوهات محلياً (stream pipe مباشر)
- ✅ بيانات الاعتماد في `.env` (مستثناة من git)
- ✅ SSL للاتصال بقاعدة البيانات
- ✅ تتبع الأخطاء والفشل

---

## 🐛 استكشاف الأخطاء

### خطأ: "Requests limit reached: 60 per min"
**الحل**: السكريبت الآن يعالج كل فيلم بالكامل قبل الانتقال للتالي. تأكد من استخدام أحدث نسخة.

### خطأ: "MaxListenersExceededWarning"
**الحل**: تم زيادة الحد إلى 100. إذا استمر الخطأ، قلل `--limit`.

### خطأ: "IPTV account not Active"
**الحل**: تحقق من صلاحية اشتراك IPTV:
```bash
node iptv.js account
```

### خطأ: "Database connection failed"
**الحل**: تحقق من `DATABASE_URL` في `.env`

---

## 📈 الإحصائيات

بعد كل تشغيل، ستحصل على:
```
══════════════════════════════════════════════════
  ✅ نجح: 5  |  ⏭ تخطي: 10  |  ❌ فشل: 0
  النتائج: iptv-results.json
  الكتالوج محفوظ في: PostgreSQL
══════════════════════════════════════════════════
```

---

## 🔄 سير العمل الكامل

### رفع فيلم:
1. ✅ جلب قائمة الأفلام من IPTV
2. ✅ التحقق من عدم رفعه مسبقاً
3. ✅ جلب البيانات من TMDB
4. ✅ إنشاء المجلدات في LuluStream
5. ✅ رفع الفيديو (stream pipe)
6. ✅ حفظ في PostgreSQL
7. ✅ تحديث ملف الحالة
8. ✅ الانتقال للفيلم التالي

### رفع حلقة مسلسل:
1. ✅ جلب قائمة المسلسلات من IPTV
2. ✅ جلب حلقات المسلسل
3. ✅ التحقق من عدم رفع الحلقة مسبقاً
4. ✅ جلب البيانات من TMDB
5. ✅ إنشاء المجلدات (مسلسل/موسم)
6. ✅ رفع الحلقة (stream pipe)
7. ✅ حفظ المسلسل في `lulu_catalog`
8. ✅ حفظ الحلقة في `lulu_episodes`
9. ✅ تحديث `episode_count`
10. ✅ الانتقال للحلقة التالية

---

## 📞 الدعم

للمشاكل أو الاستفسارات، راجع:
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - هيكل قاعدة البيانات
- ملفات السجلات في `iptv-results.json`
- وضع Debug: `DEBUG=1 node iptv.js ...`

---

## 📜 الترخيص

هذا المشروع للاستخدام الشخصي فقط.
