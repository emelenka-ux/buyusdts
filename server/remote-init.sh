#!/usr/bin/env bash
# Настройка сервера: nginx + SSL + PHP (админка) + rates.json + cron обновления курса.
# Запускается с GitHub-раннера по SSH. Идемпотентно.
set -e
export DEBIAN_FRONTEND=noninteractive

DOMAIN="buyusdtinvoice.ru"
ROOT="/var/www/buyusdt"

# 1. пакеты (nginx, rsync, certbot, php-fpm, jq, curl)
NEED=""
command -v nginx  >/dev/null 2>&1 || NEED="$NEED nginx"
command -v rsync  >/dev/null 2>&1 || NEED="$NEED rsync"
command -v certbot>/dev/null 2>&1 || NEED="$NEED certbot"
command -v jq     >/dev/null 2>&1 || NEED="$NEED jq"
command -v curl   >/dev/null 2>&1 || NEED="$NEED curl"
ls /run/php/php*-fpm.sock >/dev/null 2>&1 || NEED="$NEED php-fpm"
if [ -n "$NEED" ]; then apt-get update -y; apt-get install -y $NEED; fi

# убедимся, что php-fpm запущен (создаёт сокет)
for u in $(systemctl list-unit-files 'php*-fpm.service' --no-legend 2>/dev/null | awk '{print $1}'); do
  systemctl enable --now "$u" >/dev/null 2>&1 || true
done

mkdir -p "$ROOT"
PHPSOCK="$(ls /run/php/php*-fpm.sock 2>/dev/null | head -1)"
[ -z "$PHPSOCK" ] && PHPSOCK="/run/php/php-fpm.sock"

# 2. пароль админки (из ADMIN_PASSWORD_B64; иначе дефолт при первом запуске)
if [ -n "${ADMIN_PASSWORD_B64:-}" ]; then
  echo "$ADMIN_PASSWORD_B64" | base64 -d > /etc/buyusdt-admin.pass
elif [ ! -f /etc/buyusdt-admin.pass ]; then
  printf 'changeme' > /etc/buyusdt-admin.pass
fi
chown root:www-data /etc/buyusdt-admin.pass 2>/dev/null || true
chmod 640 /etc/buyusdt-admin.pass

# 3. rates.json — создаём только если нет (не затираем правки админки/крона)
if [ ! -f "$ROOT/rates.json" ]; then
  cat > "$ROOT/rates.json" <<'JSON'
{"cny_rub": 12.50, "usdt_buy": 78.98, "usdt_sell": 78.97, "usdt_cny": 7.20, "fee": 0.005, "updated": ""}
JSON
fi
chown www-data:www-data "$ROOT/rates.json" 2>/dev/null || true
chmod 664 "$ROOT/rates.json"

# 4. nginx-конфиг (с PHP). Пишем HTTP, получаем сертификат, затем HTTPS.
PHP_LOC="location ~ \.php\$ { include snippets/fastcgi-php.conf; fastcgi_pass unix:$PHPSOCK; }"

cat > /etc/nginx/sites-available/buyusdt <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN _;
    root $ROOT;
    index index.html;
    location /.well-known/acme-challenge/ { root $ROOT; }
    location / { try_files \$uri \$uri/ =404; }
    $PHP_LOC
    location ~* \.(css|js|png|jpg|jpeg|svg|webp|woff2?)\$ { expires 7d; add_header Cache-Control "public"; }
}
CONF
ln -sf /etc/nginx/sites-available/buyusdt /etc/nginx/sites-enabled/buyusdt
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot certonly --webroot -w "$ROOT" -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --deploy-hook "systemctl reload nginx" || echo "certbot: выпуск не удался"
fi

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
    $PHP_LOC
    location = /rates.json { add_header Cache-Control "no-store"; }
    location ~* \.(css|js|png|jpg|jpeg|svg|webp|woff2?)\$ { expires 7d; add_header Cache-Control "public"; }
}
CONF
  nginx -t
  systemctl reload nginx
fi

# 5. RATES_ENDPOINT (live-курс USDT с биржи) — из env при деплое
if [ -n "${RATES_ENDPOINT:-}" ]; then
  echo "RATES_ENDPOINT=\"$RATES_ENDPOINT\"" > /etc/buyusdt.env
elif [ ! -f /etc/buyusdt.env ]; then
  echo 'RATES_ENDPOINT=""' > /etc/buyusdt.env
fi
chmod 600 /etc/buyusdt.env

# обновлятель курса (cron каждые 3 мин; работает только если задан RATES_ENDPOINT)
cat > /usr/local/bin/buyusdt-update-rates.sh <<'UPD'
#!/usr/bin/env bash
set -e
[ -f /etc/buyusdt.env ] && . /etc/buyusdt.env
[ -z "${RATES_ENDPOINT:-}" ] && exit 0
F=/var/www/buyusdt/rates.json
resp="$(curl -fsS -m 15 "$RATES_ENDPOINT")" || exit 0
buy="$(printf '%s' "$resp"  | jq -r '(.ask.highestPrice // .ask.items[0][0]) | tostring' 2>/dev/null)"
sell="$(printf '%s' "$resp" | jq -r '(.bid.highestPrice // .bid.items[0][0]) | tostring' 2>/dev/null)"
case "$buy" in ''|null) exit 0;; esac
case "$sell" in ''|null) sell="$buy";; esac
out="$(jq --arg b "$buy" --arg s "$sell" --arg t "$(date -u +%FT%TZ)" '.usdt_buy=($b|tonumber) | .usdt_sell=($s|tonumber) | .updated=$t' "$F")" || exit 0
printf '%s' "$out" > "$F"
UPD
chmod 755 /usr/local/bin/buyusdt-update-rates.sh
( crontab -l 2>/dev/null | grep -v 'buyusdt-update-rates' ; echo '*/3 * * * * /usr/local/bin/buyusdt-update-rates.sh >> /var/log/buyusdt-rates.log 2>&1' ) | crontab -

echo "remote-init: готово (nginx+PHP, rates.json, cron)"
