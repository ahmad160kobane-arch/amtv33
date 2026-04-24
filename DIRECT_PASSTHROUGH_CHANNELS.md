# 📺 ميزة القنوات المباشرة (Direct Passthrough)

## ✅ تم التطبيق بنجاح!

تم إضافة ميزة **القنوات المباشرة** التي تسمح بإضافة قنوات يدوياً وتمرير روابطها مباشرة للمستخدمين **بدون إعادة بث**.

---

## 🎯 ما هي القنوات المباشرة؟

### القنوات العادية (IPTV):
```
مستخدم → Backend API → Cloud Server (إعادة بث) → IPTV → Cloud Server → مستخدم
```
- ✅ تخفي رابط IPTV الأصلي
- ✅ تحكم كامل في البث
- ❌ تستهلك موارد السيرفر
- ❌ قد تتعرض للحظر من IPTV

### القنوات المباشرة (Direct Passthrough):
```
مستخدم → Backend API → رابط مباشر → مستخدم
```
- ✅ لا تستهلك موارد السيرفر
- ✅ لا إعادة بث
- ✅ مثالية للقنوات المجانية
- ❌ الرابط مكشوف للمستخدم

---

## 🚀 كيفية الاستخدام

### 1. إضافة قناة مباشرة من Admin Dashboard

```
1. افتح Admin Dashboard: http://62.171.153.204:3000
2. اذهب إلى "القنوات"
3. اضغط "+ يدوي"
4. املأ البيانات:
   - اسم القناة: مثلاً "العراقية الأولى"
   - المجموعة: "عراقي"
   - رابط البث: https://cdn.catiacast.video/abr/...
   - رابط الشعار: (اختياري)
   - ✓ فعّل "قناة مباشرة (Direct Passthrough)"
5. اضغط "إضافة"
```

---

### 2. إضافة قنوات من IPTV-ORG

#### الطريقة الأولى: يدوياً (قناة واحدة)

```bash
# 1. احصل على القنوات العراقية
curl "https://iptv-org.github.io/iptv/countries/iq.m3u" > iraqi_channels.m3u

# 2. افتح الملف واختر قناة
cat iraqi_channels.m3u

# 3. أضفها من Admin Dashboard
# مثال:
# الاسم: Al Iraqia
# الرابط: https://cdn.catiacast.video/abr/8d2ffb0aba244e8d9101a9488a7daa05/playlist.m3u8
# ✓ قناة مباشرة
```

#### الطريقة الثانية: سكريبت تلقائي (كل القنوات)

```javascript
// add_iptv_org_channels.js
const https = require('https');
const fetch = require('node-fetch');

const API = 'https://amtv33-production.up.railway.app';
const TOKEN = 'YOUR_ADMIN_TOKEN'; // احصل عليه من localStorage

// تحميل ملف M3U
function downloadM3U(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// تحليل ملف M3U
function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  let currentChannel = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      
      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        logo_url: logoMatch ? logoMatch[1] : '',
        group_name: groupMatch ? groupMatch[1] : 'عراقي'
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      currentChannel.stream_url = line;
      channels.push(currentChannel);
      currentChannel = {};
    }
  }
  
  return channels;
}

// إضافة القنوات
async function addChannels(channels) {
  let added = 0;
  let failed = 0;

  for (const ch of channels) {
    try {
      const res = await fetch(`${API}/api/admin/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          name: ch.name,
          group_name: ch.group_name,
          logo_url: ch.logo_url,
          stream_url: ch.stream_url,
          is_direct_passthrough: 1, // ← مباشرة
          sort_order: 0
        })
      });
      
      if (res.ok) {
        added++;
        console.log(`✅ Added: ${ch.name}`);
      } else {
        failed++;
        console.error(`❌ Failed: ${ch.name}`);
      }
    } catch (err) {
      failed++;
      console.error(`❌ Error: ${ch.name}`, err.message);
    }
  }
  
  return { added, failed };
}

// الدالة الرئيسية
async function main() {
  console.log('🔄 Downloading Iraqi channels from IPTV-ORG...');
  const m3uContent = await downloadM3U('https://iptv-org.github.io/iptv/countries/iq.m3u');
  
  console.log('📋 Parsing M3U file...');
  const channels = parseM3U(m3uContent);
  console.log(`Found ${channels.length} channels`);
  
  console.log('💾 Adding channels...');
  const stats = await addChannels(channels);
  
  console.log('\n📊 Summary:');
  console.log(`  ✅ Added: ${stats.added}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  📺 Total: ${channels.length}`);
}

main().catch(console.error);
```

**الاستخدام:**
```bash
# تثبيت المكتبات
npm install node-fetch

