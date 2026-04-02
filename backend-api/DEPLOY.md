# نشر Backend API على Railway

## الخطوات

### 1. إنشاء مشروع Railway
1. اذهب إلى [railway.app](https://railway.app) وسجّل الدخول
2. اضغط **New Project → Deploy from GitHub repo**
3. اختر المستودع ثم حدد مجلد `backend-api` كـ Root Directory

### 2. إضافة Volume للـ SQLite (مهم لحفظ البيانات)
1. في Railway → مشروعك → اضغط **+ New Volume**
2. اختر **Mount Path**: `/data`
3. في إعدادات المتغيرات: `DB_PATH=/data/ma_streaming.db`

> بدون Volume، قاعدة البيانات تُحذف عند كل deployment جديد!

### 3. متغيرات البيئة المطلوبة
في Railway → Variables، أضف:

| المتغير | القيمة |
|---|---|
| `JWT_SECRET` | نص عشوائي طويل (مثل: `openssl rand -hex 32`) |
| `CLOUD_SERVER_URL` | رابط السيرفر السحابي (VPS أو Railway service آخر) |
| `INTERNAL_SECRET` | نفس القيمة المستخدمة في cloud-server |
| `DB_PATH` | `/data/ma_streaming.db` |
| `CORS_ORIGIN` | رابط الويب آب (مثل: `https://myapp.vercel.app`) |
| `NODE_ENV` | `production` |

> `PORT` يُضبط تلقائياً من Railway — لا تضيفه

### 4. بعد النشر
- افتح `/api/health` للتحقق أن السيرفر يعمل
- نسخ الـ URL الذي أعطاك إياه Railway وضعه في:
  - `mobile-app/constants/Api.ts` → `API_BASE_URL`
  - `web-app` → متغير `BACKEND_URL`

## الهيكل المُستخدم
```
backend-api/
├── server.js          ← نقطة الدخول
├── db.js              ← قاعدة البيانات (SQLite)
├── routes/            ← API routes
├── middleware/        ← auth middleware
├── lib/               ← cloud communication
├── railway.json       ← إعدادات Railway
├── nixpacks.toml      ← إعدادات البناء
└── .env.example       ← نموذج متغيرات البيئة
```
