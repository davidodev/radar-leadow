// BZP / Platforma e-Zamowienia - ogloszenia o zamowieniach publicznych.
// API jest bezplatne i NIE wymaga klucza ani wniosku (Regulamin korzystania z API,
// Zarzadzenie Prezesa UZP nr 1/2023: "W zakresie Webservice nie jest wymagane
// skladanie wniosku dostepowego").
//
// Dwie pulapki, ktore juz sa obsluzone:
//  1. Zapytanie bez zakresu dat zwraca HTTP 400 - daty sa obowiazkowe.
//  2. Filtr wojewodztwa NIE dziala po stronie serwera. OrganizationProvince=PL61
//     zwraca 400, Province=PL61 jest po cichu ignorowane. Filtrujemy u siebie
//     po polu organizationProvince.
// Odpowiedz zawiera pelny htmlBody kazdego ogloszenia - przy PageSize=100 to
// megabajty. Dlatego PageSize domyslnie 50 i od razu obcinamy htmlBody.
//
// Ksztalt odpowiedzi potwierdzony na zywym API 17.09.2026: to GOLA TABLICA
// obiektow, nie obiekt z polem `content`. Pola jednego ogloszenia:
//   noticeNumber "2026/BZP 00435059/01", bzpNumber, noticeType, orderType
//   ("Services"/"Works"/"Delivery"), orderObject, cpvCode - UWAGA: to string
//   z WIELOMA kodami i ich nazwami po przecinku, np.
//   "72413000-8 (Uslugi w zakresie projektowania stron WWW),72212224-5 (...)",
//   organizationName, organizationCity, organizationProvince (NUTS: "PL22"),
//   organizationNationalId (to NIP zamawiajacego), organizationId,
//   publicationDate, submittingOffersDate, tenderId (OCID), objectId, htmlBody.

import { env } from '../lib/env.js';
import { CPV, BROAD } from '../config/cpv.js';
import { score } from '../config/keywords.js';
import { isLocal } from '../lib/env.js';

const API = 'https://ezamowienia.gov.pl/mo-board/api/v1/Notice';

const ymd = (d) => new Date(d).toISOString().slice(0, 10);

async function page({ cpv, from, to, pageNumber = 1, pageSize = 50 }) {
  const u = new URL(API);
  u.searchParams.set('NoticeType', 'ContractNotice');
  u.searchParams.set('PublicationDateFrom', ymd(from));
  u.searchParams.set('PublicationDateTo', ymd(to));
  u.searchParams.set('CpvCode', cpv);
  u.searchParams.set('PageSize', String(pageSize));
  u.searchParams.set('PageNumber', String(pageNumber));

  const res = await fetch(u, { headers: { 'user-agent': env.ua, accept: 'application/json' } });
  if (!res.ok) throw new Error(`bzp ${res.status} cpv=${cpv}`);
  const text = await res.text();
  if (!text.trim()) return [];                    // brak wynikow = puste cialo
  const json = JSON.parse(text);
  // Potwierdzone: gola tablica. Warianty opakowane zostawiam na wypadek zmiany.
  return Array.isArray(json) ? json : (json.content || json.items || json.data || []);
}

// Z htmlBody wyciagamy tylko tekst - do scoringu i podgladu, nie do bazy.
const stripHtml = (h = '') =>
  h.replace(/<script[\s\S]*?<\/script>/gi, ' ')
   .replace(/<[^>]+>/g, ' ')
   .replace(/&nbsp;/g, ' ')
   .replace(/\s+/g, ' ')
   .trim();

/** @param {number} days ile dni wstecz sprawdzamy (domyslnie 3 - cron dzienny z zapasem) */
export async function fetchBzp({ days = 3, onlyProvince = true } = {}) {
  const to = new Date();
  const from = new Date(Date.now() - days * 864e5);
  const out = [];

  for (const { code } of CPV) {
    let items = [];
    try {
      items = await page({ cpv: code, from, to });
    } catch (e) {
      console.warn('[bzp]', code, e.message);
      continue;
    }
    for (const it of items) {
      const province = it.organizationProvince || it.province || null;
      if (onlyProvince && province && province !== env.provinceNuts) continue;

      const text = stripHtml(it.htmlBody || '');
      const title = it.orderObject || it.noticeTitle || '(bez tytulu)';
      let rel = score(`${title} ${text.slice(0, 4000)}`);
      // Szerokie CPV lapia tez dostawy sprzetu i licencje - podnosimy im prog.
      if (BROAD.has(code)) rel -= 20;
      // Dostawy i roboty budowlane prawie nigdy nie sa zleceniem na strone.
      if (it.orderType && it.orderType !== 'Services') rel -= 25;
      const city = it.organizationCity || null;

      out.push({
        source: 'bzp',
        externalId: it.noticeNumber || it.tenderId || it.objectId,
        // tenderId to OCID - platforma otwiera po nim widok postepowania.
        url: it.tenderId
          ? `https://ezamowienia.gov.pl/mp-client/search/list/${it.tenderId}`
          : 'https://ezamowienia.gov.pl/mp-client/search/list',
        title,
        body: text.slice(0, 4000),
        city,
        province,
        budget: null,
        publishedAt: it.publicationDate || null,
        deadlineAt: it.submittingOffersDate || null,
        channel: 'A', // postepowanie publiczne = zaproszenie do skladania ofert
        relevance: Math.max(0, rel),
        isLocal: isLocal(city),
        raw: {
          cpv: code,
          cpvAll: it.cpvCode,                       // pelny string z nazwami kodow
          organizationName: it.organizationName,
          organizationNip: it.organizationNationalId,
          orderType: it.orderType,
          noticeNumber: it.noticeNumber,
        },
      });
    }
  }

  const seen = new Set();
  return out.filter((o) => (seen.has(o.externalId) ? false : seen.add(o.externalId)));
}
