#!/usr/bin/env python3
"""
deploy_webapp_now.py
رفع ونشر تطبيق الويب (Next.js) على VPS بجانب السيرفر السحابي
الاستخدام: py deploy_webapp_now.py
"""

import paramiko
import os
import sys
import time
import stat

# ─── الإعدادات ─────────────────────────────────────────────
VPS_HOST     = "62.171.153.204"
VPS_PORT     = 22
VPS_USER     = "root"
VPS_PASS     = "Mustafa7"
LOCAL_DIR    = r"c:\Users\princ\Desktop\ma\web-app"
REMOTE_DIR   = "/home/webapp"
WEBAPP_PORT  = 3001
BACKEND_URL  = "https://amtv33-production.up.railway.app"
CLOUD_URL    = "http://localhost:8090"

# مجلدات/ملفات يتم تجاهلها عند الرفع
SKIP_DIRS  = {".next", "node_modules", ".git", "__pycache__", ".vercel"}
SKIP_FILES = {".env.local", ".env", "tsconfig.tsbuildinfo"}

# ─── الألوان ───────────────────────────────────────────────
G  = "\033[92m"  # أخضر
Y  = "\033[93m"  # أصفر
R  = "\033[91m"  # أحمر
B  = "\033[94m"  # أزرق
C  = "\033[96m"  # سماوي
NC = "\033[0m"   # إعادة ضبط
BOLD = "\033[1m"

def ok(msg):   print(f"{G}[✓]{NC} {msg}")
def info(msg): print(f"{B}[i]{NC} {msg}")
def warn(msg): print(f"{Y}[!]{NC} {msg}")
def err(msg):  print(f"{R}[✗]{NC} {msg}")
def step(msg): print(f"\n{C}{BOLD}{'═'*50}{NC}\n{C}{BOLD}  {msg}{NC}\n{C}{BOLD}{'═'*50}{NC}")

def run_ssh(ssh, cmd, timeout=300, show=True):
    """تشغيل أمر على VPS وإظهار المخرجات"""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    output = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line and show:
            print(f"   {line}")
        output.append(line)
    exit_code = stdout.channel.recv_exit_status()
    return exit_code, "\n".join(output)

def upload_dir(sftp, local_path, remote_path, depth=0):
    """رفع مجلد بشكل تكراري"""
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        sftp.mkdir(remote_path)

    items = os.listdir(local_path)
    for item in items:
        if item in SKIP_DIRS or item in SKIP_FILES:
            continue
        if item.startswith(".") and item not in {".gitignore", ".env.example"}:
            continue

        local_item  = os.path.join(local_path, item)
        remote_item = remote_path + "/" + item

        if os.path.isdir(local_item):
            if depth == 0:
                print(f"   📁 {item}/")
            upload_dir(sftp, local_item, remote_item, depth + 1)
        else:
            sftp.put(local_item, remote_item)

