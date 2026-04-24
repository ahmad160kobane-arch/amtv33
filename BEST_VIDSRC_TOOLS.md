# أفضل أدوات استخراج m3u8 من VidSrc

## 🎯 الأدوات الجاهزة والنشطة

### 1. **Aijazmakerb/vidsrc-api** ⭐ (الأفضل - API جاهز)
- **الرابط**: https://github.com/Aijazmakerb/vidsrc-api
- **الحالة**: ✅ نشط (آخر تحديث: 2024)
- **النوع**: API جاهز للاستخدام
- **اللغة**: JavaScript/Node.js
- **المميزات**:
  - ✅ API جاهز ومنشور على Vercel
  - ✅ يدعم الأفلام والمسلسلات
  - ✅ استخدام مباشر بدون تثبيت
  - ✅ Deploy سهل على Vercel

#### الاستخدام المباشر:
```bash
# فيلم
curl https://vidsrc-api-two.vercel.app/916224

# مسلسل (الموسم 1، الحلقة 1)
curl https://vidsrc-api-two.vercel.app/1429?s=1&e=1
```

⚠️ **ملاحظة**: API قد يحتاج دفع (HTTP 402) - استخدم cool-dev-guy/vidsrc-api بدلاً منه

#### Deploy على Vercel الخاص بك:
```bash
git clone https://github.com/Aijazmakerb/vidsrc-api.git
cd vidsrc-api
vercel deploy
```

#### الاستخدام في مشروعك:
```javascript
// في cloud-server/server.js
async function getVidsrcStream(tmdbId, type, season, episode) {
  const baseUrl = 'https://vidsrc-api-two.vercel.app';
  let url = `${baseUrl}/${tmdbId}`;
  
  if (type === 'tv' && season && episode) {
    url += `?s=${season}&e=${episode}`;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    success: true,
    embedUrl: data.embedUrl,
    sources: data.sources,
    subtitles: data.subtitles
  };
}
```

---

### 2. **isg32/vidsrc** ⭐ (Python - Web Scraper)
- **الرابط**: https://github.com/isg32/vidsrc
- **الحالة**: ✅ نشط
- **النوع**: Python Web Scraper
- **المميزات**:
  - ✅ Web scraping تلقائي
  - ✅ يستخدم vidsrc-API
  - ✅ سهل الاستخدام

#### التثبيت:
```bash
git clone https://github.com/isg32/vidsrc.git
cd vidsrc
pip install -r requirements.txt
```

#### الاستخدام:
```python
from vidsrc import VidSrc

scraper = VidSrc()
result = scraper.get_stream(tmdb_id='1159559', media_type='movie')
print(result['m3u8_url'])
```

---

### 3. **habitual69/VidSrc-Streamer** ⭐ (Python - IPTV Creator)
- **الرابط**: https://github.com/habitual69/VidSrc-Streamer
- **الحالة**: ✅ نشط
- **النوع**: Python Application + Web API
- **المميزات**:
  - ✅ Web API على المنفذ 8000
  - ✅ إنشاء قوائم IPTV
  - ✅ تخزين مؤقت في SQLite
  - ✅ دعم Docker

#### الاستخدام:
```bash
# تشغيل API
python m3u8parser.py

# استخدام API
curl http://localhost:8000/stream/tt0111161
```

---

### 4. **cool-dev-guy/vidsrc-api** ⭐⭐⭐ (Python - يدعم الترجمات)
- **الرابط**: https://github.com/cool-dev-guy/vidsrc-api
- **الحالة**: ⚠️ متوقف مؤقتاً (انتقل إلى vidsrc.ts)
- **النوع**: Python API (FastAPI)
- **المميزات**:
  - ✅ **يستخرج الترجمات** لجميع المصادر
  - ✅ يدعم 4 مصادر (vidsrc.to, vidsrc.me, etc.)
  - ✅ Async support
  - ✅ Deploy على Vercel

