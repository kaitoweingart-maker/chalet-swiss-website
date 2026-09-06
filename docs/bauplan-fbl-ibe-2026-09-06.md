---
thema: fbl-ibe
datum: 2026-09-06
status: verdrahtet
repo: ~/Projects/chalet-swiss-website
plankey: fbl-ibe
weitere_repos:
  - ~/Projects/chalet-swiss-website (Gate-Auszug, Segment 1)
  - ~/Projects/hotel-mulin-website (Gate-Auszug, Segment 2)
  - ~/Projects/amanthos-living-website (Gate-Auszug, Segment 3)
grundlage: amanthos-ai-agents, Branch research/google-hotel-ads-2026-09-06, docs/research/google-hotel-ads-2026-09-06.md (Abschnitte 4 und 10)
---

# Bauplan: IBE-Umbau für Google Free Booking Links (Partnerweg über Adchieve)

> Entscheidungen des Inhabers vom 06.09.2026, nicht neu verhandeln: Partnerweg über einen
> Konnektivitätspartner mit Feed direkt aus Apaleo (Adchieve-Anfrage ist raus), keine
> Direktanbindung an Google. Start mit Hotel Chalet Swiss (HCSI), aber alle drei Sites
> werden parallel gebaut. NICHT im Bau: der Feed selbst (Partner), Sperrpreise (betrieblich
> über Restriktionen, Revenue Management), das Hotel-Center-Konto (Partner), Prize by
> Radisson (kein eigener IBE).
>
> **Scharfschalten:** Vor Beginn des Parallelbaus stellt der Inhaber `status:` in ALLEN
> VIER Plankopien auf `aktiv` (Master hier, drei Gate-Auszüge in den Site-Repos, Abschnitt
> 0a). Solange `draft` steht, sind Edit-Gate, Commit-Gate und PR-Check stumm.
> Segment-Branches heissen `segment/fbl-ibe/<nr>-<slug>`, im jeweiligen Repo; nur dort
> greifen die Gates. Segmentnummern sind über alle vier Repos eindeutig, ein Branchname
> nennt damit auch das Repo. Jeder Commit auf einem Segment-Branch trägt im Body den Block:
>
> ```
> Plan-Abgleich:
>   erledigt: <Abschnitte>
>   offen: <was aussteht>
>   abweichung: <keine | was anders gebaut wurde und warum>
> ```
>
> Bauagenten committen nach jedem Teilschritt, nicht erst am Ende (Regel vom 05.09.2026:
> stirbt ein Agent, ist nur der ungeschriebene Rest verloren). Überschreitet ein Segment die
> 400 Zeilen Produktivcode, hält der Agent an und meldet es; er teilt nicht selbst.

## 0. Trennlinie und Randbedingungen (gelten für jeden Schritt)

| Claude darf                                                                                | Nur der Inhaber                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Code in den Segment-Scopes der vier Repos schreiben, Branches pushen                       | Merge-Freigabe je PR                                                                 |
| Apaleo LESEN (`GET /booking/v1/offers`), den öffentlichen IBE-Endpunkt `/api/offers` lesen | `status: aktiv` in den vier Plankopien setzen                                        |
| Die Sites lokal über den Test-Harness (`tests/dev-server.py`, Mock-API) im Browser prüfen  | Die eine E2E-Testbuchung in Prod freigeben (Verdrahtung Schritt 6)                   |
| Im GA4-UI navigieren und die benutzerdefinierte Dimension vorbereiten                      | Render-Env, Branch-Protection, Adchieve-Vertrag, Hotel-List-Feed-IDs mit dem Partner |

- **Apaleo-Writes nur an einer Stelle, und dort nur um die Quelle ergänzt.** Der einzige
  Schreibpfad ist `_handle_booking` in `website-backend/server.py` (Segment 4). Dort wird der
  bestehende `POST /booking/v1/bookings` um das Feld `source` und zwei Kommentar-Token
  erweitert. Nichts am Zahlungsfluss, an Folios, Payment-Links, Promo-Logik, Kurtaxe-Buchung
  oder an `channelCode`. Kein Retry, keine neue Fehlerklasse. Roh-Fehler von Apaleo gehen wie
  bisher nie an den Client. Die bekannte Lücke (kein Outbox-Muster nach Invariante §1 in
  diesem Handler) besteht vor diesem Plan und wird hier weder vergrössert noch behoben.
- **Gästedaten:** Kein Segment liest, loggt oder committet Gästedaten. Test-Fixtures sind
  synthetisch (Angebote ohne Personenbezug, Buchungs-Mocks mit `"firstName": "Test"`).
  Neue Log-Zeilen tragen höchstens `booking_id` und den Quellwert. Wer ein Feld zeigen muss,
  schreibt `"email": "<redacted>"`.
- **Consent:** `gclid` bleibt consent-gebunden im bestehenden `tracking`-Objekt (meta.js,
  `_clean_tracking`). Die neue Buchungsquelle und die Kampagnenkennung (`utm_*` aus dem
  Deep Link) sind Kampagnenbezeichner, keine Personendaten; sie werden ohne Consent
  übertragen, nur im Speicher der aktuellen Seite gehalten und nie in `localStorage`
  geschrieben. Das ist gesetzt, weil der Kanal sonst unsichtbar bleibt (Inhaber bestätigt,
  Abschnitt 7).
- **Öffentliche Repos:** `chalet-swiss-website`, `hotel-mulin-website` und
  `amanthos-living-website` sind auf GitHub PUBLIC und werden komplett über GitHub Pages
  ausgeliefert (geprüft 06.09.2026). Alles, was dort landet (Plankopie, Tests, Fixtures),
  ist öffentlich. Deshalb: keine Sperrpreis-Grenzen, keine Rabattsätze, keine internen
  Adressen, keine Render-IDs in den Gate-Auszügen oder Tests der Site-Repos.
