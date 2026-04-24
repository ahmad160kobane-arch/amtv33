# 🔄 الحل: الحصول على روابط القنوات العراقية المحدثة

## ❌ المشكلة
الروابط التي أعطيتك قديمة ولا تعمل.

## ✅ الحل

### الطريقة 1: استخدام IPTV-ORG (الأفضل والأحدث)

**الرابط المباشر للقنوات العراقية المحدثة:**
```
https://iptv-org.github.io/iptv/countries/iq.m3u
```

هذا الرابط يتم تحديثه **تلقائياً** من قبل مجتمع IPTV-ORG.

---

## 🚀 كيفية الاستخدام

### الطريقة 1: تحميل الملف مباشرة

```bash
# على VPS أو جهازك
curl -o iraqi_channels_updated.m3u "https://iptv-org.github.io/iptv/countries/iq.m3u"

# أو باستخدام wget
wget -O iraqi_channels_updated.m3u "https://iptv-org.github.io/iptv/countries/iq.m3u"
```

---

### الطريقة 2: استخدام في VLC مباشرة

```
1. افتح VLC
2. Media → Open Network Stream
3. الصق: https://iptv-org.github.io/iptv/countries/iq.m3u
4. Play
```

---

### الطريقة 3: استخدام في IPTV Smarters

```
1. افتح IPTV Smarters
2. Add New User
3. Load Your Playlist or File/URL
4. الصق: https://iptv-org.github.io/iptv/countries/iq.m3u
5. Load
```

---

### الطريقة 4: إنشاء سكريبت تحديث تلقائي

```bash
# إنشاء سكريبت
nano update_iraqi_channels.sh
```

```bash
#!/bin/bash

echo "🔄 Updating Iraqi IPTV channels..."

# تحميل أحدث القنوات
curl -s "https://iptv-org.github.io/iptv/countries/iq.m3u" -o /tmp/iraqi_channels_new.m3u

# التحقق من نجاح التحميل
if [ $? -eq 0 ] && [ -s /tmp/iraqi_channels_new.m3u ]; then
    # نسخ الملف القديم كنسخة احتياطية
    if [ -f iraqi_channels.m3u ]; then
        cp iraqi_channels.m3u iraqi_channels_backup.m3u
        echo "✅ Backup created"
    fi
    
    # استبدال بالملف الجديد
    mv /tmp/iraqi_channels_new.m3u iraqi_channels.m3u
    
    # عد القنوات
    channel_count=$(grep -c "^#EXTINF" iraqi_channels.m3u)
    echo "✅ Updated! Found $channel_count channels"
    
    # عرض أسماء القنوات
    echo ""
    echo "📺 Available channels:"
    grep "^#EXTINF" iraqi_channels.m3u | sed 's/.*,/  - /'
else
    echo "❌ Failed to download channels"
    exit 1
fi
```

```bash
# جعل السكريبت قابل للتنفيذ
chmod +x update_iraqi_channels.sh

# تشغيل
./update_iraqi_channels.sh
```

---

### الطريقة 5: جدولة التحديث التلقائي (Cron)

```bash
# فتح crontab
crontab -e

# إضافة سطر للتحديث يومياً في الساعة 3 صباحاً
0 3 * * * /path/to/update_iraqi_channels.sh >> /var/log/iptv_update.log 2>&1
```

---

## 📋 مصادر إضافية للقنوات المحدثة

### 1. القنوات العربية (جميع الدول العربية)
```
https://iptv-org.github.io/iptv/languages/ara.m3u
```

### 2. القنوات حسب الفئة

#### الأخبار:
```
https://iptv-org.github.io/iptv/categories/news.m3u
```

#### الرياضة:
```
https://iptv-org.github.io/iptv/categories/sports.m3u
```

#### الأفلام:
```
https://iptv-org.github.io/iptv/categories/movies.m3u
```

#### الدينية:
```
https://iptv-org.github.io/iptv/categories/religious.m3u
```

---

## 🔧 سكريبت Node.js لإضافة القنوات إلى Database

