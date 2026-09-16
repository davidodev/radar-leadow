// CEIDG - Hurtownia Danych v3, nowe wpisy w wojewodztwie po kodach PKD.
//
// Struktura odpowiedzi potwierdzona na zywym API (16.09.2026):
//   { firmy: [{ id, nazwa, adresDzialalnosci: {...}, wlasciciel: {imie,nazwisko,nip,regon},
//               dataRozpoczecia, status, link }],
//     count: <liczba wszystkich pasujacych>,
//     links: { next, prev, self } }
//
// Trzy rzeczy, ktore wynikaja z tej odpowiedzi i latwo je przeoczyc:
//  1. PAGINACJA JEST OD ZERA. Przy limit=1 i page nieokreslonym `prev` wskazuje page=0,
//     a `next` page=1 - czyli domyslnie jestes na stronie 0.
//  2. BEZ PARAMETRU `status` API zwraca WSZYSTKO - AKTYWNY, WYKRESLONY, ZAWIESZONY,
//     OCZEKUJE_NA_ROZPOCZECIE_DZIALANOSCI, WYLACZNIE_W_FORMIE_SPOLKI.
//     Zawsze przekazujemy status=AKTYWNY jawnie.
//  3. LISTA NIE ZAWIERA PKD ANI KONTAKTU. Zeby dostac email/telefon/PKD trzeba
//     wolac `link` (czyli /firma/{id}) - jedno dodatkowe zapytanie na rekord.
//     Domyslnie tego NIE robimy: te firmy i tak sa sciezka C (offline), a limit
//     to 50 zapytan / 3 min. Wlacz przez { enrich: true } tylko dla krotkiej listy.
//
// Limity: 50 zapytan / 3 min oraz 1000 / 60 min. Parametr `limit` do 500.
//
// WAZNE PRAWNIE: e-mail i telefon we wpisie CEIDG to NIE jest zgoda marketingowa.
// Firmy z tego zrodla ladują z channel = 'C'.

import { env, sleep, isLocal } from '../lib/env.js';
import { SEGMENTS, allCodes } from '../config/pkd.js';

const PAGE_DELAY_MS = 4000; // 50 req / 3 min => min. ~3,6 s odstepu

