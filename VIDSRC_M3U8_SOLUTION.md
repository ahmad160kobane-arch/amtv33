# حل مشكلة VidSrc — استخراج روابط M3U8 المباشرة

## المشكلة 🔴

عند تشغيل الأفلام والمسلسلات من VidSrc، كان النظام يعرض:
- **"فشل تشغيل الفيديو"** (Video playback failed)
- السبب: النظام كان يرجع **embed URLs** بدلاً من روابط **m3u8 مباشرة**
- Embed URLs تحتوي على إعلانات وقد لا تعمل في بعض المشغلات

## الحل ✅

تم إنشاء **VidSrc M3U8 Extractor** جديد يستخرج روابط m3u8 مباشرة من 4 مصادر VidSrc:

### المصادر المدعومة:
1. **vidsrc.xyz** (TMDB) — سريع
2. **vidsrc.to** (IMDb) — جودة عالية
3. **vidsrc.net** (IMDb) — بديل
4. **vidsrc.pro** (TMDB) — جودة عالية

### كيف يعمل:
```
1. Consumet (مصدر أساسي - بدون إعلانات)
   ↓ فشل
2. Vidlink.pro (HLS مباشر)
   ↓ فشل
3. VidSrc M3U8 Extractor (جديد!) ← يستخرج m3u8 من 4 مصادر
   ↓ فشل
4. Embed URLs (احتياطي - مع إعلانات)
```

## الملفات المضافة 📁

### 1. `cloud-server/lib/vidsrc-m3u8-extractor.js`
**الوظيفة:** استخراج روابط m3u8 مباشرة من VidSrc

**المميزات:**
- ✅ يستخرج m3u8 من 4 مصادر VidSrc
- ✅ يدعم الأفلام والمسلسلات
- ✅ يدعم TMDB و IMDb IDs
- ✅ يحاول جميع المصادر تلقائياً
- ✅ يرجع أفضل مصدر متاح

**مثال الاستخدام:**
```javascript
const { extractVidSrcM3U8 } = require('./lib/vidsrc-m3u8-extractor');

// فيلم
const result = await extractVidSrcM3U8({
  tmdbId: '550',
  imdbId: 'tt0137523',
  type: 'movie'
});

// مسلسل
const result = await extractVidSrcM3U8({
  tmdbId: '1396',
  type: 'tv',
  season: 1,
  episode: 1
});

// النتيجة:
{
  url: 'https://example.com/playlist.m3u8',
  provider: 'vidsrc.xyz',
  type: 'hls',
  quality: 'auto',
  sources: [...]
}
```

## التعديلات على الملفات الموجودة 🔧

### 1. `cloud-server/server.js`

**التعديل 1:** إضافة require للمستخرج الجديد
```javascript
const { extractVidSrcM3U8 } = require('./lib/vidsrc-m3u8-extractor');
```

**التعديل 2:** إضافة المستخرج في `/api/stream/vidsrc` endpoint
```javascript
// ═══ 2.5. VidSrc M3U8 Extractor — استخراج m3u8 مباشر من VidSrc ═══
try {
  console.log(`[Stream] → VidSrc M3U8 Extractor: ${label}`);
  const vidsrcM3u8 = await extractVidSrcM3U8({
    tmdbId,
    imdbId,
    type,
    season,
    episode,
  });
  
  if (vidsrcM3u8 && vidsrcM3u8.url) {
    console.log(`[Stream] ✓ VidSrc M3U8: ${vidsrcM3u8.provider}`);
    await recordHistory();
    const arabicSubs = await arabicSubsPromise;
    return res.json({
      success: true, streamId, ready: true,
      hlsUrl: vidsrcM3u8.url,
      provider: vidsrcM3u8.provider,
      quality: vidsrcM3u8.quality,
      subtitles: arabicSubs,
    });
  }
} catch (vme) {
  console.log(`[Stream] VidSrc M3U8 failed: ${vme.message}`);
}
```

## خطوات النشر 🚀

### 1. رفع الملفات إلى VPS
```bash
# من جهازك المحلي
scp cloud-server/lib/vidsrc-m3u8-extractor.js root@62.171.153.204:/root/ma-streaming/cloud-server/lib/
scp cloud-server/server.js root@62.171.153.204:/root/ma-streaming/cloud-server/
```

