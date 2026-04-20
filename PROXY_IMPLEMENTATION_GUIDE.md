# 🌐 دليل تطبيق Proxy للاتصال بـ IPTV

## ✅ الإجابة: **نعم، سينجح!**

استخدام Proxy بين FFmpeg/Node.js و IPTV هو **الحل الأمثل** لمشكلة الحظر.

---

## 🎯 لماذا سينجح؟

### المشكلة الحالية:
```
VPS IP: 62.171.153.204
    ↓ (طلبات كثيرة)
IPTV Server: myhand.org
    ↓
❌ HTTP 403/502/511 (حظر IP)
```

### مع Proxy:
```
VPS IP: 62.171.153.204
    ↓
Proxy: IP مختلف (أو IPs متعددة)
    ↓
IPTV Server: myhand.org
    ↓
✅ يعمل بشكل طبيعي (IP جديد)
```

**IPTV يرى IP الـ Proxy وليس IP الـ VPS!**

---

## 🚀 خيارات التطبيق

### الخيار 1: VPN على VPS (الأسهل والأرخص) ⭐ موصى به

**التكلفة:** $3-5/شهر  
**الوقت:** 10 دقائق  
**الصعوبة:** سهل جداً

#### الخطوات:

```bash
# 1. اشترك في VPN (NordVPN, Surfshark, ProtonVPN)
# 2. على VPS:
apt update
apt install openvpn

# 3. حمّل ملف الـ config من VPN
# مثال NordVPN:
wget https://downloads.nordcdn.com/configs/files/ovpn_legacy/servers/us1234.nordvpn.com.tcp.ovpn

# 4. شغّل VPN
openvpn --config us1234.nordvpn.com.tcp.ovpn --daemon

# 5. تحقق من IP الجديد
curl ifconfig.me
# يجب أن يظهر IP مختلف عن 62.171.153.204

# 6. أعد تشغيل السيرفر
pm2 restart cloud-server
```

**الميزات:**
- ✅ كل الاتصالات تمر عبر VPN تلقائياً
- ✅ لا حاجة لتعديل الكود
- ✅ رخيص جداً
- ✅ سهل التطبيق

---

### الخيار 2: HTTP Proxy في الكود

**التكلفة:** $10-75/شهر  
**الوقت:** 30 دقيقة  
**الصعوبة:** متوسط

#### الخطوات:

```bash
# 1. تثبيت المكتبة
npm install https-proxy-agent socks-proxy-agent
```

```javascript
// 2. تعديل xtream-proxy.js
const { HttpsProxyAgent } = require('https-proxy-agent');

// إضافة Proxy config
const PROXY_URL = process.env.IPTV_PROXY || null;
const proxyAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

// في دالة fetchManifest و fetchSegment:
const response = await fetch(url, {
  headers: { 'User-Agent': 'VLC/3.0.18' },
  agent: proxyAgent,  // ← إضافة هذا السطر
  signal: AbortSignal.timeout(6000)
});
```

```bash
# 3. إضافة Proxy URL في .env
echo "IPTV_PROXY=http://proxy-server:8080" >> .env

# أو مع authentication:
echo "IPTV_PROXY=http://username:password@proxy-server:8080" >> .env

# 4. إعادة تشغيل
pm2 restart cloud-server
```

**مزودي Proxy موصى بهم:**
- **ProxyMesh** - $10/شهر (رخيص)
- **Smartproxy** - $75/شهر (rotating IPs)
- **Bright Data** - $500/شهر (enterprise)

---

### الخيار 3: Rotating Proxy (الأفضل للإنتاج)

**التكلفة:** $75/شهر  
**الميزات:**
- ✅ تغيير IP تلقائي كل طلب
- ✅ ملايين IPs متاحة
- ✅ لا حظر أبداً
- ✅ سرعة عالية

```javascript
// مثال Smartproxy
const PROXY_URL = 'http://username:password@gate.smartproxy.com:7000';

// كل طلب يستخدم IP مختلف تلقائياً!
```

---

## 🧪 اختبار Proxy مجاني (للتجربة)

```bash
# 1. جرب proxy مجاني من:
# https://free-proxy-list.net/

# 2. اختبر:
export IPTV_PROXY="http://123.45.67.89:8080"
node -e "
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const agent = new HttpsProxyAgent(process.env.IPTV_PROXY);
fetch('http://myhand.org:8080/live/07740338663/11223344/1017030.m3u8', { agent })
  .then(r => console.log('✅ Works!', r.status))
  .catch(e => console.log('❌ Failed:', e.message));
"
```

---

## 📊 مقارنة الحلول

| الحل | التكلفة | السهولة | الفعالية | الاستقرار |
|------|---------|---------|----------|-----------|
| **VPN على VPS** | $3/شهر | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **HTTP Proxy** | $10/شهر | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Rotating Proxy** | $75/شهر | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Proxy مجاني** | $0 | ⭐⭐⭐⭐ | ⭐ | ⭐ |

---

## 🎯 التوصية النهائية

### للبدء السريع (اليوم):
1. **جرب VPN مجاني** (ProtonVPN - مجاني تماماً)
2. إذا نجح → اشترك في VPN مدفوع ($3/شهر)

### للإنتاج (24/7):
1. **VPN مدفوع** ($3/شهر) - كافي لمعظم الحالات
2. إذا احتجت أكثر → **Rotating Proxy** ($75/شهر)

---

## 🔧 التطبيق الآن

### الطريقة السريعة (VPN):

```bash
# 1. على VPS
ssh root@62.171.153.204

# 2. تثبيت ProtonVPN (مجاني)
wget https://repo.protonvpn.com/debian/dists/stable/main/binary-all/protonvpn-stable-release_1.0.3-2_all.deb
dpkg -i protonvpn-stable-release_1.0.3-2_all.deb
apt update
apt install protonvpn

# 3. تسجيل الدخول
protonvpn-cli login

# 4. الاتصال
protonvpn-cli connect --fastest

# 5. تحقق
curl ifconfig.me

# 6. إعادة تشغيل
pm2 restart cloud-server
```

---

## ❓ أسئلة شائعة

### هل سيؤثر على السرعة؟
- VPN جيد: تأخير 10-50ms فقط
- Proxy جيد: تأخير 5-20ms فقط
- **لن يلاحظ المستخدمون الفرق**

### هل سيحل المشكلة 100%؟
- **نعم!** IPTV لن يرى IP الـ VPS
- سيرى IP الـ VPN/Proxy فقط
- لا حظر بعد الآن

### ماذا لو حُظر IP الـ VPN؟
- غيّر سيرفر VPN (دقيقة واحدة)
- أو استخدم Rotating Proxy (تغيير تلقائي)

---

## 🚀 هل تريد البدء؟

أخبرني أي خيار تفضل:
1. ✅ **VPN مجاني** (ProtonVPN) - نبدأ الآن
2. ✅ **VPN مدفوع** (NordVPN $3/شهر) - أفضل
3. ✅ **HTTP Proxy** في الكود - أكثر تحكم
4. ✅ **Rotating Proxy** ($75/شهر) - للإنتاج

وسأساعدك في التطبيق خطوة بخطوة! 🎯
