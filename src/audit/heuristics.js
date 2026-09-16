// Heurystyki, ktorych PageSpeed nie daje, a ktore najmocniej dzialaja w rozmowie:
// brak HTTPS, brak RWD, stary WordPress, brak Open Graph, wolny TTFB.
// Wszystko z jednego zapytania HTTP - tanio.

import { env } from '../lib/env.js';

export async function probe(url) {
  const started = Date.now();
  let res, html = '', err = null;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': env.ua },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    html = (await res.text()).slice(0, 300_000);
  } catch (e) {
    err = e.message;
  }
  const ttfbMs = Date.now() - started;
  if (err) return { ok: false, error: err, ttfbMs, findings: [{ k: 'unreachable', s: 'krytyczne', t: 'Strona nie odpowiada' }] };

  const h = html.toLowerCase();
  const gen = (html.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)/i) || [])[1] || null;
  const wpVer = (gen && /wordpress\s+([\d.]+)/i.exec(gen)?.[1]) || null;

  const findings = [];
  const add = (k, s, t) => findings.push({ k, s, t });

  if (!res.url.startsWith('https://')) add('https', 'krytyczne', 'Brak HTTPS - przegladarki oznaczaja strone jako niebezpieczna');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) add('rwd', 'krytyczne', 'Brak meta viewport - strona nie jest responsywna na telefonie');
  if (!/<title[^>]*>[^<]{5,}/i.test(html)) add('title', 'wazne', 'Brak sensownego tytulu strony');
  if (!/<meta[^>]+name=["']description["']/i.test(html)) add('description', 'wazne', 'Brak meta description - Google sam dobiera opis w wynikach');
  if (!/property=["']og:/i.test(html)) add('og', 'drobne', 'Brak Open Graph - link wrzucony na Facebooka wyglada pusto');
  if (!/<h1[\s>]/i.test(h)) add('h1', 'wazne', 'Brak naglowka H1');
  if (wpVer) {
    const major = Number(wpVer.split('.')[0]);
    if (major && major < 6) add('wp', 'krytyczne', `WordPress ${wpVer} - wersja bez wsparcia, realne ryzyko wlamania`);
    else add('wp', 'info', `WordPress ${wpVer}`);
  }
  if (/jquery-1\.|jquery\/1\./i.test(h)) add('jquery', 'wazne', 'jQuery 1.x - biblioteka sprzed dekady');
  if (ttfbMs > 1200) add('ttfb', 'wazne', `Serwer odpowiada po ${(ttfbMs / 1000).toFixed(1)} s - wolny hosting`);
  if (!/<html[^>]+lang=/i.test(html)) add('lang', 'drobne', 'Brak atrybutu lang - problem dla czytnikow ekranu');
  if (!/(polityka prywatnosci|polityka prywatności)/i.test(html) && html.includes('<form'))
    add('rodo', 'wazne', 'Formularz bez widocznej polityki prywatnosci - ryzyko RODO');

  return { ok: true, finalUrl: res.url, status: res.status, ttfbMs, generator: gen, wpVersion: wpVer, findings };
}

/** 0-100. Im wyzej, tym wiekszy bol klienta - i tym lepszy lead. */
export function painScore({ psi, probe: p }) {
  let s = 0;
  if (!p?.ok) return 95;
  const w = { krytyczne: 18, wazne: 9, drobne: 3, info: 0 };
  for (const f of p.findings) s += w[f.s] || 0;
  if (psi?.perf != null) s += Math.round((100 - psi.perf) * 0.35);
  if (psi?.seo != null) s += Math.round((100 - psi.seo) * 0.15);
  if (psi?.lcpMs && psi.lcpMs > 4000) s += 10;
  return Math.max(0, Math.min(100, s));
}
