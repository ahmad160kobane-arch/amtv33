# شرح VidSrc - ما هو وكيف يعمل؟
# VidSrc Explained - What is it and How Does it Work?

## 🎬 ما هو VidSrc؟

**VidSrc** هو **محلل روابط streaming** (Stream Resolver) يقوم بـ:
- ✅ استخراج روابط المشاهدة المباشرة من مواقع الاستضافة
- ✅ تحويل IMDb ID أو TMDB ID إلى رابط HLS/MP4 قابل للتشغيل
- ✅ توفير embed player جاهز للاستخدام
- ✅ دعم الأفلام والمسلسلات العربية والأجنبية

**VidSrc** is a **Stream Resolver** that:
- ✅ Extracts direct streaming links from hosting sites
- ✅ Converts IMDb ID or TMDB ID to playable HLS/MP4 links
- ✅ Provides ready-to-use embed player
- ✅ Supports Arabic and international movies/series

---

## 🌐 نطاقات VidSrc المختلفة | Different VidSrc Domains

يوجد عدة نطاقات لـ VidSrc، كل واحد مستقل:

### 1. **vidsrc.to** ⭐ الأصلي
- الموقع الأصلي والأكثر شهرة
- يدعم IMDb IDs
- embed player متقدم
- **الاستخدام**:
  ```
  https://vidsrc.to/embed/movie/tt1234567
  https://vidsrc.to/embed/tv/tt1234567/1/1
  ```

### 2. **vidsrc.me** 
- نسخة بديلة
- نفس الوظائف تقريباً
- **الاستخدام**:
  ```
  https://vidsrc.me/embed/movie?imdb=tt1234567
  https://vidsrc.me/embed/tv?imdb=tt1234567&season=1&episode=1
  ```

### 3. **vidsrc.xyz**
- نسخة أخرى
- يدعم TMDB IDs
- **الاستخدام**:
  ```
  https://vidsrc.xyz/embed/movie/tmdb_id
  https://vidsrc.xyz/embed/tv/tmdb_id/season/episode
  ```

### 4. **vidsrc.stream** / **vidsrc.icu** / **vidsrc.lol**
- نسخ تجارية
- توفر API مدفوع
- جودة أعلى
- دعم فني

---

## 🔧 كيف يعمل VidSrc؟ | How Does VidSrc Work?

### الآلية:

```
1. المستخدم يطلب فيلم بـ IMDb ID
   ↓
2. VidSrc يبحث عن الفيلم في قواعد بيانات الاستضافة
   ↓
3. يستخرج روابط من مواقع مثل:
   - Vidplay
   - Filemoon
   - MyCloud
   - Streamtape
   - وغيرها...
   ↓
4. يفك تشفير الروابط
   ↓
5. يعيد رابط HLS/MP4 مباشر
   ↓
6. المستخدم يشاهد الفيلم
```

### مثال عملي:

```javascript
// 1. المستخدم يريد مشاهدة فيلم "Inception"
const imdbId = "tt1375666";

// 2. VidSrc يستخرج الرابط
const embedUrl = `https://vidsrc.to/embed/movie/${imdbId}`;

// 3. VidSrc يحلل الرابط ويعيد HLS
// النتيجة: https://some-cdn.com/inception/master.m3u8

