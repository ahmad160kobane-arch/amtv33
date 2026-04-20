# 🌐 حل Proxy للاتصال بـ IPTV

## المشكلة:
IPTV يحظر VPS بعد فترة قصيرة (HTTP 403/502/511)

## الحل:
استخدام **HTTP/SOCKS Proxy** بين السيرفر و IPTV

---

## 🔧 الخيارات المتاحة:

### 1️⃣ Proxy مجاني (للاختبار)
**مصادر:**
- https://www.proxy-list.download/
- https://free-proxy-list.net/
- https://www.sslproxies.org/

**مشكلة:** غير مستقر، بطيء

---

### 2️⃣ Proxy مدفوع (موصى به)
**مزودين:**
- **Bright Data** (Luminati) - $500/شهر
- **Smartproxy** - $75/شهر
- **Oxylabs** - $300/شهر
- **ProxyMesh** - $10/شهر (رخيص!)

**ميزات:**
- ✅ Rotating IPs (تغيير تلقائي)
- ✅ سرعة عالية
- ✅ استقرار 99.9%
- ✅ لا حظر

---

### 3️⃣ VPN بدلاً من Proxy
**أرخص وأسهل:**
- **NordVPN** - $3.49/شهر
- **ExpressVPN** - $6.67/شهر
- **Surfshark** - $2.49/شهر

**كيف:**
```bash
# تثبيت OpenVPN على VPS
apt install openvpn
# تشغيل VPN
openvpn --config nordvpn.ovpn
# الآن كل الاتصالات تمر عبر VPN
```

---

## 🚀 التطبيق السريع:

### الطريقة 1: Proxy في FFmpeg
```javascript
// في xtream-proxy.js
const proxyUrl = 'http://proxy-server:8080';

fetch(iptvUrl, {
  agent: new HttpsProxyAgent(proxyUrl)
})
```

### الطريقة 2: Proxy في Node.js
```javascript
const HttpsProxyAgent = require('https-proxy-agent');
const agent = new HttpsProxyAgent('http://proxy:8080');

fetch(url, { agent })
```

### الطريقة 3: VPN على VPS (الأسهل!)
```bash
# على VPS
apt install openvpn
openvpn --config vpn-config.ovpn
# الآن كل الاتصالات تمر عبر VPN تلقائياً
```

---

## 💰 التكلفة:

| الحل | التكلفة | الاستقرار | السرعة |
|------|---------|-----------|---------|
| Proxy مجاني | $0 | ⭐ | ⭐ |
| ProxyMesh | $10/شهر | ⭐⭐⭐ | ⭐⭐⭐ |
| VPN | $3/شهر | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Rotating Proxy | $75/شهر | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 التوصية:

**للاختبار السريع:**
1. جرب **VPN مجاني** أولاً (ProtonVPN مجاني)
2. إذا نجح، اشترك في VPN مدفوع ($3/شهر)

**للإنتاج:**
- استخدم **Rotating Proxy** ($75/شهر)
- أو **VPN + Multi-account** (أرخص)

---

## ❓ هل تريد:
1. ✅ تجربة VPN مجاني الآن؟
2. ✅ تطبيق Proxy مدفوع؟
3. ✅ شرح كيفية إعداد VPN على VPS؟

أخبرني وسأساعدك! 🚀
