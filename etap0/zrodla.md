# Źródła — co realnie sprawdzać codziennie (etap 0)

Research zmienił listę względem pierwszej wersji planu. Poniżej stan po weryfikacji,
wrzesień 2026.

## Codziennie, ~15 minut

### 1. Useme — główne źródło wolumenu
Kategorie (zakładki do bookmarków):

- Strony internetowe — https://useme.com/pl/jobs/category/strony-internetowe,96/
- Sklepy internetowe — https://useme.com/pl/jobs/category/sklepy-internetowe,97/
- Obsługa stron — https://useme.com/pl/jobs/category/obsuga-stron-internetowych,98/
- Obsługa sklepów — https://useme.com/pl/jobs/category/obsuga-sklepow-internetowych,99/

Realny wolumen: **~60–65 aktywnych zleceń** na strony www w danym momencie.
Listing pokazuje też archiwum (4 338 pozycji w kategorii 96) — aktywne kończą się
mniej więcej na 4. stronie, dalej same „Zakończone".

Świeżość dobra: pierwsza strona to zlecenia z ostatnich godzin.
ID zleceń rosną (~144 200 we wrześniu 2026), więc nowe wykrywa się po inkrementacji ID.

Zasady: prowizja 7,8% netto (min. 29 zł, max 349 zł/mies.).
**Regulamin art. 2 §15 zakazuje wyprowadzania zleceniodawców poza platformę** —
odpowiadasz w Useme, nie mailem do klienta.

### 2. Facebook — tylko ręcznie
Meta usunęła Facebook Groups API 22 kwietnia 2024. Nie ma legalnej drogi do
automatyzacji. Zostaje włączenie powiadomień w grupach i filtr w skrzynce.

Grupy do dopisania (uzupełnij o te, które faktycznie obserwujesz):

- [ ] …
- [ ] …
- [ ] …

## Raz dziennie, automatycznie (etap 1)

### 3. BZP / Platforma e-Zamówienia
API bezpłatne, bez klucza i bez wniosku.
`https://ezamowienia.gov.pl/mo-board/api/v1/Notice`

Wolumen dla CPV 72413000-8 (projektowanie stron WWW): **~16 ogłoszeń miesięcznie
w skali kraju**, w kujawsko-pomorskim pojedyncze sztuki. Dlatego kod odpytuje
9 kodów CPV, nie jeden — i nie filtruje po województwie po stronie serwera
(ten filtr tam nie działa).

### 4. Baza Konkurencyjności
Zapytania ofertowe beneficjentów funduszy UE. Zamówienia poniżej progów PZP,
więc trafiają tam rzeczy, których nie ma w BZP. Publiczny rejestr rządowy,
brak przeszkód regulaminowych. Endpoint JSON do potwierdzenia w DevTools.

### 5. BIP-y gmin
Zapytania ofertowe poniżej 130 tys. zł nie trafiają do BZP. To realne,
niewykorzystane źródło — ale rozproszone po kilkudziesięciu stronach.
Na etapie 0 sprawdź ręcznie 5 gmin z okolicy i zobacz, czy cokolwiek tam jest.

## Wykluczone — i dlaczego

| Źródło | Powód |
|---|---|
| **Oferia.com.pl** | Wolumen znikomy: 2 aktywne zlecenia w kategorii IT, ~96 w całym serwisie. Nie warto kodu. Konto załóż, ale traktuj jako tło. |
| **Oferteo.pl** | Regulamin XVII.5 wprost zakazuje masowego pozyskiwania danych o zapytaniach. Sankcja: blokada konta. Wolumen jest (28 zlecających w kuj-pom), ale tylko przez płatne leady. |
| **Fixly** | Regulamin pkt 3 ust. 16 zakazuje agregowania danych. Wolumen i tak niski: 9 zleceń na strony www tygodniowo w skali kraju. |
| **OLX** | Brak API do czytania, regulamin zakazuje agregacji, Cloudflare blokuje. Twoje własne ogłoszenia zostają jako kanał inbound. |
| **LinkedIn** | API nie daje odczytu feedu ani grup. Scraping łamie ToS. |
| **Zleca.pl, Favore.pl** | Sprawdzone: najnowsze zlecenie w kuj-pom z lutego 2026. Martwe. |
| **justjoin.it, Rocket Jobs** | To oferty pracy i długoterminowe B2B, nie jednorazowe zlecenia. |
