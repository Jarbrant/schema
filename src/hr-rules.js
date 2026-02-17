/*
 * HR-RULES.JS — Hotell- och Restaurangfackets officiella regler + AO-02 PATCH (AUTOPATCH v1.6)
 *
 * AUTOPATCH v1.6 (stabilitet + determinism):
 * - P0: Deltidslogik fixad för ALLA employmentDegree (inte bara "80%"):
 *       -> FULLTIME-bas räknas alltid fram
 *       -> PARTTIME-tabell används bara när employmentDegree matchar tabellens antagna grad (default 80)
 *       -> annars proportionell beräkning från FULLTIME (inkl kommunal åldersvarianter)
 * - P2: Strikt ISO-datumparse (YYYY-MM-DD) med UTC-konstruktion för deterministiska beräkningar
 * - P2: validatePersonAgainstHRF() får riktig framtids-check (startDate > idag)
 * - P0: employmentPct prioriteras framför degree när graden hämtas från person
 *
 * Gällande från 1 april 2026 (enligt filens meta)
 * Källa: HRF, Kommunal, LAS
 */

/**
 * Sektor-typer
 */
export const SECTOR_TYPES = {
    PRIVATE: 'private',      // Privat sektor
    MUNICIPAL: 'municipal'   // Kommunal sektor
};

/**
 * HRF Vacation Rules by Sector
 */
export const HRF_VACATION_RULES = {
    // ===== PRIVAT SEKTOR =====
    private: {
        name: 'Privat sektor',

        // Beräkningsperiod (veckor)
        CALCULATION_PERIOD_FULLTIME: 26,      // 100% = 26 veckor
        CALCULATION_PERIOD_PARTTIME: 16,      // <100% = 16 veckor

        // Vacation period starts
        VACATION_YEAR_START: '04-01',         // 1 april

        // Days per year by employment years (100% employment)
        FULLTIME: {
            '0-2': 25,      // År 1-2: 25 dagar
            '2-5': 28,      // År 3-5: 28 dagar
            '5+': 31        // År 6+: 31 dagar
        },

        // Days per year by employment years (<100% employment)
        // OBS: Tabellen här representerar ett "standardfall" (historiskt 80% i din kommentar).
        // AUTOPATCH v1.6: Vi använder denna tabell bara när employmentDegree matchar antagen grad.
        PARTTIME: {
            '0-2': 16,      // (exempel 80%-justerad)
            '2-5': 18,
            '5+': 20
        },

        description: 'Privat hotell- och restaurangsektor',
        url: 'https://www.hrf.se/arbetsvillkor/lon-och-arbetstid/semester'
    },

    // ===== KOMMUNAL SEKTOR =====
    municipal: {
        name: 'Kommunal sektor',

        // Beräkningsperiod (veckor)
        CALCULATION_PERIOD_FULLTIME: 26,
        CALCULATION_PERIOD_PARTTIME: 16,

        // Vacation period starts — ofta 1 juni eller 1 juli per kommun
        VACATION_YEAR_START: '06-01',

        // Days per year by employment years (100% employment)
        FULLTIME: {
            '0-2': 28,
            '2-5': 30,
            '5+': 32
        },

        FULLTIME_AGE_40: {
            '0-2': 31,
            '2-5': 31,
            '5+': 31
        },

        FULLTIME_AGE_50: {
            '0-2': 32,
            '2-5': 32,
            '5+': 32
        },

        PARTTIME: {
            '0-2': 18,
            '2-5': 19,
            '5+': 21
        },

        PARTTIME_AGE_40: {
            '0-2': 20,
            '2-5': 20,
            '5+': 20
        },

        PARTTIME_AGE_50: {
            '0-2': 21,
            '2-5': 21,
            '5+': 21
        },

        description: 'Kommunal sektor (äldreboenden, skolkök, mm) — åldersbaserad semester',
        url: 'https://www.lo.se/rad-och-stod/kollektivavtal'
    }
};

