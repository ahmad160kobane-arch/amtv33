# أدوات GitHub لاستخراج روابط m3u8 من VidSrc

## 📋 نظرة عامة
هذا الدليل يحتوي على أفضل الأدوات المتاحة على GitHub لاستخراج روابط الفيديو m3u8 من مصادر VidSrc المختلفة.

---

## 🔧 الأدوات المتاحة

### 1. **Ciarands/vidsrc-to-resolver** ⚠️ (متوقف)
- **الرابط**: https://github.com/Ciarands/vidsrc-to-resolver
- **الحالة**: ❌ **متوقف منذ 31/07/2024** - vidsrc.to توقف عن العمل
- **الوصف**: أداة CLI بسيطة لاستخراج روابط m3u8 من vidsrc.to
- **البديل الموصى به**: https://github.com/movie-cat/providers

**ملاحظة**: هذه الأداة لم تعد تعمل لأن نطاق vidsrc.to توقف عن العمل.

---

### 2. **movie-cat/providers** ✅ (نشط)
- **الرابط**: https://github.com/movie-cat/providers
- **الحالة**: ✅ **نشط ويعمل**
- **اللغة**: Python
- **المصادر المدعومة**: 
  - FlixHQ ✅
  - Rabbitstream ✅

#### التثبيت:
```bash
git clone https://github.com/movie-cat/providers.git mcat-providers
cd mcat-providers
pip install .
```

#### الاستخدام (CLI):
```bash
# استخراج روابط من FlixHQ
mcat-providers --src "flixhq" --tmdb 278

# حفظ النتائج في ملف JSON
mcat-providers --src "flixhq" --tmdb 278 > streams.json
```

#### الاستخدام (Python):
```python
import asyncio
from mcat_providers.sources import flixhq

async def scrape_movie():
    source = flixhq.FlixHq()
    sources_list = await source.scrape_all(
        tmdb="278",
        media_type="movie",
    )
    
    first_source = sources_list[0]
    stream = first_source.streams[0]
    print(f"Stream URL: {stream.url}")
    print(f"Referrer: {stream.headers.referrer}")
    
    # الترجمات الإنجليزية
    english_subs = [sub for sub in first_source.subtitles 
                    if "english" in sub.language.lower()]

loop = asyncio.get_event_loop()
loop.run_until_complete(scrape_movie())
```

**المميزات**:
- ✅ يدعم TMDB IDs
- ✅ يستخرج روابط HLS مباشرة
- ✅ يدعم الترجمات
- ✅ كود نظيف وسهل الاستخدام

---

### 3. **habitual69/VidSrc-Streamer** ✅ (نشط)
- **الرابط**: https://github.com/habitual69/VidSrc-Streamer
- **الحالة**: ✅ **نشط ويعمل**
- **اللغة**: Python
- **المميزات**: 
  - Web API لاستخراج الروابط
  - إنشاء قوائم IPTV (m3u8 playlists)
  - دعم Docker
  - تخزين مؤقت في SQLite

#### المكونات:
1. **m3u8parser.py**: API لاستخراج روابط البث
2. **playlistcreator.py**: إنشاء قوائم IPTV

#### التثبيت:
```bash
git clone https://github.com/habitual69/VidSrc-Streamer.git
cd VidSrc-Streamer
pip install -r requirements.txt
```

#### الاستخدام (Web API):
```bash
# تشغيل السيرفر
python m3u8parser.py

# استخدام API
http://localhost:8000/stream/<imdb_id>
```

#### إنشاء قائمة IPTV:
```bash
# 1. إنشاء ملف imdb_id.txt
echo "tt0111161" > imdb_id.txt
echo "tt0068646" >> imdb_id.txt

# 2. تشغيل السكريبت
python playlistcreator.py

# 3. سيتم إنشاء ملف playlist.m3u8
```

#### Docker:
```bash
# بناء الصورة
docker build -t vidsrc-streamer .

# تشغيل الحاوية
docker run -d -p 8000:8000 vidsrc-streamer

# الوصول للـ API
http://localhost:8000/stream/<imdb_id>
```

**المميزات**:
- ✅ يدعم IMDb IDs
- ✅ Web API جاهز للاستخدام
- ✅ إنشاء قوائم IPTV
- ✅ تخزين مؤقت للروابط
- ✅ دعم Docker

---

### 4. **cool-dev-guy/vidsrc-api** ⚠️ (متوقف مؤقتاً)
- **الرابط**: https://github.com/cool-dev-guy/vidsrc-api
- **الحالة**: ⚠️ **متوقف مؤقتاً**
- **البديل الجديد**: https://github.com/cool-dev-guy/vidsrc.ts (TypeScript)
- **اللغة**: Python (القديم) / TypeScript (الجديد)

