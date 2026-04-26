import paramiko, os
VPS = "62.171.153.204"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS, username="root", password="Mustafa7", timeout=20)
sftp = ssh.open_sftp()
base = "c:/Users/princ/Desktop/ma/web-app/src/components"
sftp.put(f"{base}/Navbar.tsx", "/home/webapp/src/components/Navbar.tsx")
sftp.put(f"{base}/Logo.tsx", "/home/webapp/src/components/Logo.tsx")
sftp.close()

# Rebuild
print("Rebuilding on VPS...")
_,o,e = ssh.exec_command("cd /home/webapp && npm run build 2>&1")
print(o.read().decode())
ssh.exec_command("pm2 restart webapp")
ssh.close()
print("Done.")