/* ========================================================================
   AO-02 PATCH: KOLLEKTIVAVTAL (FIXED — konsistent datumformat)
   ======================================================================== */

export const COLLECTIVE_AGREEMENTS = {
  // === PRIVAT (HRF) ===
  "grona-riksavtalet": {
    id: "grona-riksavtalet",
    name: "Gröna riksavtalet (Visita-HRF)",
    sector: "private",
    organization: "Visita-HRF",
    validFrom: "2025-04-01",
    validTo: "2027-03-31",

    minSalary2026: {
      group1: { noExp: 28425, sixYears: 30428 },
      group2: { noExp: 26580, sixYears: 28944 },
    },
    minHourly2026: {
      group1: { noExp: 164.30, sixYears: 175.88 },
      group2: { noExp: 153.64, sixYears: 167.31 },
    },

    ob: {
      ob1: 27.59,
      ob2: 24.31,
      totalNight: 51.90,
    },

    vacationDaysPerYear: 25,
    redDayCompensation: false,
    description: "Standard kollektivavtal för privata restauranger/hotell (Visita-medlemmar)",
  },

  "hrf-hangavtal": {
    id: "hrf-hangavtal",
    name: "HRF-hängavtal (fristående arbetsgivare)",
    sector: "private",
    organization: "HRF",
    validFrom: "2025-04-01",
    validTo: "2027-03-31",

    minSalary2026: {
      group1: { noExp: 28425, sixYears: 30428 },
      group2: { noExp: 26580, sixYears: 28944 },
    },
    minHourly2026: {
      group1: { noExp: 164.30, sixYears: 175.88 },
      group2: { noExp: 153.64, sixYears: 167.31 },
    },

    ob: {
      ob1: 27.59,
      ob2: 24.31,
      totalNight: 51.90,
    },

    vacationDaysPerYear: 25,
    redDayCompensation: false,
    description: "HRF-avtal för arbetsgivare utanför Visita",
  },

  "nojesesavtalet": {
    id: "nojesesavtalet",
    name: "Nöjesavtalet (nöjesparker, underhållning)",
    sector: "private",
    organization: "HRF",
    validFrom: "2025-04-01",
    validTo: "2027-03-31",

    minSalary2026: {
      group1: { noExp: 28425, sixYears: 30428 },
    },
    minHourly2026: {
      group1: { noExp: 164.30, sixYears: 175.88 },
    },

    ob: {
      ob1: 27.59,
      ob2: 24.31,
      totalNight: 51.90,
    },

    vacationDaysPerYear: 25,
    redDayCompensation: false,
    description: "Kollektivavtal för nöjesparker, casino, underhållning",
  },

  // === KOMMUNAL ===
  "kommunal-ab": {
    id: "kommunal-ab",
    name: "AB Allmänna bestämmelser (Kommunal)",
    sector: "municipal",
    organization: "SKR/Sobona + Kommunal",
    validFrom: "2025-01-01",
    validTo: "2027-12-31",

    minSalary2026: {
      group1: { noExp: 29000, sixYears: 31500 },
      group2: { noExp: 27000, sixYears: 29500 },
    },
    minHourly2026: {
      group1: { noExp: 167.65, sixYears: 182.04 },
      group2: { noExp: 156.29, sixYears: 170.65 },
    },

    ob: {
      evening: 33.00,
      night: 55.00,
      weekend: 58.00,
    },

    vacationDaysPerYear: 25,
    redDayCompensation: true,
    description: "Kommunal sektor (äldreboenden, skolkök, mm) med åldersbaserad semester",
  },

  "regional-ab": {
    id: "regional-ab",
    name: "AB Region (Landsting/Region)",
    sector: "municipal",
    organization: "SKR/Sobona + Kommunal",
    validFrom: "2025-01-01",
    validTo: "2027-12-31",

    minSalary2026: {
      group1: { noExp: 29000, sixYears: 31500 },
      group2: { noExp: 27000, sixYears: 29500 },
    },
    minHourly2026: {
      group1: { noExp: 167.65, sixYears: 182.04 },
      group2: { noExp: 156.29, sixYears: 170.65 },
    },

    ob: {
      evening: 33.00,
      night: 55.00,
      weekend: 58.00,
    },

    vacationDaysPerYear: 25,
    redDayCompensation: true,
    description: "Region/Landsting (sjukhus, hälsovård, mm) med åldersbaserad semester",
  },
};

