# Buy_USDTs — сайт + блог с автопубликацией

Статичный сайт (без сборки) + блог, который сам пополняется статьями раз в день через GitHub Actions.

## Структура
```
index.html            — главная
styles.css, script.js — стили и логика
logo.png              — логотип
blog.html             — список статей (маркер ARTICLES:START)
blog/<slug>.html      — статьи
blog/_template.html   — шаблон статьи (плейсхолдеры {{...}})
blog/topics.md        — очередь тем для авто-публикации
scripts/generate-article.mjs — генератор статьи (Claude API)
.github/workflows/    — деплой и ежедневная статья
robots.txt, sitemap.xml
```

## Локальный просмотр
Просто откройте `index.html` в браузере (двойной клик).

## Шаг 1. Выложить на GitHub
```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/buyusdts.git
git branch -M main
git push -u origin main
```
(Репозиторий создайте на github.com → New repository → имя, например `buyusdts`.)

## Шаг 2. Включить сайт (GitHub Pages)
1. Репозиторий → **Settings → Pages** → Source: **GitHub Actions**.
2. После первого пуша workflow «Деплой сайта» опубликует сайт.
3. Домен: **Settings → Pages → Custom domain** → `buyusdtinvoice.ru`.
   В DNS у регистратора добавьте записи на GitHub Pages:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - либо `CNAME` для www → `ВАШ_ЛОГИН.github.io`

## Шаг 3. Включить ежедневные статьи
1. Получите ключ Anthropic API: https://console.anthropic.com → API Keys.
2. Репозиторий → **Settings → Secrets and variables → Actions → New repository secret**:
   - имя: `ANTHROPIC_API_KEY`, значение: ваш ключ `sk-ant-...`
3. Готово. Каждый день в 10:00 МСК workflow «Ежедневная статья» берёт тему из `blog/topics.md`,
   пишет статью, кладёт в `blog/`, добавляет карточку в `blog.html` и пушит — сайт пересобирается.
   Запустить вручную: вкладка **Actions → Ежедневная статья → Run workflow**.

### Управление темами
Темы лежат в `blog/topics.md` в разделе **В очереди**. Дописывайте строки в формате:
```
- [ ] Заголовок статьи (tag: Рубрика) → slug: latinicey-cherez-defis
```
Опубликованные темы скрипт сам переносит в раздел **Опубликовано**.

### Режим публикации
По умолчанию — авто-коммит в `main` (статья сразу онлайн). Если хотите сначала проверять —
напишите, переключу workflow на создание Pull Request (вы жмёте Merge, когда одобрили).

## Альтернатива: деплой на свой сервер HostKey (вместо Pages)
Если хотите держать сайт на своём сервере, добавьте секреты `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PATH`
и workflow с rsync по SSH — попросите, пришлю готовый `deploy-ssh.yml` под вашу конфигурацию.
```