// 4. المستخدم يشاهد عبر HLS Player
```

---

## 💻 استخدام VidSrc في نظامك | Using VidSrc in Your System

### الطريقة الحالية (Embed):

نظامك يستخدم VidSrc عبر iframe embed:

```javascript
// في cloud-server/lib/vidsrc-resolver.js
async function getVidsrcEmbed(tmdbId, type, season, episode) {
  if (type === 'movie') {
    return `https://vidsrc.xyz/embed/movie/${tmdbId}`;
  } else {
    return `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
  }
}
```

### الطريقة المتقدمة (Direct Link):

استخراج الرابط المباشر بدلاً من embed:

```javascript
// مثال: استخدام vidsrc-to-resolver من GitHub
const { VidSrcToResolver } = require('vidsrc-to-resolver');

async function getDirectLink(imdbId, type, season, episode) {
  const resolver = new VidSrcToResolver();
  
  if (type === 'movie') {
    const sources = await resolver.resolveMovie(imdbId);
    return sources[0].url; // رابط HLS مباشر
  } else {
    const sources = await resolver.resolveEpisode(imdbId, season, episode);
    return sources[0].url;
  }
}
```

---

## 📦 مكتبات VidSrc على GitHub | VidSrc Libraries on GitHub

### 1. **vidsrc-to-resolver** ⭐ الأفضل
**GitHub**: https://github.com/Ciarands/vidsrc-to-resolver

```bash
npm install vidsrc-to-resolver
```

```javascript
const { VidSrcToResolver } = require('vidsrc-to-resolver');

const resolver = new VidSrcToResolver();
const sources = await resolver.resolveMovie('tt1375666');
console.log(sources[0].url); // رابط HLS مباشر
```

### 2. **vidsrc-api**
**GitHub**: https://github.com/cool-dev-guy/vidsrc-api

API جاهز للاستخدام:
```bash
git clone https://github.com/cool-dev-guy/vidsrc-api
cd vidsrc-api
npm install
npm start
```

```javascript
// استخدام API
const response = await fetch('http://localhost:3000/movie/tt1375666');
const data = await response.json();
console.log(data.streamUrl);
```

### 3. **VidSrc-Streamer** (Python)
**GitHub**: https://github.com/habitual69/VidSrc-Streamer

```python
from vidsrc_streamer import VidSrcStreamer

streamer = VidSrcStreamer()
url = streamer.get_stream_url('tt1375666')
print(url)
```

---

## 🆚 VidSrc vs مصادر أخرى | VidSrc vs Other Sources

| الميزة | VidSrc | Consumet | LuluStream | IPTV |
|--------|--------|----------|------------|------|
| **مجاني** | ✅ نعم | ✅ نعم | ✅ نعم | ⚠️ يعتمد |
| **محتوى عربي** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **محتوى أجنبي** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **جودة** | HD/FHD | HD/FHD | HD/FHD/4K | SD/HD |
| **استقرار** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **سرعة** | سريع | سريع | سريع جداً | متوسط |
| **API** | ✅ نعم | ✅ نعم | ✅ نعم | ❌ لا |
| **ترجمات** | ✅ نعم | ✅ نعم | ✅ نعم | ❌ لا |

---

## 🎯 متى تستخدم VidSrc؟ | When to Use VidSrc?

### استخدم VidSrc عندما:
- ✅ تريد محتوى أجنبي (هوليوود، كوري، تركي)
- ✅ تريد جودة عالية (HD/FHD)
- ✅ تريد ترجمات متعددة
- ✅ تريد استقرار عالي
- ✅ تريد API مجاني

### لا تستخدم VidSrc عندما:
- ❌ تريد محتوى عربي حصري (استخدم LuluStream)
- ❌ تريد قنوات مباشرة (استخدم IPTV)
- ❌ تريد محتوى محلي (استخدم مصادر محلية)

---

## 🔨 كيفية إضافة VidSrc Resolver إلى نظامك | How to Add VidSrc Resolver

### الخطوة 1: تثبيت المكتبة

```bash
cd cloud-server
npm install vidsrc-to-resolver
```

### الخطوة 2: إنشاء ملف resolver جديد

**ملف**: `cloud-server/lib/vidsrc-direct-resolver.js`

```javascript
const { VidSrcToResolver } = require('vidsrc-to-resolver');

class VidSrcDirectResolver {
  constructor() {
    this.resolver = new VidSrcToResolver();
  }

  async resolveMovie(imdbId) {
    try {
      const sources = await this.resolver.resolveMovie(imdbId);
      if (!sources || sources.length === 0) {
        throw new Error('No sources found');
      }
      
      // اختر أفضل مصدر (عادة الأول)
      const bestSource = sources[0];
      
      return {
        success: true,
        url: bestSource.url,
        quality: bestSource.quality || 'auto',
        type: bestSource.type || 'hls',
        subtitles: bestSource.subtitles || []
      };
    } catch (error) {
      console.error('[VidSrc] Movie resolve error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async resolveEpisode(imdbId, season, episode) {
    try {
      const sources = await this.resolver.resolveEpisode(imdbId, season, episode);
      if (!sources || sources.length === 0) {
        throw new Error('No sources found');
      }
      
      const bestSource = sources[0];
      
      return {
        success: true,
        url: bestSource.url,
        quality: bestSource.quality || 'auto',
        type: bestSource.type || 'hls',
        subtitles: bestSource.subtitles || []
      };
    } catch (error) {
      console.error('[VidSrc] Episode resolve error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new VidSrcDirectResolver();
```

### الخطوة 3: إضافة endpoint في server.js

```javascript
const vidsrcResolver = require('./lib/vidsrc-direct-resolver');

// Movie direct link
app.get('/api/vidsrc/movie/:imdbId', async (req, res) => {
  try {
    const result = await vidsrcResolver.resolveMovie(req.params.imdbId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Episode direct link
app.get('/api/vidsrc/episode/:imdbId/:season/:episode', async (req, res) => {
  try {
    const { imdbId, season, episode } = req.params;
    const result = await vidsrcResolver.resolveEpisode(imdbId, season, episode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### الخطوة 4: استخدام في Web App

```javascript
// في web-app/src/constants/api.ts
export async function getVidSrcDirectLink(imdbId: string, type: 'movie' | 'tv', season?: number, episode?: number) {
  try {
    let url = '';
    if (type === 'movie') {
      url = `/api/vidsrc/movie/${imdbId}`;
    } else {
      url = `/api/vidsrc/episode/${imdbId}/${season}/${episode}`;
    }
    
    const res = await apiFetch(url);
    const data = await res.json();
    
    if (data.success) {
      return {
        success: true,
        streamUrl: data.url,
        subtitles: data.subtitles
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

## ⚠️ ملاحظات مهمة | Important Notes

### 1. القانونية:
- VidSrc يستخرج روابط من مواقع استضافة خارجية
- المحتوى ليس مستضاف على VidSrc نفسه
- استخدمه للأغراض التعليمية فقط

### 2. الاستقرار:
- الروابط قد تتغير أو تتوقف
- يُنصح بوجود fallback (مصدر بديل)
- استخدم cache للروابط المستخرجة

### 3. الأداء:
- استخراج الرابط يأخذ 2-5 ثواني
- استخدم caching لتحسين السرعة
- استخدم CDN إذا أمكن

---

## 🔗 روابط مفيدة | Useful Links

### GitHub Repos:
- **vidsrc-to-resolver**: https://github.com/Ciarands/vidsrc-to-resolver
- **vidsrc-api**: https://github.com/cool-dev-guy/vidsrc-api
- **VidSrc-Streamer**: https://github.com/habitual69/VidSrc-Streamer

### VidSrc Domains:
- **vidsrc.to**: https://vidsrc.to/
- **vidsrc.me**: https://vidsrc.me/
- **vidsrc.xyz**: https://vidsrc.xyz/
- **vidsrc.stream**: https://vidsrc.stream/

### Alternatives:
- **Consumet**: https://github.com/consumet/api.consumet.org
- **SuperStream**: https://github.com/recloudstream/cloudstream
- **Stremio**: https://www.stremio.com/

---

## ✅ الخلاصة | Summary

**VidSrc** هو:
- 🎬 محلل روابط streaming مجاني
- 🌍 يدعم محتوى عالمي (أفلام ومسلسلات)
- 🔗 يحول IMDb/TMDB IDs إلى روابط HLS مباشرة
- 💻 يوفر API و embed player جاهز
- ⭐ مستخدم في نظامك الحالي

**نظامك الحالي**:
- ✅ يستخدم VidSrc عبر embed (iframe)
- ✅ يمكن ترقيته لاستخدام direct links
- ✅ يعمل بشكل ممتاز

**التوصية**:
- استمر باستخدام VidSrc للمحتوى الأجنبي
- استخدم LuluStream للمحتوى العربي
- استخدم IPTV للقنوات المباشرة

---

**تاريخ التحديث**: 2026-04-20
**المصادر**: GitHub, VidSrc.to, VidSrc.me, VidSrc.xyz
