#!/usr/bin/env bash
# Настройка nginx + бесплатный SSL (Let's Encrypt) на сервере.
# Запускается с GitHub-раннера по SSH. Идемпотентно.
set -e
export DEBIAN_FRONTEND=noninteractive

DOMAIN="buyusdtinvoice.ru"
ROOT="/var/www/buyusdt"

# 1. пакеты
if ! command -v nginx >/dev/null 2>&1 || ! command -v rsync >/dev/null 2>&1 || ! command -v certbot >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y nginx rsync certbot
fi

mkdir -p "$ROOT"

# 2. базовый HTTP-конфиг (отдаёт сайт + ACME-проверку)
write_http_conf() {
cat > /etc/nginx/sites-available/buyusdt <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN _;

    root $ROOT;
    index index.html;

    location /.well-known/acme-challenge/ { root $ROOT; }
    location / { try_files \$uri \$uri/ =404; }
    location ~* \.(css|js|png|jpg|jpeg|svg|webp|woff2?)\$ { expires 7d; add_header Cache-Control "public"; }
}
CONF
}

write_http_conf
ln -sf /etc/nginx/sites-available/buyusdt /etc/nginx/sites-enabled/buyusdt
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx

# 3. получить сертификат, если его ещё нет
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot certonly --webroot -w "$ROOT" \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --deploy-hook "systemctl reload nginx" || echo "certbot: выпуск не удался (проверьте, что домен указывает на сервер)"
fi

# 4. если сертификат есть — включаем HTTPS + редирект http->https
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
cat > /etc/nginx/sites-available/buyusdt <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN _;
    root $ROOT;
    location /.well-known/acme-challenge/ { root $ROOT; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN _;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    root $ROOT;
    index index.html;

    location / { try_files \$uri \$uri/ =404; }
    location ~* \.(css|js|png|jpg|jpeg|svg|webp|woff2?)\$ { expires 7d; add_header Cache-Control "public"; }
}
CONF
  nginx -t
  systemctl reload nginx
  echo "remote-init: HTTPS включён для $DOMAIN"
else
  echo "remote-init: пока только HTTP (сертификат не выпущен)"
fi

echo "remote-init: готово, корень сайта $ROOT"