- **Der Ordner `amanthos-group-booking/website/` ist ein veralteter Spiegel** (714 Zeilen
  `booking.js` gegen 1'992 im Website-Repo, letzte Commits aus dem Frühjahr). Er steht in
  keinem Segment-Scope, sondern in den Sammelstellen, damit das Gate jeden Zugriff blockt.
  Massgeblich sind ausschliesslich die drei Website-Repos.
- Repo-Konventionen: `amanthos-group-booking` stdlib-pur, max 500 LOC je Datei, Tests je
  Sub-App, `print()`-Logging, keine Shared-Imports über Sub-App-Grenzen (Duplikat unter
  100 LOC ist erlaubt). Website-Repos: Vanilla JS ES5-Stil (`var`, keine Arrow-Functions in
  `booking.js`), keine Build-Stufe ausser dem Mulin-Minify, keine Dependencies.
- Kein Gedankenstrich in Texten, Commits, PR-Beschreibungen, Code-Kommentaren.

## 0a. Vier Repos, eine Plandatei: wo die Gates lesen

Geprüft am 06.09.2026 an `~/scripts/claude-hooks/segment-edit-gate.sh`,
`~/scripts/claude-hooks/bauplan-commit-gate.sh` (beide in `~/.claude/settings.json`
eingehängt) und `claude-mcp-setup/.github/workflows/plan-abgleich.yml`:

- **Repo-Wurzel:** Das Edit-Gate läuft von der Zieldatei aufwärts bis zum ersten `.git`
  (auch Worktree-Dateien). Das Commit-Gate nimmt `git rev-parse --show-toplevel`. Beide
  suchen dann `<wurzel>/docs/bauplan-fbl-ibe-YYYY-MM-DD.md` mit `status: aktiv`. **Jedes
  der vier Repos braucht deshalb eine eigene Plankopie unter genau diesem Pfad**, sonst ist
  das Gate dort stumm (fail-open).
- **Parser:** `bauplan-scope.sh` liegt in `~/scripts/` (identisch mit der Fassung in
  `claude-mcp-setup/scripts/`, `diff -q` am 06.09. leer). In KEINEM der vier Repos existiert
  `scripts/bauplan-scope.sh`; das ist auch nicht nötig, die Hooks finden `~/scripts/` zuerst,
  und der PR-Check trägt eine Inline-Kopie des Parserkerns.
- **Pfade in den Scope-Blöcken sind relativ zur Wurzel des Repos, in dessen `docs/` die
  Kopie liegt.** Dieser Master trägt die Blöcke aller Segmente; jeder Block beginnt mit einer
  `# repo: <name>`-Kommentarzeile (der Parser ignoriert `#`-Zeilen). Ein Branch
  `segment/fbl-ibe/1-…` existiert nur in `chalet-swiss-website`, dort matcht der Block von
  Segment 1; die Blöcke der übrigen Segmente matchen dort nie eine Datei und stören nicht.
- **Gate-Auszug statt Vollkopie in den Site-Repos.** Weil die drei Site-Repos öffentlich
  sind, bekommt jedes nur einen Auszug: Frontmatter (identisch bis auf `repo:`), Abschnitt 0,
  die Kontrakte K1, K1b, K2, K4, K6, K7, den eigenen Segment-Abschnitt (Auftrag, Scope,
  Kriterien, Out-of-Scope, Testplan), den Scope- und Kriterienblock von Segment 0 und den
  Sammelstellen-Block. Nicht in den Auszug: K3, K5, Segment 4, Segment 5, Abschnitt 1
  (gemessene Fakten), Abschnitt 5 und 7. Der Auszug ist ein Bauplan im Sinne des Formats,
  nur kürzer. Drift-Schutz: `~/scripts/bauplan-scope.sh files <auszug> <nr>` und
  `sammelstellen <auszug>` müssen Zeile für Zeile dem Master entsprechen (Kriterium in
  Segment 0).
- **Serverseitiger PR-Check:** Keines der vier Repos hat `plan-abgleich.yml` (geprüft
  06.09.). Segment 0 kopiert die Datei wörtlich aus `claude-mcp-setup` in alle vier Repos.
  Als Required Check wirkt sie erst, wenn der Inhaber sie in der Branch-Protection einträgt
  (Klickarbeit, Abschnitt 5). In `amanthos-group-booking` sind heute `Summary` und
  `review / L4` required; die Branch-Protection der drei Site-Repos wurde nicht abgefragt.
- **Nicht geprüft:** ob die Hooks auf der zweiten Maschine (Laptop) identisch installiert
  sind; dieser Plan wurde auf dem Studio geschrieben und dort gegen die installierten Hooks
  gelesen.

## 2. Segment 0: Kontrakte (sequenziell, vor allem anderen)

Vier Branches `segment/fbl-ibe/0-kontrakte`, je Repo ein PR, alle gemergt und auf `aktiv`
gestellt, bevor ein Segment der Welle 1 abzweigt. Kein Produktivcode; Deliverables sind die
Plankopien, die PR-Check-Kopie und die gemeinsamen Testvektoren.

**Dateien:**

```bauplan-scope segment=0
# repo: amanthos-group-booking
docs/bauplan-fbl-ibe-2026-09-06.md
.github/workflows/plan-abgleich.yml
# repo: chalet-swiss-website, hotel-mulin-website, amanthos-living-website (je Repo dieselben drei Pfade)
tests/fixtures/deeplink-cases.json
```

(Der Pfad `docs/bauplan-fbl-ibe-2026-09-06.md` und `.github/workflows/plan-abgleich.yml`
gelten in allen vier Repos; im Block stehen sie einmal, weil sie repo-relativ identisch sind.)

**Inhalt:**

1. Gate-Auszug nach Abschnitt 0a in jedes Site-Repo (Ordner `docs/` anlegen, existiert dort
   nicht). Status bleibt `draft`; der Inhaber stellt um.
2. `.github/workflows/plan-abgleich.yml` wörtlich aus `claude-mcp-setup` in alle vier Repos
   (Datei ist selbsttragend, braucht kein Secret und läuft bei Nichtzuständigkeit grün).
3. `tests/fixtures/deeplink-cases.json` in den drei Site-Repos, byte-identisch, aus K1
   abgeleitet (mindestens die 18 Fälle aus K1). Die Site-Tests der Segmente 1 bis 3 laufen
   gegen diese Datei.
4. Das Microdata-Skelett K2 noch einmal wörtlich gegen die Google-Referenzseite abgleichen
   (der Plan hat sie am 06.09. nur als Zusammenfassung gelesen). Abweichungen in K2 im
   Master und in den Auszügen korrigieren, BEVOR Welle 1 startet. Erledigt am 06.09.2026,
   zwei Korrekturen: DateTime statt Datum für `checkinTime`/`checkoutTime`, und nur noch
   eine typisierte Kurtaxe-Komponente statt der untypisierten Komponenten Room und City tax.

Die übrigen Kontrakte sind in diesem Plan fixiert und für alle Segmente bindend:

### K1: Deep-Link-Parameter und Validierung (deeplink.js, alle drei Sites)

Query-Parameter, alle optional; ein Deep Link „zählt" nur, wenn `arrival` und `departure`
gültig sind. Gross-/Kleinschreibung der Parameternamen exakt wie hier.

| Parameter                                  | Regel                                                                                                                                                                                                                               | Ungültig heisst                                                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `property`                                 | Apaleo-Property-Code. Chalet: nur `HCSI`; Mulin: nur `MUBRIG`; Living: `GBAL`, `GNBE`, `NYAL`, dort Pflicht                                                                                                                         | Chalet/Mulin: fehlt → Site-Code annehmen; fremder Wert → `search = null`. Living: fehlt oder fremd → `search = null`                                |
| `arrival`, `departure`                     | `YYYY-M-D` mit ein- oder zweistelligem Monat/Tag, normalisiert auf `YYYY-MM-DD`; echtes Kalenderdatum; `arrival >= heute` (lokales Browserdatum, Mitternacht); `departure > arrival`; Nächte `<= 30`; `arrival <= heute + 365 Tage` | `search = null` (stille Rückkehr zur normalen Startseite, keine Autosuche, kein Dialog, kein Fehler in der Konsole)                                 |
| `adults`                                   | Ganzzahl `1..MAX` der Site bzw. des Hauses                                                                                                                                                                                          | fehlt → 2; ausserhalb → auf den Rand geklemmt, Suche läuft                                                                                          |
| `children`                                 | Ganzzahl `0..(MAX - adults)`                                                                                                                                                                                                        | fehlt → 0; ausserhalb → geklemmt                                                                                                                    |
| `lang`                                     | erste zwei Zeichen, kleingeschrieben, ISO 639-1                                                                                                                                                                                     | nicht unterstützt → `en` (Änderung in `i18n.js`: ein vorhandener, aber unbekannter `?lang=` fällt auf `en`, nicht mehr auf Storage/Browser/Default) |
| `room`                                     | Apaleo-UnitGroup-Id oder -Code (`HCSI-DZSU` oder `DZSU`), Vergleich case-insensitiv, mit oder ohne Property-Präfix                                                                                                                  | kein Treffer → keine Vorauswahl, Liste normal                                                                                                       |
| `rate`                                     | Apaleo-RatePlan-Id oder -Code (`HCSI-NONREFBB_IBE` oder `NONREFBB_IBE`), gleiche Vergleichsregel                                                                                                                                    | kein Treffer → keine Vorauswahl                                                                                                                     |
| `utm_source`, `utm_medium`, `utm_campaign` | nach Trim `^[A-Za-z0-9._-]{1,64}$`                                                                                                                                                                                                  | einzeln verworfen                                                                                                                                   |
| `ucur`                                     | drei Buchstaben, Grossschreibung                                                                                                                                                                                                    | verworfen; dient nur der Analyse, die IBE bleibt CHF                                                                                                |
| `gtotal`                                   | `^\d+(\.\d{1,2})?$` (Google-Gesamtpreis wie angezeigt)                                                                                                                                                                              | verworfen                                                                                                                                           |
| `gverify`                                  | `true` → Google-Prüfklick                                                                                                                                                                                                           | alles andere ignoriert                                                                                                                              |
| `gclid`                                    | wird von `deeplink.js` NICHT gelesen; `meta.js` behandelt ihn bereits (consent-gebunden)                                                                                                                                            |                                                                                                                                                     |

Quellableitung (deterministisch, in dieser Reihenfolge):

1. `gverify=true` → `source = 'google_verify'`
2. `utm_source == 'google'` und `utm_campaign` beginnt mit `hotel-` und `utm_medium == 'organic'` → `google_fbl`
3. dito mit `utm_medium == 'cpc'` → `google_hotel_ads`
4. sonst `source = null`

Rückgabe von `parse(search, cfg)`:

```
{
  search:    null | { property, arrival, departure, adults, children, lang },
  preselect: null | { room, rate },            // nur wenn mindestens eines gesetzt
  source:    null | 'google_fbl' | 'google_hotel_ads' | 'google_verify',
  campaign:  null | { utm_source, utm_medium, utm_campaign },   // nur gültige Felder
  google:    null | { ucur, gtotal }
}
```

`cfg = { today: Date, properties: { <code>: <MAX> }, langs: [ ... ], defaultProperty: <code>|null }`.
`source`, `campaign` und `google` werden auch dann geliefert, wenn `search` null ist.
`property` wird case-insensitiv erkannt und als kanonischer Code zurückgegeben; `lang` fehlt →
`null` (die Site behält ihre eigene Sprachwahl); `adults` ohne Zahl → 2, `children` ohne Zahl → 0;
`room` und `rate` werden getrimmt und in Grossbuchstaben normalisiert zurückgegeben (der
Vergleich mit den Angeboten bleibt case-insensitiv, mit oder ohne Präfix), fehlt eines,
steht dort `null`; `campaign` trägt nur die gültigen Schlüssel, ungültige fehlen; `ucur` gilt
nur exakt als drei Grossbuchstaben; `google` trägt immer beide Schlüssel (`ucur`, `gtotal`,
ungültig → `null`) und ist als Ganzes null, wenn beide ungültig sind. Die Testvektoren
`tests/fixtures/deeplink-cases.json` sind ein JSON-Array dieser Fälle (46 Fälle, Stand
06.09.2026) und in den drei Site-Repos byte-identisch.

Testvektoren (`tests/fixtures/deeplink-cases.json`, Format je Fall
`{ "name", "query", "today", "site": { "properties", "langs", "defaultProperty" }, "expect" }`),
mindestens: gültiger FBL-Klick HCSI; gültiger Ads-Klick; Prüfklick; Anreise gestern;
Abreise gleich Anreise; 31 Nächte; Anreise 366 Tage voraus; einstelliger Monat/Tag;
`adults=9` (Klemmung auf MAX); `children` über Rest; `lang=ko` auf Chalet (→ `en`);
`lang=DE`; unbekanntes `property` auf Chalet; fehlendes `property` auf Living; Living
`NYAL` mit `adults=4` und `children=1` (Klemmung); `room`/`rate` mit und ohne Präfix;
`utm_campaign` mit Sonderzeichen; nur `utm_*` ohne Daten (search null, source gesetzt).

### K1b: Einbindung in booking.js (alle drei Sites)

- `js/deeplink.js` definiert `window.amDeepLink = { parse, VERSION: '1' }`, exportiert
  zusätzlich `module.exports` (für `node --test`), und feuert nach der Definition
  `document.dispatchEvent(new CustomEvent('am:deeplink-ready'))`.
- `js/booking.js` hält den Zustand in `var deepLink = null;` und bindet so ein:
  `if (window.amDeepLink) applyDeepLink(); else document.addEventListener('am:deeplink-ready', applyDeepLink, { once: true });`
  Ohne `deeplink.js` (bis die Verdrahtung den Script-Tag setzt) passiert nichts; der Code
  ist inert und kann gefahrlos gemergt werden.
- `applyDeepLink()`: `parse(location.search, cfg)`; bei `search`: Kalender setzen
  (`cal.checkin`/`cal.checkout` als Date, `syncInputs()`), Belegung in die Hidden-Inputs,
  Label aktualisieren, Living zusätzlich `selectLocation(property)`, Sprache über den
  bestehenden `?lang=`-Pfad von `i18n.js`, dann `searchBtn.click()` (so feuert
  `search_availability` über den bestehenden Handler). Nach `renderOffers`: Vorauswahl über
  `room`/`rate` per `selectOffer(index)` beim ersten Treffer. Kein eigener Fetch-Pfad, kein
  Umbau der Suche.
- Google-Policy: Der Klick muss ohne Zwischenseite zum Preis führen. Das bestehende
  Consent-Banner (`consent.js`, fixierte Leiste unten, kein Overlay) bleibt, weil es den
  Preis nicht verdeckt.

### K2: Microdata auf der Angebotsseite (Rendering in booking.js, alle drei Sites)

Skelett nach Googles Referenz „Hotel Price Structured Data"
(developers.google.com/hotels/hotel-prices/structured-data/hotel-price-structured-data, am
06.09.2026 in Segment 0 wörtlich abgeglichen: Microdata empfohlen, JSON-LD für die
Preisprüfung veraltet; `checkinTime`/`checkoutTime` sind DateTime, nicht Datum; ein
`priceComponent` braucht `priceComponentType`, Google kennt Discount, ResortFee, GenericTax,
ServiceFee, TransferFee; `price` ist der Gesamtbetrag inklusive aller Steuern und Gebühren;
Hotel braucht `name`, `identifier`, `makesOffer`, `address` ist optional). Alles innerhalb von `#offersGrid`, das `renderOffers` ohnehin
neu schreibt. Das bestehende JSON-LD `Hotel` im `<head>` bleibt unverändert (anderer Zweck,
kein Konflikt).

```html
<div itemscope itemtype="https://schema.org/Hotel" data-am-microdata="1">
  <meta itemprop="name" content="Hotel Chalet Swiss Interlaken" />
  <meta itemprop="identifier" content="HCSI" />
  <!-- je Angebot: die bestehende .offer-card wird zum Offer-Knoten -->
  <div
    class="offer-card …"
    itemprop="makesOffer"
    itemscope
    itemtype="https://schema.org/Offer https://schema.org/LodgingReservation"
  >
    <meta itemprop="availability" content="https://schema.org/InStock" />
    <meta itemprop="checkinTime" content="2026-10-10T15:00:00" />
    <meta itemprop="checkoutTime" content="2026-10-12T11:00:00" />
    <meta itemprop="numAdults" content="2" />
    <meta itemprop="numChildren" content="0" />
    <div
      itemprop="priceSpecification"
      itemscope
      itemtype="https://schema.org/CompoundPriceSpecification"
    >
      <meta itemprop="price" content="638.95" />
      <meta itemprop="priceCurrency" content="CHF" />
      <!-- nur wenn die Kurtaxe separat ausgewiesen ist -->
      <div
        itemprop="priceComponent"
        itemscope
        itemtype="https://schema.org/UnitPriceSpecification"
      >
        <meta itemprop="name" content="City tax" /><meta
          itemprop="priceComponentType"
          content="GenericTax"
        /><meta itemprop="price" content="14.00" /><meta
          itemprop="priceCurrency"
          content="CHF"
        />
      </div>
    </div>
    … bestehender sichtbarer Karteninhalt …
  </div>
</div>
```

Regeln:

- `identifier` = Apaleo-Property-Code (`HCSI`, `MUBRIG`, `GBAL`, `GNBE`, `NYAL`). Das ist
  zugleich die Hotel-ID, die mit Adchieve für den Hotel-List-Feed festzulegen ist (offen,
  Abschnitt 7); ändert sich die Feed-ID, ändert sich nur diese eine Konstante.
- `price` = **genau der Bruttobetrag, den die Karte sichtbar zeigt**: Zimmerpreis (wie von
  `/api/offers` geliefert, bereits gerundet) plus Kurtaxe, wenn `cityTax.included == false`
  und `cityTax.amount > 0` (skaliert auf die Personen so, wie die Karte es tut); bei
  `included == true` (MUBRIG) nur der Zimmerpreis. Zwei Nachkommastellen, keine
  Währungszeichen im Wert. Hotel Center: „Structured data should match the visual elements".
- `checkinTime` und `checkoutTime` als DateTime: Anreisedatum mit `T15:00:00`, Abreisedatum
  mit `T11:00:00` (Site-Konstanten, an die Hausregeln angepasst, falls das JSON-LD im `<head>`
  andere Zeiten nennt).
- Genau eine `priceComponent` (`name` City tax, `priceComponentType` GenericTax), und nur,
  wenn die Kurtaxe separat ausgewiesen ist. Keine Komponente für den Zimmerpreis; bei MUBRIG
  und bei Häusern ohne separate Kurtaxe gar keine Komponente. Google verlangt zu jeder
  Komponente einen Typ, und für den Zimmerpreis gibt es keinen.
- Keine Angebote: ein einziger `Offer`-Knoten mit `availability` =
  `https://schema.org/SoldOut`, `checkinTime`/`checkoutTime`/`numAdults`/`numChildren`, OHNE
  `priceSpecification`, gerendert im bestehenden `no-offers`-Zweig.
- Living: die Karte MUSS die Kurtaxe-Zeile für `included == false` neu anzeigen (heute
  fehlt sie, gemessen NYAL 18.00), sonst stimmen Sichtbares und Microdata nicht überein.
  Anzeige: `+ CHF 18.00 Kurtaxe` und Bruttosumme, dazu der Hinweis, dass sie separat
  belastet wird; dieselbe Zeile in der Preiszusammenfassung vor den Gästeangaben
  (Referral-Policy: Gesamtpreis vor der ersten Eingabe). Der Zahlbetrag (`totalAmount`)
  bleibt unverändert.
- Der Microdata-Typ `Hotel` gilt auch für Living; ob Google Living als Hotel oder
  Apartment einstuft, ist offen (Abschnitt 7) und ändert höchstens den `itemtype`.

### K4: Conversion-Messung über gtmPush (alle drei Sites)

- `deepLink.source` wird als Merkmal `source` in das `data`-Objekt von genau drei
  Ereignissen aufgenommen: `search_availability`, `view_offers`, `booking_confirmed`. Werte
  wie in K1; fehlt die Quelle, fehlt das Merkmal.
- `ga4Event` reicht es als Parameter `booking_source` bei genau diesen drei Ereignissen
  weiter (die Parameterliste bleibt abschliessend; nichts anderes wandert mit).
- `plausibleEvent` bleibt unverändert; die Whitelist `location`, `nights`, `step` wird
  nicht angefasst. Plausible attribuiert Sitzungen ohnehin über `utm_*` der Landing-URL.
- `adsEvent` bekommt zusätzlich `id: <Property-Code>` (Googles optionaler Hotel-Parameter).
  `start_date`/`end_date` (Reisedaten) werden NICHT gesendet; das widerspräche der
  bestehenden Regel „keine Reisedaten an GA4/Ads" und FBL braucht sie nicht (offen für den
  Inhaber, Abschnitt 7).