/* ========================================================================
   AO-02 PATCH: OB-REGLER PER SEKTOR
   ======================================================================== */

export const OB_RULES_BY_SECTOR = {
  private: {
    ob1: { name: "OB1 (Kväll)", amount: 27.59, appliesTo: "Mån-Fre 20:00-06:00, Lör 16:00-06:00, Sön 06:00-06:00" },
    ob2: { name: "OB2 (Natt)", amount: 24.31, appliesTo: "01:00-06:00 (UTÖVER ob1)" },
    totalNight: 51.90,
    redDay: { hasCompensationLeave: false, note: "Extra OB-ersättning, ingen automatisk ledighet" },
  },
  municipal: {
    evening: { name: "Kväll (19:00-22:00)", amount: 33.00 },
    night: { name: "Natt (22:00-06:00)", amount: 55.00 },
    weekend: { name: "Helg (Lör/Sön)", amount: 58.00 },
    redDay: { hasCompensationLeave: true, note: "Extra OB + ofta kompensationsledighet" },
  },
};

/* ========================================================================
   AO-02 PATCH: LAS-REGLER (UPPSÄGNINGSTIDER)
   ======================================================================== */

export const LAS_RULES = {
  description: "Lagen om anställningsskydd (LAS) — Uppsägningstider när arbetsgivare säger upp",
  validFrom: "2024-01-01",
  rules: [
    { yearsMin: 0, yearsMax: 2, noticeMonths: 1, noticeDays: 30 },
    { yearsMin: 2, yearsMax: 4, noticeMonths: 2, noticeDays: 60 },
    { yearsMin: 4, yearsMax: 6, noticeMonths: 3, noticeDays: 90 },
    { yearsMin: 6, yearsMax: 8, noticeMonths: 4, noticeDays: 120 },
    { yearsMin: 8, yearsMax: 10, noticeMonths: 5, noticeDays: 150 },
    { yearsMin: 10, yearsMax: 999, noticeMonths: 6, noticeDays: 180 },
  ]
};

/* ========================================================================
   AO-02 PATCH: HELPER FUNCTIONS (PRODUCTION-SAFE)
   ======================================================================== */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * P2: Strikt ISO-parse (YYYY-MM-DD) -> Date (UTC)
 * Fail-closed: return null om ogiltigt.
 */
function parseISODateStrict(dateStr) {
  if (!isNonEmptyString(dateStr)) return null;
  const s = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, m, d] = s.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12) return null;

  // UTC-konstruerad för determinism (undviker timezone-shift)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // 12:00 UTC för extra DST-säkerhet
  // Kontrollera att datumet inte “rullar”
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== (m - 1) || dt.getUTCDate() !== d) return null;
  return dt;
}

/**
 * Få avtal-regler från ID
 * @param {string} agreementId
 * @returns {object|null}
 */
export function getAgreementRules(agreementId) {
  if (!isNonEmptyString(agreementId)) return null;
  return COLLECTIVE_AGREEMENTS[agreementId.trim()] || null;
}

/**
 * Validera lön mot avtal + minimilöner (fail-closed)
 * @param {object} person
 * @returns {object} { valid, error, warning }
 */