#### هيكل الاستجابة (مع الترجمات):
```json
{
  "status": 200,
  "info": "success",
  "sources": [
    {
      "name": "vidsrc",
      "data": {
        "stream": "https://example.com/video.m3u8",
        "subtitle": [
          {
            "lang": "English",
            "file": "https://example.com/en.srt"
          },
          {
            "lang": "Arabic",
            "file": "https://example.com/ar.srt"
          },
          {
            "lang": "Spanish",
            "file": "https://example.com/es.srt"
          }
        ]
      }
    }
  ]
}
```

#### الاستخدام:
```bash
# فيلم
curl https://your-api.vercel.app/vidsrc/tt0111161

# مسلسل
curl https://your-api.vercel.app/vidsrc/tt0111161?s=1&e=2

# مع لغة ترجمة محددة
curl https://your-api.vercel.app/vidsrc/tt0111161?l=arabic
```

#### Deploy الخاص بك:
```bash
git clone https://github.com/cool-dev-guy/vidsrc-api.git
cd vidsrc-api
pip install -r requirements.txt

# تشغيل محلي
uvicorn main:app --reload --port=8000

# Deploy على Vercel
vercel deploy
```

---

### 5. **cool-dev-guy/vidsrc.ts** ⭐ (TypeScript - حديث)
- **الرابط**: https://github.com/cool-dev-guy/vidsrc.ts
- **الحالة**: ✅ نشط (البديل الجديد لـ vidsrc-api)
- **النوع**: TypeScript Library
- **المميزات**:
  - ✅ مكتوب بـ TypeScript
  - ✅ متوافق مع Node.js و Deno
  - ✅ سريع جداً
  - ✅ كود نظيف

---

### 5. **cool-dev-guy/vidsrc.ts** ⭐ (TypeScript - حديث)
- **الرابط**: https://github.com/cool-dev-guy/vidsrc.ts
- **الحالة**: ✅ نشط (البديل الجديد لـ vidsrc-api)
- **النوع**: TypeScript Library
- **المميزات**:
  - ✅ مكتوب بـ TypeScript
  - ✅ متوافق مع Node.js و Deno
  - ✅ سريع جداً
  - ✅ كود نظيف
  - ✅ **يدعم الترجمات**

---

### 6. **crxssed7/vidsrc-extractor** ⚠️ (مؤرشف)
- **الرابط**: https://github.com/crxssed7/vidsrc-extractor
- **الحالة**: ⚠️ مؤرشف (21 أكتوبر 2025)
- **ملاحظة**: لم يعد نشطاً ولكن الكود لا يزال متاحاً

---

## � دعم الترجمات (Subtitles)

### الأدوات التي تستخرج الترجمات:

#### ✅ **cool-dev-guy/vidsrc-api** (الأفضل للترجمات)
- **يستخرج**: الفيديو + الترجمات
- **اللغات**: English, Arabic, Spanish, French, German, وأكثر
- **الصيغة**: SRT, VTT
- **المصادر**: OpenSubtitles + مصادر VidSrc

**مثال الاستجابة:**
```json
{
  "status": 200,
  "sources": [
    {
      "name": "vidsrc",
      "data": {
        "stream": "https://example.com/video.m3u8",
        "subtitle": [
          {
            "lang": "English",
            "file": "https://subs.example.com/en.srt"
          },
          {
            "lang": "Arabic", 
            "file": "https://subs.example.com/ar.srt"
          }
        ]
      }
    }
  ]
}
```

#### ✅ **habitual69/VidSrc-Streamer**
- **يستخرج**: الفيديو + الترجمات
- **اللغات**: متعددة
- **الصيغة**: SRT

#### ⚠️ **Aijazmakerb/vidsrc-api**
- **يستخرج**: الفيديو فقط (بدون ترجمات)
- **ملاحظة**: يحتاج دفع (HTTP 402)

