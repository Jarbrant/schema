/*
 * COST-UTILS.JS — Kostnadskalkyler för personal
 * 
 * Beräknar:
 * - Månadslön ↔ Timlön
 * - Arbetsgivaravgifter
 * - Preliminär skatt (uppskattning)
 * - Total kostnad per timme/dag/månad
 * 
 * Standard (2026):
 * - Arbetsgivaravgift: 31.42% (standard)
 * - Genomsnittlig månad: 167 arbetstimmar
 * - Skatt: 30% (basic uppskattning)
 *
 * PATCH (v2.1 mini):
 * 1) P0: employmentPct fallback till degree (bakåtkompatibelt schema).
 * 2) P0: calculateCostPerGroup använder groupIds som primär, fallback till groups.
 * 3) P1: getEmployerTaxRate robust: Number(age) + Number.isFinite + age == null guard.
 */

// ============================================================================
// KONSTANTER
// ============================================================================

/** Standard arbetstimmar per månad (genomsnitt) */
export const HOURS_PER_MONTH = 167;

/** Standard arbetsgivaravgift (31.42%) */
export const EMPLOYER_TAX_RATE_STANDARD = 0.3142;

/** Reducerad arbetsgivaravgift för unga (< 26 år): ca 20% */
export const EMPLOYER_TAX_RATE_YOUNG = 0.2000;

/** Reducerad arbetsgivaravgift för äldre (> 65 år): ca 10% */
export const EMPLOYER_TAX_RATE_SENIOR = 0.1031;

/** Standard preliminär skatt (30% uppskattning) */
export const TAX_RATE_DEFAULT = 0.30;

// ============================================================================
// KONVERTERINGSFUNKTIONER
// ============================================================================

/**
 * Konvertera månadslön till timlön
 * @param {number} monthlySalary - Månadslön (SEK)
 * @param {number} hoursPerMonth - Timmar per månad (default 167)
 * @returns {number} Timlön (SEK)
 */
export function monthlyToHourly(monthlySalary, hoursPerMonth = HOURS_PER_MONTH) {
  if (!monthlySalary || monthlySalary <= 0) return 0;
  if (!hoursPerMonth || hoursPerMonth <= 0) return 0;
  return monthlySalary / hoursPerMonth;
}

/**
 * Konvertera timlön till månadslön
 * @param {number} hourlyWage - Timlön (SEK)
 * @param {number} hoursPerMonth - Timmar per månad (default 167)
 * @returns {number} Månadslön (SEK)
 */
export function hourlyToMonthly(hourlyWage, hoursPerMonth = HOURS_PER_MONTH) {
  if (!hourlyWage || hourlyWage <= 0) return 0;
  if (!hoursPerMonth || hoursPerMonth <= 0) return 0;
  return hourlyWage * hoursPerMonth;
}

/**
 * Justera lön baserat på anställningsgrad
 * @param {number} fullSalary - Heltidslön (SEK)
 * @param {number} employmentPct - Anställningsgrad (0-100)
 * @returns {number} Justerad lön (SEK)
 */
export function adjustForEmployment(fullSalary, employmentPct) {
  if (!fullSalary || fullSalary <= 0) return 0;
  if (!employmentPct || employmentPct <= 0) return 0;
  if (employmentPct > 100) employmentPct = 100;
  return fullSalary * (employmentPct / 100);
}

// ============================================================================
// ARBETSGIVARAVGIFT
// ============================================================================

/**
 * Beräkna arbetsgivaravgift
 * @param {number} salary - Bruttolön (SEK)
 * @param {number} rate - Avgiftssats (default 0.3142)
 * @returns {number} Arbetsgivaravgift (SEK)
 */
export function calculateEmployerTax(salary, rate = EMPLOYER_TAX_RATE_STANDARD) {
  if (!salary || salary <= 0) return 0;
  if (!rate || rate < 0) return 0;
  return salary * rate;
}

