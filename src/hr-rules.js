/*
 * HR-RULES.JS — Hotell- och Restaurangfackets officiella regler
 * 
 * Stöd för både PRIVAT och KOMMUNAL sektor
 * Gällande från 1 april 2026
 * Källa: https://www.hrf.se/arbetsvillkor/lon-och-arbetstid/semester
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
        PARTTIME: {
            '0-2': 16,      // År 1-2: 16 dagar
            '2-5': 18,      // År 3-5: 18 dagar
            '5+': 20        // År 6+: 20 dagar
        },
        
        description: 'Privat hotell- och restaurangsektor',
        url: 'https://www.hrf.se/arbetsvillkor/lon-och-arbetstid/semester'
    },
    
    // ===== KOMMUNAL SEKTOR =====
    municipal: {
        name: 'Kommunal sektor',
        
        // Beräkningsperiod (veckor) - ofta samma men kan variera per kommun
        CALCULATION_PERIOD_FULLTIME: 26,      // 100% = 26 veckor
        CALCULATION_PERIOD_PARTTIME: 16,      // <100% = 16 veckor
        
        // Vacation period starts - kan variera per kommun (ofta 1 juni eller 1 juli)
        VACATION_YEAR_START: '06-01',         // 1 juni (kan variera)
        
        // Days per year by employment years (100% employment)
        // Ofta högre i kommunal sektor
        FULLTIME: {
            '0-2': 28,      // År 1-2: 28 dagar (högre än privat)
            '2-5': 30,      // År 3-5: 30 dagar
            '5+': 32        // År 6+: 32 dagar
        },
        
        // Days per year by employment years (<100% employment)
        PARTTIME: {
            '0-2': 18,      // År 1-2: 18 dagar
            '2-5': 19,      // År 3-5: 19 dagar
            '5+': 21        // År 6+: 21 dagar
        },
        
        description: 'Kommunal sektor (ofta enligt arbetsgruppsavtal)',
        url: 'https://www.lo.se/rad-och-stod/kollektivavtal'
    }
};

/**
 * Get vacation rules for sector
 */
export function getVacationRulesForSector(sector) {
    if (!sector || !HRF_VACATION_RULES[sector]) {
        console.warn(`⚠️ Okänd sektor: ${sector}, använder PRIVAT`);
        return HRF_VACATION_RULES.private;
    }

    return HRF_VACATION_RULES[sector];
}

/**
 * Get vacation days per year based on HRF rules and sector
 * 
 * @param {number} yearsEmployed - Antal år anställd
 * @param {number} employmentDegree - Tjänstgöringsgrad (10-100)
 * @param {string} sector - 'private' eller 'municipal'
 * @returns {number} Semesterdagar
 */
export function getVacationDaysPerYear(yearsEmployed, employmentDegree = 100, sector = 'private') {
    if (!yearsEmployed || yearsEmployed < 0) {
        yearsEmployed = 0;
    }

    const rules = getVacationRulesForSector(sector);

    // Välj baserat på deltid/heltid
    const isFulltime = employmentDegree >= 100;
    const vacationRules = isFulltime ? rules.FULLTIME : rules.PARTTIME;

    // Välj rätt intervall baserat på år
    let baseDays;
    if (yearsEmployed < 2) {
        baseDays = vacationRules['0-2'];
    } else if (yearsEmployed < 5) {
        baseDays = vacationRules['2-5'];
    } else {
        baseDays = vacationRules['5+'];
    }

    // Justera för deltid
    const adjustedDays = (baseDays * employmentDegree) / 100;
    return Math.round(adjustedDays);
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
    const [month] = rules.VACATION_YEAR_START.split('-').map(Number);
    return month - 1; // Convert to JS month (0-11)
}

/**
 * Get next vacation year start date for sector
 */
export function getNextVacationYearStart(sector = 'private') {
    const today = new Date();
    const currentYear = today.getFullYear();
    const startMonth = getVacationYearStartMonth(sector);
    
    const thisYearStart = new Date(currentYear, startMonth, 1);
    
    if (today >= thisYearStart) {
        // We're in this year's vacation year
        return thisYearStart;
    } else {
        // We're in last year's vacation year
        return new Date(currentYear - 1, startMonth, 1);
    }
}

