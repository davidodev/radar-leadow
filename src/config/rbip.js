// RBIP mojregion.info - Regionalny Biuletyn Informacji Publicznej
// Wojewodztwa Kujawsko-Pomorskiego (projekt "Infostrada Kujaw i Pomorza").
//
// Dlaczego to jest najlepsze zrodlo w calym radarze:
//  - zamowienia PONIZEJ 130 tys. zl nie trafiaja do BZP, wiec gminy publikuja
//    je u siebie. RBIP zbiera dziesiatki podmiotow regionu na jednym silniku.
//  - kazdy podmiot wystawia gotowe kanaly RSS - nie scrapujemy HTML-a,
//    czytamy XML, ktory sami udostepniaja do ponownego wykorzystania.
//  - robots.txt: "Allow: /", bez crawl-delay; blokuje imiennie ~200 botow
//    (GPTBot, AhrefsBot, PerplexityBot...), wsrod nich nas nie ma.
//
// DO ROZSTRZYGNIECIA PRZED PRODUKCJA: robots.txt ma "Disallow: /xml",
// a kanaly leza pod "/rss/...". Sciezki sie nie pokrywaja, ale intencja moze byc
// ta sama. Najprosciej zapytac administratora RBIP - to jednostka publiczna,
// a pytanie o ponowne wykorzystanie informacji publicznej ma obowiazek rozpatrzyc.

export const BASE = 'rbip.mojregion.info';

// Subdomeny potwierdzone na zywo. Lista jest niepelna - Infostrada ma 149
// partnerow. Dopisuj kolejne w miare jak je znajdziesz; `npm run rbip:discover`
// sam wyszuka kanaly RSS dla kazdej.
export const PODMIOTY = [
  { sub: 'umwkp',                nazwa: 'Urzad Marszalkowski Woj. Kujawsko-Pomorskiego' },
  { sub: 'pow-nakielski',        nazwa: 'Powiat nakielski' },
  { sub: 'pow-swiecki',          nazwa: 'Powiat swiecki' },
  { sub: 'pow-rypinski',         nazwa: 'Powiat rypinski' },
  { sub: 'gm-inowroclaw',        nazwa: 'Gmina Inowroclaw' },
  { sub: 'gm-skrwilno',          nazwa: 'Gmina Skrwilno' },
  { sub: 'gm-dabrowa-biskupia',  nazwa: 'Gmina Dabrowa Biskupia' },
  { sub: 'gm-zlawies-wielka',    nazwa: 'Gmina Zlawies Wielka' },
  { sub: 'mst-solec-kujawski',   nazwa: 'Miasto Solec Kujawski' },
  { sub: 'mst-gorzno',           nazwa: 'Miasto Gorzno' },
];

// Kategorie kanalow, ktore nas interesuja. Numer kategorii jest LOKALNY dla
// kazdego podmiotu (u Skrwilna zamowienia publiczne to 306), wiec feedow nie da
// sie zlozyc z szablonu - trzeba je raz wykryc. Robi to `npm run rbip:discover`,
// ktory zapisuje wynik do src/config/rbip-feeds.json.
export const INTERESUJACE = [
  'zamowienia-publiczne',
  'zapytania-ofertowe',
  'ogloszenia',
  'aktualnosci',
  'przetargi',
];