export function validateSalaryAgainstAgreement(person) {
  if (!person || typeof person !== 'object') {
    return { valid: false, error: "Person-objekt måste finnas" };
  }

  const agreement = getAgreementRules(person.collectiveAgreement);
  if (!agreement) {
    return { valid: false, error: `Okänt kollektivavtal: ${person.collectiveAgreement}` };
  }

  const wageGroup = person.wageGroup || "group1";
  const yearsExp = Math.max(0, Number(person.yearsOfExperience || 0));

  const minSalaryData = agreement.minSalary2026?.[wageGroup];
  if (!minSalaryData) {
    return { valid: false, error: `Lönegrupp ${wageGroup} finns inte i avtal` };
  }

  const minSalary = yearsExp >= 6 ? minSalaryData.sixYears : minSalaryData.noExp;
  const salary = Math.max(0, Number(person.salary || 0));

  if (salary < minSalary) {
    return {
      valid: false,
      error: `Lön (${salary} kr) understiger minimilön enligt ${agreement.name}: ${minSalary} kr/mån`,
    };
  }

  return { valid: true };
}

/**
 * Få minimilöner från avtal (safe)
 * @param {string} agreementId
 * @param {string} wageGroup
 * @param {number} yearsOfExperience
 * @returns {object|null} { monthly, hourly }
 */
export function getMinimumWage(agreementId, wageGroup, yearsOfExperience) {
  const agreement = getAgreementRules(agreementId);
  if (!agreement) return null;

  wageGroup = wageGroup || "group1";
  const isExp = (Number(yearsOfExperience || 0) >= 6) ? "sixYears" : "noExp";

  const salaryData = agreement.minSalary2026?.[wageGroup]?.[isExp];
  const hourlyData = agreement.minHourly2026?.[wageGroup]?.[isExp];

  if (!salaryData || !hourlyData) return null;

  return {
    monthly: salaryData,
    hourly: hourlyData,
  };
}

/**
 * Beräkna uppsägningstider enligt LAS (safe)
 * @param {number} yearsEmployed
 * @returns {number} Uppsägningstider i dagar
 */
export function getNoticeRequiredDays(yearsEmployed) {
  const ye = Math.max(0, yearsEmployed == null ? 0 : Number(yearsEmployed));

  const rule = LAS_RULES.rules.find(r =>
    ye >= r.yearsMin && ye < r.yearsMax
  );

  return rule ? rule.noticeDays : 30;
}

/**
 * Get vacation rules for sector
 */
export function getVacationRulesForSector(sector) {
    if (!isNonEmptyString(sector) || !HRF_VACATION_RULES[sector]) {
        console.warn(`⚠️ Okänd sektor: ${sector}, använder PRIVAT`);
        return HRF_VACATION_RULES.private;
    }

    return HRF_VACATION_RULES[sector];
}

/**
 * P0/P1: Get vacation days per year (deltid + åldersbaserad för kommunal)
 *
 * AUTOPATCH v1.6:
 * - FULLTIME-bas räknas alltid fram (inkl ålder för kommunal)
 * - PARTTIME-tabell används endast när employmentDegree matchar antagen grad (default 80)
 * - annars: proportionell beräkning från FULLTIME-bas
 *
 * @param {number} yearsEmployed - Antal år anställd
 * @param {number} employmentDegree - Tjänstgöringsgrad (10-100)
 * @param {string} sector - 'private' eller 'municipal'
 * @param {number} age - Ålder (för kommunal åldersökning)
 * @returns {number} Semesterdagar
 */