/**
 * Välj arbetsgivaravgiftssats baserat på ålder
 * @param {number|string|null|undefined} age - Ålder (år)
 * @returns {number} Avgiftssats
 */
export function getEmployerTaxRate(age) {
  // P1: robust guard (null/undefined/NaN/strings)
  if (age == null) return EMPLOYER_TAX_RATE_STANDARD;

  const ageNum = Number(age);
  if (!Number.isFinite(ageNum)) return EMPLOYER_TAX_RATE_STANDARD;

  if (ageNum < 26) {
    return EMPLOYER_TAX_RATE_YOUNG; // Reducerad för unga
  } else if (ageNum > 65) {
    return EMPLOYER_TAX_RATE_SENIOR; // Reducerad för pensionärer
  }

  return EMPLOYER_TAX_RATE_STANDARD; // Standard
}

// ============================================================================
// SKATT (UPPSKATTNING)
// ============================================================================

/**
 * Uppskatta preliminär skatt (förenklad)
 * @param {number} grossSalary - Bruttolön (SEK)
 * @param {number} taxRate - Skattesats (default 0.30)
 * @returns {number} Preliminär skatt (SEK)
 */
export function estimateTax(grossSalary, taxRate = TAX_RATE_DEFAULT) {
  if (!grossSalary || grossSalary <= 0) return 0;
  if (!taxRate || taxRate < 0) return 0;
  return grossSalary * taxRate;
}

/**
 * Beräkna nettolön (efter skatt)
 * @param {number} grossSalary - Bruttolön (SEK)
 * @param {number} taxRate - Skattesats (default 0.30)
 * @returns {number} Nettolön (SEK)
 */
export function calculateNetSalary(grossSalary, taxRate = TAX_RATE_DEFAULT) {
  if (!grossSalary || grossSalary <= 0) return 0;
  const tax = estimateTax(grossSalary, taxRate);
  return grossSalary - tax;
}

// ============================================================================
// TOTAL KOSTNAD
// ============================================================================

/**
 * Beräkna total kostnad för arbetsgivare (lön + arbetsgivaravgift)
 * @param {number} salary - Bruttolön (SEK)
 * @param {number} employerTaxRate - Arbetsgivaravgift (default 0.3142)
 * @returns {object} { salary, employerTax, totalCost }
 */
export function calculateTotalCost(salary, employerTaxRate = EMPLOYER_TAX_RATE_STANDARD) {
  if (!salary || salary <= 0) {
    return {
      salary: 0,
      employerTax: 0,
      totalCost: 0
    };
  }

  const employerTax = calculateEmployerTax(salary, employerTaxRate);
  const totalCost = salary + employerTax;

  return {
    salary: salary,
    employerTax: employerTax,
    totalCost: totalCost
  };
}

/**
 * Beräkna total månadskostnad för en person
 * @param {object} person - Person objekt
 * @param {number} person.salary - Månadslön
 * @param {number} person.employmentPct - Anställningsgrad (0-100)
 * @param {number} person.degree - (fallback) Tjänstgöringsgrad (0-100)
 * @param {number} person.employerTaxRate - Arbetsgivaravgift (optional)
 * @param {number|string} person.age - Ålder (för att bestämma avgiftssats)
 * @returns {object} Kostnadskalkyl
 */
export function calculatePersonMonthlyCost(person) {
  if (!person) {
    return {
      grossSalary: 0,
      adjustedSalary: 0,
      employerTax: 0,
      totalCost: 0,
      hourlyRate: 0,
      hourlyCost: 0
    };
  }

  const grossSalary = person.salary || 0;

  // P0: schema-mismatch fix (employmentPct fallback till degree)
  const employmentPct = (person.employmentPct ?? person.degree ?? 100);

  // Justera för deltid
  const adjustedSalary = adjustForEmployment(grossSalary, employmentPct);

  // Välj arbetsgivaravgift
  let employerTaxRate = person.employerTaxRate || EMPLOYER_TAX_RATE_STANDARD;
  if (person.age != null) {
    employerTaxRate = getEmployerTaxRate(person.age);
  }

  // Beräkna total kostnad
  const costBreakdown = calculateTotalCost(adjustedSalary, employerTaxRate);

  // Beräkna tim-kostnader
  const hourlyRate = monthlyToHourly(adjustedSalary);
  const hourlyCost = monthlyToHourly(costBreakdown.totalCost);

  return {
    grossSalary: grossSalary,
    adjustedSalary: adjustedSalary,
    employerTax: costBreakdown.employerTax,
    totalCost: costBreakdown.totalCost,
    hourlyRate: hourlyRate,
    hourlyCost: hourlyCost,
    employerTaxRate: employerTaxRate
  };
}

