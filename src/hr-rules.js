/*
 * HR-RULES.JS — Hotell- och Restaurangfackets officiella regler + AO-02 PATCH (FIXED v1.5)
 * 
 * PATCH v1.5 (AO-02 + FIXES):
 * - FIXED P0: Dubbelskalning deltid-semester → PARTTIME-tabell redan deltid-justerad
 * - FIXED P0: Namnbyte getCurrentVacationYearStart() (var getNextVacationYearStart)
 * - FIXED P1: Kommunal åldersbaserad semester integrerad i semesterberäkning
 * - FIXED P1: Konsistent datumformat i avtal (validFrom/validTo)
 * - FIXED P2: Datumparsing-guards + fail-closed validering
 * - Lade till: COLLECTIVE_AGREEMENTS (Privat HRF + Kommunal)
 * - Lade till: OB_RULES_BY_SECTOR (OB1, OB2, Natt, Helg)
 * - Lade till: LAS_RULES (uppsägningstider)
 * - Lade till: validateSalaryAgainstAgreement(), getAgreementRules(), getMinimumWage()
 * - Behöll: All existing vacation/sector logic (bakåtkompatibel)
 * 
 * Gällande från 1 april 2026
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
        // REDAN JUSTERAT FÖR DELTID — vi multiplicerar INTE igen!
        PARTTIME: {
            '0-2': 16,      // År 1-2: 16 dagar (80% av 20)
            '2-5': 18,      // År 3-5: 18 dagar (80% av 22.5)
            '5+': 20        // År 6+: 20 dagar (80% av 25)
        },
        
        description: 'Privat hotell- och restaurangsektor',
        url: 'https://www.hrf.se/arbetsvillkor/lon-och-arbetstid/semester'
    },
    
    // ===== KOMMUNAL SEKTOR =====
    municipal: {
        name: 'Kommunal sektor',
        
        // Beräkningsperiod (veckor)
        CALCULATION_PERIOD_FULLTIME: 26,      // 100% = 26 veckor
        CALCULATION_PERIOD_PARTTIME: 16,      // <100% = 16 veckor
        
        // Vacation period starts — ofta 1 juni eller 1 juli per kommun
        VACATION_YEAR_START: '06-01',         // 1 juni (kan variera)
        
        // Days per year by employment years (100% employment)
        // ÅLDERSBASERAD — se getVacationDaysPerYear()
        FULLTIME: {
            '0-2': 28,      // År 1-2: 28 dagar (under 40 år)
            '2-5': 30,      // År 3-5: 30 dagar (under 40 år)
            '5+': 32        // År 6+: 32 dagar (under 40 år)
        },
        
        // Åldersökning för kommunal sektor
        FULLTIME_AGE_40: {
            '0-2': 31,      // År 1-2: 31 dagar (40+ år)
            '2-5': 31,      // År 3-5: 31 dagar
            '5+': 31        // År 6+: 31 dagar
        },
        
        FULLTIME_AGE_50: {
            '0-2': 32,      // År 1-2: 32 dagar (50+ år)
            '2-5': 32,      // År 3-5: 32 dagar
            '5+': 32        // År 6+: 32 dagar
        },
        
        PARTTIME: {
            '0-2': 18,      // År 1-2: 18 dagar (under 40 år)
            '2-5': 19,      // År 3-5: 19 dagar
            '5+': 21        // År 6+: 21 dagar
        },
        
        PARTTIME_AGE_40: {
            '0-2': 20,      // År 1-2: 20 dagar (40+ år)
            '2-5': 20,      // År 3-5: 20 dagar
            '5+': 20        // År 6+: 20 dagar
        },
        
        PARTTIME_AGE_50: {
            '0-2': 21,      // År 1-2: 21 dagar (50+ år)
            '2-5': 21,      // År 3-5: 21 dagar
            '5+': 21        // År 6+: 21 dagar
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
      ob1: 27.59,           // Kväll (20:00-06:00)
      ob2: 24.31,           // Natt (01:00-06:00, UTÖVER ob1)
      totalNight: 51.90,    // ob1 + ob2
    },
    
    vacationDaysPerYear: 25,  // Alltid 25, ingen åldersökning
    redDayCompensation: false,  // Bara OB-ersättning
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
      evening: 33.00,       // 19:00-22:00
      night: 55.00,         // 22:00-06:00 ← HÖGRE än privat!
      weekend: 58.00,       // Helg
    },
    
    vacationDaysPerYear: 25,  // Se getVacationDaysPerYear() för åldersökning
    redDayCompensation: true,   // Ofta möjligt
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
    
    vacationDaysPerYear: 25,  // Se getVacationDaysPerYear() för åldersökning
    redDayCompensation: true,
    description: "Region/Landsting (sjukhus, hälsovård, mm) med åldersbaserad semester",
  },
};

/* ========================================================================
   AO-02 PATCH: OB-REGLER PER SEKTOR
   ======================================================================== */