```javascript
// update_channels_from_iptv_org.js
const https = require('https');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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
      // استخراج المعلومات
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);
      const idMatch = line.match(/tvg-id="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      
      currentChannel = {
        id: idMatch ? idMatch[1] : null,
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        logo: logoMatch ? logoMatch[1] : null,
        group: groupMatch ? groupMatch[1] : 'عراقي'
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      currentChannel.stream_url = line;
      channels.push(currentChannel);
      currentChannel = {};
    }
  }
  
  return channels;
}

// إضافة القنوات إلى Database
async function addChannelsToDatabase(channels) {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const ch of channels) {
    try {
      // إنشاء ID فريد
      const channelId = ch.id || `iraq_${ch.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      const result = await pool.query(
        `INSERT INTO channels (id, name, logo, stream_url, category, enabled, is_streaming, viewers)
         VALUES ($1, $2, $3, $4, $5, true, false, 0)
         ON CONFLICT (id) DO UPDATE SET
         name = $2, logo = $3, stream_url = $4, category = $5, updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [channelId, ch.name, ch.logo, ch.stream_url, ch.group]
      );
      
      if (result.rows[0].inserted) {
        added++;
        console.log(`✅ Added: ${ch.name}`);
      } else {
        updated++;
        console.log(`🔄 Updated: ${ch.name}`);
      }
    } catch (err) {
      failed++;
      console.error(`❌ Error with ${ch.name}:`, err.message);
    }
  }
  
  return { added, updated, failed };
}

// الدالة الرئيسية
async function main() {
  try {
    console.log('🔄 Downloading Iraqi channels from IPTV-ORG...');
    const m3uContent = await downloadM3U('https://iptv-org.github.io/iptv/countries/iq.m3u');
    
    console.log('📋 Parsing M3U file...');
    const channels = parseM3U(m3uContent);
    console.log(`Found ${channels.length} channels`);
    
    console.log('💾 Adding channels to database...');
    const stats = await addChannelsToDatabase(channels);
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Added: ${stats.added}`);
    console.log(`  🔄 Updated: ${stats.updated}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  📺 Total: ${channels.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
```

**الاستخدام:**
```bash
# تثبيت المكتبات
npm install pg

# تشغيل السكريبت
node update_channels_from_iptv_org.js
```

---

## 🧪 اختبار الروابط المحدثة

```bash
# سكريبت اختبار سريع
nano test_updated_channels.sh
```

```bash
#!/bin/bash

echo "🧪 Testing updated Iraqi channels..."

# تحميل الملف
curl -s "https://iptv-org.github.io/iptv/countries/iq.m3u" > /tmp/test_channels.m3u

# استخراج الروابط
urls=$(grep -v "^#" /tmp/test_channels.m3u | grep "http")

count=0
working=0
failed=0

for url in $urls; do
    count=$((count + 1))
    echo -n "Testing channel $count... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" -I --max-time 5 "$url")
    
    if [ "$status" -eq 200 ] || [ "$status" -eq 302 ]; then
        echo "✅ Working (HTTP $status)"
        working=$((working + 1))
    else
        echo "❌ Failed (HTTP $status)"
        failed=$((failed + 1))
    fi
done

echo ""
echo "📊 Results:"
echo "  Total: $count"
echo "  ✅ Working: $working"
echo "  ❌ Failed: $failed"
```

```bash
chmod +x test_updated_channels.sh
./test_updated_channels.sh
```

---

## 📺 عرض القنوات المتاحة

```bash
# عرض أسماء القنوات فقط
curl -s "https://iptv-org.github.io/iptv/countries/iq.m3u" | grep "^#EXTINF" | sed 's/.*,//'

# عرض مع التفاصيل
curl -s "https://iptv-org.github.io/iptv/countries/iq.m3u" | grep -A1 "^#EXTINF"
```

---

## 🔄 التحديث المستمر

### خيار 1: Cron Job يومي

```bash
# إضافة إلى crontab
0 3 * * * curl -s "https://iptv-org.github.io/iptv/countries/iq.m3u" -o /root/ma-streaming/iraqi_channels.m3u && node /root/ma-streaming/update_channels_from_iptv_org.js
```

### خيار 2: Systemd Timer

```bash
# إنشاء service
sudo nano /etc/systemd/system/iptv-update.service
```

```ini
[Unit]
Description=Update Iraqi IPTV Channels
After=network.target

[Service]
Type=oneshot
ExecStart=/root/ma-streaming/update_iraqi_channels.sh
User=root
```

```bash
# إنشاء timer
sudo nano /etc/systemd/system/iptv-update.timer
```

```ini
[Unit]
Description=Update Iraqi IPTV Channels Daily

[Timer]
OnCalendar=daily
OnBootSec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# تفعيل
sudo systemctl enable iptv-update.timer
sudo systemctl start iptv-update.timer
```

---

## 💡 نصائح مهمة

### 1. استخدم الروابط الرسمية دائماً
```
✅ https://iptv-org.github.io/iptv/countries/iq.m3u
❌ روابط عشوائية من مواقع غير موثوقة
```

### 2. حدّث القنوات بانتظام
```
- يومياً: للإنتاج
- أسبوعياً: للاختبار
- شهرياً: كحد أدنى
```

### 3. احتفظ بنسخة احتياطية
```bash
cp iraqi_channels.m3u iraqi_channels_backup_$(date +%Y%m%d).m3u
```

### 4. اختبر قبل النشر
```bash
# اختبر الملف الجديد قبل استبدال القديم
./test_updated_channels.sh
```

---

## 🌐 مصادر أخرى موثوقة

### 1. Free-TV IPTV
```
https://github.com/Free-TV/IPTV
```

### 2. IPTV-ORG Database
```
https://github.com/iptv-org/database
```

### 3. IPTV-ORG API
```
https://iptv-org.github.io/api/
```

---

## 📞 الدعم

إذا واجهت مشاكل:

1. **تحقق من الاتصال بالإنترنت**
   ```bash
   ping iptv-org.github.io
   ```

2. **تحقق من الملف تم تحميله**
   ```bash
   ls -lh iraqi_channels.m3u
   ```

3. **تحقق من محتوى الملف**
   ```bash
   head -20 iraqi_channels.m3u
   ```

4. **جرب رابط بديل**
   ```
   https://raw.githubusercontent.com/iptv-org/iptv/master/streams/iq.m3u
   ```

---

## ✅ الخلاصة

**الحل الأفضل:**
```bash
# 1. حمّل القنوات المحدثة
curl -o iraqi_channels.m3u "https://iptv-org.github.io/iptv/countries/iq.m3u"

# 2. اختبر
./test_updated_channels.sh

# 3. أضف إلى نظامك
node update_channels_from_iptv_org.js

# 4. جدول التحديث التلقائي
crontab -e
# أضف: 0 3 * * * /path/to/update_iraqi_channels.sh
```

**الآن لديك:**
- ✅ روابط محدثة تلقائياً
- ✅ سكريبتات جاهزة
- ✅ تحديث تلقائي
- ✅ اختبار تلقائي

**ابدأ الآن!** 🚀
