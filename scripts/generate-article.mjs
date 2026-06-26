/**
 * Ежедневная генерация статьи для блога Buy_USDTs.
 *
 * Что делает:
 *  1. Берёт первую тему из раздела «В очереди» в blog/topics.md
 *  2. Просит Claude API написать статью (JSON: description, keywords, readMin, bodyHtml)
 *  3. Заполняет blog/_template.html → blog/<slug>.html
 *  4. Вставляет карточку в blog.html (после маркера ARTICLES:START)
 *  5. Добавляет URL в sitemap.xml
 *  6. Переносит тему в «Опубликовано» в topics.md
 *
 * Запуск: node scripts/generate-article.mjs
 * Нужно: переменная окружения ANTHROPIC_API_KEY (и опц. MODEL, SITE_URL).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = process.env.SITE_URL || 'https://buyusdtinvoice.ru';
const MODEL = process.env.MODEL || 'claude-sonnet-4-6';
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('Нет ANTHROPIC_API_KEY'); process.exit(1); }

const p = (...x) => path.join(ROOT, ...x);
const today = new Date();
const iso = today.toISOString().slice(0, 10);
const human = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const humanShort = today.toLocaleDateString('ru-RU');

/* ---- 1. выбрать тему ---- */
const topicsRaw = await readFile(p('blog/topics.md'), 'utf8');
const queueMatch = topicsRaw.match(/## В очереди([\s\S]*?)(?=\n## |\s*$)/);
if (!queueMatch) { console.error('Не найден раздел «В очереди»'); process.exit(1); }
const lineRe = /- \[ \] (.+?)(?:\s*\(tag:\s*(.+?)\))?\s*→\s*slug:\s*([a-z0-9-]+)/i;
const queueLines = queueMatch[1].split('\n');
const idx = queueLines.findIndex((l) => lineRe.test(l));
if (idx === -1) { console.log('Очередь пуста — нечего публиковать.'); process.exit(0); }
const m = queueLines[idx].match(lineRe);
const topicTitle = m[1].trim();
const tag = (m[2] || 'Блог').trim();
const slug = m[3].trim();
console.log('Тема:', topicTitle, '| slug:', slug, '| tag:', tag);

/* ---- 2. сгенерировать статью через Claude API ---- */
const system = `Ты — ведущий редактор-копирайтер блога Buy_USDTs (Москва-Сити): платёжный агент/ВЭД — оплата инвойсов и поставщиков за границу и в Китай, переводы по миру, USDT, Alipay, WeChat. Пишешь экспертно, человечно и по делу, на русском.

ЦЕЛЬ: полезная экспертная статья, которая снимает страхи импортёра и мягко ведёт к заявке.

ВСЕГДА:
- Начинай с выгоды/боли читателя и дай ПРЯМОЙ ОТВЕТ в первом абзаце (мини-TL;DR, 2–3 предложения) — это важно и для людей, и для ИИ-поиска (Нейро Яндекса, AI Overviews).
- Пиши «вы-ориентированно» (о выгоде клиента), а не «мы-ориентированно».
- Конкретика: сроки (1–3 дня), способы (USDT, Alipay/WeChat, карты КНР, наличные), документы (инвойс, закрывающие для бухгалтерии). Не выдумывай точные цифры/курсы/проценты.
- Закрывай возражения ВЭД прямо в тексте: законно ли это, от чего зависит комиссия, какие сроки, что с документами для бухгалтерии, что если платёж зависнет.
- H2 в форме вопросов («Как…», «Сколько стоит…», «Законно ли…»). Короткие абзацы (2–4 строки), маркированные списки, где уместно — сравнительная таблица.
- В конце добавь раздел <h2>Частые вопросы</h2> с 3–5 парами вопрос(<h3>)/ответ(<p>).
- Заверши одним ценностным призывом текстом (например: «Пришлите инвойс — рассчитаем срок и комиссию»). Ссылку на расчёт давай как <a href="../index.html#calc">калькулятор</a>. Кнопку-CTA не пиши — она уже есть в шаблоне.

НИКОГДА:
- Никакого канцелярита и «воды»: убирай «осуществление оплаты», «в целях», «данный», «являться», «в рамках»; пустые усилители «качественный/эффективный/надёжный/лучший/индивидуальный подход».
- Без кликбейта (заголовок уже задан темой — выполняй его). Без юридических и финансовых гарантий и обещаний доходности. Юр/налоговые моменты формулируй аккуратно, не как абсолютную истину.
- Не дублируй <h1>.

ОБЪЁМ: 800–1200 слов.

ФОРМАТ ОТВЕТА — СТРОГО валидный JSON без markdown-обёртки:
{"description": "<=160 символов, от выгоды", "keywords": "6–10 ключей через запятую", "readMin": <число>, "bodyHtml": "<HTML статьи>"}
В bodyHtml разрешены только теги: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <blockquote>, <a href>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. Начинай с вводного <p> (без <h1>).`;

const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 6000,
    system,
    messages: [{ role: 'user', content: `Напиши статью на тему: «${topicTitle}». Тег рубрики: ${tag}.` }],
  }),
});
if (!resp.ok) { console.error('Ошибка API:', resp.status, await resp.text()); process.exit(1); }
const data = await resp.json();
let txt = (data.content?.[0]?.text || '').trim();
txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
let art;
try { art = JSON.parse(txt); } catch (e) { console.error('Не распарсил JSON ответа:', e.message, '\n', txt.slice(0, 400)); process.exit(1); }
const readMin = Number(art.readMin) || 6;