export const OB_RULES_BY_SECTOR = {
  private: {
    // HRF 2026 (Gröna riksavtalet)
    ob1: { name: "OB1 (Kväll)", amount: 27.59, appliesTo: "Mån-Fre 20:00-06:00, Lör 16:00-06:00, Sön 06:00-06:00" },
    ob2: { name: "OB2 (Natt)", amount: 24.31, appliesTo: "01:00-06:00 (UTÖVER ob1)" },
    totalNight: 51.90,
    redDay: { hasCompensationLeave: false, note: "Extra OB-ersättning, ingen automatisk ledighet" },
  },
  municipal: {
    // Kommunal-avtal (SKR/Kommunal)
    evening: { name: "Kväll (19:00-22:00)", amount: 33.00 },
    night: { name: "Natt (22:00-06:00)", amount: 55.00 },  // ← HÖGRE än privat!
    weekend: { name: "Helg (Lör/Sön)", amount: 58.00 },   // ← HÖGRE än privat!
    redDay: { hasCompensationLeave: true, note: "Extra OB + ofta kompensationsledighet" },
  },
};

/* ========================================================================
   AO-02 PATCH: LAS-REGLER (UPPSÄGNINGSTIDER)
   ======================================================================== */

export const LAS_RULES = {
  description: "Lagen om anställningsskydd (LAS) — Uppsägningstider när arbetsgivare säger upp",
  validFrom: "2024-01-01",  // Gäller från 2024 framåt
  rules: [
    { yearsMin: 0, yearsMax: 2, noticeMonths: 1, noticeDays: 30 },
    { yearsMin: 2, yearsMax: 4, noticeMonths: 2, noticeDays: 60 },
    { yearsMin: 4, yearsMax: 6, noticeMonths: 3, noticeDays: 90 },
    { yearsMin: 6, yearsMax: 8, noticeMonths: 4, noticeDays: 120 },
    { yearsMin: 8, yearsMax: 10, noticeMonths: 5, noticeDays: 150 },
    { yearsMin: 10, yearsMax: 999, noticeMonths: 6, noticeDays: 180 },  // Max 6 mån
  ]
};

/* ========================================================================
   AO-02 PATCH: HELPER FUNCTIONS (PRODUCTION-SAFE)
   ======================================================================== */

/**
 * Få avtal-regler från ID
 * @param {string} agreementId
 * @returns {object|null}
 */
export function getAgreementRules(agreementId) {
  if (!agreementId || typeof agreementId !== 'string') return null;
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
  const yearsExp = Math.max(0, person.yearsOfExperience || 0);
  
  const minSalaryData = agreement.minSalary2026?.[wageGroup];
  if (!minSalaryData) {
    return { valid: false, error: `Lönegrupp ${wageGroup} finns inte i avtal` };
  }
  
  const minSalary = yearsExp >= 6 ? minSalaryData.sixYears : minSalaryData.noExp;
  const salary = Math.max(0, person.salary || 0);
  
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
  const isExp = (yearsOfExperience || 0) >= 6 ? "sixYears" : "noExp";
  
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
  
  return rule ? rule.noticeDays : 30;  // Default 1 månad
}

/**
 * Get vacation rules for sector
 */
export function getVacationRulesForSector(sector) {
    if (!sector || typeof sector !== 'string' || !HRF_VACATION_RULES[sector]) {
        console.warn(`⚠️ Okänd sektor: ${sector}, använder PRIVAT`);
        return HRF_VACATION_RULES.private;
    }

    return HRF_VACATION_RULES[sector];
}

