# أكبر مكتبات الأفلام والمسلسلات العربية والأجنبية
# Largest Movie & Series Libraries (Arabic & International)

## 🎬 قواعد البيانات العالمية | International Databases

### 1. **TMDB (The Movie Database)** ⭐ الأفضل
**الموقع**: https://www.themoviedb.org/
**API**: https://developers.themoviedb.org/

#### المميزات:
- ✅ **أكبر قاعدة بيانات مجانية** في العالم
- ✅ أكثر من **1 مليون فيلم** و **200,000 مسلسل**
- ✅ محتوى عربي وأجنبي وتركي وكوري وهندي
- ✅ API مجاني بالكامل (50 طلب/ثانية)
- ✅ صور عالية الجودة (Posters, Backdrops)
- ✅ معلومات كاملة (Cast, Crew, Ratings, Trailers)
- ✅ ترجمات بـ 39 لغة (بما فيها العربية)
- ✅ تحديث يومي من المجتمع

#### كيفية الاستخدام:
```javascript
// 1. احصل على API Key مجاني من:
// https://www.themoviedb.org/settings/api

// 2. مثال: البحث عن فيلم
const API_KEY = 'your_api_key';
const response = await fetch(
  `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=الرسالة&language=ar`
);

// 3. مثال: أحدث الأفلام العربية
const arabic = await fetch(
  `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_original_language=ar&sort_by=release_date.desc`
);

// 4. مثال: تفاصيل فيلم
const details = await fetch(
  `https://api.themoviedb.org/3/movie/550?api_key=${API_KEY}&language=ar`
);
```

#### المحتوى العربي في TMDB:
- أفلام مصرية: **15,000+**
- أفلام خليجية: **3,000+**
- أفلام لبنانية وسورية: **2,000+**
- مسلسلات عربية: **5,000+**

---

### 2. **OMDb (Open Movie Database)**
**الموقع**: https://www.omdbapi.com/
**API**: مجاني (1,000 طلب/يوم)

#### المميزات:
- ✅ بيانات من IMDb مباشرة
- ✅ تقييمات Rotten Tomatoes و Metacritic
- ✅ API بسيط وسريع
- ❌ محتوى عربي محدود

---

### 3. **IMDb (Internet Movie Database)**
**الموقع**: https://www.imdb.com/
**API**: مدفوع فقط (AWS Data Exchange)

#### المميزات:
- ✅ أكبر قاعدة بيانات في العالم (10+ مليون عنوان)
- ✅ تقييمات موثوقة
- ❌ API مدفوع ($$$)
- ❌ لا يوجد API مجاني رسمي

---

## 🇸🇦 منصات المحتوى العربي | Arabic Content Platforms

### 1. **Shahid (شاهد)** ⭐ الأكبر عربياً
**الموقع**: https://shahid.mbc.net/
**المالك**: MBC Group (السعودية)

#### المميزات:
- ✅ **أكبر مكتبة محتوى عربي** في العالم
- ✅ أكثر من **20,000 ساعة** محتوى عربي
- ✅ أفلام ومسلسلات مصرية وخليجية ولبنانية
- ✅ محتوى تركي وكوري وهندي مدبلج
- ✅ إنتاجات أصلية حصرية (Shahid Originals)
- ✅ بث مباشر لقنوات MBC
- ✅ 4.4 مليون مشترك نشط (2024)
- ❌ مدفوع (لكن يوجد محتوى مجاني محدود)

#### الاشتراك:
- **Shahid VIP**: $9.99/شهر
- **Shahid + Netflix Bundle**: متوفر في السعودية

---

### 2. **OSN+ (أو إس إن)**
**الموقع**: https://www.osnplus.com/
**المالك**: OSN (الإمارات)

#### المميزات:
- ✅ محتوى عربي وأجنبي
- ✅ أفلام هوليوود حصرية
- ✅ مسلسلات HBO و Paramount+
- ❌ مدفوع فقط

---

### 3. **Watch iT (واتش إت)**
**الموقع**: https://www.watchit.com/
**المالك**: United Media Services (مصر)

#### المميزات:
- ✅ أكبر مكتبة محتوى مصري
- ✅ أفلام ومسلسلات مصرية كلاسيكية وحديثة
- ✅ إنتاجات أصلية
- ❌ مدفوع

---

### 4. **Weyyak (ويّاك)**
**الموقع**: https://weyyak.com/
**المالك**: Weyyak (الكويت)

#### المميزات:
- ✅ محتوى خليجي وعربي
- ✅ مسلسلات رمضانية
- ✅ أفلام عربية
- ✅ بعض المحتوى مجاني

---

## 🌐 مصادر محتوى مجانية | Free Content Sources

### 1. **VidSrc API** ⭐ مجاني
**الموقع**: https://vidsrc.xyz/
**النوع**: Streaming Resolver

#### المميزات:
- ✅ مجاني بالكامل
- ✅ يدعم TMDB IDs
- ✅ روابط streaming مباشرة
- ✅ محتوى عربي وأجنبي
- ✅ ترجمات متعددة

#### كيفية الاستخدام:
```javascript
// فيلم
https://vidsrc.xyz/embed/movie/tmdb_id