### 2. إعادة تشغيل السيرفر على VPS
```bash
ssh root@62.171.153.204
cd /root/ma-streaming/cloud-server
pm2 restart cloud-server
pm2 logs cloud-server --lines 50
```

### 3. اختبار النظام
افتح التطبيق وجرب تشغيل فيلم أو مسلسل. يجب أن ترى في اللوجات:
```
[Stream] → VidSrc M3U8 Extractor: tmdb=550 type=movie
[VidSrc.xyz M3U8] Fetching: https://vidsrc.xyz/embed/movie/550
[VidSrc.xyz M3U8] ✓ Found: https://example.com/playlist.m3u8...
[VidSrc M3U8 Extractor] ✓ Success: vidsrc.xyz — https://example.com/playlist.m3u8...
[Stream] ✓ VidSrc M3U8: vidsrc.xyz
```

## التحقق من النجاح ✔️

### علامات النجاح:
1. ✅ الفيديو يشتغل مباشرة بدون "فشل تشغيل الفيديو"
2. ✅ لا توجد إعلانات (لأنه m3u8 مباشر)
3. ✅ التشغيل سريع وسلس
4. ✅ في اللوجات: `[Stream] ✓ VidSrc M3U8: vidsrc.xyz`

### إذا لم يعمل:
1. تحقق من اللوجات: `pm2 logs cloud-server`
2. تأكد من أن الملف موجود: `ls -la /root/ma-streaming/cloud-server/lib/vidsrc-m3u8-extractor.js`
3. تأكد من إعادة تشغيل السيرفر: `pm2 restart cloud-server`
4. جرب فيلم آخر (بعض الأفلام قد لا تكون متاحة على VidSrc)

## الفرق بين النظام القديم والجديد 📊

### النظام القديم ❌
```
User → Web App → Backend → VidSrc Advanced Resolver
                              ↓
                         Embed URL (مع إعلانات)
                              ↓
                         iframe في التطبيق
                              ↓
                         "فشل تشغيل الفيديو"
```

### النظام الجديد ✅
```
User → Web App → Backend → VidSrc M3U8 Extractor
                              ↓
                         m3u8 URL مباشر
                              ↓
                         HLS Player (بدون إعلانات)
                              ↓
                         تشغيل ناجح! 🎉
```

## الأدوات المستخدمة 🛠️

### المكتبات:
- **axios** — لطلبات HTTP
- **jsdom** — لتحليل HTML واستخراج البيانات
- **@movie-web/providers** — (موجود مسبقاً) للمصادر الأخرى

### المصادر المرجعية:
- [cool-dev-guy/vidsrc.ts](https://github.com/cool-dev-guy/vidsrc.ts) — TypeScript VidSrc extractor
- [Ciarands/vidsrc-to-resolver](https://github.com/Ciarands/vidsrc-to-resolver) — VidSrc.to resolver (deprecated)
- [movie-cat/providers](https://github.com/movie-cat/providers) — Python providers (مرجع)

## ملاحظات مهمة ⚠️

1. **VidSrc قد يتغير:** مصادر VidSrc تتغير بشكل متكرر. إذا توقف المستخرج عن العمل، قد نحتاج لتحديثه.

2. **ليس كل المحتوى متاح:** بعض الأفلام/المسلسلات قد لا تكون متاحة على VidSrc. في هذه الحالة، سيعود النظام إلى Embed URLs.

3. **الأولوية:** النظام يحاول المصادر بالترتيب:
   - Consumet (أفضل - بدون إعلانات)
   - Vidlink (جيد - HLS مباشر)
   - VidSrc M3U8 (جديد - m3u8 مباشر)
   - Embed URLs (احتياطي - مع إعلانات)

4. **الأداء:** المستخرج يحاول 4 مصادر بالتوازي، لذلك قد يستغرق 3-5 ثواني.

## الدعم والمساعدة 💬

إذا واجهت مشاكل:
1. تحقق من اللوجات: `pm2 logs cloud-server`
2. جرب فيلم/مسلسل آخر
3. تأكد من أن الاشتراك Premium نشط
4. تحقق من الاتصال بالإنترنت على VPS

---

**تم التحديث:** 2026-04-20
**الحالة:** ✅ جاهز للنشر