#### ✅ **نظامك الحالي** (cloud-server)
- **يستخرج**: الفيديو + الترجمات
- **المصادر**: Subdl + OpenSubtitles
- **اللغات**: Arabic, English, Kurdish
- **الصيغة**: VTT

---

## 🎯 التوصية حسب الاحتياج

### إذا كنت تريد: **فيديو + ترجمات**
استخدم **cool-dev-guy/vidsrc-api**:
```bash
# Deploy على Vercel
git clone https://github.com/cool-dev-guy/vidsrc-api.git
cd vidsrc-api
vercel deploy

# الاستخدام
curl https://your-api.vercel.app/vidsrc/tt0111161
```

**النتيجة:**
- ✅ رابط m3u8 للفيديو
- ✅ روابط SRT للترجمات (جميع اللغات)
- ✅ جودات متعددة

### إذا كنت تريد: **فيديو فقط**
استخدم **Aijazmakerb/vidsrc-api** أو **نظامك الحالي**

---

## 💡 مثال تكامل مع الترجمات

```javascript
// cloud-server/lib/vidsrc-with-subtitles.js
class VidSrcWithSubtitles {
  async getStreamWithSubs(tmdbId, type, season, episode) {
    try {
      // استدعاء cool-dev-guy API
      const imdbId = await this.getImdbId(tmdbId);
      let url = `https://your-vidsrc-api.vercel.app/vidsrc/${imdbId}`;
      
      if (type === 'tv') {
        url += `?s=${season}&e=${episode}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 200 && data.sources.length > 0) {
        const source = data.sources[0];
        
        return {
          success: true,
          streamUrl: source.data.stream,
          subtitles: source.data.subtitle.map(sub => ({
            language: sub.lang,
            url: sub.file,
            label: sub.lang
          })),
          provider: 'vidsrc-api'
        };
      }

      return { success: false, error: 'No sources found' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getImdbId(tmdbId) {
    // تحويل TMDB ID إلى IMDb ID
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=YOUR_KEY`
    );
    const data = await response.json();
    return data.imdb_id;
  }
}

module.exports = VidSrcWithSubtitles;
```

### الاستخدام في server.js:
```javascript
const VidSrcWithSubtitles = require('./lib/vidsrc-with-subtitles');

app.post('/api/stream/vidsrc-full', requireAuth, requirePremium, async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  
  const extractor = new VidSrcWithSubtitles();
  const result = await extractor.getStreamWithSubs(tmdbId, type, season, episode);
  
  if (result.success) {
    res.json({
      success: true,
      hlsUrl: result.streamUrl,
      subtitles: result.subtitles,
      provider: 'vidsrc-full'
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error
    });
  }
});
```

---

## �🚀 الحل الموصى به لمشروعك

### الخيار 1: استخدام API جاهز (الأسهل)

استخدم **Aijazmakerb/vidsrc-api** مباشرة:

```javascript
// في cloud-server/lib/vidsrc-api-client.js
class VidSrcApiClient {
  constructor(baseUrl = 'https://vidsrc-api-two.vercel.app') {
    this.baseUrl = baseUrl;
  }

