// Prosty scoring dopasowania. Zamiast klasyfikatora ML - lista slow z wagami.
// Dostrajaj po pierwszym tygodniu: to jest plik, ktory bedziesz najczesciej ruszal.

// Kalibracja: fraza ze STRONG ma sama w sobie przekroczyc prog alertu (45),
// bo urzedowy tytul "Wykonanie i wdrozenie nowej strony internetowej" nie
// zawiera zadnego slowa technicznego z MEDIUM - a to jest idealny lead.
// Sprawdzone na realnych tytulach z BZP i RBIP (17.09.2026).
export const STRONG = [
  'strona www', 'strone www', 'strony www', 'stronę www',
  'strona internetowa', 'strone internetowa', 'stronę internetową', 'strony internetowej',
  'landing page', 'sklep internetowy', 'sklepu internetowego', 'e-commerce',
  'wizytowka internetowa', 'wizytówka internetowa',
  'wykonanie serwisu', 'serwis internetowy', 'portal internetowy',
  'aplikacja webowa', 'aplikacje webowa', 'system internetowy',
  'redesign', 'przebudowa strony', 'modernizacja strony', 'migracja strony',
  // warianty urzedowe - tak to nazywaja w zapytaniach ofertowych i przetargach
  'serwisu internetowego', 'serwis www', 'witryny internetowej', 'witryna internetowa',
  'portalu internetowego', 'stron internetowych', 'strona podmiotowa',
  // UWAGA: bez golego 'bip' - to trzyliterowy fragment, ktory na stronach RBIP
  // wystepuje wszedzie (w URL-ach, stopkach, nazwach dzialow) i zapalilby
  // alert na kazdym ogloszeniu o remoncie chodnika.
  'biuletynu informacji publicznej', 'biuletyn informacji publicznej',
  'sklepu internetowego',
];

export const MEDIUM = [
  'wordpress', 'woocommerce', 'shoper', 'presta', 'prestashop', 'shopify',
  'astro', 'next.js', 'nextjs', 'react', 'headless',
  'cms', 'seo', 'pagespeed', 'core web vitals', 'wcag', 'dostepnosc cyfrowa',
  'dostępność cyfrowa', 'rodo', 'certyfikat ssl', 'hosting', 'domena',
  'integracja api', 'formularz kontaktowy', 'rezerwacje online', 'system rezerwacji',
  // slownictwo zamowien publicznych
  'zapytanie ofertowe', 'przedmiotem zamowienia', 'przedmiotem zamówienia',
  'wykonanie i wdrozenie', 'wykonanie i wdrożenie', 'wdrozenie', 'wdrożenie',
  'deklaracja dostepnosci', 'deklaracja dostępności', 'wcag 2.1', 'responsywn',
  'szkolenie z obslugi', 'przeniesienie tresci', 'przeniesienie treści',
];

// Slowa, ktore prawie zawsze oznaczaja "to nie jest zlecenie dla Ciebie".
export const NEGATIVE = [
  'praca stala', 'praca stała', 'umowa o prace', 'etat', 'rekrutacja',
  'wizytowki papierowe', 'ulotki', 'druk', 'baner reklamowy',
  'copywriting', 'tlumaczenie', 'tłumaczenie', 'transkrypcja',
  'wpisy blogowe', 'zdjecia produktowe', 'zdjęcia produktowe',
  'social media manager', 'moderacja', 'wirtualna asystentka',
  'excel', 'wypelnianie danych', 'wypełnianie danych',
];

/** 0-100. >=45 warte alertu, >=70 warte natychmiastowej reakcji. */
export function score(text = '') {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of STRONG) if (t.includes(w)) { s += 45; break; }
  let med = 0;
  for (const w of MEDIUM) if (t.includes(w)) med += 8;
  s += Math.min(med, 35);
  for (const w of NEGATIVE) if (t.includes(w)) s -= 25;
  if (/\b(pilne|pilnie|na wczoraj|asap)\b/.test(t)) s += 5;
  if (/\b(budzet|budżet|do \d[\d\s]{2,}\s*(zl|zł|pln))/.test(t)) s += 10;
  return Math.max(0, Math.min(100, s));
}
