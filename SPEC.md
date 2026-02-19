# Schema-Program — Komplett Systemspecifikation v1.0

> **Senast uppdaterad:** 2026-02-19
> **Status:** Godkänd av projektägare
> **Plattform:** UI-only / GitHub Pages (HTML + CSS + vanilla JS, ESM-moduler)
> **Persistens:** localStorage (ingen server/backend)

---

## Innehåll

1. [Kärnidé](#1-kärnidé)
2. [Systemöversikt](#2-systemöversikt)
3. [Nivåer](#3-nivåer)
4. [Datamodell](#4-datamodell)
5. [Veckomall-systemet](#5-veckomall-systemet)
6. [Beräkningsperiod](#6-beräkningsperiod)
7. [Regelmotor](#7-regelmotor)
8. [AI-schemaläggning](#8-ai-schemaläggning)
9. [Frånvarohantering](#9-frånvarohantering)
10. [X-dagar (extra ledighetsdagar)](#10-x-dagar-extra-ledighetsdagar)
11. [Vakans-system](#11-vakans-system)
12. [Dashboard & Statistik](#12-dashboard--statistik)
13. [Hjälpsystem](#13-hjälpsystem)
14. [Designbeslut (15 punkter)](#14-designbeslut-15-punkter)
15. [AO-plan (byggordning)](#15-ao-plan-byggordning)
16. [Terminologi](#16-terminologi)
17. [Arbetsregler för utveckling](#17-arbetsregler-för-utveckling)
18. [Filstruktur](#18-filstruktur)

---

## 1. Kärnidé

En restaurangchef lägger in sin personal och sina passmallar, skapar veckomallar som
beskriver bemanningsbehov, och får sedan **AI-stödd hjälp att fylla ett schema** över
varje persons beräkningsperiod — med hänsyn till arbetstidsregler, tillgänglighet,
X-dagar, frånvaro, kompetens och rättvis fördelning.

Vid beräkningsperiodens slut ska timmarna gå jämnt ut.

---

## 2. Systemöversikt

### Flöde — Hur systemet används

```
1. SETUP (görs en gång, uppdateras sällan)
   ├── Lägg in personal (namn, grad, arbetsdagar, tillgänglighet, grupper)
   ├── Skapa arbetsgrupper (Kök, Bar, Servering, ...)
   ├── Skapa grundpass/passmallar (Lunch 10-15, Kväll 17-01, ...)
   ├── Koppla grundpass till grupper
   └── Skapa veckomallar ("Standardvecka", "Sommarvecka", "Julvecka")

2. KALENDERPLANERING (görs inför varje period)
   ├── Tilldela veckomall till varje kalendervecka
   ├── Gör dag-overrides vid behov (storbokning, röd dag, etc)
   └── Registrera känd frånvaro (semester, föräldraledighet, etc)

3. SCHEMALÄGGNING (görs per beräkningsperiod)
   ├── AI fyller schemat baserat på veckomallar + regler
   ├── Markerar VAKANS där ingen eligible personal finns
   ├── Chefen granskar, justerar, tilldelar manuellt vid behov
   └── Chefen låser veckor som är klara

4. DRIFT (löpande)
   ├── Registrera frånvaro i efterhand (sjukdom, VAB, etc)
   ├── Hantera vakanser (framtid: SMS till vikarier)
   └── Följ upp på dashboard (timbalans, kostnad, X-dagar)

5. EXPORT (vid behov)
   ├── Skriv ut veckovy (för uppsättning i köket)
   ├── Exportera schema som CSV/Excel
   └── Backup/restore av all data
```

### Vad systemet INTE gör

| Utanför scope | Varför |
|---------------|--------|
| Löneberäkning | Visar kostnad som info, räknar inte faktisk lön |
| Juridisk semesterhantering | Planering, inte "sanningen" enligt lagen |
| Användarhantering / roller | En användare (demo) i v1 |
| Backend / databas | Allt i localStorage, UI-only |
| Faktisk SMS-utskickning | Förberett i datamodellen, inte implementerat i v1 |

---

## 3. Nivåer

### Nivå 1 — MVP (grunddata måste fungera felfritt)

- **Personal:** Skapa/redigera/ta bort. Namn, empNo, tjänstgöringsgrad %, arbetsdagar/vecka,
  tillgänglighet per veckodag, koppling till 1+ grupper, anställningstyp (regular/substitute),
  beräkningsperiod-start (redigerbart, default = anställningsdatum)
- **Grupper:** Skapa/redigera/ta bort. Visa medlemmar. Koppla till grundpass.
- **Grundpass (passmallar):** Skapa/redigera/ta bort. Start/slut/rast/färg/kostnadsställe.
- **Veckomallar:** Skapa/redigera/ta bort. Definiera behov per dag/grupp/pass (count + countMin).
- **Datakontrakt:** En bestämd shape för all data som all kod följer.
- **Hjälpsystem:** Kontextuell hjälp (❓) på varje sida.

### Nivå 2 — Regler & perioder

- **Regelmotor:** Avgör om en person kan jobba ett pass på ett datum. Returnerar varför inte.
- **Beräkningsperiod:** Individuell per person. Måltimmar. Timbalans-kontroll.
- **Frånvaro-UI:** Registrera SEM/SJ/VAB/FÖR manuellt. Stöd för enskild dag, period och
  upprepande mönster.

### Nivå 3 — Schemaläggning

- **Kalender + mallkoppling:** Tilldela veckomall till kalenderveckor. Dag-override.
- **Schema-vy:** Visa eligible persons per pass. Manuell tilldelning. VAKANS-markering.
- **X-dags-hantering:** Planering per beräkningsperiod. Max carry-over (3-4 st). Varning.
- **Låsning:** Chefen kan låsa veckor som är klara.

### Nivå 4 — Auto-schemaläggning

- **AI-fill:** Fyller hela beräkningsperioden. Prioritetsordning. Rättvis fördelning.
  Fail-closed vid saknad data. Markerar vakans vid brist.

### Nivå 5 — Export & drift

- **CSV/Excel-export** av schema.
- **Utskriftsvänlig veckovy** (print-CSS).
- **Backup/restore** av all data.
- **Byteslogg** (vem ändrade vad).

### Nivå 6 — HRF/Visita-regler (framtida)

- Röda dagar, OB-flagga.
- Semesterperiod-stöd.
- Företrädesrätt/logik.
- Personal med egen inlogg.
- SMS-tjänst för vakanser.

---

## 4. Datamodell

### Komplett store state

```javascript
{
  // ===== PERSONAL =====
  people: {
    "person-uuid": {
      id: "person-uuid",
      firstName: "Anna",
      lastName: "Andersson",
      empNo: "1001",                          // anställningsnummer
      employmentPct: 100,                     // tjänstgöringsgrad (10-100)
      employmentType: "regular",              // "regular" | "substitute"
      workdaysPerWeek: 5,
      sector: "private",                      // "private" | "municipal"
      startDate: "2024-03-15",                // anställningsdatum (ISO)
      age: 32,

      // Grupper (kompetens)
      groupIds: ["kok", "bar"],               // kan jobba i dessa grupper

      // Tillgänglighet per veckodag (0=mån, 6=sön)
      availability: {
        0: true, 1: true, 2: true, 3: true, 4: true,  // mån-fre
        5: false, 6: false                               // lör-sön
      },

      // Beräkningsperiod
      calculationPeriodStart: "2024-03-15",   // redigerbart, default = startDate
      maxCarryOverExtraDays: 4,               // max X-dagar att spara vid periodens slut

      // Semester & ledighet
      vacationDaysPerYear: 25,
      usedVacationDays: 0,
      savedVacationDays: 0,
      extraDaysStartBalance: 0,

      // Önskemål (framtid, nice to have)
      preferredShifts: [],                    // ["lunch-kok"] — föredrar
      avoidShifts: [],                        // ["kvall-bar"] — vill slippa
      preferredDays: [],                      // [0,1,2] — föredrar mån-ons

      // Lön
      salary: 28000,                          // månadslön SEK
      salaryType: "monthly",                  // "monthly" | "hourly"

      // Status
      isActive: true
    }
  },

  // ===== GRUPPER =====
  groups: {
    "kok": {
      id: "kok",
      name: "Kök",
      color: "#e74c3c",
      shiftTemplateIds: ["lunch-kok", "kvall-kok"]   // kopplade grundpass
    },
    "bar": {
      id: "bar",
      name: "Bar",
      color: "#3498db",
      shiftTemplateIds: ["lunch-bar", "kvall-bar"]
    }
  },

  // ===== GRUNDPASS (passmallar) =====
  shiftTemplates: {
    "lunch-kok": {
      id: "lunch-kok",
      name: "Lunchpass Kök",
      startTime: "10:00",
      endTime: "15:00",
      breakStart: "12:00",
      breakEnd: "12:30",
      color: "#e74c3c",
      costCenter: "Kök",
      workplace: "Restaurang A"
    },
    "kvall-bar": {
      id: "kvall-bar",
      name: "Kvällspass Bar",
      startTime: "17:00",
      endTime: "01:00",                       // korsar midnatt — tillhör startdagen
      breakStart: "20:00",
      breakEnd: "20:30",
      color: "#3498db",
      costCenter: "Bar",
      workplace: "Restaurang A"
    }
  },

  // ===== VECKOMALLAR =====
  weekTemplates: {
    "standard": {
      id: "standard",
      name: "Standardvecka",
      slots: [
        { dayOfWeek: 0, groupId: "kok", shiftTemplateId: "lunch-kok", countMin: 2, count: 2 },
        { dayOfWeek: 0, groupId: "kok", shiftTemplateId: "kvall-kok", countMin: 1, count: 1 },
        { dayOfWeek: 0, groupId: "bar", shiftTemplateId: "lunch-bar", countMin: 1, count: 1 },
        { dayOfWeek: 0, groupId: "bar", shiftTemplateId: "kvall-bar", countMin: 1, count: 1 },
        // ... resterande dagar
        { dayOfWeek: 5, groupId: "bar", shiftTemplateId: "kvall-bar", countMin: 2, count: 3 },
        { dayOfWeek: 6, groupId: "kok", shiftTemplateId: "lunch-kok", countMin: 1, count: 1 }
      ]
    },
    "sommar": {
      id: "sommar",
      name: "Sommarvecka",
      slots: [
        // reducerad bemanning
      ]
    }
  },

  // ===== KALENDERKOPPLING =====
  calendarWeeks: {
    "2026-W01": "standard",
    "2026-W02": "standard",
    "2026-W25": "sommar",
    "2026-W51": "jul"
    // veckor utan entry → ingen mall → inget schema genereras
  },

  // ===== DAG-OVERRIDES =====
  calendarOverrides: {
    "2026-03-18": [
      { groupId: "kok", shiftTemplateId: "lunch-kok", countMin: 3, count: 4 }
      // override: denna dag behöver 4 kockar istället för 2
    ]
  },

  // ===== SCHEMA (genererat) =====
  schedule: {
    year: 2026,
    entries: {
      "2026-01-05": [
        {
          personId: "person-uuid",
          groupId: "kok",
          shiftTemplateId: "lunch-kok",
          status: "assigned"                   // "assigned" | "vacancy"
        },
        {
          personId: null,
          groupId: "bar",
          shiftTemplateId: "kvall-bar",
          status: "vacancy"                    // ingen eligible → vakans
        }
      ]
    },
    lockedWeeks: ["2026-W01", "2026-W02"]     // låsta veckor
  },

  // ===== FRÅNVARO =====
  absences: [
    {
      id: "abs-uuid",
      personId: "person-uuid",
      type: "SEM",                             // SEM|SJ|VAB|FÖR|PERM|UTB
      pattern: "range",                        // "single" | "range" | "recurring"
      date: null,                              // för "single"
      startDate: "2026-07-06",                 // för "range" och "recurring"
      endDate: "2026-07-26",                   // för "range" och "recurring"
      days: null,                              // för "recurring": [0,1,2] = mån,tis,ons
      note: "Sommarsemester"
    },
    {
      id: "abs-uuid-2",
      personId: "person-uuid-2",
      type: "FÖR",
      pattern: "recurring",
      startDate: "2026-03-01",
      endDate: "2026-08-31",
      days: [0, 1, 2],                         // mån, tis, ons varje vecka
      note: "Föräldraledig mån-ons"
    }
  ],

  // ===== VAKANSER (förberett för framtid) =====
  vacancies: [
    {
      id: "vac-uuid",
      date: "2026-03-14",
      groupId: "bar",
      shiftTemplateId: "kvall-bar",
      status: "open",                          // "open" | "offered" | "accepted" | "filled"
      offeredTo: [],                           // framtid: [personId, ...]
      acceptedBy: null,                        // framtid: personId
      smsStatus: null                          // framtid: "sent" | "delivered" | "failed"
    }
  ],

  // ===== ÄNDRINGSLOGG =====
  changeLog: [
    {
      timestamp: "2026-03-14T09:23:00Z",
      action: "assign",                        // "assign" | "unassign" | "override" | "lock" | ...
      personId: "person-uuid",
      date: "2026-03-14",
      shiftTemplateId: "kvall-bar",
      reason: "manuell tilldelning"
    }
  ],

  // ===== INSTÄLLNINGAR =====
  settings: {
    defaultStart: "07:00",
    defaultEnd: "16:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    helpAutoShow: true,                        // visa hjälp automatiskt första gången
    helpDismissed: {}                          // { personal: true, groups: true, ... }
  },

  // ===== META =====
  meta: {
    appVersion: "1.0.0",
    appName: "Schema-Program",
    lastUpdated: "2026-02-19T10:00:00Z"
  }
}
```

---

## 5. Veckomall-systemet

### Koncept

Chefen skapar **standardmallar** som beskriver bemanningsbehov per veckodag. Mallarna
kopplas till kalenderveckor. Enskilda dagar kan ha overrides.

### Slot-struktur

Varje slot i en veckomall definierar:

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `dayOfWeek` | `number (0-6)` | 0=måndag, 6=söndag |
| `groupId` | `string` | Vilken arbetsgrupp |
| `shiftTemplateId` | `string` | Vilket grundpass |
| `countMin` | `number` | **Minimum** bemanning — under detta = P0/vakans |
| `count` | `number` | **Önskad** bemanning — målvärde |

### Override-logik

```
FÖR en given dag:
  1. Hämta veckomall från calendarWeeks["2026-W03"]
  2. Hämta slots för rätt dayOfWeek
  3. Kolla calendarOverrides["2026-01-15"]
  4. Om override finns för samma groupId+shiftTemplateId → ersätt slot
  5. Om override finns för ny kombination → lägg till
  6. Resultat = effektivt behov för den dagen
```

### Flera mallar

Chefen kan skapa obegränsat antal mallar:

- "Standardvecka" — normal drift
- "Sommarvecka" — reducerad bemanning
- "Julvecka" — extra bemanning
- "Helgvecka special" — anpassad

---

## 6. Beräkningsperiod

### Definition

| Egenskap | Detalj |
|----------|--------|
| **Längd** | Heltid (100%): **26 veckor**. Deltid (<100%): **16 veckor** |
| **Start** | Baseras på `calculationPeriodStart` per person (default = `startDate`, redigerbart) |
| **Cykel** | Automatisk — när en period tar slut börjar nästa omedelbart |
| **Individuellt** | Varje person har sin egen period → kan ha olika periodslut |

### Timbalans

| Begrepp | Beräkning |
|---------|-----------|
| **Måltimmar** | `(employmentPct / 100) × 40h/vecka × antal veckor i perioden` |
| **Schemalagda timmar** | Summa av alla tilldelade pass i perioden |
| **Timbalans** | `schemalagda - måltimmar` |
| **Tolerans** | Minus-timmar OK (personen jobbar ifatt). Plus-timmar undviks (övertid kostar) |

### Periodövergång

Vid periodens slut:
1. Beräkna slutlig timbalans
2. X-dagar: max `maxCarryOverExtraDays` (default 4) sparas, resten → utbetalning
3. Ny period startar omedelbart med nollställd timbalans
4. Sparade X-dagar överförs till ny period

---

## 7. Regelmotor

### Regler som kontrolleras

| Regel | Kod | Nivå | Beskrivning |
|-------|-----|------|-------------|
| Rätt grupp | `GROUP_MATCH` | P0 | Personen måste tillhöra gruppens `groupId` |
| Tillgänglig | `AVAILABILITY` | P0 | Personens `availability[dayOfWeek]` måste vara `true` |
| Ej frånvarande | `ABSENCE` | P0 | Ingen aktiv frånvaro (SEM/SJ/VAB/FÖR/PERM/UTB) på datumet |
| Dygnsvila 11h | `REST_11H` | P0 | Minst 11 timmars vila mellan pass |
| Veckovila 36h | `REST_36H` | P0 | Minst 36 timmars sammanhängande vila per 7-dagarsperiod |
| Max 10h/pass | `MAX_10H` | P0 | Arbetstid per pass max 10 timmar |
| Streak max 10 | `STREAK_10` | P1 | Varning vid 10+ arbetsdagar i rad |
| Beräkningsperiod | `PERIOD_BALANCE` | P0 | Ej överstiga måltimmar i perioden |
| Semester | `VACATION_OVERDRAWN` | P0 | Ej övertrassera semesterdagar |
| X-dagar | `EXTRA_NEGATIVE` | P0 | Ej ta ut fler X-dagar än intjänade |
| X-dagar ej planerade | `EXTRA_NOT_PLANNED` | P1 | Varning om intjänade X-dagar inte planeras |
| Anställningstyp | `EMPLOYMENT_TYPE` | P1 | `substitute` schemaläggs bara vid vakans |
| Röd dag | `RED_DAY_WARNING` | P1 | Varning om standardmall appliceras på röd dag |

### Returnformat

```javascript
{
  eligible: true | false,
  reasons: [
    { code: "REST_11H", level: "P0", message: "Dygnsvila < 11h (8.5h)" }
  ]
}
```

---

## 8. AI-schemaläggning

### Algoritm (greedy, per beräkningsperiod)

```
FÖR VARJE dag i beräkningsperioden:
  Hämta effektivt behov (veckomall + override)
  FÖR VARJE slot (grupp + grundpass + antal):
    1. Hitta alla eligible persons (regelmotor)
    2. Filtrera bort substitute (först regular)
    3. Ranka efter score
    4. Tilldela top-N personer
    5. Om < countMin eligible → markera VAKANS
    6. Om < count men >= countMin → markera VARNING
    7. Försök fylla vakans med substitute-personal

Om vakans kvarstår efter substitute:
  → Skapa vacancy-post (förberett för framtida SMS)
```

### Prioritetsordning (score)

| Prio | Kriterium | Varför |
|------|-----------|--------|
| 1 | Mest timmar kvar i beräkningsperioden | Jämnar ut arbetsbelastningen |
| 2 | Minst jobbat senaste veckan | Rättvis kortsiktig fördelning |
| 3 | Färre grupper (specialist först) | Specialister har färre alternativ |
| 4 | Önskemål match (framtid) | `preferredShifts` / `avoidShifts` |
| 5 | Slumpmässig vid lika | Undvik bias |

### Nattpass som korsar midnatt

**Regel:** Passet tillhör **startdagen**.

- Kvällspass Bar 17:00–01:00 på fredag = **fredagspass**
- Dygnsvila räknas från 01:00 lördag natt till nästa pass-start
- Timmarna bokförs på fredagen

### Dubbla pass samma dag

**Regel:** Tillåtet om reglerna uppfylls (dygnsvila 11h, etc). AI:n **undviker** det om möjligt
men kan använda det som sista utväg före vakans.

---

## 9. Frånvarohantering

### Typer

| Typ | Kod | Effekt på timbalans | Registreras av |
|-----|-----|---------------------|----------------|
| Semester | `SEM` | Räknas av mot semesterdagar | Chef (→ framtid: personal) |
| Sjukdom | `SJ` | Minskar måltimmar | Chef (→ framtid: personal) |
| VAB | `VAB` | Minskar måltimmar | Chef (→ framtid: personal) |
| Föräldraledighet | `FÖR` | Minskar måltimmar | Chef |
| Tjänstledighet | `PERM` | Minskar måltimmar | Chef |
| Utbildning | `UTB` | Beror på typ | Chef |

### Mönster

| Mönster | Användning | Exempel |
|---------|------------|---------|
| `single` | En enskild dag | "Erik sjuk 18 mars" |
| `range` | Sammanhängande period | "Omar semester 6-26 juli" |
| `recurring` | Upprepande mönster | "Anna föräldraledig mån-ons varje vecka mars-aug" |

---

## 10. X-dagar (extra ledighetsdagar)

| Regel | Detalj |
|-------|--------|
| **Intjäning** | Jobbar röd dag → tjänar 1 X-dag |
| **Uttag** | Schemaläggas ut under beräkningsperioden |
| **Max carry-over** | Max 3-4 st (konfigurerbart per person, default 4) vid periodens slut |
| **Ej uttagna över max** | Betalas ut i pengar → systemet varnar |
| **Planering** | `extraPlanner.js` planerar automatiskt, chefen godkänner |

---

## 11. Vakans-system

### Nu (v1)

- Vakans visas som **röd markering** i schemat
- Chefen ser direkt vilka pass som saknar personal
- Kan manuellt tilldela vikarie/substitute

### Framtid

- Personal har egen inlogg → ser lediga pass → anmäler intresse
- SMS-tjänst: "Hej Anna, kvällspass Bar lör 14 jan är ledigt — vill du ta det?"
- Datamodellen stödjer detta redan via `vacancies[]`

### Vakans-datastruktur

```javascript
{
  id: "vac-uuid",
  date: "2026-03-14",
  groupId: "bar",
  shiftTemplateId: "kvall-bar",
  status: "open",              // "open" | "offered" | "accepted" | "filled"
  offeredTo: [],               // framtid: [personId, ...]
  acceptedBy: null,            // framtid: personId
  smsStatus: null              // framtid: "sent" | "delivered" | "failed"
}
```

---

## 12. Dashboard & Statistik

### Veckosammanfattning

```
VECKA 12 — Sammanfattning
├── Total bemanning: 47/52 pass fyllda (90%)
├── Vakanser: 5 (3 Bar Kväll, 2 Kök Lunch)
├── Personalkostnad veckan: 87 400 SEK
├── Personal med mest timmar: Omar (42h)
├── Personal med minst timmar: Sara (12h)
├── X-dagar att planera: Anna 2, Erik 1
└── Beräkningsperioder som slutar snart:
    └── Erik: 3 veckor kvar, -4h att fylla
```

### Statistik som visas

| Statistik | Beskrivning |
|-----------|-------------|
| Bemanningsgrad | % fyllda pass vs behov |
| Personalkostnad | Total kostnad per vecka/månad (lön + arbetsgivaravgift) |
| Timbalans per person | Schemalagda vs måltimmar i beräkningsperioden |
| X-dagssaldo | Intjänade, uttagna, kvarvarande |
| Vakanser | Antal, vilka grupper/pass, trend |
| Regelbrott | P0/P1-varningar |
| Nyttjandegrad per person | % av tjänstgöringsgrad som faktiskt schemalagts |

---

## 13. Hjälpsystem

### Design

Varje sida/sektion har en **❓-knapp** i headern som öppnar kontextuell hjälp.

### Beteende

| Egenskap | Val |
|----------|-----|
| Placering | I sidans header, bredvid rubriken |
| Klick | Panel expanderar under rubriken |
| Klick igen | Panel stängs |
| Första besöket | Hjälpen visas **automatiskt** (kan stängas av i settings) |
| Toggle | Settings: "Visa hjälp automatiskt" on/off |

### Hjälptexter per sida

| Sida | Innehåll |
|------|----------|
| Personal | Hur man lägger till/redigerar, vad tjänstgöringsgrad betyder, grupper, tillgänglighet |
| Grupper | Vad en grupp är, koppling till grundpass, att personal kan tillhöra flera |
| Grundpass | Vad en passmall är, start/slut/rast, att det är en mall (inte schemalagd tid) |
| Veckomallar | Hur man skapar standardvecka, countMin vs count, olika mallar |
| Kalender | Hur man kopplar mall till vecka, dag-override, röda dagar |
| Schema | Eligibility, vakans, manuell tilldelning, AI-knappen, låsning |
| Frånvaro | Typer (SEM/SJ/VAB/FÖR), mönster (single/range/recurring), effekt på timbalans |
| Dashboard | Vad siffrorna betyder, färger, beräkningsperiod-status, kostnad |

### Teknisk implementation

```
src/modules/help-system.js
├── HELP_TEXTS = { personal: { title, steps[], tips[] }, ... }
├── renderHelpButton(sectionId)
├── renderHelpPanel(sectionId)
└── toggleHelp(sectionId)
```

---

## 14. Designbeslut (15 punkter)

| # | Beslut | Prio | Detalj |
|---|--------|------|--------|
| 1 | Enskild dag-override | 🔴 | `calendarOverrides` kan ändra behov per dag utan ny mall |
| 2 | Nattpass korsar midnatt | 🔴 | Pass tillhör **startdagen**. Timmarna bokförs på startdagen |
| 3 | Prioritetsordning (AI) | 🔴 | 1) mest timmar kvar 2) minst jobbat senaste veckan 3) specialist först 4) önskemål 5) slump |
| 4 | Min vs önskad bemanning | 🔴 | `countMin` = minimum (under = vakans), `count` = önskat (under = varning) |
| 5 | Byteslogg / historik | 🟡 | `changeLog[]` sparar alla ändringar med timestamp + reason |
| 6 | Personalönskemål | 🟡 | `preferredShifts`, `avoidShifts`, `preferredDays` — tiebreaker i AI-score |
| 7 | Dashboard + statistik + kostnad | 🔴 | Veckosammanfattning med bemanningsgrad, kostnad, timbalans, X-dagar |
| 8 | Låst schema | 🟡 | `lockedWeeks[]` — låsta veckor kan inte ändras utan upplåsning |
| 9 | Dubbla pass samma dag | 🟡 | Tillåtet om regler OK. AI undviker men använder som sista utväg |
| 10 | Röd dag-varning | 🔴 | Systemet varnar om standardmall appliceras på röd dag |
| 11 | Vikarier / timanställda | 🔴 | `employmentType: "substitute"` — schemaläggs bara vid vakans |
| 12 | Upprepande frånvaro | 🔴 | `pattern: "recurring"` med `days[]` + datumintervall |
| 13 | Utskriftsvänlig veckovy | 🟡 | Print-CSS med tydlig tabell per vecka |
| 14 | Kostnad per vecka | 🔴 | Visa personalkostnad (lön + arbetsgivaravgift) på dashboard |
| 15 | Kontextuell hjälp | 🔴 | ❓-knapp per sida med steg-för-steg-guide + tips |

---

## 15. AO-plan (byggordning)

> Ordningen är bestämd av Copilot baserat på tekniska beroenden.
> Varje AO ändrar max 2-3 filer.

### Nivå 1 — MVP

| AO | Namn | Filer | Beroende |
|----|------|-------|----------|
| **AO-03** | Datakontrakt + migration | `store.js` | AO-01 (klar) |
| **AO-04** | Groups + Passmallar (render) | `views/groups.js`, `assets/css/groups.css` | AO-03 |
| **AO-05** | Groups + Passmallar (form) | `modules/groups-form.js`, `modules/groups-validate.js` | AO-03, AO-04 |
| **AO-06** | Veckomall-UI | `views/week-templates.js`, `modules/week-template-form.js` | AO-03, AO-05 |
| **AO-15** | Hjälpsystem | `modules/help-system.js`, `assets/css/help.css` | — (kan byggas parallellt) |

### Nivå 2 �� Regler & perioder

| AO | Namn | Filer | Beroende |
|----|------|-------|----------|
| **AO-07** | Kalender + mallkoppling | `views/calendar.js`, `modules/calendar-form.js` | AO-06 |
| **AO-08** | Beräkningsperiod-motor | `modules/calculation-period.js`, `hr-rules.js` | AO-03 |
| **AO-09** | Frånvaro-UI | `views/absence.js`, `modules/absence-form.js` | AO-03 |

### Nivå 3 — Schemaläggning

| AO | Namn | Filer | Beroende |
|----|------|-------|----------|
| **AO-10** | Schema-vy + eligibility | `views/schedule.js`, `rules-engine.js` | AO-07, AO-08, AO-09 |
| **AO-11** | X-dags-hantering | `scheduler/extraPlanner.js`, `rules.js` | AO-08, AO-10 |

### Nivå 4 — Auto-schemaläggning

| AO | Namn | Filer | Beroende |
|----|------|-------|----------|
| **AO-12** | Auto-fill | `scheduler/autoScheduler.js`, `rules-engine.js`, `views/schedule.js` | AO-10 |

### Nivå 5 — Export & drift

| AO | Namn | Filer | Beroende |
|----|------|-------|----------|
| **AO-13** | Export/Import + Print | `views/settings.js`, `store.js`, `assets/css/print.css` | AO-10 |
| **AO-14** | Dashboard | `views/dashboard.js`, `modules/dashboard-stats.js` | AO-10 |
| **AO-16** | Vakans-system (förberett) | `modules/vacancy.js` | AO-10 |
| **AO-17** | Byteslogg | `modules/change-log.js` | AO-10 |

---

## 16. Terminologi

> Dessa begrepp gäller i **all kod**. Inga synonymer.

| Begrepp | Tekniskt namn | Beskrivning |
|---------|---------------|-------------|
| Personal | `person` / `people` | En anställd |
| Grupp | `group` / `groups` | Arbetsgrupp (Kök, Bar, ...) |
| Grundpass / Passmall | `shiftTemplate` / `shiftTemplates` | Mall: start/slut/rast (ingen person, inget datum) |
| Veckomall | `weekTemplate` / `weekTemplates` | Bemanningsbehov per veckodag |
| Kalenderkoppling | `calendarWeeks` | Vilken veckomall som gäller per vecka |
| Dag-override | `calendarOverrides` | Ändring av behov en enskild dag |
| Schemapost | `scheduleEntry` | Person tilldelad ett pass på ett datum |
| Frånvaro | `absence` / `absences` | SEM/SJ/VAB/FÖR/PERM/UTB |
| Vakans | `vacancy` / `vacancies` | Pass utan tilldelad personal |
| Beräkningsperiod | `calculationPeriod` | Individuell period där timmar ska balansera |
| X-dag | `extraDay` | Extra ledig dag intjänad genom arbete på röd dag |
| Vikarie | `substitute` | Timanställd som bara schemaläggs vid vakans |
| Regel | `rule` | Kontroll om person kan jobba pass X på datum Y |
| Byteslogg | `changeLog` | Historik över schemaändringar |

---

## 17. Arbetsregler för utveckling

### Leveransformat

1. **Hela produktionsklara filer** — aldrig snippets som måste klistras in
2. **Tydligt uppmärkta block** — varje fil har namngivna block (BLOCK 1, BLOCK 2, ...)
3. **Senaste sanningen** — om Copilot inte har senaste versionen av en fil, fråga innan leverans

### Kodstandard

1. **ESM-moduler** — `import/export`, aldrig `require()`
2. **XSS-safe** — `textContent`, aldrig osäker `innerHTML` med interpolering
3. **Fail-closed** — korrupt data → lås + visa fel, aldrig krascha tyst
4. **Inga nya storage keys** utan beslut
5. **Inga globala event listeners som inte rensas** — varje vy har cleanup

### AO-regler

1. Max **2-3 filer** per AO
2. Copilot bestämmer **byggordning** baserat på tekniska beroenden
3. Copilot rekommenderar alltid det som är **bäst för systemet**
4. Varje AO har tydliga **acceptanskriterier** som kan verifieras i webbläsaren
5. Ingen AO startas utan att föregående beroenden är klara

### QA-process

1. Copilot levererar kod
2. Kod testas i webbläsaren
3. QA-tråd (ChatGPT) ger: PASS/FAIL, buggar P0/P1/P2, risker, förbättringar
4. Patch-plan (utan kod) tillbaka till Copilot
5. Copilot levererar fix

---

## 18. Filstruktur

```
schema/
├── index.html
├── SPEC.md                              ← detta dokument
├── assets/
│   └── css/
│       ├── styles.css
│       ├── groups.css
│       ├── help.css
│       └── print.css
├── src/
│   ├── app.js                           ← init + keyboard guards
│   ├── store.js                         ← state + localStorage + migration
│   ├── router.js                        ← routing + navigation
│   ├── ui.js                            ← navbar + toast + error
│   ├── diagnostics.js                   ← error reporting
│   ├── hr-rules.js                      ← HRF/Visita-regler, beräkningsperiod
│   ├── rules-engine.js                  ← eligibility-kontroller
│   ├── rules.js                         ← regelmotor (evaluate)
│   ├── stats.js                         ← statistik-beräkningar
│   ├── views/
│   │   ├── home.js
│   │   ├── login-pin.js
│   │   ├── personal.js
│   │   ├── groups.js
│   │   ├── week-templates.js            ← NY
│   │   ├── calendar.js
│   │   ├── schedule.js
│   │   ├���─ absence.js                   ← NY
│   │   ├── dashboard.js                 ← NY
│   │   └── settings.js
│   ├── modules/
│   │   ├── groups-form.js
│   │   ├── groups-validate.js
│   │   ├── week-template-form.js        ← NY
│   │   ├── calendar-form.js             ← NY
│   │   ├── absence-form.js              ← NY
│   │   ├── calculation-period.js        ← NY
│   │   ├── dashboard-stats.js           ← NY
│   │   ├── help-system.js              ← NY
│   │   ├── vacancy.js                   ← NY
│   │   └── change-log.js               ← NY
│   ├── scheduler/
│   │   ├── extraPlanner.js
│   │   └── autoScheduler.js             ← NY
│   ├── data/
│   │   └── holidays.js
│   └── lib/
│       └── cost-utils.js
└── tests/
    └── shift-utils.test.js
```

---

## Versionshistorik

| Version | Datum | Ändring |
|---------|-------|---------|
| 1.0 | 2026-02-19 | Initial specifikation — godkänd av projektägare |