- Zwei neue Ereignisse: `deeplink_applied` `{ step: 'deeplink', source }` einmal nach
  erfolgreicher Autosuche; `deeplink_price_mismatch` `{ step: 'deeplink', delta }` einmal
  nach `renderOffers`, wenn `google.gtotal` vorlag und der Bruttopreis des vorausgewählten
  (sonst des günstigsten) Angebots um mehr als 0.05 CHF abweicht (`delta` = IBE minus
  Google, auf 0.05 gerundet). `ga4Event` bekommt je einen `case` (`booking_source`
  beziehungsweise `delta`), Plausible sieht nur `step`.
- `google_verify` wird wie eine Quelle geführt, damit Prüfklicks in GA4 filterbar sind;
  in Plausible sind sie nicht unterscheidbar (bekannte Grenze, kein Umbau).

### K6: Landingpage-Vorlage für Adchieve (Verdrahtung übergibt sie dem Partner)

```
https://chalet-swiss.ch/?property=(PARTNER-HOTEL-ID)&arrival=(CHECKINYEAR)-(CHECKINMONTH)-(CHECKINDAY)&departure=(CHECKOUTYEAR)-(CHECKOUTMONTH)-(CHECKOUTDAY)&adults=(NUM-ADULTS)&children=(NUM-CHILDREN)&room=(PARTNER-ROOM-ID)&rate=(RATE-PLAN-ID)&lang=(USER-LANGUAGE)&ucur=(USER-CURRENCY)&gtotal=(PRICE-DISPLAYED-TOTAL)&utm_source=google&utm_medium=(IF-AD-CLICK)cpc(ELSE)organic(ENDIF)&utm_campaign=hotel-(IF-AD-CLICK)ads(ELSE)fbl(ENDIF)&gverify=(VERIFICATION)
```

