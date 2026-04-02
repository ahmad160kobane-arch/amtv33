# Consumet Extensions Integration

## التغييرات الرئيسية

### 1. مصادر المحتوى
- **القنوات المباشرة**: IPTV (Xtream Codes)
- **الأفلام والمسلسلات**: Consumet Extensions + TMDB API

### 2. الملفات المعدلة

#### `lib/consumet.js` (جديد)
مكتبة للتعامل مع Consumet Extensions و TMDB API:
- `fetchPopularMovies()` - جلب الأفلام الشائعة
- `fetchPopularSeries()` - جلب المسلسلات الشائعة
- `fetchMovieDetails()` - تفاصيل الفيلم
- `fetchSeriesDetails()` - تفاصيل المسلسل
- `fetchSeasonEpisodes()` - حلقات الموسم
- `getMovieStreamUrl()` - روابط m3u8 مباشرة للأفلام
- `getEpisodeStreamUrl()` - روابط m3u8 مباشرة للحلقات
- `searchContent()` - البحث في TMDB

#### المزودات المتاحة:
- **FlixHQ**: أفلام ومسلسلات (إنجليزي + مترجم)
- **ArabSeed**: محتوى عربي (أفلام ومسلسلات عربية)
- **FaselHD**: محتوى عربي مدبلج ومترجم (يمكن إضافته)

#### `routes/vod.js` (معدل)
- تم إعادة كتابته بالكامل لاستخدام Consumet
- جميع الأفلام والمسلسلات تأتي من TMDB
- روابط التشغيل m3u8 مباشرة من Consumet

#### `iptv-sync.js` (معدل)
- يقوم فقط بمزامنة القنوات المباشرة
- تم إزالة مزامنة الأفلام والمسلسلات

### 3. إعداد TMDB API

يجب إضافة مفتاح TMDB API في `lib/consumet.js`:

```javascript
const TMDB_API_KEY = 'YOUR_TMDB_API_KEY';
```

للحصول على المفتاح:
1. سجل في https://www.themoviedb.org/
2. اذهب إلى Settings > API
3. انسخ API Key (v3 auth)

### 4. كيفية عمل النظام الجديد

#### الأفلام:
1. التطبيق يطلب قائمة الأفلام من `/api/vod/all?type=movie`
2. Backend يجلب من TMDB API
3. عند اختيار فيلم، يتم جلب التفاصيل من TMDB
4. عند الضغط على تشغيل، يتم جلب رابط m3u8 مباشر من Consumet/FlixHQ

#### المسلسلات:
1. التطبيق يطلب قائمة المسلسلات من `/api/vod/all?type=series`
2. Backend يجلب من TMDB API
3. عند اختيار مسلسل، يتم جلب المواسم والحلقات
4. عند الضغط على تشغيل حلقة، يتم جلب رابط m3u8 مباشر من Consumet

#### القنوات المباشرة:
- تبقى كما هي من IPTV
- يتم مزامنتها عبر `node iptv-sync.js`

### 5. المميزات

✅ روابط m3u8 مباشرة (لا حاجة لـ embed)
✅ ترجمات متعددة مدمجة
✅ جودات متعددة (1080p, 720p, 480p, auto)
✅ محتوى ضخم من TMDB (ملايين الأفلام والمسلسلات)
✅ تفاصيل كاملة (ممثلين، مخرج، تقييمات، إلخ)
✅ صور عالية الجودة (posters, backdrops)
✅ دعم البحث المتقدم
✅ مفتوح المصدر ومجاني
✅ يعمل على السيرفر مباشرة (لا حاجة لخدمات خارجية)

### 6. الاستخدام

```bash
# تثبيت المكتبة
cd backend-api
npm install @consumet/extensions

# مزامنة القنوات المباشرة فقط
node iptv-sync.js

# تشغيل السيرفر
npm start
```

### 7. ملاحظات مهمة

- Consumet يوفر روابط m3u8 مباشرة
- TMDB API مجاني (40 طلب/10 ثواني)
- يمكن إضافة مزودات إضافية (ArabSeed, FaselHD)
- يمكن إضافة cache للطلبات لتحسين الأداء
- الروابط تعمل مباشرة في المشغل بدون embed

### 8. إضافة مزودات عربية

لإضافة ArabSeed أو FaselHD، قم بتعديل `lib/consumet.js`:

```javascript
const arabseed = new MOVIES.ArabSeed();
// أو
const faselhd = new MOVIES.FaselHD();
```

ثم استخدمها في دوال البحث والتشغيل.
