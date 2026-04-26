import paramiko

VPS_HOST = "62.171.153.204"
VPS_USER = "root"
VPS_PASS = "Mustafa7"
DOMAIN   = "amtvs.net"
VPS_IP   = "62.171.153.204"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)

def run(cmd, timeout=180):
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    return o.read().decode() + e.read().decode()

print("=== إصدار شهادة SSL ===")
cert = run(
    f"certbot --nginx -d {DOMAIN} -d www.{DOMAIN} "
    f"--non-interactive --agree-tos --email admin@amtvs.net "
    f"--redirect 2>&1",
    timeout=180
)
print(cert)
print("\n=== إعادة تحميل Nginx ===")
print(run("systemctl reload nginx 2>&1"))
print("\n=== فحص SSL ===")
print(run(f"certbot certificates 2>&1 | grep -A5 {DOMAIN}"))
ssh.close()
