import paramiko, time

VPS_HOST = "62.171.153.204"
VPS_USER = "root"
VPS_PASS = "Mustafa7"
DOMAIN   = "amtvs.net"
VPS_IP   = "62.171.153.204"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)

def run(cmd, timeout=120):
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode() + e.read().decode()
    return out.strip()

def step(title):
    print(f"\n{'═'*55}\n  {title}\n{'═'*55}")

# ─── 1. تثبيت certbot ────────────────────────────────────
step("1. تثبيت Certbot")
print(run("apt-get update -qq && apt-get install -y certbot python3-certbot-nginx 2>&1 | tail -5", timeout=120))
print(run("certbot --version 2>&1"))

# ─── 2. كتابة Nginx config للدومين (HTTP فقط أولاً) ─────
step("2. إعداد Nginx للدومين")

nginx_conf = f"""server {{
    listen 80;
    listen [::]:80;
    server_name {DOMAIN} www.{DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript
               application/vnd.apple.mpegurl video/MP2T;

    proxy_connect_timeout 120s;
    proxy_send_timeout    120s;
    proxy_read_timeout    120s;
    send_timeout          120s;

    location / {{
        proxy_pass         http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }}

    location ~* \\.(m3u8|ts)$ {{
        proxy_pass       http://127.0.0.1:3002;
        proxy_buffering  off;
        proxy_cache      off;
        add_header       Cache-Control "no-cache, no-store";
        add_header       Access-Control-Allow-Origin "*";
    }}

    location /health {{
        return 200 'webapp-ok\\n';
        add_header Content-Type text/plain;
    }}

    access_log /var/log/nginx/webapp-access.log;
    error_log  /var/log/nginx/webapp-error.log;
}}
"""

# كتابة ملف Nginx الجديد للدومين
sftp = ssh.open_sftp()
with sftp.open("/etc/nginx/sites-available/webapp", "w") as f:
    f.write(nginx_conf)
sftp.close()

# تأكد من وجود symlink
run("ln -sf /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/webapp 2>/dev/null || true")

# اختبار config
test = run("nginx -t 2>&1")
print(test)
if "ok" in test:
    print(run("systemctl reload nginx"))
    print("  [✓] Nginx محدّث")
else:
    print("  [!] خطأ في Nginx config")

# ─── 3. فحص هل DNS يشير للـ VPS ─────────────────────────
step("3. فحص DNS")
dns = run(f"dig +short {DOMAIN} A 2>/dev/null")
print(f"  amtvs.net => {dns}")

if VPS_IP in dns:
    # ─── 4. إصدار شهادة SSL ──────────────────────────────
    step("4. إصدار شهادة SSL (Let's Encrypt)")
    cert = run(
        f"certbot --nginx -d {DOMAIN} -d www.{DOMAIN} "
        f"--non-interactive --agree-tos --email admin@{DOMAIN} "
        f"--redirect 2>&1",
        timeout=180
    )
    print(cert)
    if "Congratulations" in cert or "Certificate not yet due" in cert:
        print("  [✓] SSL certificate تم إصداره")
    else:
        print("  [!] راجع السجل أعلاه")
else:
    print(f"""
  ⚠️  DNS لم يتغير بعد!
  
  يجب تغيير A records في لوحة إدارة الدومين:
  
  ┌─────────────────────────────────────────────┐
  │  Type: A    Name: @      Value: {VPS_IP}  │
  │  Type: A    Name: www    Value: {VPS_IP}  │
  └─────────────────────────────────────────────┘
  
  بعد تغيير DNS (قد يستغرق 5-30 دقيقة)، شغّل:
  py setup_ssl.py
""")

ssh.close()
print("\n✅ انتهى الإعداد")