Dieselbe Vorlage mit Host `https://hotelmulin.ch/` und `https://www.amanthosliving.com/`
(Pages-URLs am 06.09. abgefragt). `(PARTNER-HOTEL-ID)` muss dem Apaleo-Property-Code
entsprechen (mit Adchieve festlegen). Ob Google `(CHECKINMONTH)`/`(CHECKINDAY)` mit
führender Null liefert, ist unbelegt; K1 akzeptiert beides. Für bezahlte Klicks kommt
`gclid={gclid}` über das Final-URL-Suffix in Google Ads dazu, das `meta.js` bereits liest.

### K7: Test-Harness der Sites, Locale-Schlüssel, env

- Jedes Site-Segment liefert `tests/dev-server.py` (stdlib, unter 120 Zeilen, kein
  Produktivcode): serviert das Repo-Verzeichnis, schreibt beim Ausliefern von
  `js/booking.js` den API-Host auf `''` (gleiche Origin, kein CORS), fügt in `index.html`
  vor dem `booking.js`-Tag `<script src="./js/deeplink.js" defer></script>` ein, stubbt
  `window.gtag` (zeichnet Aufrufe in `window.__gtagCalls` auf), beantwortet `GET /health`,
  `GET /api/offers` aus `tests/fixtures/offers-<code>.json` (mit `?fixture=empty` leer) und
  `POST /api/bookings` mit einem synthetischen Erfolg, und protokolliert den empfangenen
  Buchungs-Body auf stdout. Mulin: liefert `index.html` mit `js/booking.js` statt
  `js/booking.min.js` und `js/local-api.js` als leere Datei aus (sonst zieht der
  `localhost`-Override auf Port 3002). Sammelstellen werden dabei nie geschrieben, nur
  beim Ausliefern im Speicher umgeschrieben.
