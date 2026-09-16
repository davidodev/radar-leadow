// Endpoint pod formularz "sprawdz swoja strone" na davido.pl (etap 2).
// To jest jedyna maszyna, ktora legalnie buduje Twoja baze: bez checkboxa zgody
// nie wolno pozniej wyslac do tej firmy niczego marketingowego.
//
// Uruchom:  node src/server.js      (domyslnie :8787)
// Postaw za nginx/Caddy i wystaw jako https://api.davido.pl/audyt

import http from 'node:http';
import { q, pool } from './lib/db.js';
import { auditUrl, renderReport } from './jobs/audit.js';
import { send } from './notify/telegram.js';

const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.CORS_ORIGIN || 'https://davido.pl';

// Dokladna tresc, ktora zapisujemy w rejestrze zgod. Zmiana tresci = nowa wersja.
export const CLAUSE_V1 =
  'Wyrazam zgode na otrzymanie raportu z audytu oraz kontakt handlowy ze strony ' +
  'DAVIDO Dawid [nazwisko], NIP [numer], na podany adres e-mail. ' +
  'Zgode moge wycofac w kazdej chwili, pisac na kontakt@davido.pl. ' +
  'Wycofanie zgody nie wplywa na zgodnosc z prawem przetwarzania sprzed wycofania.';

const json = (res, code, body) => {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
};

// Prosty limiter po IP - 5 zapytan / 10 min. PSI kosztuje 20-30 s czasu.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 600_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 5;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST' || !req.url.startsWith('/audyt')) return json(res, 404, { error: 'nie znaleziono' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: 'Za duzo zapytan. Sprobuj za kilka minut.' });

  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'za duzo danych' }); }

  let data;
  try { data = JSON.parse(body); } catch { return json(res, 400, { error: 'nieprawidlowe dane' }); }

  const { url, email, consent, company } = data;
  if (!url || !/^[\w.-]+\.[a-z]{2,}/i.test(String(url).replace(/^https?:\/\//, '')))
    return json(res, 400, { error: 'Podaj poprawny adres strony.' });
  if (!email || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email))
    return json(res, 400, { error: 'Podaj poprawny adres e-mail.' });
  if (consent !== true)
    return json(res, 400, { error: 'Bez zgody nie mozemy wyslac raportu.' });

  // Sprzeciw ma pierwszenstwo nad zgoda.
  const { rows: opt } = await q(
    `SELECT 1 FROM consents WHERE lower(email)=lower($1) AND kind='opt_out' LIMIT 1`, [email]);
  if (opt.length) return json(res, 403, { error: 'Ten adres zostal wypisany z kontaktu.' });

  try {
    const companyRow = await q(
      `INSERT INTO companies (name, domain, channel, source, has_website)
       VALUES ($1,$2,'B','formularz-audytu',true) RETURNING id`,
      [company || url, String(url).replace(/^https?:\/\//, '').replace(/\/.*$/, '')],
    );
    const companyId = companyRow.rows[0].id;

    await q(
      `INSERT INTO consents (company_id, email, kind, clause, source, ip)
       VALUES ($1,$2,'marketing_email',$3,'formularz audytu davido.pl',$4)`,
      [companyId, email, CLAUSE_V1, ip],
    );

    const result = await auditUrl(url, { companyId, strategies: ['mobile'] });
    await send(`🟢 Nowy lead z formularza audytu\n${url}\n${email}\nOcena problemu: ${result.painScore}/100`);

    return json(res, 200, {
      ok: true,
      painScore: result.painScore,
      report: renderReport(result),
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Nie udalo sie zbadac strony. Sprobuj za chwile.' });
  }
});

server.listen(PORT, () => console.log(`audyt api na :${PORT}`));
process.on('SIGTERM', () => { server.close(); pool.end(); });
