# 📊 هيكل قاعدة البيانات - LuluStream Catalog

## الجداول

### 1️⃣ `lulu_catalog` - الكتالوج الرئيسي

يحتوي على معلومات الأفلام والمسلسلات.

#### الأعمدة:

| العمود | النوع | الوصف |
|--------|------|-------|
| `id` | TEXT (PK) | معرف فريد (file_code أو series_id) |
| `title` | TEXT | عنوان الفيلم/المسلسل |
| `vod_type` | TEXT | نوع المحتوى: `movie` أو `series` |
| `poster` | TEXT | رابط صورة الغلاف |
| `backdrop` | TEXT | رابط الخلفية |
| `plot` | TEXT | القصة/الملخص |
| `year` | TEXT | سنة الإصدار |
| `rating` | TEXT | التقييم |
| `genres` | TEXT | التصنيفات (مفصولة بفواصل) |
| `cast_list` | TEXT | قائمة الممثلين |
| `director` | TEXT | المخرج |
| `country` | TEXT | البلد |
| `runtime` | TEXT | المدة |
| `tmdb_id` | INTEGER | معرف TMDB |
| `tmdb_type` | TEXT | نوع TMDB: `movie` أو `tv` |
| `imdb_id` | TEXT | معرف IMDB |
| `file_code` | TEXT | كود الملف في LuluStream |
| `embed_url` | TEXT | رابط التشغيل المضمن |
| `hls_url` | TEXT | رابط HLS للتشغيل |
| `canplay` | BOOLEAN | هل جاهز للتشغيل |
| `episode_count` | INTEGER | عدد الحلقات (للمسلسلات فقط) |
| `lulu_fld_id` | INTEGER | معرف المجلد في LuluStream |
| `uploaded_at` | BIGINT | تاريخ الرفع (timestamp) |
| `updated_at` | BIGINT | تاريخ آخر تحديث |

#### الفهارس:
- `idx_lulu_catalog_type` - على `vod_type`
- `idx_lulu_catalog_uploaded` - على `uploaded_at DESC`

---

### 2️⃣ `lulu_episodes` - حلقات المسلسلات

يحتوي على تفاصيل كل حلقة من حلقات المسلسلات.

#### الأعمدة:

| العمود | النوع | الوصف |
|--------|------|-------|
| `id` | SERIAL (PK) | معرف تلقائي |
| `catalog_id` | TEXT | معرف المسلسل (يربط مع `lulu_catalog.id`) |
| `season` | INTEGER | رقم الموسم |
| `episode` | INTEGER | رقم الحلقة |
| `title` | TEXT | عنوان الحلقة |
| `file_code` | TEXT | كود الملف في LuluStream |
| `embed_url` | TEXT | رابط التشغيل المضمن |
| `hls_url` | TEXT | رابط HLS للتشغيل |
| `canplay` | BOOLEAN | هل جاهزة للتشغيل |
| `thumbnail` | TEXT | صورة مصغرة للحلقة |
| `overview` | TEXT | ملخص الحلقة |
| `air_date` | TEXT | تاريخ العرض الأصلي |
| `duration` | INTEGER | مدة الحلقة (بالدقائق) |
| `created_at` | BIGINT | تاريخ الرفع (timestamp) |

#### الفهارس:
- `idx_lulu_episodes_catalog` - على `(catalog_id, season, episode)`
- `idx_lulu_ep_unique` - فهرس فريد على `(catalog_id, season, episode)`

---

## 🔗 العلاقات بين الجداول

```
lulu_catalog (المسلسل)
    ↓
    id = "12345"
    title = "مسلسل الهيبة"
    vod_type = "series"
    episode_count = 30
    
    ↓ (يرتبط بـ)
    
lulu_episodes (الحلقات)
    ↓
    catalog_id = "12345"  ← نفس id المسلسل
    season = 1, episode = 1
    
    catalog_id = "12345"
    season = 1, episode = 2
    
    catalog_id = "12345"
    season = 2, episode = 1
    ...
```

---

## 📝 استعلامات SQL مفيدة

### 1. الحصول على جميع حلقات مسلسل:
```sql
SELECT * FROM lulu_episodes
WHERE catalog_id = '12345'
ORDER BY season ASC, episode ASC;
```