export function getVacationDaysPerYear(yearsEmployed, employmentDegree = 100, sector = 'private', age = null) {
    yearsEmployed = Math.max(0, yearsEmployed == null ? 0 : Number(yearsEmployed));
    employmentDegree = Math.max(10, Math.min(100, Number(employmentDegree) || 100));

    const rules = getVacationRulesForSector(sector);

    const ageNum = (age == null) ? null : Number(age);
    const hasAge = Number.isFinite(ageNum) && ageNum > 0;

    // 1) Välj FULLTIME-bas (inkl kommunal ålder)
    let fulltimeRules = rules.FULLTIME;
    if (sector === 'municipal' && hasAge) {
        if (ageNum >= 50 && rules.FULLTIME_AGE_50) fulltimeRules = rules.FULLTIME_AGE_50;
        else if (ageNum >= 40 && rules.FULLTIME_AGE_40) fulltimeRules = rules.FULLTIME_AGE_40;
    }

    const bracketKey = yearsEmployed < 2 ? '0-2' : (yearsEmployed < 5 ? '2-5' : '5+');
    const fullBaseDays = Number(fulltimeRules?.[bracketKey] ?? 0);

    // 2) Heltid -> return direkt
    if (employmentDegree >= 100) {
        return Math.round(fullBaseDays);
    }

    // 3) Deltid: försök använda PARTTIME-tabell endast om graden matchar antagen grad
    // Antagen tabellgrad: 80% (enligt dina kommentarer/exempel).
    const PARTTIME_TABLE_DEGREE = 80;
    if (employmentDegree === PARTTIME_TABLE_DEGREE && rules.PARTTIME) {
        let partRules = rules.PARTTIME;

        if (sector === 'municipal' && hasAge) {
            if (ageNum >= 50 && rules.PARTTIME_AGE_50) partRules = rules.PARTTIME_AGE_50;
            else if (ageNum >= 40 && rules.PARTTIME_AGE_40) partRules = rules.PARTTIME_AGE_40;
        }

        const partBaseDays = Number(partRules?.[bracketKey] ?? NaN);
        if (Number.isFinite(partBaseDays) && partBaseDays > 0) {
            return Math.round(partBaseDays);
        }
        // fallthrough -> proportionell
    }

    // 4) Standard: proportionell beräkning från FULLTIME-bas
    return Math.round((fullBaseDays * employmentDegree) / 100);
}

/**
 * Get calculation period in weeks for sector
 */
export function getCalculationPeriodWeeks(employmentDegree = 100, sector = 'private') {
    const rules = getVacationRulesForSector(sector);
    const deg = Math.max(10, Math.min(100, Number(employmentDegree) || 100));
    const isFulltime = deg >= 100;
    return isFulltime
        ? rules.CALCULATION_PERIOD_FULLTIME
        : rules.CALCULATION_PERIOD_PARTTIME;
}

/**
 * Get vacation year start month for sector
 * Returns month number (0-11)
 */
export function getVacationYearStartMonth(sector = 'private') {
    const rules = getVacationRulesForSector(sector);
    const [monthStr] = rules.VACATION_YEAR_START.split('-');
    const month = parseInt(monthStr, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
        console.warn(`⚠️ Ogiltig startmånad i regler: ${rules.VACATION_YEAR_START}`);
        return 3;
    }
    return month - 1;
}

/**
 * Returnerar NUVARANDE vacation year start (inte nästa).
 */
export function getCurrentVacationYearStart(sector = 'private') {
    const today = new Date();
    const currentYear = today.getFullYear();
    const startMonth = getVacationYearStartMonth(sector);

    const thisYearStart = new Date(currentYear, startMonth, 1);

    if (today >= thisYearStart) {
        return thisYearStart;
    } else {
        return new Date(currentYear - 1, startMonth, 1);
    }
}

/**
 * P2: Safe datumparsing med guard
 * Get vacation year for a date in sector
 */
export function getVacationYear(dateStr, sector = 'private') {
    const dt = parseISODateStrict(dateStr);
    if (!dt) {
        console.warn(`⚠️ Ogiltigt datum: ${dateStr}`);
        return null;
    }

    const month = dt.getUTCMonth(); // 0-11
    const year = dt.getUTCFullYear();
    const startMonth = getVacationYearStartMonth(sector);

    if (month >= startMonth) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

/**
 * P2: Safe year-of-employment calculation
 */
export function calculateYearsEmployed(startDateStr, sector = 'private') {
    const startDt = parseISODateStrict(startDateStr);
    if (!startDt) {
        if (startDateStr) console.warn(`⚠️ Ogiltigt startdatum: ${startDateStr}`);
        return 0;
    }

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    const startVacationYear = getVacationYear(startDateStr, sector);
    const todayVacationYear = getVacationYear(todayISO, sector);

    if (!startVacationYear || !todayVacationYear) {
        return 0;
    }

    const [startYear] = startVacationYear.split('-').map(Number);
    const [todayYear] = todayVacationYear.split('-').map(Number);

    const yearsCalc = todayYear - startYear;
    return Math.max(0, yearsCalc);
}

/**
 * Get vacation days accumulated for current vacation year
 */
export function getAccumulatedVacationDays(person, sector = 'private') {
    if (!person || typeof person !== 'object') return 0;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const degree = (person.employmentPct ?? person.degree ?? 100);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, degree, sector, person.age);

    const vacationYearStart = getCurrentVacationYearStart(sector);
    const today = new Date();

    const weeksPassed = Math.floor((today - vacationYearStart) / (7 * 24 * 60 * 60 * 1000));
    const calculationPeriod = getCalculationPeriodWeeks(degree, sector);

    const accumulated = Math.floor((vacationDaysPerYear * Math.max(0, weeksPassed)) / Math.max(1, calculationPeriod));
    return Math.min(accumulated, vacationDaysPerYear);
}

