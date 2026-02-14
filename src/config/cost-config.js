/*
 * COST-CONFIG.JS — Kostnadskonfiguration per år
 * 
 * Innehåller årliga regelpaket för:
 * - Arbetsgivaravgifter per åldersgrupp
 * - Standard skattesatser
 * - Arbetstidsregler
 */

/**
 * Kostnadskonfiguration för 2026
 */
export const COST_CONFIG_2026 = {
    year: 2026,
    
    // Arbetsgivaravgifter (%)
    employerTax: {
        standard: 31.42,      // Standard (26-65 år)
        young: 20.00,         // Reducerad för unga (< 26 år)
        senior: 10.31,        // Reducerad för äldre (> 65 år)
        description: 'Arbetsgivaravgifter enligt Skatteverket 2026'
    },
    
    // Skattesatser (uppskattning)
    tax: {
        default: 30.00,       // Standard uppskattning
        low: 20.00,           // Låg skatt (t.ex. låg inkomst)
        medium: 30.00,        // Medel skatt
        high: 50.00,          // Hög skatt (över brytpunkt)
        description: 'Preliminär skatt (uppskattning)'
    },
    
    // Arbetstidsregler
    workTime: {
        hoursPerMonth: 167,           // Standard månad
        hoursPerYear: 2000,           // Standard år (ca 40h/vecka × 50 veckor)
        daysPerYear: 250,             // Arbetsdagar per år
        weeksPerYear: 52,             // Veckor per år
        standardWeekHours: 40,        // Standard arbetsvecka
        description: 'Standard arbetstider'
    },
    
    // Semesterregler
    vacation: {
        minimumDays: 25,              // Minsta lagstadgad semester
        savableDays: 5,               // Max sparade dagar (vanligt)
        description: 'Semesterregler enligt semesterlagen'
    },
    
    // OB-tillägg (för framtida bruk)
    obSupplement: {
        evening: 0.10,                // 10% kvällstillägg
        night: 0.40,                  // 40% natttillägg
        weekend: 0.15,                // 15% helgtillägg
        description: 'OB-tillägg (exempel, kan variera per avtal)'
    }
};

/**
 * Hämta kostnadskonfiguration för ett specifikt år
 * @param {number} year - År (t.ex. 2026)
 * @returns {object} Kostnadskonfig för året
 */
export function getCostConfig(year = 2026) {
    // För nu: returnera endast 2026
    // I framtiden: lägg till fler år
    if (year === 2026) {
        return COST_CONFIG_2026;
    }
    
    // Fallback: returnera 2026 som default
    console.warn(`⚠️ Kostnadskonfig för år ${year} saknas, använder 2026 som default`);
    return COST_CONFIG_2026;
}

/**
 * Hämta arbetsgivaravgiftssats baserat på ålder och år
 * @param {number} age - Ålder (år)
 * @param {number} year - År (default 2026)
 * @returns {number} Avgiftssats (decimal, t.ex. 0.3142)
 */
export function getEmployerTaxRateForAge(age, year = 2026) {
    const config = getCostConfig(year);
    
    if (!age) {
        return config.employerTax.standard / 100;
    }
    
    if (age < 26) {
        return config.employerTax.young / 100;
    } else if (age > 65) {
        return config.employerTax.senior / 100;
    }
    
    return config.employerTax.standard / 100;
}

/**
 * Hämta standard skattesats
 * @param {number} year - År (default 2026)
 * @returns {number} Skattesats (decimal, t.ex. 0.30)
 */
export function getDefaultTaxRate(year = 2026) {
    const config = getCostConfig(year);
    return config.tax.default / 100;
}

/**
 * Hämta standard timmar per månad
 * @param {number} year - År (default 2026)
 * @returns {number} Timmar per månad
 */
export function getHoursPerMonth(year = 2026) {
    const config = getCostConfig(year);
    return config.workTime.hoursPerMonth;
}

/**
 * Exportera alla configs
 */
export default {
    COST_CONFIG_2026,
    getCostConfig,
    getEmployerTaxRateForAge,
    getDefaultTaxRate,
    getHoursPerMonth
};
