// Kody CPV do odpytywania BZP. Filtr CpvCode dziala po stronie serwera,
// ale przyjmuje jeden kod na zapytanie - stad petla.
// Kolejnosc = malejaca trafnosc.
export const CPV = [
  { code: '72413000-8', name: 'Uslugi w zakresie projektowania stron WWW' },
  { code: '48224000-4', name: 'Pakiety oprogramowania do edycji stron WWW' },
  { code: '72212224-5', name: 'Uslugi opracowywania oprogramowania do edycji stron WWW' },
  { code: '72212220-7', name: 'Uslugi opracowywania oprogramowania dla internetu i intranetu' },
  { code: '72420000-0', name: 'Uslugi w zakresie rozwijania internetu' },
  { code: '72422000-4', name: 'Uslugi rozwijania internetowych aplikacji serwerowych' },
  { code: '72400000-4', name: 'Uslugi internetowe' },
  { code: '72000000-5', name: 'Uslugi informatyczne' },
  { code: '48000000-8', name: 'Pakiety oprogramowania i systemy informatyczne' },
];

// Dwa ostatnie sa szerokie - trafiaja tam tez dostawy sprzetu i licencji.
// Dla nich podnies prog scoringu.
export const BROAD = new Set(['72000000-5', '48000000-8']);
