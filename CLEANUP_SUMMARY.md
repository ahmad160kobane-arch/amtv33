# ملخص تنظيف تطبيق الويب - AM Live

## التغييرات المنفذة ✅

### 1. حذف نظام VidSrc بالكامل ❌→✅
- **`api.ts`**: حذف الأنواع `VidsrcItem`, `VidsrcDetail`, `VidsrcEpisode`
- **`api.ts`**: حذف الدوال `fetchVidsrcHome()`, `fetchVidsrcBrowse()`, `fetchVidsrcDetail()`, `searchVidsrc()`, `requestVidsrcStream()`
- **`detail/page.tsx`**: حذف متغير `sourceLulu` والمسار الميت (كان دائماً true)
- **`detail/page.tsx`**: تعريف أنواع محلية `ContentDetail` و `ContentEpisode` بدلاً من VidsrcDetail/VidsrcEpisode
- **`detail/page.tsx`**: حذف دالة `fetchSubtitles` الميتة
- **`HeroSlider.tsx`**: حذف استيراد `VidsrcItem` وتعريف `HeroItem` محلياً
- **`next.config.js`**: حذف إعادة التوجيه `/api/vidsrc/:path*`
- **حذف ملف**: `src/app/api/proxy/embed/route.ts` (كان لـ VidSrc embeds)
- **`next.config.js`**: حذف إعادة التوجيه `/api/embed-proxy`

### 2. حذف نظام Xtream VOD بالكامل ❌→✅
- **`api.ts`**: حذف كل أنواع IPTV: `IptvVodItem`, `IptvVodDetail`, `IptvEpisode`, `IptvSeason`, `IptvSeriesDetail`, `IptvBrowseResult`, `IptvHomeData`, `IptvCategoryWithMovies`
- **`api.ts`**: حذف كل الدوال: `fetchIptvHome()`, `fetchIptvCategoriesWithMovies()`, `fetchIptvMovies()`, `fetchIptvSeries()`, `fetchIptvMovieDetail()`, `fetchIptvSeriesDetail()`, `fetchIptvSearch()`, `requestIptvVodStream()`, `requestIptvSeriesStream()`

### 3. حذف نظام القنوات المميزة القديم ❌→✅
- **`api.ts`**: حذف نوع `Channel` (كان يستخدم viewers, is_streaming, enabled)
- **`api.ts`**: حذف دالة `fetchChannels()` (لم تُستدعَ من أي صفحة)

### 4. إصلاح أخطاء ⚠️→✅
- **`favorites/page.tsx`**: إصلاح روابط مكسورة — `tmdbId=` → `id=` + `source=lulu` + `type=series` بدل `type=tv`
- **`history/page.tsx`**: إصلاح نفس المشكلة
- **`mylist/page.tsx`**: إصلاح نفس المشكلة
- **`detail/page.tsx`**: إضافة حقل `trailer` المفقود لنوع `ContentDetail`

### 5. تنظيف الباك اند ❌→✅
- **`backend-api/routes/vod.js`**: حذف مسارات Consumet/FlixHQ الميتة (`/all`, `/:id`, `/:id/episodes`, `/play/:token`)
- **`backend-api/routes/vod.js`**: حذف استيراد `consumet` و `requirePremium` غير المستخدمين
- المسارات النشطة المتبقية: `/favorite`, `/favorites/list`, `/rate`, `/:id/rating`

---

## الأنظمة النشطة المتبقية ✅

| النظام | الاستخدام | الملفات |
|--------|-----------|---------|
| **LuluStream** | أفلام ومسلسلات | `api.ts`, `detail/`, `allcontent/`, `entertainment/`, `kids/` |
| **Xtream Channels** | بث مباشر | `api.ts`, `live/`, `kids/` |
| **Auth/Session** | تسجيل دخول | `api.ts`, `AuthContext.tsx` |
| **Subscription** | اشتراكات | `api.ts`, `subscription/` |
| **Agent** | وكلاء | `api.ts`, `agent/` |
| **Favorites/History** | مفضلة وتاريخ | `api.ts`, `favorites/`, `history/`, `mylist/` |

---

## ملاحظات ⚠️
- **cloud-server/** يحتوي على كود VidSrc/Consumet/Vidlink ميت لكنه سيرفر منفصل — يحتاج تنظيف منفصل
- **الملفات المؤقتة** في جذر المشروع (`_test_*.js`, `_deploy_*.js`, إلخ) هي أدوات تطوير قديمة يمكن حذفها لاحقاً
- **`entertainment/`** و **`allcontent/`** متطابقتان تقريباً — يمكن دمجهما في صفحة واحدة لاحقاً