/* ---- 3. собрать страницу статьи из шаблона ---- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tpl = await readFile(p('blog/_template.html'), 'utf8');
const page = tpl
  .replace(/\{\{TITLE\}\}/g, esc(topicTitle))
  .replace(/\{\{DESCRIPTION\}\}/g, esc(art.description || topicTitle))
  .replace(/\{\{KEYWORDS\}\}/g, esc(art.keywords || ''))
  .replace(/\{\{SLUG\}\}/g, slug)
  .replace(/\{\{TAG\}\}/g, esc(tag))
  .replace(/\{\{DATE_ISO\}\}/g, iso)
  .replace(/\{\{DATE_HUMAN\}\}/g, human)
  .replace(/\{\{READ_MIN\}\}/g, String(readMin))
  .replace(/\{\{BODY_HTML\}\}/g, art.bodyHtml || '');
await writeFile(p('blog', `${slug}.html`), page, 'utf8');

/* ---- 4. карточка в blog.html ---- */
const card = `    <a class="post-card reveal" href="blog/${slug}.html">
      <span class="tag">${esc(tag)}</span>
      <h2>${esc(topicTitle)}</h2>
      <p>${esc(art.description || '')}</p>
      <div class="post-meta"><time>${humanShort}</time><span>${readMin} мин</span></div>
      <span class="post-card__more">Читать →</span>
    </a>`;
let blog = await readFile(p('blog.html'), 'utf8');
blog = blog.replace('<!-- ARTICLES:START -->', `<!-- ARTICLES:START -->\n${card}`);
await writeFile(p('blog.html'), blog, 'utf8');

/* ---- 5. sitemap ---- */
let sm = await readFile(p('sitemap.xml'), 'utf8');
const urlBlock = `  <url>\n    <loc>${SITE}/blog/${slug}.html</loc>\n    <lastmod>${iso}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
if (!sm.includes(`/blog/${slug}.html`)) sm = sm.replace('</urlset>', `${urlBlock}</urlset>`);
await writeFile(p('sitemap.xml'), sm, 'utf8');

/* ---- 6. topics.md: перенести тему в «Опубликовано» ---- */
let topics = topicsRaw.replace(queueLines[idx] + '\n', '').replace(queueLines[idx], '');
topics = topics.replace(/(## Опубликовано\n)/, `$1- [x] ${iso} — ${topicTitle} → \`${slug}.html\` (tag: ${tag})\n`);
await writeFile(p('blog/topics.md'), topics, 'utf8');

console.log(`Готово: blog/${slug}.html опубликована.`);
