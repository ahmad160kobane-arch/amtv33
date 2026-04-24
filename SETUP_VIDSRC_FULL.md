# إعداد VidSrc Full (فيديو + ترجمات)

## الخطوات:

### 1. Deploy API على Vercel
```bash
# شغل الملف
deploy_vidsrc_api.bat

# أو يدوياً:
git clone https://github.com/cool-dev-guy/vidsrc-api.git
cd vidsrc-api
npm i -g vercel
vercel deploy --prod
```

**انسخ الرابط**: `https://your-api.vercel.app`

---

### 2. تحديث cloud-server

#### أ. افتح `cloud-server/lib/vidsrc-api-client.js`
غير السطر 10:
```javascript
this.baseUrl = 'https://your-api.vercel.app'; // ضع رابطك هنا
```

#### ب. افتح `cloud-server/server.js`
أضف في البداية (بعد السطر 50):
```javascript
const VidSrcApiClient = require('./lib/vidsrc-api-client');
```

أضف endpoint جديد (بعد السطر 2350):
```javascript
// ═══ VidSrc Full - فيديو + ترجمات ═══
app.post('/api/stream/vidsrc-full', requireAuth, requirePremium, async (req, res) => {
  const { tmdbId, type = 'movie', season, episode } = req.body;

  if (!tmdbId) return res.status(400).json({ error: 'tmdbId مطلوب' });

  try {
    const client = new VidSrcApiClient();
    const result = await client.getStream(tmdbId, type, season, episode);

    if (result.success) {
      return res.json({
        success: true,
        hlsUrl: result.streamUrl,
        streamUrl: result.streamUrl,
        subtitles: result.subtitles,
        provider: 'vidsrc-full',
        ready: true
      });
    }

    return res.status(404).json({ success: false, error: result.error });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
```

---

### 3. رفع على VPS
```bash
# على VPS
cd /root/ma-streaming/cloud-server
pm2 restart cloud-server
```

---

### 4. Deploy Web App
```bash
cd web-app
git add .
git commit -m "Add VidSrc Full support"
git push
```

---

## النتيجة:

عند فتح مسلسل/فيلم:
- ✅ يستخرج رابط الفيديو (m3u8)
- ✅ يستخرج الترجمات (جميع اللغات)
- ✅ يعرضها للمستخدم تلقائياً

---

## اختبار:

```bash
# على VPS
curl -X POST http://localhost:8090/api/stream/vidsrc-full \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"tmdbId":"1159559","type":"movie"}'
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "hlsUrl": "https://example.com/video.m3u8",
  "subtitles": [
    {"language": "English", "url": "https://...en.srt"},
    {"language": "Arabic", "url": "https://...ar.srt"}
  ]
}
```
