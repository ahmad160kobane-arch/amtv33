server {
    server_name amlive.shop www.amlive.shop;

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

    # Cloud server - HLS Streaming
    location /hls/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_buffering    off;
        proxy_cache        off;
    }

    # Cloud server - Xtream API
    location /api/xtream/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Cloud server - VidSrc API
    location /api/vidsrc/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # Cloud server - Stream API
    location /api/stream/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # Cloud server - Session API
    location /api/session/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # Web app - Lulu API
    location /api/lulu/ {
        proxy_pass         http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # Cloud server - Proxy endpoints (CORS handled by cloud-server)
    location /proxy/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_buffering    off;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    location /free-hls/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_buffering    off;
    }

    location /xtream-play/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_buffering    off;
    }

    location /vod-play/ {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_buffering    off;
    }

    # Web app - everything else
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

    location /health {
        return 200 'webapp-ok\n';
        add_header Content-Type text/plain;
    }

    access_log /var/log/nginx/web-amlive-access.log;
    error_log  /var/log/nginx/web-amlive-error.log;

    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/amlive.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/amlive.shop/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.amlive.shop) {
        return 301 https://$host$request_uri;
    }

    if ($host = amlive.shop) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name amlive.shop www.amlive.shop;
    return 404;
}