/**
 * Beräkna kostnad för arbetade timmar
 * @param {number} hours - Antal timmar
 * @param {number} hourlyCost - Kostnad per timme (inkl arbetsgivaravgift)
 * @returns {number} Total kostnad (SEK)
 */
export function calculateHoursCost(hours, hourlyCost) {
  if (!hours || hours <= 0) return 0;
  if (!hourlyCost || hourlyCost <= 0) return 0;
  return hours * hourlyCost;
}

// ============================================================================
// AGGREGERING
// ============================================================================

/**
 * Beräkna total månadskostnad för flera personer
 * @param {Array} people - Array av person-objekt
 * @returns {object} Aggregerad kostnad
 */
export function calculateTotalMonthlyCost(people) {
  if (!Array.isArray(people) || people.length === 0) {
    return {
      totalSalary: 0,
      totalEmployerTax: 0,
      totalCost: 0,
      peopleCount: 0,
      averageCost: 0
    };
  }

  let totalSalary = 0;
  let totalEmployerTax = 0;
  let totalCost = 0;

  people.forEach(person => {
    const cost = calculatePersonMonthlyCost(person);
    totalSalary += cost.adjustedSalary;
    totalEmployerTax += cost.employerTax;
    totalCost += cost.totalCost;
  });

  return {
    totalSalary: totalSalary,
    totalEmployerTax: totalEmployerTax,
    totalCost: totalCost,
    peopleCount: people.length,
    averageCost: people.length > 0 ? totalCost / people.length : 0
  };
}

/**
 * Beräkna kostnad per grupp
 * @param {Array} people - Array av person-objekt
 * @param {Array} groups - Array av grupp-objekt
 * @returns {object} Kostnad per grupp { groupId: cost }
 */
export function calculateCostPerGroup(people, groups) {
  if (!Array.isArray(people) || !Array.isArray(groups)) {
    return {};
  }

  const costPerGroup = {};

  groups.forEach(group => {
    // P0: groupIds primär (canonical), fallback till groups (bakåtkompatibelt)
    const groupPeople = people.filter(person => {
      const ids = Array.isArray(person?.groupIds)
        ? person.groupIds
        : (Array.isArray(person?.groups) ? person.groups : []);
      return ids.includes(group.id);
    });

    const groupCost = calculateTotalMonthlyCost(groupPeople);

    costPerGroup[group.id] = {
      groupName: group.name,
      totalCost: groupCost.totalCost,
      peopleCount: groupCost.peopleCount,
      averageCost: groupCost.averageCost
    };
  });

  return costPerGroup;
}

/**
 * Formatera belopp till SEK-format
 * @param {number} amount - Belopp
 * @returns {string} Formaterat belopp (t.ex. "35 000 kr")
 */
export function formatCurrency(amount) {
  if (typeof amount !== 'number') return '0 kr';
  return amount.toLocaleString('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' kr';
}

/**
 * Formatera belopp med decimaler
 * @param {number} amount - Belopp
 * @param {number} decimals - Antal decimaler (default 2)
 * @returns {string} Formaterat belopp
 */
export function formatCurrencyDetailed(amount, decimals = 2) {
  if (typeof amount !== 'number') return '0,00 kr';
  return amount.toLocaleString('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }) + ' kr';
}