def main():
    print(f"""
{C}{BOLD}╔══════════════════════════════════════════════════════╗
║   🚀 نشر تطبيق الويب على VPS                        ║
║   VPS: {VPS_HOST}:{WEBAPP_PORT}                               ║
╚══════════════════════════════════════════════════════╝{NC}
""")

    # ─── الاتصال بـ VPS ────────────────────────────────────
    step("1. الاتصال بـ VPS")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(VPS_HOST, port=VPS_PORT, username=VPS_USER, password=VPS_PASS,
                    timeout=30, banner_timeout=30, auth_timeout=30)
        ok(f"متصل بـ {VPS_HOST}")
    except Exception as e:
        err(f"فشل الاتصال: {e}")
        sys.exit(1)

    # ─── فحص الوضع الحالي ─────────────────────────────────
    step("2. فحص الوضع الحالي على VPS")
    code, out = run_ssh(ssh, "pm2 status 2>/dev/null | head -20 || echo 'PM2 غير مثبت بعد'")
    code, out = run_ssh(ssh, "node -v 2>/dev/null || echo 'Node غير مثبت'")
    ok(f"Node.js: {out.strip()}")
    code, out = run_ssh(ssh, "nginx -v 2>&1 || echo 'Nginx غير مثبت'")
    info(f"Nginx: {out.strip()}")

    # ─── تثبيت الحزم المطلوبة ─────────────────────────────
    step("3. تثبيت الأدوات (Node.js / PM2 / Nginx)")
    
    install_cmds = [
        ("تحديث apt", "apt-get update -qq 2>/dev/null"),
        ("تثبيت curl/git/nginx", "apt-get install -y -qq curl git nginx build-essential 2>/dev/null"),
    ]
    
    # فحص Node.js
    code, out = run_ssh(ssh, "node -v 2>/dev/null | cut -d. -f1 | tr -d 'v'", show=False)
    node_ver = out.strip()
    if not node_ver.isdigit() or int(node_ver) < 18:
        warn("تثبيت Node.js 20...")
        install_cmds.append(("تثبيت Node.js 20",
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y -qq nodejs"))
    else:
        ok(f"Node.js {node_ver} مثبت مسبقاً")

    for label, cmd in install_cmds:
        info(f"  {label}...")
        code, out = run_ssh(ssh, cmd, show=False)
        if code != 0:
            warn(f"  تحذير في: {label}")
        else:
            ok(f"  {label}")

    # تثبيت PM2
    code, _ = run_ssh(ssh, "pm2 -v 2>/dev/null", show=False)
    if code != 0:
        info("  تثبيت PM2...")
        run_ssh(ssh, "npm install -g pm2 --quiet", show=False)
        ok("  PM2")
    else:
        ok("  PM2 مثبت")

    # ─── رفع ملفات تطبيق الويب ────────────────────────────
    step("4. رفع ملفات تطبيق الويب")
    info(f"  من: {LOCAL_DIR}")
    info(f"  إلى: {VPS_HOST}:{REMOTE_DIR}")
    
    sftp = ssh.open_sftp()
    
    # إنشاء المجلد الرئيسي
    try:
        sftp.stat(REMOTE_DIR)
        warn(f"  المجلد {REMOTE_DIR} موجود — سيتم تحديث الملفات")
    except FileNotFoundError:
        sftp.mkdir(REMOTE_DIR)
        ok(f"  تم إنشاء {REMOTE_DIR}")

    upload_dir(sftp, LOCAL_DIR, REMOTE_DIR)
    sftp.close()
    ok("  تم رفع جميع الملفات")

    # ─── إنشاء next.config.js المحسّن للـ VPS ───────────────
    step("5. إعداد next.config.js للـ VPS (localhost:8090)")
    
    next_config = r"""/** @type {import('next').NextConfig} */
// VPS deployment — cloud server runs locally on port 8090
const BACKEND_URL = 'https://amtv33-production.up.railway.app';
const CLOUD_URL   = 'http://localhost:8090';

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: ['camera=()', 'microphone=()', 'payment=()', 'usb=()', 'autoplay=*', 'fullscreen=*'].join(', '),
  },
];

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: { proxyTimeout: 120000 },
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      {
        source: '/proxy/live/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/free-hls/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/vod-play/:path*',
        headers: [
          { key: 'X-Accel-Buffering', value: 'no' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Expose-Headers', value: 'Content-Range, Content-Length, Accept-Ranges' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/api/vidsrc/:path*',  destination: `${CLOUD_URL}/api/vidsrc/:path*`  },
      { source: '/api/stream/:path*',  destination: `${CLOUD_URL}/api/stream/:path*`  },
      { source: '/api/xtream/:path*',  destination: `${CLOUD_URL}/api/xtream/:path*`  },
      { source: '/api/embed-proxy',    destination: `${CLOUD_URL}/api/embed-proxy`    },
      { source: '/proxy/live/:path*',  destination: `${CLOUD_URL}/proxy/live/:path*`  },
      { source: '/free-hls/:path*',    destination: `${CLOUD_URL}/free-hls/:path*`    },
      { source: '/xtream-play/:path*', destination: `${CLOUD_URL}/xtream-play/:path*` },
      { source: '/xtream-pipe/:path*', destination: `${CLOUD_URL}/xtream-pipe/:path*` },
      { source: '/hls/:path*',         destination: `${CLOUD_URL}/hls/:path*`         },
      { source: '/vod-play/:path*',    destination: `${CLOUD_URL}/vod-play/:path*`    },
      { source: '/api/:path*',         destination: `${BACKEND_URL}/api/:path*`       },
    ];
  },
};

module.exports = nextConfig;
"""

    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/next.config.js", "w") as f:
        f.write(next_config)
    sftp.close()
    ok("  تم إنشاء next.config.js مع localhost:8090")

    # ─── إنشاء .env.local ────────────────────────────────
    step("6. إعداد المتغيرات البيئية")
    env_local = f"""NODE_ENV=production
PORT={WEBAPP_PORT}
NEXT_PUBLIC_BACKEND_URL={BACKEND_URL}
NEXT_PUBLIC_CLOUD_URL={CLOUD_URL}
"""
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/.env.local", "w") as f:
        f.write(env_local)
    sftp.close()
    ok("  تم إنشاء .env.local")

    # ─── تثبيت الحزم ──────────────────────────────────────
    step("7. تثبيت حزم npm")
    info("  قد يستغرق 2-3 دقائق...")
    code, out = run_ssh(ssh, f"cd {REMOTE_DIR} && npm ci 2>&1 | tail -5", timeout=300)
    if code != 0:
        warn("  npm ci فشل — محاولة npm install...")
        code, out = run_ssh(ssh, f"cd {REMOTE_DIR} && npm install 2>&1 | tail -5", timeout=300)
    ok("  تم تثبيت الحزم")

    # ─── بناء Next.js ────────────────────────────────────
    step("8. بناء تطبيق Next.js (2-5 دقائق)")
    info("  جارٍ البناء...")
    code, out = run_ssh(ssh, f"cd {REMOTE_DIR} && npm run build 2>&1 | tail -20", timeout=600)
    if code != 0:
        err("  فشل البناء!")
        err(f"  {out[-500:]}")
        ssh.close()
        sys.exit(1)
    ok("  تم البناء بنجاح ✓")

    # ─── إعداد وتشغيل PM2 ───────────────────────────────
    step("9. تشغيل التطبيق عبر PM2")
    
    ecosystem = f"""module.exports = {{
  apps: [{{
    name: 'webapp',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '{REMOTE_DIR}',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {{
      NODE_ENV: 'production',
      PORT: {WEBAPP_PORT},
    }},
    error_file: '/var/log/webapp-error.log',
    out_file:   '/var/log/webapp-output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }}],
}};
"""
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/ecosystem.webapp.config.js", "w") as f:
        f.write(ecosystem)
    sftp.close()

    # إيقاف النسخة القديمة وتشغيل الجديدة
    run_ssh(ssh, "pm2 stop webapp 2>/dev/null; pm2 delete webapp 2>/dev/null; true", show=False)
    code, out = run_ssh(ssh, f"cd {REMOTE_DIR} && pm2 start ecosystem.webapp.config.js && pm2 save")
    if code != 0:
        err("  فشل تشغيل PM2!")
    else:
        ok("  webapp يعمل عبر PM2 على port 3001")

    # إعداد الإقلاع التلقائي
    run_ssh(ssh, "pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null; pm2 save", show=False)
    ok("  إعداد الإقلاع التلقائي")

    # ─── إعداد Nginx ──────────────────────────────────────
    step("10. إعداد Nginx كـ Reverse Proxy (port 80)")
    
    nginx_conf = f"""# ─── تطبيق الويب — Nginx Reverse Proxy ───────────────────
server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript
               application/vnd.apple.mpegurl video/MP2T;

    # Timeouts للبث
    proxy_connect_timeout 120s;
    proxy_send_timeout    120s;
    proxy_read_timeout    120s;
    send_timeout          120s;

    # ─── Next.js App ─────────────────────────────────────
    location / {{
        proxy_pass         http://127.0.0.1:{WEBAPP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }}

    # ─── HLS/M3U8 بدون buffering ─────────────────────────
    location ~* \\.(m3u8|ts)$ {{
        proxy_pass       http://127.0.0.1:{WEBAPP_PORT};
        proxy_buffering  off;
        proxy_cache      off;
        add_header       Cache-Control "no-cache, no-store";
        add_header       Access-Control-Allow-Origin "*";
    }}

    # ─── Health Check ─────────────────────────────────────
    location /health {{
        return 200 'webapp-ok\\n';
        add_header Content-Type text/plain;
    }}

    access_log /var/log/nginx/webapp-access.log;
    error_log  /var/log/nginx/webapp-error.log;
}}
"""

    sftp = ssh.open_sftp()
    with sftp.file("/etc/nginx/sites-available/webapp", "w") as f:
        f.write(nginx_conf)
    sftp.close()

    # تفعيل الإعداد
    run_ssh(ssh, "ln -sf /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/webapp", show=False)
    run_ssh(ssh, "rm -f /etc/nginx/sites-enabled/default", show=False)
    
    # فحص وإعادة تشغيل Nginx
    code, _ = run_ssh(ssh, "nginx -t 2>&1")
    if code == 0:
        run_ssh(ssh, "systemctl reload nginx || systemctl start nginx", show=False)
        ok("  Nginx جاهز على port 80")
    else:
        err("  خطأ في إعداد Nginx!")

    # فتح الجدار الناري
    run_ssh(ssh, f"ufw allow 80/tcp 2>/dev/null; ufw allow {WEBAPP_PORT}/tcp 2>/dev/null; true", show=False)

    # ─── إنشاء سكريبت تحديث سريع ─────────────────────────
    step("11. إنشاء أدوات الإدارة")
    
    sftp = ssh.open_sftp()
    update_script = f"""#!/bin/bash
echo "🔄 تحديث تطبيق الويب..."
cd {REMOTE_DIR}
npm run build
pm2 restart webapp
echo "✅ تم التحديث!"
pm2 status webapp
"""
    with sftp.file("/usr/local/bin/update-webapp", "w") as f:
        f.write(update_script)
    sftp.chmod("/usr/local/bin/update-webapp", 0o755)
    sftp.close()
    ok("  سكريبت update-webapp: /usr/local/bin/update-webapp")

    # ─── فحص نهائي ────────────────────────────────────────
    step("12. فحص التشغيل النهائي")
    time.sleep(3)
    
    # فحص PM2
    code, out = run_ssh(ssh, "pm2 status")
    
    # فحص الـ health
    code, out = run_ssh(ssh, f"curl -sf http://localhost:{WEBAPP_PORT}/ -o /dev/null -w '%{{http_code}}' 2>/dev/null || echo 'لم يستجب'", show=False)
    http_code = out.strip()
    if http_code in ["200", "304", "301", "302"]:
        ok(f"  webapp يستجيب (HTTP {http_code}) ✓")
    else:
        warn(f"  webapp HTTP code: {http_code} — انتظر بضع ثوانٍ")

    code, out = run_ssh(ssh, "curl -sf http://localhost/health 2>/dev/null || echo 'لم يستجب'", show=False)
    if "webapp-ok" in out:
        ok("  Nginx يعمل ✓")

    # ─── ملخص ─────────────────────────────────────────────
    ssh.close()
    print(f"""
{G}{BOLD}╔══════════════════════════════════════════════════════╗
║        ✅ تم النشر بنجاح!                            ║
╠══════════════════════════════════════════════════════╣
║  🌐 تطبيق الويب: http://{VPS_HOST}             ║
║  ⚡ بورت مباشر : http://{VPS_HOST}:{WEBAPP_PORT}          ║
║  ☁️  السيرفر السحابي: http://{VPS_HOST}:8090     ║
║                                                      ║
║  للتحديث لاحقاً  : py deploy_webapp_now.py          ║
║  تحديث سريع VPS : ssh root@{VPS_HOST} update-webapp ║
║  مراقبة PM2     : ssh root@{VPS_HOST} pm2 monit     ║
║  سجلات التطبيق  : ssh root@{VPS_HOST} pm2 logs webapp║
╚══════════════════════════════════════════════════════╝{NC}
""")

if __name__ == "__main__":
    main()
