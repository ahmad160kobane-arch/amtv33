# IPTV Cloud Streaming Server v2

سيرفر بث سحابي خفيف — **للبث فقط** (FFmpeg + HLS).  
لا يحتوي على قاعدة بيانات أو إدارة مستخدمين. الإدارة من Backend API.

## التشغيل

```bash
npm install
BACKEND_API_URL=http://backend:3000 INTERNAL_SECRET=my-secret node server.js
```

## متغيرات البيئة
| المتغير | الوصف | الافتراضي |
|---------|-------|-----------|
| `PORT` | منفذ السيرفر | `8080` |
| `BACKEND_API_URL` | رابط الباك اند الرئيسي | `http://localhost:3000` |
| `INTERNAL_SECRET` | مفتاح سري مشترك مع الباك اند | `cloud-internal-secret-change-me` |
| `FFMPEG_PATH` | مسار FFmpeg | `ffmpeg` |

## API الداخلي (للباك اند فقط)

كل الطلبات تحتاج Header: `X-Internal-Secret: <secret>`

| المسار | الوصف |
|--------|-------|
| `POST /internal/stream/start` | بدء بث `{streamId, type, sourceUrl, name}` |
| `POST /internal/stream/release` | إنهاء مشاهدة `{streamId}` |
| `POST /internal/stream/stop` | إيقاف بث `{streamId}` |
| `POST /internal/stream/stop-all` | إيقاف كل البث |
| `GET /internal/stream/status` | حالة البث النشط |
| `GET /internal/stream/ready/:id` | فحص جهوزية البث |
| `POST /internal/stream/probe-subtitles` | فحص الترجمة `{sourceUrl}` |

## HLS (عام)

| المسار | الوصف |
|--------|-------|
| `GET /hls/:streamId/stream.m3u8` | بث قناة مباشرة |
| `GET /hls/vod/:streamId/stream.m3u8` | بث VOD |
| `GET /health` | فحص صحة السيرفر |

## بنية المشروع

```
cloud-server/
├── server.js              # السيرفر (190 سطر)
├── config.js              # الإعدادات
├── lib/
│   └── stream-manager.js  # إدارة FFmpeg + HLS
├── hls/                   # ملفات البث المؤقتة
├── setup.sh               # سكريبت تثبيت VPS
└── package.json           # فقط express + cors
