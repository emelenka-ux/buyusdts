#!/usr/bin/env bash
# Идемпотентная настройка nginx на сервере (запускается с GitHub-раннера по SSH).
set -e
export DEBIAN_FRONTEND=noninteractive

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx
fi

mkdir -p /var/www/buyusdt

cat > /etc/nginx/sites-available/buyusdt <<'CONF'
server {
    listen 80;
    listen [::]:80;
    server_name buyusdt.ru www.buyusdt.ru _;

    root /var/www/buyusdt;
    index index.html;

    location / { try_files $uri $uri/ =404; }

    location ~* \.(css|js|png|jpg|jpeg|svg|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
CONF

ln -sf /etc/nginx/sites-available/buyusdt /etc/nginx/sites-enabled/buyusdt
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx
echo "remote-init: nginx готов, корень сайта /var/www/buyusdt"
