import paramiko, time
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('62.171.153.204', username='root', password='Mustafa7', timeout=15)
def run(c):
    _,o,_ = ssh.exec_command(c)
    return o.read().decode().strip()
time.sleep(3)
code3002 = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ 2>/dev/null')
code80   = run('curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null')
health   = run('curl -s http://localhost/health 2>/dev/null')
print('port 3002 (webapp):', code3002)
print('port 80   (nginx) :', code80)
print('health check      :', health)
if code3002 in ('200','304','301','302') and code80 in ('200','304','301','302'):
    print('\n✅ تطبيق الويب يعمل على http://62.171.153.204')
else:
    print('\n[!] لا يزال يقلع — انتظر 10 ثوانٍ أخرى')
    logs = run('pm2 logs webapp --lines 5 --nostream 2>&1')
    print(logs)
ssh.close()
