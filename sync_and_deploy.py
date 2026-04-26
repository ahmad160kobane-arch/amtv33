import os, hashlib, shutil, paramiko, time

SRC      = r"c:\Users\princ\Desktop\ma\_check_appwep"
DST      = r"c:\Users\princ\Desktop\ma\web-app"
VPS_HOST = "62.171.153.204"
VPS_USER = "root"
VPS_PASS = "Mustafa7"
REMOTE   = "/home/webapp"

# ملفات لا تُنسخ إلى web-app محلياً (مرتبطة بالبيئة)
SKIP_COPY = {'package-lock.json'}
# ملفات لا تُرفع إلى VPS
SKIP_VPS  = {'.gitignore', 'package-lock.json', '.env', '.env.local'}
SKIP_DIRS = {'.git', 'node_modules', '.next', '__pycache__', '.vercel'}

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f: h.update(f.read())
    return h.hexdigest()

# ─── الخطوة 1: نسخ الملفات المتغيرة إلى web-app ─────────
print("═"*55)
print("  1. نسخ التحديثات من _check_appwep إلى web-app")
print("═"*55)
copied = []
for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for fname in files:
        if fname in SKIP_COPY: continue
        src_path = os.path.join(root, fname)
        rel      = os.path.relpath(src_path, SRC)
        dst_path = os.path.join(DST, rel)
        
        needs_copy = not os.path.exists(dst_path) or md5(src_path) != md5(dst_path)
        if needs_copy:
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            shutil.copy2(src_path, dst_path)
            copied.append(rel)
            print(f"  [✓] {rel}")

print(f"\n  تم نسخ {len(copied)} ملف إلى web-app")

# ─── الخطوة 2: رفع الملفات المتغيرة إلى VPS عبر SFTP ────
print("\n" + "═"*55)
print("  2. رفع الملفات المحدّثة إلى VPS")
print("═"*55)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)
sftp = ssh.open_sftp()

def run(cmd, timeout=60):
    _,o,e = ssh.exec_command(cmd, timeout=timeout)
    return o.read().decode() + e.read().decode()

# رفع الملفات المتغيرة فقط (من web-app إلى VPS)
uploaded = []
for rel in copied:
    if any(part in SKIP_VPS for part in [os.path.basename(rel)]): continue
    local_path  = os.path.join(DST, rel)
    remote_path = REMOTE + "/" + rel.replace("\\", "/")
    
    # إنشاء المجلد إذا لم يكن موجوداً
    remote_dir = os.path.dirname(remote_path)
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        run(f"mkdir -p {remote_dir}")
    
    sftp.put(local_path, remote_path)
    uploaded.append(rel)
    print(f"  [↑] {rel}")

sftp.close()
print(f"\n  تم رفع {len(uploaded)} ملف إلى VPS")

# ─── الخطوة 3: إعادة البناء وإعادة التشغيل ───────────────
print("\n" + "═"*55)
print("  3. إعادة بناء Next.js على VPS (2-4 دقائق)")
print("═"*55)
print("  جارٍ البناء...")
build_out = run(f"cd {REMOTE} && npm run build 2>&1 | tail -15", timeout=360)
print(build_out)

if "error" in build_out.lower() and "compiled" not in build_out.lower():
    print("  [!] قد يكون هناك خطأ في البناء — فحص السجلات...")
else:
    print("  [✓] البناء ناجح")

# ─── الخطوة 4: إعادة تشغيل webapp ────────────────────────
print("\n" + "═"*55)
print("  4. إعادة تشغيل webapp")
print("═"*55)
print(run("pm2 restart webapp 2>&1"))
time.sleep(4)

# ─── الخطوة 5: فحص ───────────────────────────────────────
print("\n" + "═"*55)
print("  5. فحص التشغيل")
print("═"*55)
status = run("pm2 status webapp")
print(status)
http = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ 2>/dev/null')
print(f"  HTTP Response: {http.strip()}")

ssh.close()

print(f"""
{'═'*55}
  ✅ تم التحديث والنشر!
  🌐 http://{VPS_HOST}
{'═'*55}
""")