- Living braucht neue Locale-Schlüssel in sieben Dateien (Sammelstelle, Verdrahtung):
  `booking.citytax` („Kurtaxe"), `booking.citytax_separate_note` („wird separat
  belastet"), `booking.summary_total` („Gesamt"), falls nicht vorhanden. Der Code nutzt
  `window.t ? window.t(key) : fallback` mit englischem Fallback, damit die Seite vor der
  Verdrahtung nicht bricht.
- Keine neue env-Variable in diesem Plan.

**Akzeptanzkriterien:**

```bauplan-kriterien segment=0
- [ ] Vier Plankopien liegen unter docs/bauplan-fbl-ibe-2026-09-06.md (Master in amanthos-group-booking, Gate-Auszug in den drei Site-Repos); ~/scripts/bauplan-scope.sh files <auszug> <nr> und sammelstellen <auszug> liefern je Site Zeile fuer Zeile dieselbe Ausgabe wie am Master (diff -u zitiert, leer)
- [ ] Die Auszuege enthalten keine Sperrpreis-Grenzen, keine Rabattsaetze, keine internen Mailadressen, keine Render-IDs (grep-Beleg zitiert)
- [ ] .github/workflows/plan-abgleich.yml in allen vier Repos byte-identisch mit claude-mcp-setup (sha256 zitiert); Workflow laeuft auf dem PR und endet gruen mit "nicht zustaendig"
- [ ] tests/fixtures/deeplink-cases.json in den drei Site-Repos byte-identisch (sha256 zitiert), mindestens 18 Faelle nach K1, JSON parsebar (python3 -m json.tool Exit 0)
- [ ] K2-Skelett gegen die Google-Referenzseite woertlich abgeglichen; Ergebnis (identisch oder korrigiert, mit Fundstelle) im PR-Text
- [ ] Kein weiterer Datei-Diff; status bleibt draft, Umstellen auf aktiv macht der Inhaber
```

