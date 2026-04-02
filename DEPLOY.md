# نشر Cloud Server على Contabo VPS

## المتطلبات
- **نظام التشغيل:** Ubuntu 22.04+ (Contabo VPS)
- **RAM:** 2GB+ (4GB مستحسن للـ Puppeteer + FFmpeg)
- **Node.js:** v20+
- **FFmpeg:** مثبّت على النظام

---

## الطريقة 1: سكريبت تلقائي (مستحسن)

```bash
# 1. انسخ الملفات للسيرفر
scp -r ./cloud-server root@YOUR_VPS_IP:/home/cloud-server

# 2. ادخل على السيرفر
ssh root@YOUR_VPS_IP

# 3. شغّل السكريبت
cd /home/cloud-server
chmod +x setup.sh
./setup.sh
```

السكريبت يثبّت تلقائياً:
- Node.js 20 + FFmpeg + Chromium libs
- PM2 (مدير عمليات)
- Nginx reverse proxy + SSL (اختياري)

---

## الطريقة 2: يدوي

### 1. تثبيت المتطلبات
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# FFmpeg
sudo apt-get install -y ffmpeg

# Chromium dependencies (للـ Puppeteer)
sudo apt-get install -y ca-certificates fonts-liberation libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 \
    libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 \
    libxdamage1 libxrandr2 xdg-utils

# PM2
sudo npm install -g pm2
```

### 2. تثبيت الحزم
```bash
cd /home/cloud-server
npm install --production
mkdir -p hls vod-cache logs
```

### 3. إنشاء ملف .env
```bash
cp .env.example .env
nano .env
```

أهم المتغيرات:
```env
PORT=8090
DB_PATH=/home/backend-api/data/ma_streaming.db
JWT_SECRET=نفس_القيمة_في_الباك_اند
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

### 4. تشغيل PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Nginx Reverse Proxy (اختياري — إذا عندك دومين)
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo nano /etc/nginx/sites-available/cloud-server
```

المحتوى:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_buffering off;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8090;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/cloud-server /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# SSL
sudo certbot --nginx -d your-domain.com
```

---

## أوامر PM2 المفيدة
```bash
pm2 status              # حالة السيرفر
pm2 logs cloud-server   # عرض اللوقات
pm2 restart cloud-server  # إعادة تشغيل
pm2 monit               # مراقبة حية (CPU/RAM)
pm2 flush               # مسح اللوقات القديمة
```

---

## ملاحظات مهمة

### قاعدة البيانات
- Cloud Server يحتاج نفس قاعدة بيانات الباك اند (`ma_streaming.db`)
- إذا Backend API على Railway → انسخ الـ DB أو استخدم API بدل الاتصال المباشر
- إذا كلاهما على نفس VPS → استخدم `DB_PATH=../backend-api/data/ma_streaming.db`

### الأمان
- `JWT_SECRET` يجب أن يكون **متطابق** بين Backend API و Cloud Server
- لا تنسَ فتح البورت في Firewall:
  ```bash
  sudo ufw allow 8090/tcp  # أو 80/443 إذا استخدمت Nginx
  ```

### الأداء
- Puppeteer يحتاج ~500MB RAM
- FFmpeg يحتاج ~100-300MB لكل بث نشط
- مستحسن VPS بـ 4GB RAM للأداء الأمثل
