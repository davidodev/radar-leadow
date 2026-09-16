# Radar leadów — davido.pl

Narzędzie do wyłapywania **zamówionych** zapytań o wykonanie strony www
w woj. kujawsko-pomorskim, plus audyt strony jako magnes na leady.

Zasada, która przenika cały kod: art. 398 PKE wymaga uprzedniej zgody na marketing
elektroniczny **także w B2B**. Dlatego każdy rekord ma pole `channel`:

| channel | znaczenie | co wolno |
|---|---|---|
| **A** | zamówione — firma sama prosi o ofertę | odpowiedzieć, tym kanałem, którym pytała |
| **B** | inbound ze zgodą (formularz na davido.pl) | pisać mailem, w zakresie zgody |
| **C** | tylko offline / relacyjnie | list, wizyta, telefon w ramach relacji |
| **X** | nie dotykać | nic |

Firmy pobrane z CEIDG lądują z `channel = 'C'`, nawet jeśli mają publiczny e-mail
we wpisie. Publiczna dostępność adresu nie jest zgodą.

## Instalacja

```bash
cp .env.example .env      # uzupełnij
npm install
npm run db:up             # Postgres w dockerze (docker-compose.yml)
npm run migrate           # zakłada tabele
```

Baza słucha **tylko na 127.0.0.1** i ma hasło `radar` — to jest do lokalnej roboty.
Na VPS-ie nie wystawiaj jej na świat; radar łączy się z nią z tej samej maszyny.
Jeśli masz już Postgresa na 5432, ustaw w `.env` `RADAR_DB_PORT=5433` i ten sam
port w `DATABASE_URL`.

Bez dockera wystarczy zwykły Postgres i `createdb radar` — kod nie wie, skąd baza pochodzi.

## Komendy

```bash
npm run radar         # jeden przebieg wszystkich źródeł + alerty na Telegram
npm run heartbeat     # sprawdza, czy któreś źródło nie zamilkło
npm run audit -- example.pl
npm run ceidg -- 7    # nowe wpisy z ostatnich 7 dni (wymaga CEIDG_TOKEN)
npm run ceidg:probe   # rozstrzyga, którą wersję PKD przyjmuje filtr (wymaga CEIDG_TOKEN)
npm run report        # co się działo przez 30 dni
node src/server.js    # endpoint pod formularz audytu na davido.pl
```

## Cron

```cron
*/20 6-22 * * *  cd /srv/radar && /usr/bin/node src/cli.js radar     >> /var/log/radar.log 2>&1
0    9    * * *  cd /srv/radar && /usr/bin/node src/cli.js heartbeat >> /var/log/radar.log 2>&1
30   6    * * 1  cd /srv/radar && /usr/bin/node src/cli.js ceidg 7   >> /var/log/radar.log 2>&1
```

## Źródła — stan po weryfikacji, wrzesień 2026

| Źródło | Status | Uwaga |
|---|---|---|
| **Useme** | ✅ główne | ~60–65 aktywnych zleceń na strony www. robots.txt zezwala na `/pl/jobs/`, **crawl-delay 10 s** — kod to respektuje. Odpowiadasz w Useme, nie mailem (regulamin art. 2 §15). |
| **BZP / e-Zamówienia** | ✅ włączone | API bezpłatne, bez klucza. Daty obowiązkowe, filtr województwa **nie działa** — filtrujemy u siebie. ~16 ogłoszeń/mies. na CPV 72413000-8 w skali kraju. |
| **Baza Konkurencyjności** | ⚠️ wyłączone | Endpoint JSON do potwierdzenia w DevTools, potem `enabled: true` w `src/jobs/radar.js`. |
| **CEIDG v3** | ✅ etap 3 | Wymaga JWT z biznes.gov.pl. 50 req/3 min, 1000 req/60 min. Struktura odpowiedzi potwierdzona — patrz niżej. |
| **PageSpeed Insights** | ✅ | Darmowe, 25 000/dobę z kluczem. |
| Oferia, Oferteo, Fixly, OLX, LinkedIn, FB | ❌ | Powody w `etap0/zrodla.md`. |

## Uwaga o PKD — to jest pułapka, o którą łatwo się rozbić

PKD 2025 obowiązuje od 1.01.2025, ale okres przejściowy trwa **do 31.12.2026**,
a automatyczne przeklasyfikowanie wpisów przez GUS ma się skończyć **31.01.2027**.
Dziś baza CEIDG jest mieszana: firma zarejestrowana przed 2025, która nie ruszała
wpisu, wciąż ma PKD 2007.

`src/config/pkd.js` trzyma **obie listy kodów** dla każdego segmentu i odpytuje
obiema, dedupując po `id` z CEIDG. Po 31.01.2027 można usunąć pole `pkd2007`.

