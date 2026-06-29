// Генерирует rss.xml из статей blog/*.html — для импорта в Дзен (и пр.).
// Полный текст статьи кладётся в <content:encoded> (требование Дзена).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'blog');
const SITE = 'https://buyusdtinvoice.ru';

const pick = (html, re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const items = [];
for (const f of readdirSync(BLOG)) {
  if (!f.endsWith('.html') || f === '_template.html') continue;
  const html = readFileSync(join(BLOG, f), 'utf8');
  const title = pick(html, /<title>([\s\S]*?)\s*—\s*Buy_USDTs<\/title>/) || pick(html, /property="og:title" content="([^"]*)"/);
  const desc = pick(html, /<meta name="description" content="([^"]*)"/);
  const link = pick(html, /<link rel="canonical" href="([^"]*)"/) || `${SITE}/blog/${f}`;
  const iso = pick(html, /<time datetime="([^"]*)"/) || pick(html, /"datePublished":\s*"([^"]*)"/);
  const tag = pick(html, /<span class="tag">([^<]*)<\/span>/);
  // тело статьи: между article__body и article__cta
  let body = pick(html, /<div class="article__body">([\s\S]*?)<\/div>\s*<div class="article__cta">/);
  if (!body) body = `<p>${esc(desc)}</p>`;
  if (!title || !iso) continue;
  const d = new Date(iso + 'T09:00:00+03:00');
  items.push({ title, desc, link, tag, body, date: d, pubDate: d.toUTCString() });
}
items.sort((a, b) => b.date - a.date);

const xmlItems = items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${it.link}</link>
      <guid isPermaLink="true">${it.link}</guid>
      <pubDate>${it.pubDate}</pubDate>
      ${it.tag ? `<category>${esc(it.tag)}</category>` : ''}
      <description>${esc(it.desc)}</description>
      <content:encoded><![CDATA[${it.body.trim()}]]></content:encoded>
    </item>`).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Блог Buy_USDTs</title>
    <link>${SITE}/blog.html</link>
    <description>Оплата инвойсов и поставщиков за границу, переводы в Китай, Alipay и WeChat — простым языком.</description>
    <language>ru</language>
    <lastBuildDate>${(items[0]?.date || new Date()).toUTCString()}</lastBuildDate>
${xmlItems}
  </channel>
</rss>
`;

writeFileSync(join(ROOT, 'rss.xml'), rss, 'utf8');
console.log(`rss.xml: ${items.length} статей`);