**Hängt ab von:** nichts (Plan im Zustand `draft`). Danach: Inhaber stellt `aktiv`.
**Diff:** kein Produktivcode.

## 3. Segmente (parallel, nach Merge von Segment 0 und `status: aktiv`)

Alle fünf zweigen von `origin/main` des jeweiligen Repos ab, arbeiten im eigenen Worktree,
pushen, erstellen keinen PR und mergen nichts. Die drei Site-Segmente sind inert, bis die
Verdrahtung den Script-Tag setzt; Segment 4 ist inert, bis ein Frontend `bookingSource`
sendet (oder ein Consent-Gast mit FBL-UTM bucht).

### Segment 1: chalet-swiss-website (HCSI): Deep Link, Microdata, Quelle, Conversion

- **Datei-Scope (exklusiv):**
  ```bauplan-scope segment=1
  # repo: chalet-swiss-website
  js/deeplink.js
  js/booking.js
  js/i18n.js
  tests/deeplink.test.mjs
  tests/dev-server.py
  tests/fixtures/offers-hcsi.json
  ```
- **Auftrag:** `js/deeplink.js` nach K1/K1b als reine Funktion bauen (Browser-Global plus
  `module.exports`), `js/booking.js` um die Einbindung (K1b), das Microdata-Rendering (K2),
  die Payload-Felder `bookingSource`/`campaign` (K3, Frontend-Seite) und die Ereignisse und
  Merkmale aus K4 erweitern, `js/i18n.js` um den `en`-Fallback (K1). Testvektoren aus
  `tests/fixtures/deeplink-cases.json` (Segment 0) mit `node --test` fahren; Browserprüfung
  über `tests/dev-server.py` (K7) mit `tests/fixtures/offers-hcsi.json` (synthetisch, an
  der Form des Live-Endpunkts orientiert, mit `cityTax.included = false`).