// مسلسل
https://vidsrc.xyz/embed/tv/tmdb_id/season/episode
```

---

### 2. **Consumet API** ⭐ مجاني
**GitHub**: https://github.com/consumet/api.consumet.org
**الموقع**: https://consumet.org/

#### المميزات:
- ✅ مجاني ومفتوح المصدر
- ✅ يدعم عدة مصادر (FlixHQ, Dramacool, GogoAnime)
- ✅ API جاهز للاستخدام
- ✅ محتوى عربي وأجنبي وآسيوي

#### كيفية الاستخدام:
```javascript
// البحث
GET https://api.consumet.org/movies/flixhq/search?query=breaking+bad

// تفاصيل
GET https://api.consumet.org/movies/flixhq/info?id=movie-id

// روابط المشاهدة
GET https://api.consumet.org/movies/flixhq/watch?episodeId=episode-id
```

---

### 3. **LuluStream** (محلي في نظامك)
**الموقع**: https://lulustream.com/

#### المميزات:
- ✅ محتوى عربي مرفوع
- ✅ أفلام ومسلسلات عربية
- ✅ جودة عالية
- ✅ مدمج في نظامك بالفعل

---

### 4. **IPTV-ORG** (قنوات مجانية)
**GitHub**: https://github.com/iptv-org/iptv
**الموقع**: https://iptv-org.github.io/

#### المميزات:
- ✅ **8,000+ قناة مجانية** من جميع أنحاء العالم
- ✅ قنوات عربية: **500+**
- ✅ قنوات أفلام ومسلسلات
- ✅ تحديث يومي
- ✅ مجاني بالكامل

#### القنوات العربية:
```
https://iptv-org.github.io/iptv/countries/sa.m3u  # السعودية
https://iptv-org.github.io/iptv/countries/eg.m3u  # مصر
https://iptv-org.github.io/iptv/countries/ae.m3u  # الإمارات
https://iptv-org.github.io/iptv/countries/iq.m3u  # العراق
https://iptv-org.github.io/iptv/languages/ara.m3u # كل القنوات العربية
```

---

## 📊 مقارنة المصادر | Sources Comparison

| المصدر | المحتوى | مجاني؟ | API | محتوى عربي | التقييم |
|--------|---------|---------|-----|------------|----------|
| **TMDB** | 1M+ فيلم | ✅ نعم | ✅ نعم | ⭐⭐⭐⭐ | 🏆 الأفضل |
| **Shahid** | 20K+ ساعة | ❌ مدفوع | ❌ لا | ⭐⭐⭐⭐⭐ | 🥇 عربي |
| **VidSrc** | Unlimited | ✅ نعم | ✅ نعم | ⭐⭐⭐ | 🥈 مجاني |
| **Consumet** | Unlimited | ✅ نعم | ✅ نعم | ⭐⭐⭐ | 🥉 متنوع |
| **OMDb** | 500K+ | ✅ محدود | ✅ نعم | ⭐⭐ | ⭐ بسيط |
| **LuluStream** | 10K+ | ✅ نعم | ✅ نعم | ⭐⭐⭐⭐ | ⭐ محلي |
| **IPTV-ORG** | 8K+ قناة | ✅ نعم | ❌ لا | ⭐⭐⭐⭐ | ⭐ قنوات |

---

## 🎯 التوصيات | Recommendations

### للمحتوى العربي:
1. **TMDB** - للبيانات والمعلومات (مجاني)
2. **Shahid** - للمشاهدة المباشرة (مدفوع)
3. **LuluStream** - محتوى مرفوع (مدمج في نظامك)
4. **IPTV-ORG** - قنوات مجانية

### للمحتوى الأجنبي:
1. **TMDB** - للبيانات (مجاني)
2. **VidSrc** - للمشاهدة (مجاني)
3. **Consumet** - للمشاهدة (مجاني)

### للنظام الحالي:
نظامك يستخدم بالفعل:
- ✅ **TMDB** - للبيانات
- ✅ **VidSrc** - للمشاهدة
- ✅ **LuluStream** - للمحتوى المرفوع
- ✅ **Xtream IPTV** - للقنوات المباشرة

---

## 💡 كيفية إضافة مصدر جديد | How to Add New Source

### مثال: إضافة Consumet API

1. **تثبيت المكتبة**:
```bash
npm install @consumet/extensions
```

2. **إنشاء ملف جديد**: `cloud-server/lib/consumet-resolver.js`
```javascript
const { MOVIES } = require('@consumet/extensions');

