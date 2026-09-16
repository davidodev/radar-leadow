// PageSpeed Insights API v5. Darmowe. Z kluczem: 25 000 zapytan/dobe, 240/min.
// Realnym waskim gardlem jest czas odpowiedzi (20-30 s), nie limit.

import { env } from '../lib/env.js';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export async function runPsi(url, strategy = 'mobile') {
  const u = new URL(ENDPOINT);
  u.searchParams.set('url', url);
  u.searchParams.set('strategy', strategy);
  for (const c of ['performance', 'seo', 'accessibility', 'best-practices']) {
    u.searchParams.append('category', c);
  }
  if (env.psiKey) u.searchParams.set('key', env.psiKey);

  const res = await fetch(u, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`psi ${res.status} ${url}`);
  const json = await res.json();
  const lr = json.lighthouseResult || {};
  const cat = lr.categories || {};
  const a = lr.audits || {};
  const num = (k) => a[k]?.numericValue ?? null;
  const pct = (k) => (cat[k]?.score == null ? null : Math.round(cat[k].score * 100));

  return {
    url: lr.finalUrl || url,
    strategy,
    perf: pct('performance'),
    seo: pct('seo'),
    a11y: pct('accessibility'),
    bp: pct('best-practices'),
    lcpMs: num('largest-contentful-paint') ? Math.round(num('largest-contentful-paint')) : null,
    clsRaw: num('cumulative-layout-shift'),
    tbtMs: num('total-blocking-time') ? Math.round(num('total-blocking-time')) : null,
    bytes: num('total-byte-weight') ? Math.round(num('total-byte-weight')) : null,
    https: a['is-on-https']?.score === 1,
    viewport: a['viewport']?.score === 1,
    // Trzy rzeczy, ktore najlepiej sie sprzedaja w rozmowie:
    topOpportunities: Object.values(a)
      .filter((x) => x?.details?.type === 'opportunity' && (x.numericValue || 0) > 300)
      .sort((x, y) => (y.numericValue || 0) - (x.numericValue || 0))
      .slice(0, 3)
      .map((x) => ({ title: x.title, saveMs: Math.round(x.numericValue) })),
  };
}