  async getStream(tmdbId, type = 'movie', season, episode) {
    try {
      let url = `${this.baseUrl}/${tmdbId}`;
      
      if (type === 'tv' && season && episode) {
        url += `?s=${season}&e=${episode}`;
      }

      console.log(`[VidSrc API] Fetching: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      console.log(`[VidSrc API] ✓ Success`);
      
      return {
        success: true,
        embedUrl: data.embedUrl || data.embed_url,
        sources: data.sources || [],
        subtitles: data.subtitles || [],
        provider: 'vidsrc-api'
      };

    } catch (error) {
      console.error(`[VidSrc API] Error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = VidSrcApiClient;
```

#### الاستخدام في server.js:
```javascript
const VidSrcApiClient = require('./lib/vidsrc-api-client');

app.post('/api/stream/vidsrc-api', requireAuth, requirePremium, async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  
  const client = new VidSrcApiClient();
  const result = await client.getStream(tmdbId, type, season, episode);
  
  if (result.success) {
    res.json({
      success: true,
      embedUrl: `/api/embed-proxy?url=${encodeURIComponent(result.embedUrl)}`,
      sources: result.sources,
      subtitles: result.subtitles,
      provider: 'vidsrc-api'
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error
    });
  }
});
```

---

### الخيار 2: Deploy API الخاص بك

#### 1. Fork المشروع:
```bash
# Fork من GitHub
https://github.com/Aijazmakerb/vidsrc-api

# Clone إلى جهازك
git clone https://github.com/YOUR_USERNAME/vidsrc-api.git
cd vidsrc-api
```

#### 2. Deploy على Vercel:
```bash
# تثبيت Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod
```

#### 3. استخدام API الخاص بك:
```javascript
const client = new VidSrcApiClient('https://your-api.vercel.app');
```

---

### الخيار 3: Deploy على VPS الخاص بك

#### 1. رفع الكود إلى VPS:
```bash
# على VPS
cd /root/ma-streaming
git clone https://github.com/Aijazmakerb/vidsrc-api.git
cd vidsrc-api
npm install
```

#### 2. تشغيل بـ PM2:
```bash
pm2 start index.js --name vidsrc-api
pm2 save
```

#### 3. إعداد Nginx:
```nginx
location /vidsrc-api/ {
    proxy_pass http://localhost:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## 📊 مقارنة الأدوات

| الأداة | النوع | اللغة | API جاهز | الترجمات | Deploy سهل | التقييم |
|--------|------|-------|----------|----------|-----------|---------|
| cool-dev-guy/vidsrc-api | API | Python | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| habitual69/VidSrc-Streamer | API + IPTV | Python | ✅ | ✅ | ✅ | ⭐⭐⭐⭐ |
| cool-dev-guy/vidsrc.ts | Library | TypeScript | ❌ | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Aijazmakerb/vidsrc-api | API | JavaScript | ✅ | ❌ | ✅ | ⭐⭐⭐ |
| isg32/vidsrc | Scraper | Python | ❌ | ❌ | ❌ | ⭐⭐⭐ |
| crxssed7/vidsrc-extractor | Extractor | TypeScript | ❌ | ❌ | ❌ | ⭐⭐ (مؤرشف) |

---

## 🎯 التوصية النهائية

### للحصول على: **فيديو + ترجمات** 🎬
استخدم **cool-dev-guy/vidsrc-api**:
```bash
# Deploy على Vercel
git clone https://github.com/cool-dev-guy/vidsrc-api.git
cd vidsrc-api
vercel deploy

# الاستخدام
curl https://your-api.vercel.app/vidsrc/tt0111161
```

**النتيجة:**
```json
{
  "stream": "https://example.com/video.m3u8",
  "subtitle": [
    {"lang": "English", "file": "https://...en.srt"},
    {"lang": "Arabic", "file": "https://...ar.srt"}
  ]
}
```

### للحصول على: **فيديو فقط** 🎥
استخدم **Aijazmakerb/vidsrc-api** (لكن يحتاج دفع):
```javascript
const response = await fetch('https://vidsrc-api-two.vercel.app/1159559');
const data = await response.json();
```

### للاستخدام الفوري:
1. **cool-dev-guy/vidsrc-api** - يستخرج فيديو + ترجمات
2. **habitual69/VidSrc-Streamer** - يستخرج فيديو + ترجمات + IPTV

### للمشاريع الكبيرة:
1. Fork **cool-dev-guy/vidsrc-api**
2. Deploy على Vercel الخاص بك
3. استخدم API الخاص بك في المشروع
4. احصل على: فيديو + ترجمات بجميع اللغات

### للتحكم الكامل:
1. Deploy **cool-dev-guy/vidsrc-api** على VPS
2. استخدم API المحلي
3. أضف caching و rate limiting
4. احصل على: فيديو + ترجمات + تحكم كامل

---

## 💡 مثال تكامل كامل

```javascript
// cloud-server/lib/vidsrc-unified.js
const VidSrcApiClient = require('./vidsrc-api-client');
const VidSrcAdvancedResolver = require('./vidsrc-advanced-resolver');

class VidSrcUnified {
  constructor() {
    this.apiClient = new VidSrcApiClient();
    this.advancedResolver = new VidSrcAdvancedResolver();
  }

  async getStream(tmdbId, imdbId, type, season, episode) {
    // 1. جرب API الجاهز أولاً (الأسرع)
    console.log('[VidSrc Unified] Trying API...');
    const apiResult = await this.apiClient.getStream(tmdbId, type, season, episode);
    if (apiResult.success) {
      return apiResult;
    }

    // 2. جرب Advanced Resolver (fallback)
    console.log('[VidSrc Unified] API failed, trying Advanced Resolver...');
    const resolverResult = await this.advancedResolver.resolveStream(
      tmdbId, type, season, episode, imdbId
    );
    
    return resolverResult;
  }
}

module.exports = VidSrcUnified;
```

---

## 🔗 روابط مفيدة

### APIs جاهزة:
- **Aijazmakerb API**: https://vidsrc-api-two.vercel.app
- **Demo**: https://vidsrc-api-two.vercel.app/916224

### المستودعات:
- **vidsrc-api**: https://github.com/Aijazmakerb/vidsrc-api
- **vidsrc (Python)**: https://github.com/isg32/vidsrc
- **VidSrc-Streamer**: https://github.com/habitual69/VidSrc-Streamer
- **vidsrc.ts**: https://github.com/cool-dev-guy/vidsrc.ts

### الموضوع على GitHub:
- **#vidsrc**: https://github.com/topics/vidsrc (26 مستودع)

---

## ✅ الخلاصة

### ✅ **للحصول على فيديو + ترجمات:**
**الأداة الأفضل**: **cool-dev-guy/vidsrc-api**

**لماذا؟**
- ✅ يستخرج الفيديو (m3u8)
- ✅ يستخرج الترجمات (SRT/VTT)
- ✅ يدعم جميع اللغات (English, Arabic, Spanish, etc.)
- ✅ API جاهز ومنشور
- ✅ Deploy سهل على Vercel
- ✅ يدعم IMDb IDs
- ✅ يعمل مع الأفلام والمسلسلات
- ✅ Async support (سريع)

**الاستخدام**:
```bash
# فيلم
https://your-api.vercel.app/vidsrc/{imdb_id}

# مسلسل
https://your-api.vercel.app/vidsrc/{imdb_id}?s={season}&e={episode}

# مع لغة محددة
https://your-api.vercel.app/vidsrc/{imdb_id}?l=arabic
```

**النتيجة**:
```json
{
  "status": 200,
  "sources": [{
    "name": "vidsrc",
    "data": {
      "stream": "https://example.com/video.m3u8",
      "subtitle": [
        {"lang": "English", "file": "https://...en.srt"},
        {"lang": "Arabic", "file": "https://...ar.srt"}
      ]
    }
  }]
}
```

---

### ❌ **للحصول على فيديو فقط (بدون ترجمات):**
**الأداة**: **Aijazmakerb/vidsrc-api**

**ملاحظة**: يحتاج دفع (HTTP 402) - غير موصى به

---

### 🎯 **التوصية النهائية:**
استخدم **cool-dev-guy/vidsrc-api** لأنه:
1. يستخرج الفيديو + الترجمات معاً
2. مجاني ومفتوح المصدر
3. سهل Deploy على Vercel
4. يدعم جميع اللغات

---

تم إنشاء هذا الدليل في: 2026-04-20
