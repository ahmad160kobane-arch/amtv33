# نظام القفل/البريميوم - تطبيق الهاتف 🔒

## البنية

```
AuthProvider (context/AuthContext.tsx)
  └─ useAuth() → isPremium, isLoggedIn, user, subscription, loading
       │
       ├─ ContentRow / LiveChannelRow → عرض القفل بصرياً
       │
       └─ usePremiumGuard() (hooks/usePremiumGuard.ts)
            └─ guard.requireAuth(action) → تنبيه أو تنفيذ
                 │
                 ├─ index.tsx (الرئيسية)
                 ├─ live.tsx (البث المباشر)
                 ├─ entertainment.tsx (الترفيه)
                 ├─ kids.tsx (الأطفال)
                 ├─ mylist.tsx (قائمتي)
                 ├─ allcontent.tsx (البحث)
                 ├─ detail.tsx (التفاصيل)
                 └─ favorites.tsx (المفضلات)
```

## كيف يعمل

### 1. الطبقة البصرية (ContentCard + LiveChannelCard)
- `useAuth()` → `isPremium` + `loading`
- إذا **غير بريميوم**:
  - 🔒 شارة "بريميوم" ذهبية أسفل البطاقة
  - تراك شفاف أسود (opacity 50%) مع أيقونة قفل + "اشترك للمشاهدة"
  - صورة البوستر بتقليل الشفافية (opacity 55%)
- إذا **بريميوم**: يعرض البطاقة عادية بدون قفل

### 2. طبقة الحماية (usePremiumGuard)
```
guard.requireAuth(() => {
  // الكود الذي ينفذ فقط إذا مسجل + بريميوم
});
```
- غير مسجل → تنبيه "تسجيل الدخول مطلوب" + زر "تسجيل الدخول"
- مسجل + غير بريميوم → تنبيه "محتوى بريميوم 🔒" + زر "اشترك الآن"
- مسجل + بريميوم → تنفيذ الكود

### 3. صفحة التفاصيل
- زر التشغيل يتغير:
  - **بريميوم**: زر ذهبي "تشغيل الفيلم" ▶
  - **غير بريميوم**: زر رمادي "اشترك للمشاهدة" 🔒
- `handlePlayMovie` و `handlePlayEpisode` يستخدمان `guard.requireAuth()`

### 4. التحقق من البريميوم
```typescript
checkIsPremium(user, subscription):
  - sub.isPremium === true → بريميوم
  - user.is_admin → بريميوم
  - user.role === "admin" → بريميوم
  - user.role === "agent" → بريميوم
  - user.plan === "premium" + لم ينتهِ → بريميوم
  - غير ذلك → مجاني
```

## الملفات المُنشأة/المُعدلة

### جديدة
- `context/AuthContext.tsx` — سياق المصادقة
- `hooks/usePremiumGuard.ts` — حارس البريميوم الموحد

### معدلة
- `app/_layout.tsx` — إضافة AuthProvider
- `components/AppIcons.tsx` — إضافة LockPremiumIcon, CrownIcon
- `components/ContentRow.tsx` — شارة القفل + تراك القفل
- `components/LiveChannelRow.tsx` — شارة القفل + تراك القفل
- `app/(tabs)/index.tsx` — حماية البريميوم
- `app/(tabs)/live.tsx` — حماية البريميوم + شارة القفل
- `app/(tabs)/entertainment.tsx` — حماية البريميوم + شارة القفل
- `app/(tabs)/kids.tsx` — حماية البريميوم
- `app/(tabs)/mylist.tsx` — حماية البريميوم
- `app/allcontent.tsx` — حماية البريميوم + شارة القفل
- `app/detail.tsx` — حماية البريميوم + زر القفل
- `app/favorites.tsx` — حماية البريميوم
