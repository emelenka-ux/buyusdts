#!/usr/bin/env bash
# Разовая настройка сервера HostKey под сайт Buy_USDTs.
# Запускать на сервере от root:  sudo bash server/setup.sh
set -euo pipefail

DOMAIN="buyusdt.ru"
ROOT="/var/www/buyusdt"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1/5 Пакеты: nginx, git, curl, Node 20"
apt-get update -y
apt-get install -y nginx git curl rsync
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 2/5 Папка сайта: $ROOT"
mkdir -p "$ROOT"
# если скрипт лежит внутри проекта — копируем проект в ROOT
if [ -f "$HERE/../index.html" ]; then
  rsync -a --exclude '.git' --exclude '.agents' --exclude 'node_modules' "$HERE/../" "$ROOT/"
fi

echo "==> 3/5 nginx-конфиг"
cp "$HERE/nginx-buyusdt.conf" /etc/nginx/sites-available/buyusdt
ln -sf /etc/nginx/sites-available/buyusdt /etc/nginx/sites-enabled/buyusdt
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> 4/5 Ключ API для ежедневных статей"
if [ ! -f /etc/buyusdt.env ]; then
  cat > /etc/buyusdt.env <<'EOF'
ANTHROPIC_API_KEY=ВСТАВЬТЕ_СЮДА_КЛЮЧ_sk-ant-...
SITE_URL=https://buyusdt.ru
MODEL=claude-sonnet-4-6
EOF
  chmod 600 /etc/buyusdt.env
  echo "   Создан /etc/buyusdt.env — впишите туда свой ключ: nano /etc/buyusdt.env"
fi

echo "==> 5/5 Ежедневный запуск (cron, 10:00 МСК)"
CRON_LINE='0 7 * * * set -a; . /etc/buyusdt.env; set +a; cd /var/www/buyusdt && /usr/bin/node scripts/generate-article.mjs >> /var/log/buyusdt-blog.log 2>&1'
( crontab -l 2>/dev/null | grep -v 'generate-article.mjs' ; echo "$CRON_LINE" ) | crontab -

echo ""
echo "ГОТОВО. Дальше:"
echo "  1) Впишите ключ: nano /etc/buyusdt.env"
echo "  2) Проверьте генерацию: set -a; . /etc/buyusdt.env; set +a; node $ROOT/scripts/generate-article.mjs"
echo "  3) Направьте домен buyusdt.ru -> $(curl -s ifconfig.me) (A-запись)"
echo "  4) HTTPS: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN -d www.$DOMAIN"
