import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('62.171.153.204', username='root', password='Mustafa7', timeout=15)
def run(cmd):
    _,o,e = ssh.exec_command(cmd, timeout=30)
    out = o.read().decode()
    err = e.read().decode()
    return out + err

# 1. تحديث ecosystem.webapp.config.js إلى port 3002
print('[1] تحديث PM2 config إلى port 3002...')
ecosystem = """module.exports = {
  apps: [{
    name: 'webapp',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/home/webapp',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002,
    },
    error_file: '/var/log/webapp-error.log',
    out_file:   '/var/log/webapp-output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }],
};
"""
sftp = ssh.open_sftp()
with sftp.file('/home/webapp/ecosystem.webapp.config.js', 'w') as f:
    f.write(ecosystem)

# 2. تحديث .env.local إلى port 3002
env_local = "NODE_ENV=production\nPORT=3002\nNEXT_PUBLIC_BACKEND_URL=https://amtv33-production.up.railway.app\nNEXT_PUBLIC_CLOUD_URL=http://localhost:8090\n"
with sftp.file('/home/webapp/.env.local', 'w') as f:
    f.write(env_local)
sftp.close()
print('   تم تحديث config')

# 3. تحديث Nginx ليشير إلى port 3002
print('[2] تحديث Nginx إلى port 3002...')
nginx_conf = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

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

    location / {
        proxy_pass         http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ~* \\.(m3u8|ts)$ {
        proxy_pass       http://127.0.0.1:3002;
        proxy_buffering  off;
        proxy_cache      off;
        add_header       Cache-Control "no-cache, no-store";
        add_header       Access-Control-Allow-Origin "*";
    }

    location /health {
        return 200 'webapp-ok\\n';
        add_header Content-Type text/plain;
    }

    access_log /var/log/nginx/webapp-access.log;
    error_log  /var/log/nginx/webapp-error.log;
}
"""
sftp = ssh.open_sftp()
with sftp.file('/etc/nginx/sites-available/webapp', 'w') as f:
    f.write(nginx_conf)
sftp.close()
print('   تم تحديث Nginx')

# 4. إعادة تشغيل webapp على port 3002
print('[3] إعادة تشغيل webapp...')
print(run('pm2 stop webapp 2>/dev/null; pm2 delete webapp 2>/dev/null; echo done'))
import time
time.sleep(1)
print(run('cd /home/webapp && pm2 start ecosystem.webapp.config.js'))
time.sleep(4)

# 5. فحص nginx وإعادة تشغيله
print('[4] إعادة تشغيل Nginx...')
print(run('nginx -t 2>&1'))
print(run('systemctl reload nginx 2>&1'))

# 6. حفظ PM2
print(run('pm2 save'))

time.sleep(3)
# 7. فحص
print('[5] فحص...')
print(run('pm2 status'))
print(run('curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ 2>/dev/null'))
print(run('curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null'))

ssh.close()
print('\n✅ تم! webapp على port 3002، Nginx يعيد التوجيه من port 80')