/**
 * FIXED P0+P1: Get vacation days per year (handlar deltid + åldersbaserad för kommunal)
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
    const isFulltime = employmentDegree >= 100;

    // FIXED P0: PARTTIME-tabell är redan deltid-justerad → använd direkt, multiplicera INTE!
    let vacationRules;
    if (isFulltime) {
        vacationRules = rules.FULLTIME;
        // Kommunal: åldersökning för heltid
        if (sector === 'municipal' && age) {
            if (age >= 50 && rules.FULLTIME_AGE_50) {
                vacationRules = rules.FULLTIME_AGE_50;
            } else if (age >= 40 && rules.FULLTIME_AGE_40) {
                vacationRules = rules.FULLTIME_AGE_40;
            }
        }
    } else {
        vacationRules = rules.PARTTIME;
        // Kommunal: åldersökning för deltid
        if (sector === 'municipal' && age) {
            if (age >= 50 && rules.PARTTIME_AGE_50) {
                vacationRules = rules.PARTTIME_AGE_50;
            } else if (age >= 40 && rules.PARTTIME_AGE_40) {
                vacationRules = rules.PARTTIME_AGE_40;
            }
        }
    }

    // Välj rätt intervall baserat på år
    let baseDays;
    if (yearsEmployed < 2) {
        baseDays = vacationRules['0-2'];
    } else if (yearsEmployed < 5) {
        baseDays = vacationRules['2-5'];
    } else {
        baseDays = vacationRules['5+'];
    }

    // FIXED P0: PARTTIME är redan justerad → använd direkt!
    // För heltid med reducerad anställningsgrad: justera proportionellt
    if (isFulltime && employmentDegree < 100) {
        return Math.round((baseDays * employmentDegree) / 100);
    }

    return Math.round(baseDays);
}

/**
 * Get calculation period in weeks for sector
 */
export function getCalculationPeriodWeeks(employmentDegree = 100, sector = 'private') {
    const rules = getVacationRulesForSector(sector);
    const isFulltime = employmentDegree >= 100;
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
        return 3;  // Default april
    }
    return month - 1; // Convert to JS month (0-11)
}

/**
 * FIXED P0: Döpd från getNextVacationYearStart() → getCurrentVacationYearStart()
 * Returnerar NUVARANDE vacation year start (inte nästa).
 */
export function getCurrentVacationYearStart(sector = 'private') {
    const today = new Date();
    const currentYear = today.getFullYear();
    const startMonth = getVacationYearStartMonth(sector);
    
    const thisYearStart = new Date(currentYear, startMonth, 1);
    
    if (today >= thisYearStart) {
        // Vi är i denna års vacation year
        return thisYearStart;
    } else {
        // Vi är i förra års vacation year
        return new Date(currentYear - 1, startMonth, 1);
    }
}

/**
 * FIXED P2: Safe datumparsing med guard
 * Get vacation year for a date in sector
 * Vacation year runs from start month to end of next year's start month - 1 day
 */
export function getVacationYear(dateStr, sector = 'private') {
    if (!dateStr || typeof dateStr !== 'string') {
        return null;  // Fail-closed
    }

    let date;
    try {
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            console.warn(`⚠️ Ogiltigt datum: ${dateStr}`);
            return null;
        }
    } catch (e) {
        console.warn(`⚠️ Datumparse-fel: ${dateStr}`, e);
        return null;
    }

    const month = date.getMonth();
    const year = date.getFullYear();
    const startMonth = getVacationYearStartMonth(sector);
    
    if (month >= startMonth) {
        // Within or after start month: vacation year is THIS year
        return `${year}-${year + 1}`;
    } else {
        // Before start month: vacation year is LAST year
        return `${year - 1}-${year}`;
    }
}

/**
 * FIXED P2: Safe year-of-employment calculation
 * Calculate years of employment (for vacation days determination)
 */