### 2. الحصول على حلقات موسم محدد:
```sql
SELECT * FROM lulu_episodes
WHERE catalog_id = '12345' AND season = 1
ORDER BY episode ASC;
```

### 3. الحصول على حلقة محددة:
```sql
SELECT * FROM lulu_episodes
WHERE catalog_id = '12345' AND season = 1 AND episode = 5;
```

### 4. عدد الحلقات لكل موسم:
```sql
SELECT season, COUNT(*) as episode_count
FROM lulu_episodes
WHERE catalog_id = '12345'
GROUP BY season
ORDER BY season ASC;
```

### 5. جميع المسلسلات مع عدد حلقاتها:
```sql
SELECT id, title, episode_count, year
FROM lulu_catalog
WHERE vod_type = 'series'
ORDER BY uploaded_at DESC;
```

### 6. جميع الأفلام:
```sql
SELECT id, title, year, rating, genres
FROM lulu_catalog
WHERE vod_type = 'movie'
ORDER BY uploaded_at DESC;
```

### 7. البحث بالعنوان:
```sql
SELECT * FROM lulu_catalog
WHERE title ILIKE '%الهيبة%';
```

### 8. المسلسلات التي لها حلقات جاهزة للتشغيل:
```sql
SELECT DISTINCT c.id, c.title, c.episode_count
FROM lulu_catalog c
JOIN lulu_episodes e ON c.id = e.catalog_id
WHERE c.vod_type = 'series' AND e.canplay = true;
```

---

## 🛠️ الدوال المتاحة في `db.js`

### للأفلام:
- `saveMovieToCatalog(data)` - حفظ فيلم

### للمسلسلات:
- `saveSeriesEpisode(seriesData, episodeData)` - حفظ حلقة مسلسل
- `getSeriesInfo(seriesId)` - معلومات المسلسل
- `getSeriesEpisodes(seriesId)` - جميع حلقات المسلسل
- `getSeasonEpisodes(seriesId, season)` - حلقات موسم محدد
- `getEpisode(seriesId, season, episode)` - حلقة محددة
- `getSeriesSeasons(seriesId)` - قائمة المواسم مع عدد الحلقات

---

## 🚀 أدوات الاستعلام

### 1. عرض جميع المسلسلات:
```bash
node list-series.js
# أو
list_series.bat
```

### 2. الاستعلام عن مسلسل محدد:
```bash
# جميع حلقات المسلسل
node test-series-query.js 12345

# حلقات موسم محدد
node test-series-query.js 12345 1

# حلقة محددة
node test-series-query.js 12345 1 5
```

### 3. باستخدام bat files:
```bash
# عرض جميع المسلسلات
list_series.bat

# الاستعلام عن مسلسل
check_series.bat 12345
check_series.bat 12345 1
check_series.bat 12345 1 5
```

---

## 📌 ملاحظات مهمة

1. **معرف المسلسل (`catalog_id`)**: يُستخدم `series_id` من IPTV كمعرف فريد للمسلسل
2. **معرف الحلقة**: يُستخدم `episode.id` من IPTV لتتبع الحلقات المرفوعة
3. **الفهرس الفريد**: يمنع تكرار نفس الحلقة (catalog_id + season + episode)
4. **التحديث التلقائي**: عند رفع حلقة جديدة، يتم تحديث `episode_count` في `lulu_catalog`
5. **الحفظ بعد النجاح**: يتم الحفظ في DB فقط بعد نجاح رفع الفيديو إلى LuluStream

---

## 🔄 سير العمل

### رفع فيلم:
1. رفع الفيديو إلى LuluStream ✅
2. الحصول على `file_code` ✅
3. حفظ في `lulu_catalog` مع `vod_type = 'movie'` ✅

### رفع حلقة مسلسل:
1. رفع الفيديو إلى LuluStream ✅
2. الحصول على `file_code` ✅
3. حفظ/تحديث المسلسل في `lulu_catalog` مع `vod_type = 'series'` ✅
4. حفظ الحلقة في `lulu_episodes` ✅
5. تحديث `episode_count` في `lulu_catalog` ✅
