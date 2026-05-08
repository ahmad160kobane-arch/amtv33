# خطة التنظيف الشاملة

## التغييرات المطلوبة:

### 1. إصلاح اتجاه RTL في التطبيق
- `_layout.tsx`: تغيير `animation: 'slide_from_left'` → `'slide_from_right'` للـ RTL
- ملفات TSX: إضافة `direction: 'rtl'` و `textAlign: 'right'` حيثما ينقص
- البحث عن أي `writingDirection: 'rtl'` مفقود

### 2. إلغاء المجاني — كل شيء بريميوم فقط
**سيرفر (cloud-server/server.js):**
- حذف endpoint `/api/xtream/free-stream/:channelId` 
- حذف endpoints `/free-hls/*` (4 endpoints)
- إضافة `requirePremium` لـ `/api/xtream/channels` (حالياً بدونها)
- حذف منطق `is_free` / `free` من أي مكان

**تطبيق الموبايل:**
- حذف `requireLoginOnly` من `usePremiumGuard.ts` → تحويل كل استخدامه إلى `requireAuth`
- حذف `FreeChannel` type → توحيد مع `PremiumChannel` أو قناة عادية
- تحويل `handleChannelPress` في index.tsx, live.tsx, kids.tsx: `requireLoginOnly` → `requireAuth`
- حذف `requestFreeStream` من Api.ts
- حذف `fetchFreeChannels` → استخدام `fetchPremiumChannels` أو توحيد
- حذف شارات "بريميوم" على القنوات (لأن الكل بريميوم)
- تبسيط `player.tsx`: حذف فرع `freeChannelId` واستخدام `requestPremiumStream` فقط

### 3. حذف منطق الأفلام/المسلسلات غير lulu
**سيرفر:**
- حذف/تعطيل: vidsrc endpoints, consumet-resolver, stream-extractor
- تبسيط `/api/stream/vod/:id` ليعتمد فقط على lulu
- حذف `/api/stream/vidsrc` endpoint

**تطبيق:**
- حذف vidsrc API calls من Api.ts
- حذف WebView embed player logic من player.tsx
- جعل detail.tsx يعتمد فقط على lulu

### 4. إبقاء البث المباشر كما هو
- لا تغيير على FFmpegRestreamer, LiveProxy, إلخ
- لا تغيير على `/api/stream/live/:channelId`
- لا تغيير على `/api/xtream/stream/:channelId`

### 5. حذف أي منطق بث غير مستعمل
- حذف `/vod/proxy/:filename` إذا غير مستعمل
- حذف StreamManager إذا Restreamer هو المستعمل
- حذف VodProxy إذا غير مستعمل بعد حذف الأفلام
