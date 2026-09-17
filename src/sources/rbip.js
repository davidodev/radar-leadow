// RBIP mojregion.info - kanaly RSS gmin i powiatow kujawsko-pomorskiego.
// To jest jedyne zrodlo, ktore daje zamowienia PONIZEJ progu BZP w tym regionie.

import { readFile, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { env, sleep, isLocal } from '../lib/env.js';
import { PODMIOTY, INTERESUJACE } from '../config/rbip.js';
import { score } from '../config/keywords.js';

const FEEDS_PATH = new URL('../config/rbip-feeds.json', import.meta.url);
const DELAY_MS = 1500; // robots.txt nie narzuca crawl-delay, ale nie walimy seriami

async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': env.ua, accept: 'application/rss+xml, text/xml, text/html' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`rbip ${res.status} ${url}`);
  return res.text();
}

/**
 * Wykrywa kanaly RSS kazdego podmiotu i zapisuje je do rbip-feeds.json.
 * Numer kategorii jest lokalny dla podmiotu (u Skrwilna zamowienia publiczne
 * to 306), wiec feedow nie da sie zlozyc z szablonu - trzeba je raz znalezc.
 *
 * Uruchom: npm run rbip:discover
 */
export async function discoverFeeds() {
  const out = [];

  for (const p of PODMIOTY) {
    const host = `https://${p.sub}.rbip.mojregion.info`;
    let listUrl = null;

    // 1. Strona glowna -> link do listy kanalow RSS (numer strony tez jest lokalny).
    try {
      const home = await get(host + '/');
      const $ = cheerio.load(home);
      $('a[href*="lista-kanalow-rss"]').each((_, el) => {
        if (!listUrl) listUrl = new URL($(el).attr('href'), host).toString();
      });
    } catch (e) {
      console.warn(`[rbip] ${p.sub}: strona glowna - ${e.message}`);
    }
    if (!listUrl) {
      console.warn(`[rbip] ${p.sub}: nie znalazlem listy kanalow RSS`);
      await sleep(DELAY_MS);
      continue;
    }

    // 2. Lista kanalow -> feedy pasujace do interesujacych nas kategorii.
    try {
      const html = await get(listUrl);
      const $ = cheerio.load(html);
      const feeds = [];
      $('a[href*="/rss/"]').each((_, el) => {
        const href = new URL($(el).attr('href'), host).toString();
        const slug = (href.match(/\/rss\/\d+\/([^/?#]+)\.html/) || [])[1] || '';
        if (INTERESUJACE.some((k) => slug.includes(k))) {
          feeds.push({ url: href, kategoria: slug });
        }
      });
      const uniq = [...new Map(feeds.map((f) => [f.url, f])).values()];
      out.push({ ...p, feeds: uniq });
      console.log(`[rbip] ${p.sub}: ${uniq.length} kanalow`);
    } catch (e) {
      console.warn(`[rbip] ${p.sub}: lista kanalow - ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  await writeFile(FEEDS_PATH, JSON.stringify(out, null, 2) + '\n');
  const total = out.reduce((n, p) => n + p.feeds.length, 0);
  console.log(`\nZapisano ${total} kanalow z ${out.length} podmiotow do src/config/rbip-feeds.json`);
  return out;
}

async function loadFeeds() {
  try {
    return JSON.parse(await readFile(FEEDS_PATH, 'utf8'));
  } catch {
    throw new Error('brak src/config/rbip-feeds.json - uruchom najpierw: npm run rbip:discover');
  }
}

/** Parsuje RSS. cheerio w trybie XML wystarczy, nie dokladamy zaleznosci. */
function parseRss(xml, { podmiot, kategoria, sub }) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('title').first().text().trim();
    const link = $el.find('link').first().text().trim();
    const desc = $el.find('description').first().text().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const pub = $el.find('pubDate').first().text().trim();
    const guid = $el.find('guid').first().text().trim() || link;
    if (!title || !guid) return;
    items.push({ title, link, desc, pub, guid, podmiot, kategoria, sub });
  });
  return items;
}

/**
 * @param {number} days ile dni wstecz uznajemy za swieze (RSS trzyma archiwum)
 */
export async function fetchRbip({ days = 14 } = {}) {
  const podmioty = await loadFeeds();
  const cutoff = Date.now() - days * 864e5;
  const out = [];

  for (const p of podmioty) {
    for (const f of p.feeds) {
      let xml;
      try { xml = await get(f.url); }
      catch (e) { console.warn('[rbip]', f.url, e.message); await sleep(DELAY_MS); continue; }

      for (const it of parseRss(xml, { podmiot: p.nazwa, kategoria: f.kategoria, sub: p.sub })) {
        const when = it.pub ? new Date(it.pub).getTime() : null;
        if (when && when < cutoff) continue;

        // Kanal "aktualnosci" lapie wszystko, wiec podnosimy mu prog -
        // inaczej zalejemy sie remontami chodnikow.
        const szeroki = /aktualnosci|ogloszenia/.test(it.kategoria);
        let rel = score(`${it.title} ${it.desc}`);
        if (szeroki) rel -= 15;

        // Miasto wyciagamy z nazwy podmiotu - RSS go nie podaje.
        const city = (it.podmiot.match(/(?:Gmina|Miasto|Powiat)\s+(.+)$/i) || [])[1] || null;

        out.push({
          source: 'rbip',
          externalId: it.guid,
          url: it.link,
          title: it.title,
          body: it.desc.slice(0, 4000),
          city,
          province: 'kujawsko-pomorskie',
          budget: null,
          publishedAt: when ? new Date(when).toISOString() : null,
          deadlineAt: null,
          channel: 'A', // zapytanie ofertowe = zaproszenie do skladania ofert
          relevance: Math.max(0, rel),
          isLocal: isLocal(city) || true, // caly RBIP to nasze wojewodztwo
          raw: { podmiot: it.podmiot, kategoria: it.kategoria, sub: it.sub },
        });
      }
      await sleep(DELAY_MS);
    }
  }

  const seen = new Set();
  return out.filter((o) => (seen.has(o.externalId) ? false : seen.add(o.externalId)));
}
