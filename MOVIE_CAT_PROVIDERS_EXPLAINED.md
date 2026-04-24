# شرح تفصيلي: movie-cat/providers

## 📖 ما هو movie-cat/providers؟

**movie-cat/providers** هو مكتبة Python متخصصة في **استخراج روابط البث المباشر** (m3u8/HLS) من مصادر مختلفة على الإنترنت، وهو جزء من مشروع **movie-cat** الذي يوفر واجهة موحدة للوصول إلى محتوى الأفلام والمسلسلات.

### 🎯 الهدف الرئيسي:
تجميع منطق الـ **web scraping** لمصادر البث المختلفة في مكان واحد، مما يسهل استخراج روابط الفيديو بدون التعامل مع تعقيدات كل مصدر على حدة.

---

## 🏗️ البنية الأساسية

### المكونات الرئيسية:

```
mcat-providers/
├── mcat_providers/
│   ├── sources/          # مصادر البث (FlixHQ, etc.)
│   │   ├── flixhq.py    # استخراج من FlixHQ
│   │   └── ...
│   ├── providers/        # موفري الروابط (Rabbitstream, etc.)
│   │   ├── rabbitstream.py
│   │   └── ...
│   └── utils/            # أدوات مساعدة
└── setup.py
```

---

## 🔍 كيف يعمل؟

### 1️⃣ **المصادر (Sources)**
المصادر هي المواقع التي تحتوي على معلومات الأفلام/المسلسلات:

#### **FlixHQ** (المصدر الرئيسي):
- **ما هو FlixHQ؟**
  - موقع يجمع روابط الأفلام والمسلسلات من مصادر خارجية
  - لا يستضيف الفيديوهات بنفسه، بل يجمع الروابط من مواقع أخرى
  - يوفر واجهة بحث موحدة للمحتوى

- **كيف يعمل FlixHQ؟**
  ```
  1. المستخدم يبحث عن فيلم (مثلاً: The Shawshank Redemption)
  2. FlixHQ يبحث في قاعدة بياناته عن الفيلم
  3. يعرض معلومات الفيلم (Poster, Rating, Year, etc.)
  4. عند الضغط على "Play"، يجلب روابط من موفري البث
  5. يعرض الروابط في iframe أو player مدمج
  ```

### 2️⃣ **الموفرون (Providers)**
الموفرون هم الخدمات التي تستضيف الفيديوهات الفعلية:

#### **Rabbitstream** (الموفر الرئيسي):
- خدمة استضافة فيديو تستخدمها مواقع كثيرة
- توفر روابط HLS (m3u8) للبث المباشر
- تدعم جودات متعددة (360p, 480p, 720p, 1080p)

---

## 💻 كيف يعمل الكود؟

### مثال عملي - استخراج رابط فيلم:

```python
import asyncio
from mcat_providers.sources import flixhq

async def get_movie_stream():
    # 1. إنشاء instance من FlixHQ
    source = flixhq.FlixHq()
    
    # 2. استخراج جميع المصادر المتاحة
    # tmdb="278" = The Shawshank Redemption
    sources_list = await source.scrape_all(
        tmdb="278",           # TMDB ID للفيلم
        media_type="movie",   # نوع المحتوى (movie أو tv)
    )
    
    # 3. النتيجة: قائمة بالمصادر المتاحة
    # sources_list = [Source1, Source2, Source3, ...]
    
    # 4. اختيار أول مصدر
    first_source = sources_list[0]
    
    # 5. الحصول على رابط البث
    stream = first_source.streams[0]
    print(f"Stream URL: {stream.url}")
    print(f"Quality: {stream.quality}")
    print(f"Type: {stream.type}")  # hls, mp4, etc.
    
    # 6. الحصول على الترجمات
    for subtitle in first_source.subtitles:
        print(f"Subtitle: {subtitle.language} - {subtitle.url}")
    
    # 7. Headers المطلوبة للبث
    print(f"Referrer: {stream.headers.referrer}")
    print(f"User-Agent: {stream.headers.user_agent}")

# تشغيل الكود
asyncio.run(get_movie_stream())
```

---

## 🔄 آلية العمل خطوة بخطوة

### الخطوة 1: البحث عن الفيلم في FlixHQ
```python
# الكود الداخلي يقوم بـ:
1. إرسال طلب HTTP إلى FlixHQ API
2. البحث عن الفيلم باستخدام TMDB ID
3. الحصول على معلومات الفيلم (Title, Year, Poster, etc.)
```