## CEIDG — co już potwierdzone na żywym API (16.09.2026)

Struktura odpowiedzi `/v3/firmy`:

```json
{ "firmy": [{ "id": "GUID", "nazwa": "...", "adresDzialalnosci": { "miasto": "...",
  "wojewodztwo": "KUJAWSKO-POMORSKIE", "powiat": "...", "kod": "88-100", "terc": "...", "simc": "..." },
  "wlasciciel": { "imie": "...", "nazwisko": "...", "nip": "...", "regon": "..." },
  "dataRozpoczecia": "2026-09-16", "status": "AKTYWNY",
  "link": "https://dane.biznes.gov.pl/api/ceidg/v3/firma/{id}" }],
  "count": 265086, "links": { "next": "...", "prev": "...", "self": "..." } }
```

Cztery rzeczy, które z tego wynikają i łatwo je przeoczyć:

1. **Paginacja jest od zera.** Domyślnie jesteś na `page=0`. Kod idzie za `links.next`,
   zamiast liczyć strony samodzielnie.
2. **Bez parametru `status` API zwraca wszystko** — łącznie z WYKREŚLONY i ZAWIESZONY.
   Zawsze przekazujemy `status=AKTYWNY` jawnie.
3. **Przy zerze wyników API zwraca puste ciało**, nie `{"count":0}`. `res.json()` rzuca
   wtedy `Unexpected end of JSON input`. Bez obsługi tego każdy kod PKD bez trafień
   wywalałby cały przebieg — `call()` traktuje pustą odpowiedź jako zero wyników.
4. **Kody PKD podaje się BEZ KROPEK**: `96.21.Z` → `9621Z`. Wariant z kropkami zwraca
   zero. W `src/config/pkd.js` kody są w czytelnej formie z kropkami, konwersję robi
   `pkdParam()` w `ceidg.js`.
5. **Lista nie zawiera PKD ani kontaktu.** Żeby dostać e-mail, telefon i kody PKD,
   trzeba zawołać `link` (czyli `/firma/{id}`) — jedno zapytanie na rekord.
   Domyślnie tego nie robimy: te firmy i tak są ścieżką C, a limit to 50 zapytań / 3 min.
   `enrichFirma()` jest dostępne dla krótkich list.

Klucz główny to `ceidg_id` (GUID wpisu), nie NIP — NIP jest tylko indeksowany.

## Czego nie potwierdziłem — sprawdź przy pierwszym uruchomieniu

1. **Czy stare kody PKD 2007 są jeszcze żywe w bazie.** Pierwszy pomiar (`dataod=2026-01-01`)
   pokazał 130 trafień na `9621Z` i zero na `9602Z` — ale to nic nie dowodzi, bo firmy
   zarejestrowane w 2026 z definicji mają PKD 2025. `npm run ceidg:probe` odpytuje teraz
   oba kody także **bez filtru daty**; dopiero to rozstrzyga, czy `pkd2007`
   w `src/config/pkd.js` jest do czegokolwiek potrzebne.
2. Limity zapytań API BZP — nigdzie nieudokumentowane. Nie waliż w nie na ślepo.
3. Dokładny kształt JSON-a z BZP (`content` / `items` / tablica) — kod obsługuje
   wszystkie trzy warianty, ale nazwy pól mogły się zmienić.
4. Kody PKD 2025 dla praktyk lekarskich (86.21/86.22/86.23) — nazwy się zgadzają,
   ale żadne źródło nie deklarowało wprost wersji 2025.

## Struktura

```
docker-compose.yml       sam Postgres, reszta chodzi jako procesy node
db/schema.sql            signals, companies, audits, consents, touches, source_runs
src/config/pkd.js        segmenty + kody PKD 2007 i 2025
src/config/cpv.js        kody CPV do BZP
src/config/keywords.js   scoring trafności — plik, który będziesz ruszał najczęściej
src/sources/             useme, bzp, bazakonkurencyjnosci, ceidg
src/audit/               psi (PageSpeed), heuristics (HTTPS, RWD, WP, TTFB)
src/jobs/                radar (przebieg + heartbeat), audit (pełny audyt + raport)
src/server.js            endpoint pod formularz na davido.pl
etap0/                   tracker, szablony, lista źródeł, formularz HTML
```

## Higiena, której nie warto obchodzić

- `USEME_DELAY_MS` ≥ 10 000. To jest w ich robots.txt.
- `USER_AGENT` z kontaktem do Ciebie. Jeśli coś jest nie tak, dostaniesz maila
  zamiast bana.
- Nie publikuj nigdzie treści ogłoszeń z Useme — regulamin art. 4 §11.
- Dane z Google Places (poza `place_id`) trzymaj **maksymalnie 30 dni**.
- Rejestr zgód (`consents`) to jedyny dowód w razie kontroli. Nie kasuj go.
