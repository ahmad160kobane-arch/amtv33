import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('62.171.153.204', username='root', password='Mustafa7', timeout=15)
def run(cmd):
    _,o,_ = ssh.exec_command(cmd)
    return o.read().decode()

# فحص سبب خطأ webapp
print('=== webapp PM2 logs ===')
print(run('pm2 logs webapp --lines 20 --nostream 2>&1'))
print('=== admin-dashboard port ===')
print(run('cat /home/admin-dashboard/server.js 2>/dev/null | head -20'))
print('=== What is on port 3001 ===')
print(run('ss -tlnp | grep 3001'))
print(run('ps aux | grep 1034383 | head -3'))
ssh.close()