### الخطوة 2: استخراج روابط الموفرين
```python
# FlixHQ يعيد قائمة بالموفرين المتاحين:
providers = [
    "Rabbitstream",
    "Upcloud",
    "Vidcloud",
    # ... إلخ
]
```

### الخطوة 3: استخراج رابط m3u8 من Rabbitstream
```python
# الكود يقوم بـ:
1. فتح صفحة Rabbitstream
2. استخراج JavaScript المشفر
3. فك تشفير الكود للحصول على رابط m3u8
4. إرجاع الرابط مع Headers المطلوبة
```

### الخطوة 4: إرجاع النتيجة
```python
result = {
    "url": "https://example.com/stream/master.m3u8",
    "quality": "1080p",
    "type": "hls",
    "headers": {
        "Referer": "https://rabbitstream.net/",
        "User-Agent": "Mozilla/5.0 ...",
        "Origin": "https://rabbitstream.net"
    },
    "subtitles": [
        {"language": "English", "url": "https://..."},
        {"language": "Arabic", "url": "https://..."}
    ]
}
```

---

## 🎬 مثال كامل - تشغيل فيلم

```python
import os
import asyncio
from rich.console import Console
from mcat_providers.sources import flixhq

async def play_movie():
    console = Console()
    
    # 1. إنشاء instance
    source = flixhq.FlixHq()
    
    # 2. استخراج المصادر
    console.log("[yellow]جاري البحث عن الفيلم...[/yellow]")
    sources_list = await source.scrape_all(
        tmdb="278",  # The Shawshank Redemption
        media_type="movie",
    )
    
    if not sources_list:
        console.log("[red]لم يتم العثور على مصادر![/red]")
        return
    
    # 3. اختيار أفضل مصدر
    best_source = sources_list[0]
    stream = best_source.streams[0]
    
    console.log(f"[green]✓ تم العثور على المصدر: {stream.quality}[/green]")
    console.log(f"[cyan]URL: {stream.url}[/cyan]")
    
    # 4. الحصول على الترجمة العربية
    arabic_subs = [
        sub for sub in best_source.subtitles 
        if "arabic" in sub.language.lower()
    ]
    
    # 5. تشغيل الفيلم باستخدام MPV
    mpv_command = f'''mpv "{stream.url}" \
        --referrer="{stream.headers.referrer}" \
        --user-agent="{stream.headers.user_agent}"'''
    
    if arabic_subs:
        mpv_command += f' --sub-file="{arabic_subs[0].url}"'
    
    console.log("[green]جاري تشغيل الفيلم...[/green]")
    os.system(mpv_command)

# تشغيل
asyncio.run(play_movie())
```

---

## 🛠️ الاستخدام العملي

### 1. التثبيت:
```bash
git clone https://github.com/movie-cat/providers.git mcat-providers
cd mcat-providers
pip install .
```

### 2. استخدام CLI:
```bash
# استخراج روابط فيلم
mcat-providers --src "flixhq" --tmdb 278

# حفظ النتائج في JSON
mcat-providers --src "flixhq" --tmdb 278 > movie_streams.json
```

### 3. استخدام كمكتبة Python:
```python
from mcat_providers.sources import flixhq
import asyncio

async def main():
    source = flixhq.FlixHq()
    streams = await source.scrape_all(tmdb="278", media_type="movie")
    
    for stream_source in streams:
        print(f"Provider: {stream_source.provider}")
        for stream in stream_source.streams:
            print(f"  - Quality: {stream.quality}")
            print(f"  - URL: {stream.url}")

asyncio.run(main())
```

---

## 🔐 كيف يتعامل مع الحماية؟

### 1. **User-Agent Spoofing**:
```python
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
    'Accept': 'text/html,application/xhtml+xml,...',
    'Accept-Language': 'en-US,en;q=0.9',
}
```

### 2. **Referer Headers**:
```python
# يرسل Referer صحيح لكل موفر
headers['Referer'] = 'https://rabbitstream.net/'
```

### 3. **JavaScript Decryption**:
```python
# يفك تشفير JavaScript المشفر للحصول على الروابط
encrypted_data = extract_from_page(html)
decrypted_url = decrypt_js(encrypted_data)
```