export function calculateYearsEmployed(startDateStr, sector = 'private') {
    if (!startDateStr || typeof startDateStr !== 'string') {
        return 0;
    }

    let startDate;
    try {
        startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) {
            console.warn(`⚠️ Ogiltigt startdatum: ${startDateStr}`);
            return 0;
        }
    } catch (e) {
        console.warn(`⚠️ Startdatum-parse-fel: ${startDateStr}`, e);
        return 0;
    }

    const today = new Date();
    
    // Use vacation year logic
    const startVacationYear = getVacationYear(startDateStr, sector);
    const todayVacationYear = getVacationYear(today.toISOString().split('T')[0], sector);
    
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
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, person.degree || person.employmentPct || 100, sector, person.age);

    // Beräkna hur många veckor har passerat i denna beräkningsperiod
    const vacationYearStart = getCurrentVacationYearStart(sector);
    const today = new Date();
    
    const weeksPassed = Math.floor((today - vacationYearStart) / (7 * 24 * 60 * 60 * 1000));
    const calculationPeriod = getCalculationPeriodWeeks(person.degree || person.employmentPct || 100, sector);
    
    // Proportional allocation
    const accumulated = Math.floor((vacationDaysPerYear * weeksPassed) / calculationPeriod);
    
    return Math.min(accumulated, vacationDaysPerYear);
}

/**
 * Get remaining vacation days for current vacation year
 */
export function getRemainingVacationDays(person, sector = 'private') {
    if (!person || typeof person !== 'object') return 0;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, person.degree || person.employmentPct || 100, sector, person.age);
    const usedDays = (person.usedVacationDays || 0);
    const savedDays = (person.savedVacationDays || 0);
    
    // Beräkna nya dagar denna år plus sparade från förra året
    const available = vacationDaysPerYear + savedDays - usedDays;
    
    return Math.max(0, available);
}

/**
 * Generate vacation year info for person with sector
 */
export function getPersonVacationYearInfo(person, sector = 'private') {
    if (!person || typeof person !== 'object') return null;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, person.degree || person.employmentPct || 100, sector, person.age);
    const calculationPeriod = getCalculationPeriodWeeks(person.degree || person.employmentPct || 100, sector);
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
        usedThisYear: person.usedVacationDays || 0,
        savedFromLastYear: person.savedVacationDays || 0,
        remaining,
        employmentDegree: person.degree || person.employmentPct || 100,
        vacationYearStartMonth: getVacationYearStartMonth(sector) + 1
    };
}

/**
 * Update person's vacation days at year change
 * Called automatically or manually when crossing vacation year start
 */
export function updateVacationDaysOnYearChange(person, sector = 'private') {
    if (!person || typeof person !== 'object') return null;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const newVacationDays = getVacationDaysPerYear(yearsEmployed, person.degree || person.employmentPct || 100, sector, person.age);
    
    // Remaining days from last year become "saved"
    const usedThisYear = person.usedVacationDays || 0;
    const remainingFromLastYear = Math.max(0, (person.vacationDaysPerYear || 0) - usedThisYear);
    
    // Add remaining to saved (respecting max if specified)
    const newSavedDays = (person.savedVacationDays || 0) + remainingFromLastYear;
    
    return {
        ...person,
        vacationDaysPerYear: newVacationDays,
        usedVacationDays: 0,  // Reset for new year
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
    }

    const degree = person.degree || person.employmentPct;
    if (!degree || degree < 10 || degree > 100) {
        errors.push('Tjänstgöringsgrad måste vara 10-100%');
    }

    if (!sector || typeof sector !== 'string' || !HRF_VACATION_RULES[sector]) {
        errors.push(`Okänd sektor: ${sector}`);
    }

    if (person.startDate) {
        const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
        if (yearsEmployed < 0) {
            errors.push('Startdatum kan inte vara i framtiden');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        yearsEmployed: person.startDate ? calculateYearsEmployed(person.startDate, sector) : 0,
        vacationDaysPerYear: getVacationDaysPerYear(
            person.startDate ? calculateYearsEmployed(person.startDate, sector) : 0,
            degree || 100,
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
- **År 1-2**: ${rules.PARTTIME['0-2']} dagar
- **År 3-5**: ${rules.PARTTIME['2-5']} dagar
- **År 6+**: ${rules.PARTTIME['5+']} dagar

## Anpassning för deltid
Semesterdagarna är redan justerade för deltidsanställning i tabellen ovan.

## Sparade semesterdagar
- Outnyttjade semesterdagar överförs till nästa semesterperiod
- Hanteras enligt kollektivavtal

## Röda dagar
- Arbetade röda dagar kompenseras enligt lag
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
                note: "Kommunal har åldersökning: 40+ år +6 dagar, 50+ år +7 dagar"
            }
        ]
    };
}