/**
 * Get remaining vacation days for current vacation year
 */
export function getRemainingVacationDays(person, sector = 'private') {
    if (!person || typeof person !== 'object') return 0;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const degree = (person.employmentPct ?? person.degree ?? 100);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, degree, sector, person.age);
    const usedDays = Number(person.usedVacationDays || 0);
    const savedDays = Number(person.savedVacationDays || 0);

    const available = vacationDaysPerYear + savedDays - usedDays;
    return Math.max(0, available);
}

/**
 * Generate vacation year info for person with sector
 */
export function getPersonVacationYearInfo(person, sector = 'private') {
    if (!person || typeof person !== 'object') return null;

    const degree = (person.employmentPct ?? person.degree ?? 100);
    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, degree, sector, person.age);
    const calculationPeriod = getCalculationPeriodWeeks(degree, sector);
    const accumulated = getAccumulatedVacationDays(person, sector);
    const remaining = getRemainingVacationDays(person, sector);

    const rules = getVacationRulesForSector(sector);

    return {
        sector: sector,
        sectorName: rules.name,
        yearsEmployed,
        vacationDaysPerYear,
        calculationPeriodWeeks: calculationPeriod,
        accumulated,
        usedThisYear: Number(person.usedVacationDays || 0),
        savedFromLastYear: Number(person.savedVacationDays || 0),
        remaining,
        employmentDegree: degree,
        vacationYearStartMonth: getVacationYearStartMonth(sector) + 1
    };
}

/**
 * Update person's vacation days at year change
 */
export function updateVacationDaysOnYearChange(person, sector = 'private') {
    if (!person || typeof person !== 'object') return null;

    const degree = (person.employmentPct ?? person.degree ?? 100);
    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const newVacationDays = getVacationDaysPerYear(yearsEmployed, degree, sector, person.age);

    const usedThisYear = Number(person.usedVacationDays || 0);
    const remainingFromLastYear = Math.max(0, Number(person.vacationDaysPerYear || 0) - usedThisYear);

    const newSavedDays = Number(person.savedVacationDays || 0) + remainingFromLastYear;

    return {
        ...person,
        vacationDaysPerYear: newVacationDays,
        usedVacationDays: 0,
        savedVacationDays: newSavedDays,
        lastVacationYearUpdate: new Date().toISOString(),
        sector: sector
    };
}

/**
 * Validate person data against HRF rules for sector
 */