**ملاحظة**: المطور انتقل إلى مشروع جديد بـ TypeScript لأن vidsrc.to توقف عن العمل.

#### المشروع الجديد (vidsrc.ts):
- ✅ مكتوب بـ TypeScript
- ✅ متوافق مع Node.js و Deno
- ✅ أسرع في التنفيذ
- ✅ كود أسهل للقراءة

---

### 5. **isg32/vidsrc** ✅
- **الرابط**: https://github.com/isg32/vidsrc
- **الحالة**: ✅ **نشط**
- **اللغة**: Python
- **الوصف**: Web scraper يستخدم vidsrc-API

**المميزات**:
- ✅ Web scraping تلقائي
- ✅ Python-based
- ✅ سهل الاستخدام

---

### 6. **lestwastaken/lestresolver** ✅ (Go)
- **الرابط**: https://pkg.go.dev/github.com/lestwastaken/lestresolver
- **الحالة**: ✅ **نشط**
- **اللغة**: Go
- **المصادر**: vidsrc.me / vidsrc.net

**المميزات**:
- ✅ مكتوب بلغة Go (سريع جداً)
- ✅ استخراج روابط HLS مباشرة
- ✅ بدون إعلانات
- ✅ يدعم IMDb IDs
- ✅ جودات متعددة

---

## 🎯 التوصيات

### للاستخدام الفوري:
1. **movie-cat/providers** - الأفضل للاستخدام الحالي (FlixHQ)
2. **habitual69/VidSrc-Streamer** - ممتاز لإنشاء Web API و IPTV playlists

### للمشاريع الكبيرة:
1. **lestwastaken/lestresolver** (Go) - أداء عالي جداً
2. **cool-dev-guy/vidsrc.ts** (TypeScript) - حديث ومتطور

---

## 📊 مقارنة الأدوات

| الأداة | اللغة | الحالة | المصادر | API | IPTV | Docker |
|--------|-------|--------|---------|-----|------|--------|
| movie-cat/providers | Python | ✅ | FlixHQ | ✅ | ❌ | ❌ |
| VidSrc-Streamer | Python | ✅ | VidSrc | ✅ | ✅ | ✅ |
| vidsrc.ts | TypeScript | ✅ | متعدد | ✅ | ❌ | ❌ |
| lestresolver | Go | ✅ | vidsrc.me/net | ✅ | ❌ | ❌ |
| vidsrc-to-resolver | Python | ❌ | vidsrc.to | ❌ | ❌ | ❌ |

---

## 💡 ملاحظات مهمة

### ⚠️ تحذيرات:
1. **vidsrc.to توقف عن العمل** منذ 31/07/2024
2. معظم الأدوات القديمة التي تعتمد على vidsrc.to لم تعد تعمل
3. الأدوات الحديثة تستخدم FlixHQ أو vidsrc.xyz/net/pro

### ✅ أفضل الممارسات:
1. استخدم **movie-cat/providers** للمشاريع الجديدة
2. استخدم **VidSrc-Streamer** إذا كنت تحتاج Web API جاهز
3. استخدم **lestresolver** (Go) للأداء العالي
4. لا تحمّل السيرفرات بطلبات كثيرة
5. روابط m3u8 قد تنتهي صلاحيتها بعد 24 ساعة

---

## 🔗 روابط إضافية

### أدوات عامة لـ m3u8:
- **videojs/m3u8-parser**: https://github.com/videojs/m3u8-parser
- **williamchanrico/m3u8-download**: https://github.com/williamchanrico/m3u8-download

### مصادر بديلة:
- **FlixHQ**: أفضل بديل حالياً
- **Rabbitstream**: مصدر موثوق
- **vidsrc.xyz/net/pro**: بدائل لـ vidsrc.to

---

## 📝 الخلاصة

**الأداة الموصى بها حالياً**: 
- **movie-cat/providers** (Python) - للاستخدام العام
- **habitual69/VidSrc-Streamer** (Python) - لإنشاء Web API و IPTV

**ملاحظة**: نظامك الحالي في `cloud-server/lib/vidsrc-advanced-resolver.js` يستخدم نفس المنطق ولكن بـ JavaScript/Node.js، وهو يعمل بشكل جيد مع vidsrc.xyz و vidsrc.pro.

---

تم إنشاء هذا الدليل في: 2026-04-20
