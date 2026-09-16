// Baza Konkurencyjnosci - zapytania ofertowe beneficjentow funduszy UE.
// Publiczny rejestr rzadowy, brak przeszkod regulaminowych.
// Zamowienia ponizej progow PZP, wiec trafiaja tu rzeczy, ktorych nie ma w BZP -
// w tym strony www i systemy dla firm i NGO, nie tylko urzedow.
//
// UWAGA: serwis to SPA i endpoint JSON nie jest publicznie udokumentowany.
// Ponizsza sciezka to najczestszy wariant; jesli zwroci 404, otworz
// https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/ogloszenia
// w DevTools -> Network -> XHR i podmien URL w BK_API.
// Do tego czasu zrodlo jest wylaczone w src/jobs/radar.js (ENABLED=false).

import { env, isLocal } from '../lib/env.js';
import { score } from '../config/keywords.js';

const BK_API = 'https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/api/v1/publication';

export async function fetchBk({ days = 3, query = 'strona internetowa' } = {}) {
  const u = new URL(BK_API);
  u.searchParams.set('q', query);
  u.searchParams.set('size', '50');
  u.searchParams.set('page', '0');
  u.searchParams.set('sort', 'publicationDate,desc');

  const res = await fetch(u, { headers: { 'user-agent': env.ua, accept: 'application/json' } });
  if (!res.ok) throw new Error(`bk ${res.status}`);
  const json = await res.json();
  const items = json.content || json.items || json.data || [];
  const cutoff = Date.now() - days * 864e5;

  return items
    .filter((it) => {
      const d = new Date(it.publicationDate || it.publishedAt || 0).getTime();
      return !d || d >= cutoff;
    })
    .map((it) => {
      const title = it.title || it.name || '(bez tytulu)';
      const city = it.city || it.placeOfPerformance || null;
      return {
        source: 'bk',
        externalId: String(it.id || it.number),
        url: `https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/ogloszenia/${it.id}`,
        title,
        body: (it.description || '').slice(0, 4000),
        city,
        province: it.province || null,
        budget: it.budget || null,
        publishedAt: it.publicationDate || null,
        deadlineAt: it.offerDeadline || it.deadline || null,
        channel: 'A',
        relevance: score(`${title} ${it.description || ''}`),
        isLocal: isLocal(city),
        raw: { publisher: it.publisherName || it.organization || null },
      };
    });
}