- **Akzeptanzkriterien:**
  ```bauplan-kriterien segment=1
  - [ ] node --test tests/ Exit 0, Testzahl zitiert; alle Faelle aus tests/fixtures/deeplink-cases.json laufen durch parse() (Zahl der Faelle = Zahl der Tests plus eigene)
  - [ ] Harness: http://localhost:8080/?property=HCSI&arrival=<heute+30>&departure=<heute+32>&adults=2&children=0&lang=en&utm_source=google&utm_medium=organic&utm_campaign=hotel-fbl zeigt OHNE Klick die Angebotsliste aus dem Fixture, die Daten im Widget, html[lang=en]; #offersGrid enthaelt genau einen [itemtype~=Hotel]-Knoten mit meta[itemprop=identifier][content=HCSI]; jede .offer-card traegt itemprop=makesOffer und meta[itemprop=price] gleich dem sichtbaren Bruttobetrag (Zimmer plus Kurtaxe), genau eine priceComponent City tax mit priceComponentType GenericTax, checkinTime/checkoutTime als DateTime; DevTools-Ausgabe zitiert
  - [ ] Dieselbe URL plus &room=HCSI-DZSU&rate=NONREFBB_IBE: genau diese Karte ist .selected und das Gaesteformular sichtbar; mit &room=GIBTESNICHT keine Auswahl, kein Fehler
  - [ ] ?arrival=2020-01-01&departure=2020-01-03: keine Autosuche, kein Dialog, keine unbehandelte Ausnahme in der Konsole (Konsole zitiert); ?lang=ko fuehrt zu html[lang=en]
  - [ ] Harness mit ?fixture=empty: #offersGrid enthaelt einen Offer-Knoten mit availability=https://schema.org/SoldOut und ohne meta[itemprop=price]
  - [ ] Formular im Harness abgeschickt: der vom Mock protokollierte Body enthaelt bookingSource "google_fbl" und campaign {google, organic, hotel-fbl}; ohne Consent fehlt tracking wie bisher; ohne Deep Link fehlen beide neuen Felder
  - [ ] window.__gtagCalls: search_availability, view_offers und purchase tragen booking_source "google_fbl"; der conversion-Aufruf traegt id "HCSI"; deeplink_applied gefeuert; mit &gtotal=999 feuert deeplink_price_mismatch mit delta
  - [ ] git diff zeigt keine Aenderung in plausibleEvent (Hunk-Liste zitiert); index.html, locales/, css/ unangetastet
  - [ ] Produktivcode-Diff (js/deeplink.js, js/booking.js, js/i18n.js zusammen) hoechstens 400 Zeilen laut git diff --stat; darueber: anhalten und melden
  - [ ] Kein Datei-Diff ausserhalb des Scopes; jeder Commit mit Plan-Abgleich-Block
  ```
- **Out-of-Scope:** `index.html` (Script-Tag kommt in der Verdrahtung), `locales/`,
  `js/meta.js`, `js/consent.js`, jede Änderung an Suche, Zahlung, Promo oder Upsell.
- **Testplan:** `node --test tests/` (Exit-Code, Testzahl); `python3 tests/dev-server.py`
  und die Kriterien-URLs im Chrome-Pool (`evaluate_script`-Ausgaben zitieren).
- **Hängt ab von:** Segment 0 (Fixture, K1 bis K4, K7).
- **Diff geschätzt:** ~290 Zeilen Produktivcode (deeplink.js ~120, booking.js ~160,
  i18n.js ~10), dazu ~250 Zeilen Tests und Harness.

## 4. Sammelstellen (nur die Verdrahtung fasst sie an)

```bauplan-scope sammelstellen
# Site-Repos (jede Zeile relativ zur Wurzel des Site-Repos)
index.html
js/booking.min.js
locales/*
# amanthos-group-booking
website/*
render.yaml
.env.example
requirements.txt
requirements-dev.txt
website-backend/requirements.txt
scripts/requirements.txt
pyproject.toml
package.json
package-lock.json
```

- `index.html` (drei Sites): `<script src="./js/deeplink.js" defer>` vor `booking.js`;
  Mulin zusätzlich der Cache-Bust `?v=…` an `booking.min.js`.
- `js/booking.min.js` (Mulin): Neubau mit `npx esbuild js/booking.js --minify --target=es2017 --outfile=js/booking.min.js`.
- `locales/*` (Living, sieben Dateien): die drei Schlüssel aus K7. Chalet und Mulin: nach
  heutigem Stand kein neuer Schlüssel; sollte ein Segment einen brauchen, meldet es das mit
  englischem Fallback im Code.