export function validatePersonAgainstHRF(person, sector = 'private') {
    const errors = [];

    if (!person || typeof person !== 'object') {
        return { valid: false, errors: ['Person-objekt saknas'] };
    }

    if (!person.startDate || typeof person.startDate !== 'string') {
        errors.push('Startdatum saknas eller är fel typ');
    } else {
        const startDt = parseISODateStrict(person.startDate);
        if (!startDt) {
            errors.push('Startdatum är inte giltigt ISO-format (YYYY-MM-DD)');
        } else {
            const today = new Date();
            // jämför "dag" grovt (UTC noon vs now) -> tillräckligt för framtidscheck
            if (startDt.getTime() > today.getTime()) {
                errors.push('Startdatum kan inte vara i framtiden');
            }
        }
    }

    const degree = (person.employmentPct ?? person.degree);
    if (!Number.isFinite(Number(degree)) || Number(degree) < 10 || Number(degree) > 100) {
        errors.push('Tjänstgöringsgrad måste vara 10-100%');
    }

    if (!isNonEmptyString(sector) || !HRF_VACATION_RULES[sector]) {
        errors.push(`Okänd sektor: ${sector}`);
    }

    const yearsEmployed = person.startDate ? calculateYearsEmployed(person.startDate, sector) : 0;

    return {
        valid: errors.length === 0,
        errors,
        yearsEmployed,
        vacationDaysPerYear: getVacationDaysPerYear(
            yearsEmployed,
            Number(degree || 100),
            sector,
            person.age
        ),
        sector: sector
    };
}

/**
 * Get all rules as readable text for sector
 */
export function getRulesAsText(sector = 'private') {
    const rules = getVacationRulesForSector(sector);
    const [monthStr] = rules.VACATION_YEAR_START.split('-');
    const monthNum = parseInt(monthStr, 10);
    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    const monthName = (monthNum >= 1 && monthNum <= 12) ? monthNames[monthNum - 1] : '?';

    return `
# Hotell- och Restaurangfackets Semesterregler — ${rules.name}

**Gällande från 1 april 2026**

## Sektor
- **${rules.name}**
- Källa: ${rules.url}

## Beräkningsperiod
- **Heltidare (100%)**: ${rules.CALCULATION_PERIOD_FULLTIME} veckor
- **Deltidare (<100%)**: ${rules.CALCULATION_PERIOD_PARTTIME} veckor
- **Perioden börjar**: ${rules.VACATION_YEAR_START} (${monthName})

## Semesterdagar per år (från ${monthName})

### Heltid (100%)
- **År 1-2**: ${rules.FULLTIME['0-2']} dagar
- **År 3-5**: ${rules.FULLTIME['2-5']} dagar
- **År 6+**: ${rules.FULLTIME['5+']} dagar

### Deltid (<100%)
- Beräknas proportionellt från heltid som standard i systemet.
- (Om tabell finns för en specifik deltid, t.ex. 80%, kan den visas som exempel.)

## Sparade semesterdagar
- Outnyttjade semesterdagar överförs till nästa semesterperiod
- Hanteras enligt kollektivavtal

## Röda dagar
- Arbetade röda dagar kompenseras enligt avtal/regelverk
- Påverkar inte semesterdagstalet direkt

---
*Systemet följer ${rules.name.toLowerCase()} enligt HRF/Kommunal-avtal*
    `;
}

/**
 * Compare sectors
 */
export function compareSectors() {
    const privateRules = HRF_VACATION_RULES.private;
    const municipalRules = HRF_VACATION_RULES.municipal;

    return {
        sectors: [
            {
                name: privateRules.name,
                fulltime2years: privateRules.FULLTIME['0-2'],
                fulltime6years: privateRules.FULLTIME['5+'],
                parttime2years: privateRules.PARTTIME['0-2'],
                parttime6years: privateRules.PARTTIME['5+'],
                calculationWeeks: privateRules.CALCULATION_PERIOD_FULLTIME,
                yearStart: privateRules.VACATION_YEAR_START
            },
            {
                name: municipalRules.name,
                fulltime2years: municipalRules.FULLTIME['0-2'],
                fulltime6years: municipalRules.FULLTIME['5+'],
                parttime2years: municipalRules.PARTTIME['0-2'],
                parttime6years: municipalRules.PARTTIME['5+'],
                calculationWeeks: municipalRules.CALCULATION_PERIOD_FULLTIME,
                yearStart: municipalRules.VACATION_YEAR_START,
                note: "Kommunal har åldersökning: 40+ år -> 31 dagar, 50+ år -> 32 dagar (exempel enligt praxis)"
            }
        ]
    };
}