/**
 * Get vacation year for a date in sector
 * Vacation year runs from start month to end of next year's start month - 1 day
 */
export function getVacationYear(dateStr, sector = 'private') {
    const date = new Date(dateStr);
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
 * Calculate years of employment (for vacation days determination)
 */
export function calculateYearsEmployed(startDateStr, sector = 'private') {
    if (!startDateStr) return 0;

    const startDate = new Date(startDateStr);
    const today = new Date();
    
    // Use vacation year logic
    const startVacationYear = getVacationYear(startDateStr, sector);
    const todayVacationYear = getVacationYear(today.toISOString(), sector);
    
    const [startYear] = startVacationYear.split('-').map(Number);
    const [todayYear] = todayVacationYear.split('-').map(Number);
    
    return todayYear - startYear;
}

/**
 * Get vacation days accumulated for current vacation year
 */
export function getAccumulatedVacationDays(person, sector = 'private') {
    if (!person) return 0;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, person.degree, sector);

    // Beräkna hur många veckor har passerat i denna beräkningsperiod
    const vacationYearStart = getNextVacationYearStart(sector);
    const today = new Date();
    
    const weeksPassed = Math.floor((today - vacationYearStart) / (7 * 24 * 60 * 60 * 1000));
    const calculationPeriod = getCalculationPeriodWeeks(person.degree, sector);
    
    // Proportional allocation
    const accumulated = Math.floor((vacationDaysPerYear * weeksPassed) / calculationPeriod);
    
    return Math.min(accumulated, vacationDaysPerYear);
}

/**
 * Get remaining vacation days for current vacation year
 */
export function getRemainingVacationDays(person, sector = 'private') {
    if (!person) return 0;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, person.degree, sector);
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
    if (!person) return null;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, person.degree, sector);
    const calculationPeriod = getCalculationPeriodWeeks(person.degree, sector);
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
        employmentDegree: person.degree,
        vacationYearStartMonth: getVacationYearStartMonth(sector) + 1
    };
}

/**
 * Update person's vacation days at year change
 * Called automatically or manually when crossing vacation year start
 */
export function updateVacationDaysOnYearChange(person, sector = 'private') {
    if (!person) return null;

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    const newVacationDays = getVacationDaysPerYear(yearsEmployed, person.degree, sector);
    
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

    if (!person.startDate) {
        errors.push('Startdatum saknas');
    }

    if (!person.degree || person.degree < 10 || person.degree > 100) {
        errors.push('Tjänstgöringsgrad måste vara 10-100%');
    }

    if (!sector || !HRF_VACATION_RULES[sector]) {
        errors.push(`Okänd sektor: ${sector}`);
    }

    const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
    if (yearsEmployed < 0) {
        errors.push('Startdatum kan inte vara i framtiden');
    }

    return {
        valid: errors.length === 0,
        errors,
        yearsEmployed,
        vacationDaysPerYear: getVacationDaysPerYear(yearsEmployed, person.degree, sector),
        sector: sector
    };
}

/**
 * Get all rules as readable text for sector
 */
export function getRulesAsText(sector = 'private') {
    const rules = getVacationRulesForSector(sector);
    const startMonth = rules.VACATION_YEAR_START.split('-')[0];
    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    const monthName = monthNames[parseInt(startMonth) - 1];

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
Semesterdagarna justeras enligt tjänstgöringsgraden:
- 80% anställd får 80% av heltidsgraden
- Exempel: 80% × ${rules.FULLTIME['0-2']} dagar = ${Math.round(0.8 * rules.FULLTIME['0-2'])} dagar

## Sparade semesterdagar
- Outnyttjade semesterdagar överförs till nästa semesterperiod
- Hanteras enligt kollektivavtal

## Röda dagar
- Arbetade röda dagar kompenseras enligt lag
- Påverkar inte semesterdagstalet direkt

---
*Systemet följer ${rules.name.toLowerCase()} enligt HRF/LO-avtal*
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
                yearStart: municipalRules.VACATION_YEAR_START
            }
        ]
    };
}
