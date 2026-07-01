// Автопостинг свежей статьи блога на vc.ru через реальный editor-API (v2.1).
// Поток: POST /v2.1/editor (сохранить запись с блоками) -> POST /v2.1/editor/{id}/publish.
// Берёт самую новую статью из blog/*.html, отмечает опубликованное в scripts/vc-posted.txt.
// Если VC_TOKEN не задан — тихо выходит (чтобы не ломать воркфлоу).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'blog');
const SITE = 'https://buyusdtinvoice.ru';
const POSTED = join(ROOT, 'scripts', 'vc-posted.txt');

const TOKEN = process.env.VC_TOKEN || '';
const SUBSITE = Number(process.env.VC_SUBSITE_ID || '6025790');
const EDITOR = 'https://api.vc.ru/v2.1/editor';

if (!TOKEN) { console.log('VC_TOKEN не задан — пропускаю кросс-постинг на vc.'); process.exit(0); }

const pick = (html, re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
const abs = (s) => s
  .replace(/href="\.\.\//g, `href="${SITE}/`)
  .replace(/href="\/(?!\/)/g, `href="${SITE}/`);

// тело статьи -> массив блоков vc (по одному на верхнеуровневый элемент)
const toBlocks = (body) => {
  const blocks = [];
  const push = (text) => blocks.push({ type: 'text', cover: false, hidden: false, anchor: '', data: { text } });
  const re = /<(h2|h3|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    const inner = abs(m[2].trim());
    if (tag === 'h2') push(`<h3>${inner}</h3>`);
    else if (tag === 'h3') push(`<h4>${inner}</h4>`);
    else if (tag === 'p') push(`<p>${inner}</p>`);
    else if (tag === 'ul' || tag === 'ol') push(`<${tag}>${inner}</${tag}>`);
    else if (tag === 'blockquote') push(`<blockquote>${inner.replace(/<\/?p[^>]*>/g, '')}</blockquote>`);
  }
  return blocks;
};

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
const hdr = { 'X-Device-Token': TOKEN };
const blocks = toBlocks(newest.body);
blocks.push({ type: 'text', cover: false, hidden: false, anchor: '',
  data: { text: `<p>Полная версия и калькулятор курса: <a href="${url}">${url}</a></p>` } });

// обложка: vc забирает картинку по URL -> ставим первым блоком как cover
try {
  const cr = await fetch('https://api.vc.ru/v2.5/uploader/extract', {
    method: 'POST', headers: hdr,
    body: new URLSearchParams({ url: `${SITE}/blog/img/${newest.slug}.jpg` }),
  });
  const cj = await cr.json();
  const media = Array.isArray(cj?.result) ? cj.result[0] : null;
  if (media && media.type === 'image') {
    blocks.unshift({ type: 'media', cover: true, hidden: false, anchor: '',
      data: { items: [{ title: '', author: '', image: media }], with_border: false, with_background: false } });
    console.log('vc: обложка загружена');
  } else {
    console.log('vc: обложку загрузить не удалось — публикую без неё');
  }
} catch { console.log('vc: ошибка загрузки обложки — публикую без неё'); }

const entry = {
  id: 0, user_id: SUBSITE, type: 1, subsite_id: SUBSITE, title: newest.title,
  entry: { blocks },
  external_access_link: '', path: '', is_editorial: false, is_advertisement: false,
  is_enabled_comments: true, is_enabled_likes: true, withheld: false, is_enabled_ad: true,
  is_holdonflash: false, forced_to_mainpage: 0, is_holdonmain: false, is_published: false,
  is_adult: false, repostId: null, repostData: null,
};

console.log(`vc: сохраняю черновик «${newest.title}» (${blocks.length} блоков)…`);
const f1 = new FormData(); f1.append('entry', JSON.stringify(entry));
const r1 = await fetch(EDITOR, { method: 'POST', headers: hdr, body: f1 });
const j1 = await r1.json().catch(() => ({}));
const id = j1?.result?.entry?.id;
if (!r1.ok || !id) {
  console.log('⚠️ Не удалось сохранить черновик:', r1.status, JSON.stringify(j1).slice(0, 300));
  process.exit(0);
}
console.log(`vc: черновик id=${id}, публикую…`);
const r2 = await fetch(`${EDITOR}/${id}/publish`, { method: 'POST', headers: hdr });
const j2 = await r2.json().catch(() => ({}));
if (r2.ok) {
  const link = j1?.result?.entry?.url || `https://vc.ru/${SUBSITE}/${id}`;
  console.log(`✅ Опубликовано на vc: ${link}`);
  writeFileSync(POSTED, [...posted, newest.slug].join('\n') + '\n', 'utf8');
} else {
  console.log('⚠️ Черновик сохранён, но публикация не подтверждена:', r2.status, JSON.stringify(j2).slice(0, 300));
}
