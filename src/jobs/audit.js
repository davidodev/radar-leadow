import { q } from '../lib/db.js';
import { runPsi } from '../audit/psi.js';
import { probe, painScore } from '../audit/heuristics.js';

/**
 * Pelny audyt jednej domeny. Uzywany i przez cron (etap 3),
 * i przez formularz na davido.pl (etap 2).
 */
export async function auditUrl(rawUrl, { companyId = null, strategies = ['mobile'] } = {}) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const p = await probe(url);
  const results = [];

  for (const strategy of strategies) {
    let psi = null;
    try { psi = await runPsi(p.finalUrl || url, strategy); }
    catch (e) { console.warn('[psi]', e.message); }

    if (psi) {
      await q(
        `INSERT INTO audits (company_id, url, strategy, perf, seo, a11y, bp,
                             lcp_ms, cls, tbt_ms, bytes, https, viewport, generator, findings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [companyId, psi.url, strategy, psi.perf, psi.seo, psi.a11y, psi.bp,
         psi.lcpMs, psi.clsRaw, psi.tbtMs, psi.bytes, psi.https, psi.viewport,
         p.generator, JSON.stringify({ findings: p.findings, opportunities: psi.topOpportunities })],
      );
    }
    results.push({ strategy, psi });
  }

  const pain = painScore({ psi: results[0]?.psi, probe: p });
  if (companyId) {
    await q(`UPDATE companies SET pain_score=$1, last_audit_at=now(), has_website=$2 WHERE id=$3`,
      [pain, p.ok, companyId]);
  }
  return { url: p.finalUrl || url, probe: p, results, painScore: pain };
}

/** Tekst raportu - to jest to, co realnie czyta klient. Krotko i z jedna liczba na wierzchu. */
export function renderReport({ url, probe: p, results, painScore: pain }) {
  const psi = results[0]?.psi;
  const L = [];
  L.push(`RAPORT: ${url}`);
  L.push(`Data: ${new Date().toLocaleDateString('pl-PL')}`);
  L.push('');
  if (psi) {
    L.push(`Wydajnosc (mobile): ${psi.perf}/100`);
    L.push(`SEO: ${psi.seo}/100 · Dostepnosc: ${psi.a11y}/100`);
    if (psi.lcpMs) L.push(`Najwiekszy element pojawia sie po ${(psi.lcpMs / 1000).toFixed(1)} s (dobrze: ponizej 2,5 s)`);
  }
  L.push('');
  const crit = p.findings.filter((f) => f.s === 'krytyczne');
  const imp = p.findings.filter((f) => f.s === 'wazne');
  if (crit.length) { L.push('DO NAPRAWY OD RAZU:'); for (const f of crit) L.push(`- ${f.t}`); L.push(''); }
  if (imp.length)  { L.push('WARTO POPRAWIC:');    for (const f of imp.slice(0, 4)) L.push(`- ${f.t}`); L.push(''); }
  if (psi?.topOpportunities?.length) {
    L.push('NAJWIEKSZY ZYSK NA CZASIE LADOWANIA:');
    for (const o of psi.topOpportunities) L.push(`- ${o.title}: do ${(o.saveMs / 1000).toFixed(1)} s szybciej`);
    L.push('');
  }
  L.push(`Ocena ogolna problemu: ${pain}/100`);
  return L.join('\n');
}
