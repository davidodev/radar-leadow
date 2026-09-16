// UWAGA - najwazniejsza rzecz w tym pliku:
// PKD 2025 obowiazuje od 1.01.2025, ale okres przejsciowy trwa do 31.12.2026,
// a automatyczne przeklasyfikowanie wpisow przez GUS ma sie skonczyc 31.01.2027.
// We wrzesniu 2026 baza CEIDG jest MIESZANA: firma zarejestrowana przed 2025,
// ktora nie ruszala wpisu, ma wciaz PKD 2007.
// => kazdy segment odpytujemy obiema listami kodow i dedupujemy po NIP.
// Po 31.01.2027 mozna usunac pole `pkd2007`.

export const SEGMENTS = [
  {
    key: 'uroda',
    label: 'Fryzjerstwo i kosmetyka',
    why: 'Rezerwacje online i galeria realizacji. Wysoka gotowosc do placenia za wyglad.',
    pkd2007: ['96.02.Z'],
    pkd2025: ['96.21.Z', '96.22.Z'],
  },
  {
    key: 'moto',
    label: 'Warsztaty samochodowe i detailing',
    why: 'Zwykle brak strony albo strona z 2012. Konkuruja lokalnie w Google.',
    pkd2007: ['45.20.Z'],
    pkd2025: ['95.31.A', '95.31.B', '95.31.C', '95.32.Z'],
  },
  {
    key: 'budowlanka',
    label: 'Roboty wykonczeniowe',
    why: 'Portfolio zdjeciowe sprzedaje. Duzo nowych JDG.',
    pkd2007: ['43.31.Z', '43.32.Z', '43.33.Z', '43.34.Z', '43.39.Z'],
    pkd2025: ['43.31.Z', '43.32.Z', '43.33.Z', '43.34.Z', '43.35.Z'],
  },
  {
    key: 'gastro',
    label: 'Gastronomia',
    why: 'Menu, godziny, rezerwacja, dowozy. Czesto tylko Facebook.',
    pkd2007: ['56.10.A', '56.10.B', '56.21.Z', '56.29.Z', '56.30.Z'],
    pkd2025: ['56.11.Z', '56.12.Z', '56.21.Z', '56.22.Z', '56.30.Z'],
  },
  {
    key: 'noclegi',
    label: 'Noclegi krotkoterminowe',
    why: 'Najwyzszy budzet na strone w calej liscie - strona bezposrednio zarabia.',
    pkd2007: ['55.20.Z', '55.10.Z'],
    pkd2025: ['55.20.Z', '55.10.Z', '55.30.Z'],
  },
  {
    key: 'zdrowie',
    label: 'Praktyki lekarskie i dentystyczne',
    why: 'Wymogi dostepnosci cyfrowej i RODO - twardy argument techniczny.',
    pkd2007: ['86.21.Z', '86.22.Z', '86.23.Z'],
    pkd2025: ['86.21.Z', '86.22.Z', '86.23.Z'], // do potwierdzenia po pierwszym pobraniu
  },
  {
    key: 'fitness',
    label: 'Kluby fitness i sport',
    why: 'Grafik zajec, karnety, zapisy - realny system, nie wizytowka.',
    pkd2007: ['93.13.Z', '93.11.Z'],
    pkd2025: ['93.13.Z', '93.11.Z', '93.19.Z'],
  },
];

export const allCodes = (seg) =>
  [...new Set([...(seg.pkd2007 || []), ...(seg.pkd2025 || [])])];

export const segmentFor = (code) =>
  SEGMENTS.find((s) => allCodes(s).includes(code)) || null;
