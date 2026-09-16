-- Radar leadow - schemat
-- psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS signals (
  id            BIGSERIAL PRIMARY KEY,
  source        TEXT NOT NULL,              -- useme | bzp | bk | ceidg | manual
  external_id   TEXT NOT NULL,              -- id ogloszenia u zrodla
  url           TEXT,
  title         TEXT NOT NULL,
  body          TEXT,
  city          TEXT,
  province      TEXT,                       -- PL61 itd. lub nazwa
  budget        TEXT,
  published_at  TIMESTAMPTZ,
  deadline_at   TIMESTAMPTZ,
  -- sciezka kontaktu wg art. 398 PKE:
  --   A = zamowione (firma sama prosi o oferte)  -> wolno odpowiedziec
  --   B = inbound ze zgoda (formularz na davido.pl)
  --   C = tylko offline / relacyjnie (list, wizyta, polecenie)
  --   X = nie dotykac
  channel       CHAR(1) NOT NULL DEFAULT 'X',
  relevance     INT NOT NULL DEFAULT 0,     -- 0-100, dopasowanie tematyczne
  is_local      BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'new',-- new | seen | answered | rejected | won | lost
  notes         TEXT,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS signals_status_idx    ON signals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS signals_published_idx ON signals (published_at DESC);

-- Firmy z CEIDG / z audytu (etap 2-3). Sciezka domyslnie C - offline.
CREATE TABLE IF NOT EXISTS companies (
  id            BIGSERIAL PRIMARY KEY,
  ceidg_id      TEXT UNIQUE,               -- GUID wpisu w CEIDG; stabilniejszy klucz niz NIP
  nip           TEXT,
  regon         TEXT,
  name          TEXT NOT NULL,
  city          TEXT,
  province      TEXT,
  pkd           TEXT[],
  pkd_version   TEXT,                       -- '2007' | '2025' | 'mixed'
  registered_at DATE,
  domain        TEXT,
  has_website   BOOLEAN,
  place_id      TEXT,                       -- jedyne pole Places, ktore wolno trzymac bezterminowo
  channel       CHAR(1) NOT NULL DEFAULT 'C',
  pain_score    INT,                        -- 0-100, im wyzej tym gorsza strona
  last_audit_at TIMESTAMPTZ,
  source        TEXT,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companies_pain_idx ON companies (pain_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS companies_city_idx ON companies (city);
CREATE INDEX IF NOT EXISTS companies_nip_idx  ON companies (nip);

CREATE TABLE IF NOT EXISTS audits (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT REFERENCES companies(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  strategy      TEXT NOT NULL,              -- mobile | desktop
  perf          INT, seo INT, a11y INT, bp INT,
  lcp_ms        INT, cls NUMERIC(5,3), tbt_ms INT, bytes BIGINT,
  https         BOOLEAN, viewport BOOLEAN, generator TEXT,
  findings      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audits_company_idx ON audits (company_id, created_at DESC);

-- Rejestr zgod i sprzeciwow - to jest dowod w razie kontroli UODO/UKE.
CREATE TABLE IF NOT EXISTS consents (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  email         TEXT,
  phone         TEXT,
  kind          TEXT NOT NULL,              -- marketing_email | marketing_phone | opt_out
  clause        TEXT NOT NULL,              -- dokladna tresc klauzuli, ktora zaakceptowano
  source        TEXT NOT NULL,              -- np. 'formularz audytu davido.pl'
  ip            INET,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS consents_email_idx ON consents (lower(email));

-- Log kazdego kontaktu - kanal + podstawa prawna.
CREATE TABLE IF NOT EXISTS touches (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  signal_id     BIGINT REFERENCES signals(id) ON DELETE SET NULL,
  channel       TEXT NOT NULL,              -- email | phone | list | wizyta | platforma | linkedin
  legal_basis   TEXT NOT NULL,              -- 'zamowione (art.398 nie dotyczy)' | 'zgoda id=..' | 'offline'
  content       TEXT,
  happened_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Heartbeat zrodel - bez tego zepsuty scraper milczy i tego nie widac.
CREATE TABLE IF NOT EXISTS source_runs (
  id            BIGSERIAL PRIMARY KEY,
  source        TEXT NOT NULL,
  ok            BOOLEAN NOT NULL,
  found         INT NOT NULL DEFAULT 0,
  inserted      INT NOT NULL DEFAULT 0,
  error         TEXT,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_runs_idx ON source_runs (source, ran_at DESC);