async function call(url) {
  if (!env.ceidg.token) throw new Error('brak CEIDG_TOKEN');
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.ceidg.token}`,
      accept: 'application/json',
      'user-agent': env.ua,
    },
  });
  if (res.status === 429) { await sleep(20_000); return call(url); }
  if (!res.ok) throw new Error(`ceidg ${res.status} ${new URL(url).pathname}`);

  // WAZNE: przy zerze wynikow API zwraca PUSTE CIALO (204 / zero bajtow),
  // a nie {"count":0}. res.json() rzuca wtedy "Unexpected end of JSON input".
  // Traktujemy to jako pusty wynik - inaczej kazdy kod PKD bez trafien
  // wywalalby caly przebieg.
  const text = await res.text();
  if (!text.trim()) return { firmy: [], count: 0, links: {} };
  try { return JSON.parse(text); }
  catch { return { firmy: [], count: 0, links: {}, _unparsable: true }; }
}

/**
 * CEIDG przyjmuje kody PKD BEZ KROPEK i bez spacji: 96.21.Z -> 9621Z.
 * Zweryfikowane na zywym API 16.09.2026 - wariant z kropkami zwraca zero.
 * W src/config/pkd.js trzymamy kody w czytelnej formie z kropkami,
 * a konwertujemy dopiero tutaj.
 */
export const pkdParam = (code = '') => code.replace(/[.\s]/g, '').toUpperCase();

function buildUrl(params) {
  const u = new URL(`${env.ceidg.base}/firmy`);
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    for (const x of [].concat(v)) u.searchParams.append(k, x);
  }
  return u.toString();
}

/** Mapuje rekord z listy na nasz ksztalt. */
function mapFirma(f, { pkd, segment, pkdVersion }) {
  const a = f.adresDzialalnosci || f.adresKorespondencyjny || {};
  const city = a.miasto || null;
  return {
    ceidgId: f.id,
    nip: f.wlasciciel?.nip || null,
    regon: f.wlasciciel?.regon || null,
    name: f.nazwa || [f.wlasciciel?.imie, f.wlasciciel?.nazwisko].filter(Boolean).join(' ') || '(bez nazwy)',
    city,
    province: a.wojewodztwo || null,
    powiat: a.powiat || null,
    postcode: a.kod || null,
    pkd: [pkd],
    pkdVersion,
    registeredAt: f.dataRozpoczecia || null,
    status: f.status || null,
    segment,
    isLocal: isLocal(city),
    detailUrl: f.link || null,
    raw: { terc: a.terc, simc: a.simc },
  };
}

/**
 * Nowe wpisy z ostatnich `days` dni w wojewodztwie, dla wybranych segmentow.
 * Odpytuje kody PKD 2007 i 2025 naraz (baza jest mieszana do 31.01.2027),
 * dedupuje po `id` z CEIDG.
 */
export async function fetchCeidg({
  days = 7,
  segments = SEGMENTS,
  wojewodztwo = 'kujawsko-pomorskie',
  limit = 100,
  maxPagesPerCode = 20,
} = {}) {
  const dataod = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const out = new Map(); // ceidgId -> rekord

  for (const seg of segments) {
    for (const pkd of allCodes(seg)) {
      const pkdVersion = (seg.pkd2025 || []).includes(pkd)
        ? ((seg.pkd2007 || []).includes(pkd) ? 'oba' : '2025')
        : '2007';

      let url = buildUrl({ pkd: pkdParam(pkd), wojewodztwo, dataod, status: 'AKTYWNY', limit, page: 0 });
      for (let i = 0; i < maxPagesPerCode; i++) {
        let json;
        try { json = await call(url); }
        catch (e) { console.warn('[ceidg]', pkd, e.message); break; }

        const rows = json.firmy || [];
        for (const f of rows) {
          if (!f.id || out.has(f.id)) continue;
          out.set(f.id, mapFirma(f, { pkd, segment: seg.key, pkdVersion }));
        }
        // Idziemy za links.next dopoki strona jest pelna - bezpieczniej niz
        // liczyc strony samemu.
        if (rows.length < limit || !json.links?.next) break;
        url = json.links.next;
        await sleep(PAGE_DELAY_MS);
      }
      await sleep(PAGE_DELAY_MS);
    }
  }
  return [...out.values()];
}

/**
 * Dociaga szczegoly (PKD, email, telefon) dla pojedynczej firmy.
 * Uzywaj oszczednie - to jedno zapytanie na rekord.
 * Kontakt trafia do `raw`, NIE do pol, z ktorych cokolwiek wysylamy.
 */
export async function enrichFirma(rec) {
  if (!rec.detailUrl) return rec;
  try {
    const d = await call(rec.detailUrl);
    const f = d.firma?.[0] || d.firma || d;
    return {
      ...rec,
      pkd: f.pkd || rec.pkd,
      raw: { ...rec.raw, email: f.email || null, telefon: f.telefon || null, www: f.www || null },
    };
  } catch (e) {
    console.warn('[ceidg/detail]', rec.ceidgId, e.message);
    return rec;
  }
}

/**
 * Sprawdza format kodow PKD i to, czy stare kody 2007 sa jeszcze zywe w bazie.
 * Uruchom: npm run ceidg:probe
 */
export async function probePkd({ wojewodztwo = 'kujawsko-pomorskie' } = {}) {
  // Dwa okna czasowe, bo to rozdziela dwie rozne rzeczy:
  //  - NOWE (dataod 2026-01-01): firmy zarejestrowane w 2026 maja z definicji
  //    PKD 2025, wiec brak trafien na 2007 nic nie dowodzi,
  //  - CALA BAZA (bez dataod): tu dopiero widac, czy stare kody 2007 istniej.
  const cases = [
    { label: '2025  9621Z   nowe (od 2026-01-01)', pkd: '9621Z',  dataod: '2026-01-01' },
    { label: '2007  9602Z   nowe (od 2026-01-01)', pkd: '9602Z',  dataod: '2026-01-01' },
    { label: '2025  9621Z   CALA BAZA',            pkd: '9621Z',  dataod: null },
    { label: '2007  9602Z   CALA BAZA',            pkd: '9602Z',  dataod: null },
    { label: '2025  96.21.Z z kropkami (kontrola)',pkd: '96.21.Z',dataod: '2026-01-01' },
    { label: 'bez filtru pkd, nowe (kontrola)',    pkd: null,     dataod: '2026-01-01' },
  ];

  const results = [];
  for (const c of cases) {
    const url = buildUrl({ pkd: c.pkd, wojewodztwo, dataod: c.dataod, status: 'AKTYWNY', limit: 1, page: 0 });
    let line;
    try {
      const json = await call(url);
      line = { ...c, count: json.count ?? 0, ok: true };
    } catch (e) {
      line = { ...c, count: null, ok: false, error: e.message };
    }
    results.push(line);
    await sleep(PAGE_DELAY_MS);
  }

  console.table(results.map((r) => ({ przypadek: r.label, count: r.ok ? r.count : r.error })));

  const n = (i) => results[i].count || 0;
  const lines = [];
  lines.push(n(4) === 0 && n(0) > 0
    ? 'FORMAT: kody bez kropek (9621Z). Wariant 96.21.Z zwraca zero - pkdParam() to zalatwia.'
    : 'FORMAT: sprawdz wiersz z kropkami - zachowanie inne niz oczekiwane.');
  lines.push(n(3) > 0
    ? `PKD 2007: stare kody NADAL zyja w bazie (${n(3)} wpisow na 9602Z w calej bazie). Trzymaj obie listy w src/config/pkd.js.`
    : 'PKD 2007: stare kody nie zwracaja nic nawet bez filtru daty - API operuje wylacznie na PKD 2025. Mozesz wyczyscic listy pkd2007.');
  lines.push(`SKALA: ${n(5)} nowych aktywnych firm w wojewodztwie od 2026-01-01, z czego ${n(0)} w jednym kodzie (fryzjerstwo).`);

  console.log('\n' + lines.join('\n'));
  return { results, lines };
}
