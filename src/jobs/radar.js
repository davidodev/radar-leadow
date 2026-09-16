import { upsertSignal, logRun, q } from '../lib/db.js';
import { fetchUseme } from '../sources/useme.js';
import { fetchBzp } from '../sources/bzp.js';
import { fetchBk } from '../sources/bazakonkurencyjnosci.js';
import { sendBatch, send } from '../notify/telegram.js';

// Prog alertu. Nizej = wiecej szumu. Zacznij od 45 i podnies po tygodniu.
const ALERT_AT = Number(process.env.ALERT_AT || 45);

const SOURCES = [
  { name: 'useme', enabled: true,  run: () => fetchUseme({ pages: 2 }) },
  { name: 'bzp',   enabled: true,  run: () => fetchBzp({ days: 3, onlyProvince: false }) },
  // Wlacz, gdy potwierdzisz endpoint JSON (patrz komentarz w pliku zrodla).
  { name: 'bk',    enabled: false, run: () => fetchBk({ days: 3 }) },
];

export async function runRadar() {
  const fresh = [];

  for (const src of SOURCES) {
    if (!src.enabled) continue;
    try {
      const items = await src.run();
      let inserted = 0;
      for (const it of items) {
        const id = await upsertSignal(it);
        if (id) { inserted++; if (it.relevance >= ALERT_AT) fresh.push({ ...it, id }); }
      }
      await logRun({ source: src.name, ok: true, found: items.length, inserted });
      console.log(`[${src.name}] znaleziono ${items.length}, nowych ${inserted}`);
    } catch (e) {
      await logRun({ source: src.name, ok: false, error: e.message });
      console.error(`[${src.name}] BLAD`, e.message);
      await send(`⚠️ Radar: zrodlo <b>${src.name}</b> padlo\n${e.message}`);
    }
  }

  fresh.sort((a, b) => b.relevance - a.relevance);
  await sendBatch(fresh);
  return fresh.length;
}

/**
 * Heartbeat: zepsuty scraper nie rzuca bledu, tylko zwraca zero pozycji.
 * Jesli zrodlo od 24 h nie wstawilo NIC i nie zglosilo bledu - to jest podejrzane.
 */
export async function heartbeat() {
  const { rows } = await q(`
    SELECT source,
           max(ran_at)                                        AS last_run,
           sum(found)  FILTER (WHERE ran_at > now() - interval '24 hours') AS found_24h,
           count(*)    FILTER (WHERE ran_at > now() - interval '24 hours' AND NOT ok) AS errors_24h
      FROM source_runs
     GROUP BY source`);

  const alerts = [];
  for (const r of rows) {
    const stale = !r.last_run || Date.now() - new Date(r.last_run).getTime() > 3 * 3600e3;
    if (stale) alerts.push(`• ${r.source}: brak uruchomienia od ${r.last_run ? new Date(r.last_run).toLocaleString('pl-PL') : 'nigdy'}`);
    else if (Number(r.found_24h) === 0) alerts.push(`• ${r.source}: 0 pozycji w 24 h przy HTTP 200 - prawdopodobnie zmienil sie layout`);
    if (Number(r.errors_24h) > 3) alerts.push(`• ${r.source}: ${r.errors_24h} bledow w 24 h`);
  }
  if (alerts.length) await send(`⚠️ <b>Heartbeat radaru</b>\n${alerts.join('\n')}`);
  else console.log('heartbeat ok');
  return alerts.length;
}
