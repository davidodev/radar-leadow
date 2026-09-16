import 'dotenv/config';

export const env = {
  db: process.env.DATABASE_URL,
  tg: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chat: process.env.TELEGRAM_CHAT_ID,
  },
  ceidg: {
    token: process.env.CEIDG_TOKEN,
    base: process.env.CEIDG_BASE || 'https://dane.biznes.gov.pl/api/ceidg/v3',
  },
  psiKey: process.env.PSI_KEY || '',
  provinceNuts: process.env.PROVINCE_NUTS || 'PL61',
  provinceName: process.env.PROVINCE_NAME || 'kujawsko-pomorskie',
  localCities: (process.env.LOCAL_CITIES || '')
    .split(',').map((s) => s.trim()).filter(Boolean),
  usemeDelay: Number(process.env.USEME_DELAY_MS || 11000),
  ua: process.env.USER_AGENT || 'RadarLeadow/0.1',
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Porownanie nazw miast bez ogonkow i wielkosci liter.
export const fold = (s = '') =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().trim();

export const isLocal = (city) => {
  if (!city) return false;
  const c = fold(city);
  return env.localCities.some((x) => c.includes(fold(x)));
};
