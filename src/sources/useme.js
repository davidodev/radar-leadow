// Useme - glowne zrodlo wolumenu (~60-65 aktywnych zlecen na strony www naraz).
//
// Higiena, ktorej nie zmieniaj:
//  - robots.txt Useme zezwala na /pl/jobs/, ale narzuca crawl-delay: 10.
//    Kod respektuje to przez USEME_DELAY_MS (domyslnie 11 s).
//  - regulamin (art. 4 par. 11) zakazuje kopiowania tresci ogloszen w celu
//    PUBLIKOWANIA ich na zewnetrznych serwisach. Monitoring na wlasny uzytek,
//    zeby zlozyc oferte, to co innego - ale nie rob z tego publicznego agregatora
//    i nie eksportuj tresci na zewnatrz.
//  - art. 2 par. 15 zakazuje wyprowadzania zleceniodawcow poza platforme.
//    Odpowiadasz w Useme, nie mailem do klienta.

import * as cheerio from 'cheerio';
import { env, sleep } from '../lib/env.js';
import { score } from '../config/keywords.js';

const BASE = 'https://useme.com';

export const CATEGORIES = [
  { slug: 'strony-internetowe,96', label: 'Strony internetowe' },
  { slug: 'sklepy-internetowe,97', label: 'Sklepy internetowe' },
  { slug: 'obsuga-stron-internetowych,98', label: 'Obsluga stron' },
  { slug: 'obsuga-sklepow-internetowych,99', label: 'Obsluga sklepow' },
];

async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': env.ua, 'accept-language': 'pl,en;q=0.8' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`useme ${res.status} ${url}`);
  return res.text();
}

// Selektory sa celowo szerokie - Useme zmienia klasy. Jesli parser zwroci 0
// pozycji przy HTTP 200, heartbeat to wylapie (patrz src/jobs/heartbeat.js).
function parseList(html) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href*="/pl/jobs/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/\/pl\/jobs\/([^/?#]*?),(\d+)\/?$/);
    if (!m) return;
    const id = m[2];
    // kontener ogloszenia: najblizszy article/li/div z trescia
    const card = $(el).closest('article, li, .job, [class*="job"]');
    const root = card.length ? card : $(el);
    const title = ($(el).text() || '').replace(/\s+/g, ' ').trim();
    if (!title || title.length < 6) return;
    const text = root.text().replace(/\s+/g, ' ').trim();

    // "Znika za 12 dni" -> deadline
    const dm = text.match(/Znika za\s+(\d+)\s+dni?/i);
    const deadlineAt = dm
      ? new Date(Date.now() + Number(dm[1]) * 864e5)
      : null;
    const finished = /zakończon|zakonczon/i.test(text);
    const budget = (text.match(/(\d[\d\s]{2,})\s*(zł|zl|PLN)/i) || [])[0] || null;

    out.push({
      externalId: id,
      url: `${BASE}/pl/jobs/${m[1]},${id}/`,
      title,
      excerpt: text.slice(0, 600),
      deadlineAt,
      finished,
      budget,
    });
  });
  // dedup po id
  const seen = new Set();
  return out.filter((o) => (seen.has(o.externalId) ? false : seen.add(o.externalId)));
}

/** Pobiera pierwsze `pages` stron kazdej kategorii. 1 strona = 20 pozycji. */
export async function fetchUseme({ pages = 1 } = {}) {
  const items = [];
  for (const cat of CATEGORIES) {
    for (let p = 1; p <= pages; p++) {
      const url = `${BASE}/pl/jobs/category/${cat.slug}/${p > 1 ? `?page=${p}` : ''}`;
      const html = await get(url);
      const parsed = parseList(html).filter((x) => !x.finished);
      for (const it of parsed) items.push({ ...it, category: cat.label });
      await sleep(env.usemeDelay); // crawl-delay: 10
      if (parsed.length === 0) break;
    }
  }
  const seen = new Set();
  return items
    .filter((o) => (seen.has(o.externalId) ? false : seen.add(o.externalId)))
    .map((o) => ({
      source: 'useme',
      externalId: o.externalId,
      url: o.url,
      title: o.title,
      body: o.excerpt,
      city: null,          // Useme rzadko podaje miasto na liscie
      province: null,
      budget: o.budget,
      publishedAt: null,
      deadlineAt: o.deadlineAt,
      channel: 'A',        // zamowione: zleceniodawca sam prosi o oferty
      relevance: score(`${o.title} ${o.excerpt}`),
      isLocal: false,
      raw: { category: o.category },
    }));
}