# تشغيل
node add_iptv_org_channels.js
```

---

## 📋 الفرق بين القنوات العادية والمباشرة

| الميزة | قنوات IPTV (عادية) | قنوات مباشرة |
|--------|-------------------|--------------|
| **إعادة البث** | ✅ نعم (عبر Cloud Server) | ❌ لا |
| **استهلاك الموارد** | ⚠️ عالي | ✅ صفر |
| **إخفاء الرابط** | ✅ نعم | ❌ لا |
| **التحكم في البث** | ✅ كامل | ❌ محدود |
| **مناسب لـ** | IPTV مدفوع | قنوات مجانية |
| **الحظر من IPTV** | ⚠️ محتمل | ✅ لا يوجد |

---

## 🎯 متى تستخدم كل نوع؟

### استخدم القنوات العادية (IPTV) عندما:
- ✅ لديك اشتراك IPTV مدفوع
- ✅ تريد إخفاء رابط IPTV
- ✅ تريد التحكم الكامل في البث
- ✅ تريد إحصائيات دقيقة

### استخدم القنوات المباشرة عندما:
- ✅ القنوات مجانية من الإنترنت
- ✅ تريد توفير موارد السيرفر
- ✅ لا تهتم بإخفاء الرابط
- ✅ تريد إضافة قنوات بسرعة

---

## 🔧 التعديلات التي تمت

### 1. Database Schema
```sql
-- أضيف حقل جديد
ALTER TABLE channels ADD COLUMN is_direct_passthrough INTEGER DEFAULT 0;
```

### 2. Backend API (`backend-api/routes/channels.js`)
```javascript
// GET /api/stream/:id
// إذا كانت القناة مباشرة، أرجع الرابط مباشرة
if (ch.is_direct_passthrough === 1) {
  return res.json({ 
    url: ch.stream_url, 
    direct: true,
    ready: true
  });
}
```

### 3. Admin Dashboard (`admin-dashboard/public/app.js`)
```javascript
// نموذج إضافة قناة
<input type="checkbox" id="ch-direct">
<span>قناة مباشرة (Direct Passthrough)</span>

// حفظ
is_direct_passthrough: document.getElementById('ch-direct')?.checked ? 1 : 0
```

---

## 📊 مثال عملي

### إضافة 50 قناة عراقية من IPTV-ORG

```bash
# 1. حمّل القنوات
curl "https://iptv-org.github.io/iptv/countries/iq.m3u" > iraqi.m3u

# 2. شغّل السكريبت
node add_iptv_org_channels.js

# النتيجة:
# ✅ Added: Al Iraqia
# ✅ Added: Al Sharqiya
# ✅ Added: Kurdistan 24
# ✅ Added: Rudaw TV
# ... (50 قناة)
#
# 📊 Summary:
#   ✅ Added: 50
#   ❌ Failed: 0
#   📺 Total: 50
```

### النتيجة:
- ✅ 50 قناة عراقية متاحة للمستخدمين
- ✅ صفر استهلاك لموارد السيرفر
- ✅ لا حاجة لإعادة بث
- ✅ تظهر مع القنوات العادية بشكل طبيعي

---

## 🧪 الاختبار

### 1. اختبر من Admin Dashboard
```
1. أضف قناة مباشرة
2. فعّل "قناة مباشرة"
3. احفظ
4. تحقق من القائمة
```

### 2. اختبر من Web App
```
1. سجل دخول كمستخدم
2. اذهب إلى "القنوات المباشرة"
3. اختر قناة مباشرة
4. يجب أن تعمل مباشرة بدون تأخير
```

### 3. تحقق من الرابط
```javascript
// في Web App Console (F12)
// يجب أن ترى:
{
  url: "https://cdn.catiacast.video/abr/...",
  direct: true,
  ready: true
}
```

---

## ⚠️ ملاحظات مهمة

### 1. الأمان
- ⚠️ الرابط مكشوف للمستخدم
- ⚠️ يمكن للمستخدم مشاركة الرابط
- ✅ مناسب فقط للقنوات المجانية

### 2. الأداء
- ✅ لا استهلاك لموارد السيرفر
- ✅ لا حاجة لـ FFmpeg
- ✅ لا حاجة لـ Cloud Server

### 3. الصيانة
- ✅ الروابط قد تتغير (تحديث دوري)
- ✅ بعض القنوات قد تتوقف
- ✅ استخدم IPTV-ORG للتحديثات

---

## 🚀 الخطوات التالية

### 1. أضف القنوات العراقية
```bash
node add_iptv_org_channels.js
```

### 2. اختبر في Web App
```
افتح Web App → القنوات → اختر قناة مباشرة
```

### 3. راقب الأداء
```bash
# لا يوجد استهلاك للموارد!
pm2 monit
```

---

## 📞 الدعم

إذا واجهت مشاكل:

1. **القناة لا تعمل**
   - تحقق من الرابط في VLC
   - جرب رابط آخر من IPTV-ORG

2. **الرابط قديم**
   - حدّث من IPTV-ORG
   - استخدم سكريبت التحديث التلقائي

3. **القناة بطيئة**
   - هذه مشكلة في المصدر
   - جرب قناة أخرى

---

## ✅ الخلاصة

**الآن لديك:**
- ✅ نظام قنوات مزدوج (IPTV + مباشرة)
- ✅ توفير موارد السيرفر
- ✅ إضافة قنوات مجانية بسهولة
- ✅ مرونة كاملة في الإدارة

**استخدم:**
- 📺 **IPTV** للقنوات المدفوعة (beIN, MBC, etc.)
- 🌐 **مباشرة** للقنوات المجانية (IPTV-ORG)

**النتيجة:**
- ✅ نظام متكامل
- ✅ أداء ممتاز
- ✅ تكلفة أقل

**ابدأ الآن!** 🚀
