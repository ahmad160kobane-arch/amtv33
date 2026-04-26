import paramiko, time

VPS_HOST = "62.171.153.204"
VPS_USER = "root"
VPS_PASS = "Mustafa7"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)

def run(cmd, timeout=30):
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    return o.read().decode() + e.read().decode()

print("=== فحص Nginx الحالي ===")
print(run("cat /etc/nginx/sites-available/webapp"))

print("\n=== فحص DNS amtvs.net ===")
print(run("dig +short amtvs.net A 2>/dev/null || nslookup amtvs.net 2>&1 | grep Address | tail -1"))

print("\n=== فحص SSL certbot ===")
print(run("certbot --version 2>&1"))

ssh.close()
