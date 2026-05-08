# إصلاحات تطبيق الهاتف - البث والتفاصيل والفيديو

## المشاكل التي تم إصلاحها

### 1. 🔴 البث المباشر لا يعمل
**السبب**: `requestFreeStream` كان يستخدم endpoint قديم `GET /api/xtream/stream/:id` بينما السيرفر يستخدم الآن `POST /api/stream/live/:id`

**الإصلاح**: تحديث `requestFreeStream` في `Api.ts`:
- يستخدم الآن `POST /api/stream/live/:channelId` (مثل الويب)
- مع fallback للـ endpoint القديم
- يدعم `hlsUrl` و `vodUrl` و `directUrl`
- يمرر JWT token عبر `cloudFetch`

### 2. 🔴 الأفلام والمسلسلات لا تعمل (الفيديو)
**السبب**: `handlePlayMovie` و `handlePlayEpisode` في `detail.tsx` كانا يفحصان فقط `embedUrl` - إذا ما في `embedUrl` ما يعمل شيء

**الإصلاح**: 
- يدعم الآن `embedUrl` + `hlsUrl` + `fileCode` من `LuluDetail`
- إذا ما في `embedUrl` يجرّب `hlsUrl` (بث مباشر)
- إذا ما في شيء يرسل `luluId` كـ fallback
- أضيف دعم `embedUrl` و `luluHls` في `player.tsx`

### 3. 🔴 لا يظهر وصف أو تفاصيل
**السبب**: `LuluDetail` يعطي `plot` و `cast_list` و `genres` كـ string لكن detail.tsx كان يبحث عن `description` و `cast` و `genres` كـ array

**الإصلاح**:
- `description` → يقع على `plot` كـ fallback ✅
- أضيف `castText = detail?.cast || detail?.cast_list` 
- أضيف `directorText`, `countryText` كمتغيرات وسيطة
- `genres` → يدعم array و string بـ `Array.isArray()` check
- أصلح `genres?.join is not a function` crash

### 4. 🔴 بعد تسجيل الدخول التطبيق لا يتحدث
**السبب**: شاشة `account.tsx` كانت تستخدم حالة `user` محلية منفصلة عن `AuthContext` - بعد تسجيل الدخول، `AuthContext` لا يعرف

**الإصلاح**: 
- `account.tsx` الآن يستخدم `useAuth()` من `AuthContext`
- بعد `login()` و `register()` → يستدعي `refresh()` لتحديث كل التطبيق
- بعد `activateCode()` في `subscription.tsx` → يستدعي `refreshAuth()` 
- بعد `logout()` → `AuthContext` يتحدث فوراً

### 5. إصلاحات إضافية
- `AuthContext.refresh()` → يحاول `fetchProfile()` مباشرة أولاً (أكثر موثوقية)
- `HeroSlider` → `genres.join` crash fix (يدعم string و array)
- `player.tsx` → أضيف `embedUrl`, `isEmbed`, `luluHls`, `luluId` كـ params
- `player.tsx` → initStream يعالج embed URL و Lulu HLS قبل فحص القنوات

## الملفات المعدلة
- `constants/Api.ts` — `requestFreeStream` يستخدم endpoint الجديد
- `app/(tabs)/account.tsx` — يستخدم `useAuth` من `AuthContext`
- `app/subscription.tsx` — يستدعي `refreshAuth()` بعد تفعيل كود
- `context/AuthContext.tsx` — `refresh()` أكثر موثوقية
- `app/detail.tsx` — يدعم `cast_list`, `plot`, `genres` كـ string, `hlsUrl`
- `app/player.tsx` — يدعم `embedUrl`, `luluHls` params
- `components/HeroSlider.tsx` — `genres.join` crash fix
