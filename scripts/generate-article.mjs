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
// защита от дублей при дублирующем расписании: если статья за сегодня уже опубликована — выходим
if (topicsRaw.includes(`[x] ${iso}`)) {
  console.log(`Статья за ${iso} уже опубликована — пропускаю (защита от дублей).`);
  process.exit(0);
}
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
const system = `Ты — редактор блога Buy_USDTs (Москва-Сити): платёжный агент по ВЭД — оплата инвойсов и поставщиков за границу и в Китай, переводы по миру, пополнение Alipay и WeChat, оплата на банковские карты КНР и UnionPay, расчёты наличными. Пишешь на русском ПРОСТЫМ, ПОНЯТНЫМ языком — как живой человек спокойно объясняет, без сложных терминов и канцелярита.

ЦЕЛЬ: полезная статья, которая снимает страхи импортёра и мягко ведёт к заявке.

ТОН (важно): простой и разговорный. Короткие слова и короткие предложения. Минимум терминов; если термин нужен — объясни его одной фразой. Пиши так, чтобы понял человек без опыта в ВЭД.

ВСЕГДА:
- Начинай с выгоды/боли читателя и дай ПРЯМОЙ ОТВЕТ в первом абзаце (мини-TL;DR, 2–3 простых предложения) — это важно и для людей, и для ИИ-поиска (Нейро Яндекса, AI Overviews).
- Пиши «вы-ориентированно» (о выгоде клиента), а не «мы-ориентированно».
- Конкретика: сроки (1–3 дня), способы оплаты (Alipay/WeChat, банковские карты КНР, UnionPay, наличные, через платёжного агента), документы (инвойс, закрывающие для бухгалтерии). Не выдумывай точные цифры/проценты.
- Закрывай возражения прямо в тексте: законно ли это, от чего зависит комиссия, какие сроки, что с документами для бухгалтерии, что если платёж зависнет.
- 4–6 разделов H2 в форме вопросов («Как…», «Сколько стоит…», «Законно ли…»). Короткие абзацы (2–3 строки), маркированные списки, где уместно — простая сравнительная таблица.
- В конце добавь раздел <h2>Частые вопросы</h2> с 3–5 парами вопрос(<h3>)/ответ(<p>).
- Заверши одним призывом текстом (например: «Пришлите инвойс — рассчитаем срок и комиссию»). Ссылку на расчёт давай как <a href="../index.html#calc">калькулятор</a>. Кнопку-CTA не пиши — она уже есть в шаблоне.

НИКОГДА:
- НЕ упоминай USDT, криптовалюту, стейблкоины, токены, биржу, кошельки, «курс крипты», блокчейн — мы про это в блоге НЕ пишем. Говори только про оплату через платёжного агента: Alipay, WeChat, UnionPay, банковские карты, наличные.
- Никакого канцелярита и «воды»: убирай «осуществление оплаты», «в целях», «данный», «являться», «в рамках»; пустые усилители «качественный/эффективный/надёжный/лучший».
- Без кликбейта (выполняй заголовок). Без юридических и финансовых гарантий и обещаний доходности. Юр/налоговые моменты формулируй аккуратно, не как абсолютную истину.
- Не дублируй <h1>. Не пиши сложными длинными предложениями.

ОБЪЁМ: 700–1000 слов.

ФОРМАТ ОТВЕТА — строго такими блоками с разделителями. Без markdown, без обратных кавычек, без пояснений до или после:
@@DESC@@
мета-описание до 160 символов, от выгоды
@@KEYWORDS@@
6–10 ключей через запятую
@@READMIN@@
число минут чтения (например 7)
@@BODY@@
HTML статьи. Разрешённые теги: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <blockquote>, <a href>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. Начни с вводного <p> (без <h1>). В конце — раздел <h2>Частые вопросы</h2> с парами <h3>вопрос</h3><p>ответ</p>.
@@FAQ@@
те же 3–5 вопросов из раздела FAQ, каждый на отдельной строке в формате: вопрос ||| ответ (простым текстом, без HTML)
@@END@@`;

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
const txt = (data.content?.[0]?.text || '').trim();

// разбор блоков @@LABEL@@ ... до следующего @@...@@ или конца (HTML не нужно экранировать)
const section = (label) => {
  const i = txt.indexOf('@@' + label + '@@');
  if (i === -1) return '';
  const rest = txt.slice(i + label.length + 4);
  const next = rest.search(/@@[A-Z]+@@/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
};
const description = section('DESC');
const keywords = section('KEYWORDS');
const bodyHtml = section('BODY');
const readMin = parseInt(section('READMIN'), 10) || 6;
if (!bodyHtml || bodyHtml.length < 200) {
  console.error('Пустой/короткий BODY — ответ модели:\n', txt.slice(0, 600));
  process.exit(1);
}

/* ---- 3. собрать страницу статьи из шаблона ---- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// FAQ из блока @@FAQ@@ (строки "вопрос ||| ответ")
const faqArr = section('FAQ').split('\n').map((l) => l.trim()).filter(Boolean)
  .map((l) => { const k = l.indexOf('|||'); return k === -1 ? null : { q: l.slice(0, k).trim(), a: l.slice(k + 3).trim() }; })
  .filter((x) => x && x.q && x.a);
const faqJsonLd = faqArr.length
  ? `<script type="application/ld+json">\n${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqArr.map((x) => ({
        '@type': 'Question', name: String(x.q),
        acceptedAnswer: { '@type': 'Answer', text: String(x.a) },
      })),
    })}\n</script>`
  : '';

const tpl = await readFile(p('blog/_template.html'), 'utf8');
const page = tpl
  .replace(/\{\{TITLE\}\}/g, esc(topicTitle))
  .replace(/\{\{DESCRIPTION\}\}/g, esc(description || topicTitle))
  .replace(/\{\{KEYWORDS\}\}/g, esc(keywords || ''))
  .replace(/\{\{SLUG\}\}/g, slug)
  .replace(/\{\{TAG\}\}/g, esc(tag))
  .replace(/\{\{DATE_ISO\}\}/g, iso)
  .replace(/\{\{DATE_HUMAN\}\}/g, human)
  .replace(/\{\{READ_MIN\}\}/g, String(readMin))
  .replace(/\{\{FAQ_JSONLD\}\}/g, faqJsonLd)
  .replace(/\{\{BODY_HTML\}\}/g, bodyHtml || '');
await writeFile(p('blog', `${slug}.html`), page, 'utf8');

/* ---- 4. карточка в blog.html ---- */
const card = `    <a class="post-card reveal" href="blog/${slug}.html">
      <img class="post-card__img" src="/blog/img/${slug}.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.src='/blog/img/default.jpg'" />
      <span class="tag">${esc(tag)}</span>
      <h2>${esc(topicTitle)}</h2>
      <p>${esc(description || '')}</p>
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