- `website/*`: der veraltete Spiegel. Kein Eintrag fällig, der Pfad steht hier, damit das
  Gate jeden Zugriff blockt.
- `render.yaml`, `.env.example`, die vier `requirements*`-Dateien, `pyproject.toml`,
  `package.json`, `package-lock.json`: kein Eintrag geplant; sie stehen hier, damit kein
  Segment „nur schnell" eine Dependency, ein `testpaths`-Element oder eine env einführt.
  Einzige mögliche Verdrahtungsänderung: `scripts/tests` in `testpaths` aufnehmen, falls der
  Inhaber den Paritätsprüfer in der CI sehen will (Abschnitt 5, Schritt 9).
- Zwei Sammelstellen der Sache nach, die NICHT im Block stehen können, weil der Kontrakt
  „Sammelstellen schlagen Segment-Scope" sonst Segment 0 beziehungsweise 4 blockierte:
  `.github/workflows/` (Segment 0 legt dort `plan-abgleich.yml` an; für Segmente 1 bis 5
  ist der Ordner tabu, ihr Edit-Gate blockt ihn ohnehin, weil er in keinem ihrer Scopes
  steht) und die Dispatch-Tabellen in `website-backend/server.py` (Segment 4 besitzt die
  Datei; dass keine Route entsteht, erzwingt das Kriterium mit der Hunk-Liste, in der
  Verdrahtung nachgeprüft).

## 6. Parallelisierungsplan

| Welle  | Segmente                                                                                                                 | läuft gleichzeitig           | wartet auf                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------ |
| 0      | Segment 0 (vier Repos, vier PRs)                                                                                         | allein                       | Freigabe des Plans; danach `status: aktiv` durch den Inhaber |
| 1      | Segmente 1, 2, 3 (je Site-Repo), 4 und 5 (group-booking, disjunkte Dateien)                                              | ja, fünf Worktrees           | Segment 0 gemergt und aktiv in allen vier Repos              |
| 2      | Verdrahtung Schritte 2 bis 4 (Backend zuerst, dann HCSI, Mulin, Living)                                                  | ein Kopf, sequenziell        | Segmente 1 bis 5 gemergt                                     |
| 3      | Verdrahtung Schritte 5 bis 8 (GA4, E2E-Testbuchung, Paritätslauf, Übergabe)                                              | ein Kopf                     | Welle 2 live                                                 |
| extern | Adchieve-Onboarding, Feed, Hotel Center, Matching                                                                        | parallel zu allem ab Welle 0 | Vertrag (Inhaber)                                            |
| später | Feed-Export in den Paritätsprüfer (eigenes Mini-Segment), Living-Kurtaxe online (eigener Entscheid), Hotel-Ads-Test 2027 |                              | Partnerdaten, Inhaber                                        |

Bewusst NICHT parallelisiert: die Verdrahtung als Ganzes (Sammelstellen, Minify, Live-Prüfung
und die eine Testbuchung gehören einem Kopf); Segment 4 wird vor den Sites verdrahtet, damit
das Backend `bookingSource` kennt, bevor ein Frontend es sendet. Nicht künstlich geteilt:
Deep Link, Microdata und Merkmale je Site liegen in derselben Datei `booking.js` und bilden
ein Segment; der Schnitt in Datei-Teile hätte Hook-Punkte in Segment 0 verlangt, die mehr
kosten als sie sparen.

## 8. Bewusst nicht geplant

- Der Preis- und Verfügbarkeitsfeed (Adchieve), das Hotel-Center-Konto, das Matching.
- Sperrpreise durch Restriktionen ersetzen (betrieblich, Revenue Management, YieldPlanet).
- Prize by Radisson (kein eigener IBE).
- Wechsel von `channelCode` auf `Ibe`; `Hotel Direct` als Quelle aller IBE-Buchungen.
- Online-Einzug der NYAL-Kurtaxe; EUR-Anzeige in der IBE.
- Offline-Conversion-Upload (Data Manager API) und Google-Ads-API-Zugang.
- Server-seitig gerendertes Landing-Endpoint als Ausweichlösung, falls Googles Validator
  kein JavaScript ausführt.
- Outbox und Read-after-write für `_handle_booking` (bestehende Lücke, eigener Plan).
- Hook-Punkte in `booking.js`, die Deep Link, Microdata und Merkmale auf mehrere Dateien
  verteilt hätten; drei zusätzliche Segmente und ein grösseres Segment 0 für null Zeitgewinn.
- Der Spiegel `amanthos-group-booking/website/` (nur gesperrt, nicht gelöscht; Löschung
  ist ein eigener Aufräum-PR).

## 9. Was beim Schreiben dieses Plans nicht geprüft werden konnte

- Ob Googles Validator JavaScript rendert (Primärseiten schweigen).
- Ob Apaleo `source` auf Kanal `Direct` annimmt und ob Fremdwerte abgelehnt werden.
- Ob die `*_IBE`-Ratenpläne auf beiden Kanälen `Direct` und `Ibe` liegen (der
  Paritätsprüfer misst es in Schritt 7).
- Googles numerische Toleranz und das Zero-Padding der Datumsvariablen.
- Die Branch-Protection der drei Site-Repos, und ob `ALLOW_LOCALHOST` auf dem Prod-Dienst
  gesetzt ist (angenommen: nein; deshalb der Mock-Harness).
- Ob die Hooks auf dem Laptop identisch installiert sind (nur Studio geprüft).
- Das Microdata-Skelett K2 wörtlich gegen Googles Beispiel (nur Zusammenfassung gelesen;
  Abgleich ist Kriterium in Segment 0).
