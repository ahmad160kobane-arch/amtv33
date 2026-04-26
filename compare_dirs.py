import os, hashlib, shutil

SRC  = r"c:\Users\princ\Desktop\ma\_check_appwep"
DST  = r"c:\Users\princ\Desktop\ma\web-app"

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()

diff_files = []
new_files  = []

for root, dirs, files in os.walk(SRC):
    # تجاهل مجلدات غير ضرورية
    dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', '.next', '__pycache__'}]
    for fname in files:
        src_path = os.path.join(root, fname)
        rel      = os.path.relpath(src_path, SRC)
        dst_path = os.path.join(DST, rel)

        if os.path.exists(dst_path):
            if md5(src_path) != md5(dst_path):
                diff_files.append(rel)
        else:
            new_files.append(rel)

print(f"=== ملفات مختلفة ({len(diff_files)}) ===")
for f in diff_files:
    print(f"  CHANGED: {f}")

print(f"\n=== ملفات جديدة ({len(new_files)}) ===")
for f in new_files:
    print(f"  NEW: {f}")

print(f"\n--- المجموع: {len(diff_files)+len(new_files)} ملف ---")
