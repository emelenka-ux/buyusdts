// Автопостинг свежей статьи блога на vc.ru (Osnova API).
// Берёт самую новую статью из blog/*.html, постит её в личный блог (subsite),
// добавляет ссылку на оригинал, отмечает опубликованное в scripts/vc-posted.txt.
// Если VC_TOKEN не задан — тихо выходит (чтобы не ломать воркфлоу).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'blog');
const SITE = 'https://buyusdtinvoice.ru';
const POSTED = join(ROOT, 'scripts', 'vc-posted.txt');

const TOKEN = process.env.VC_TOKEN || '';
const SUBSITE = process.env.VC_SUBSITE_ID || '6025790';
const API = 'https://api.vc.ru/v2.5/entry/create';

if (!TOKEN) { console.log('VC_TOKEN не задан — пропускаю кросс-постинг на vc.'); process.exit(0); }

const pick = (html, re) => { const m = html.match(re); return m ? m[1].trim() : ''; };

// HTML тела статьи -> markdown (vc понимает базовую разметку)
const toMd = (html) => html
  .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n\n## ${strip(t)}\n`)
  .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n\n### ${strip(t)}\n`)
  .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n\n> ${strip(t)}\n`)
  .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${strip(t)}`)
  .replace(/<\/(ul|ol)>/gi, '\n')
  .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n\n${strip(t)}`)
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const strip = (s) => s
  .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => {
    const u = href.startsWith('http') ? href : SITE + '/' + href.replace(/^\.\.\//, '').replace(/^\//, '');
    return `[${txt.replace(/<[^>]+>/g, '')}](${u})`;
  })
  .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
  .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
  .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

// найти самую свежую статью
let newest = null;
for (const f of readdirSync(BLOG)) {
  if (!f.endsWith('.html') || f === '_template.html') continue;
  const html = readFileSync(join(BLOG, f), 'utf8');
  const iso = pick(html, /<time datetime="([^"]*)"/) || pick(html, /"datePublished":\s*"([^"]*)"/);
  if (!iso) continue;
  const d = new Date(iso + 'T09:00:00+03:00');
  if (!newest || d > newest.date) {
    newest = {
      slug: f.replace(/\.html$/, ''), date: d,
      title: pick(html, /<title>([\s\S]*?)\s*—\s*Buy_USDTs<\/title>/),
      body: pick(html, /<div class="article__body">([\s\S]*?)<\/div>\s*<div class="article__cta">/),
    };
  }
}
if (!newest || !newest.title || !newest.body) { console.log('Нет статьи для постинга.'); process.exit(0); }

const posted = existsSync(POSTED) ? readFileSync(POSTED, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : [];
if (posted.includes(newest.slug)) { console.log(`«${newest.slug}» уже опубликована на vc — пропускаю.`); process.exit(0); }

const url = `${SITE}/blog/${newest.slug}.html`;
const text = `${toMd(newest.body)}\n\n— — —\nПолная версия и калькулятор курса: ${url}`;

const form = new FormData();
form.append('title', newest.title);
form.append('subsite_id', SUBSITE);
form.append('text', text);

console.log(`Публикую на vc: «${newest.title}» → subsite ${SUBSITE}`);
const res = await fetch(API, { method: 'POST', headers: { 'X-Device-Token': TOKEN }, body: form });
const json = await res.json().catch(() => ({}));
console.log('Ответ vc:', res.status, JSON.stringify(json).slice(0, 400));

const id = json?.result?.id;
if (res.ok && id) {
  console.log(`✅ Опубликовано на vc: https://vc.ru/${id}`);
  writeFileSync(POSTED, [...posted, newest.slug].join('\n') + '\n', 'utf8');
} else {
  console.log('⚠️ Публикация на vc не подтверждена (см. ответ выше). Статья на сайте не затронута.');
}