### 4. **Cloudflare Bypass**:
```python
# يستخدم مكتبات خاصة لتجاوز Cloudflare
from cloudscraper import create_scraper
scraper = create_scraper()
response = scraper.get(url)
```

---

## 📊 البيانات المُرجعة

### هيكل البيانات:
```python
{
    "provider": "Rabbitstream",
    "streams": [
        {
            "url": "https://example.com/master.m3u8",
            "quality": "1080p",
            "type": "hls",
            "headers": {
                "Referer": "https://rabbitstream.net/",
                "User-Agent": "Mozilla/5.0 ...",
                "Origin": "https://rabbitstream.net"
            }
        },
        {
            "url": "https://example.com/720p.m3u8",
            "quality": "720p",
            "type": "hls",
            "headers": {...}
        }
    ],
    "subtitles": [
        {
            "language": "English",
            "url": "https://example.com/en.vtt",
            "format": "vtt"
        },
        {
            "language": "Arabic",
            "url": "https://example.com/ar.vtt",
            "format": "vtt"
        }
    ]
}
```

---

## ⚡ المميزات

### ✅ **Async/Await**:
- يستخدم `asyncio` للسرعة
- يمكن استخراج عدة أفلام في نفس الوقت

### ✅ **Multiple Sources**:
- يدعم مصادر متعددة (FlixHQ حالياً)
- سهل إضافة مصادر جديدة

### ✅ **Multiple Providers**:
- Rabbitstream ✅
- Upcloud (قريباً)
- Vidcloud (قريباً)

### ✅ **Subtitle Support**:
- يستخرج الترجمات تلقائياً
- يدعم لغات متعددة

### ✅ **Quality Selection**:
- يوفر جودات متعددة (360p - 1080p)
- يمكن اختيار الجودة المناسبة

---

## 🔄 مقارنة مع نظامك الحالي

### نظامك الحالي (vidsrc-advanced-resolver.js):
```javascript
// يستخدم VidSrc sources
- vidsrc.xyz
- vidsrc.to
- vidsrc.net
- vidsrc.pro
```

### movie-cat/providers:
```python
# يستخدم FlixHQ + Rabbitstream
- FlixHQ (source)
- Rabbitstream (provider)
```

### الفرق الرئيسي:
| الميزة | نظامك الحالي | movie-cat/providers |
|--------|--------------|---------------------|
| اللغة | JavaScript | Python |
| المصدر | VidSrc | FlixHQ |
| الموفر | VidSrc embeds | Rabbitstream |
| الترجمات | ✅ | ✅ |
| Async | ✅ | ✅ |
| جودات متعددة | ✅ | ✅ |

---

## 💡 هل يجب استخدامه في مشروعك؟

### ✅ **نعم، إذا:**
1. تريد إضافة FlixHQ كمصدر إضافي
2. تريد Rabbitstream كموفر بديل
3. تريد تحسين استخراج الترجمات

### ❌ **لا، إذا:**
1. نظامك الحالي يعمل بشكل جيد
2. لا تريد إضافة Python إلى المشروع
3. VidSrc يوفر كل ما تحتاجه

### 🔄 **الحل الأمثل:**
دمج الاثنين معاً:
```javascript
// في cloud-server/server.js
1. جرب VidSrc أولاً (سريع)
2. إذا فشل، جرب FlixHQ (Python subprocess)
3. إذا فشل، جرب Consumet (موجود بالفعل)
```

---

## 📝 الخلاصة

**movie-cat/providers** هو:
- ✅ مكتبة Python قوية لاستخراج روابط البث
- ✅ يستخدم FlixHQ + Rabbitstream
- ✅ يدعم Async/Await للسرعة
- ✅ يستخرج الترجمات تلقائياً
- ✅ سهل الاستخدام والتكامل

**نظامك الحالي** (vidsrc-advanced-resolver.js):
- ✅ يعمل بشكل ممتاز
- ✅ JavaScript/Node.js (متوافق مع المشروع)
- ✅ يدعم 4 مصادر VidSrc
- ✅ لا يحتاج Python

**التوصية**: 
احتفظ بنظامك الحالي، وأضف FlixHQ كـ **fallback** إضافي إذا احتجت لمزيد من المصادر.

---

تم إنشاء هذا الشرح في: 2026-04-20