const flixhq = new MOVIES.FlixHQ();

async function searchMovies(query) {
  const results = await flixhq.search(query);
  return results.results;
}

async function getMovieInfo(id) {
  const info = await flixhq.fetchMediaInfo(id);
  return info;
}

async function getStreamingLinks(episodeId) {
  const links = await flixhq.fetchEpisodeSources(episodeId);
  return links;
}

module.exports = { searchMovies, getMovieInfo, getStreamingLinks };
```

3. **إضافة endpoint في server.js**:
```javascript
const consumet = require('./lib/consumet-resolver');

app.get('/api/consumet/search', async (req, res) => {
  const { q } = req.query;
  const results = await consumet.searchMovies(q);
  res.json({ results });
});
```

---

## 📈 إحصائيات المحتوى | Content Statistics

### TMDB (أكبر قاعدة بيانات):
- **أفلام**: 1,000,000+
- **مسلسلات**: 200,000+
- **ممثلين**: 3,000,000+
- **لغات**: 39 لغة
- **صور**: 5,000,000+
- **تحديثات**: يومية

### محتوى عربي في TMDB:
- **أفلام عربية**: 20,000+
- **مسلسلات عربية**: 5,000+
- **ممثلين عرب**: 50,000+

### Shahid (أكبر منصة عربية):
- **ساعات محتوى**: 20,000+
- **مشتركين**: 4,400,000
- **إنتاجات أصلية**: 100+
- **دول**: 22 دولة عربية

---

## 🔗 روابط مفيدة | Useful Links

### APIs:
- TMDB API Docs: https://developers.themoviedb.org/
- OMDb API: https://www.omdbapi.com/
- Consumet API: https://docs.consumet.org/
- VidSrc: https://vidsrc.xyz/

### GitHub Repos:
- IPTV-ORG: https://github.com/iptv-org/iptv
- Consumet: https://github.com/consumet/api.consumet.org
- TMDB Wrapper: https://github.com/cavestri/themoviedb-javascript-library

### مواقع مفيدة:
- JustWatch: https://www.justwatch.com/ (أين تشاهد)
- Letterboxd: https://letterboxd.com/ (مراجعات)
- Trakt: https://trakt.tv/ (تتبع المشاهدة)

---

## ✅ الخلاصة | Summary

**أفضل مصدر شامل**: **TMDB** (مجاني، ضخم، API ممتاز)

**أفضل محتوى عربي**: **Shahid** (مدفوع لكن الأكبر)

**أفضل مصدر مجاني**: **VidSrc + Consumet** (مجاني، روابط مباشرة)

**نظامك الحالي**: ممتاز! يستخدم أفضل المصادر المجانية

---

**تاريخ التحديث**: 2026-04-20
**المصادر**: TMDB, Shahid, IPTV-ORG, Consumet, VidSrc
