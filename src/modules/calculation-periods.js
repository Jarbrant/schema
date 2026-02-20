/*
 * AO-12 — Calculation Periods Module — v1.0
 * FIL: src/modules/calculation-periods.js
 *
 * Globala beräkningsperioder (Q1–Q4) med individuell startperiod per person.
 * HRF-kompatibelt: kvartalsvisa perioder (13 veckor).
 *
 * Datamodell:
 *   state.settings.calculationPeriods = [
 *     { id: 'q1', name: 'Q1', startDate: '2025-01-01', endDate: '2025-03-31' },
 *     ...
 *   ]
 *   state.people[n].calculationPeriodStart = 'q1' | 'q2' | 'q3' | 'q4'
 *
 * Exports:
 *   - getDefaultPeriods(year)
 *   - getPersonPeriods(person, settings, year)
 *   - getActivePeriod(date, periods)
 *   - calcPeriodBalance(person, period, scheduleMonths, shifts, shiftTemplates)
 *   - calcAllPersonBalances(people, settings, scheduleMonths, shifts, shiftTemplates, year)
 *   - getHRFWeeklyTarget(employmentPct)
 */

import { calcShiftHours } from './schedule-engine.js';

/* ============================================================
 * CONSTANTS — HRF
 * ============================================================ */
const HRF_FULL_TIME_HOURS_WEEK = 40;    // Heltid = 40 tim/vecka
const HRF_FULL_TIME_HOURS_YEAR = 2080;  // 40 × 52
const WEEKS_PER_QUARTER = 13;

const PERIOD_NAMES = {
    q1: 'Q1 (Jan–Mar)',
    q2: 'Q2 (Apr–Jun)',
    q3: 'Q3 (Jul–Sep)',
    q4: 'Q4 (Okt–Dec)',
};

/* ============================================================
 * getDefaultPeriods — Generera globala kvartalsvisa perioder
 * ============================================================ */
export function getDefaultPeriods(year) {
    if (!year || typeof year !== 'number') year = new Date().getFullYear();
    return [
        { id: 'q1', name: 'Q1 (Jan–Mar)', startDate: `${year}-01-01`, endDate: `${year}-03-31` },
        { id: 'q2', name: 'Q2 (Apr–Jun)', startDate: `${year}-04-01`, endDate: `${year}-06-30` },
        { id: 'q3', name: 'Q3 (Jul–Sep)', startDate: `${year}-07-01`, endDate: `${year}-09-30` },
        { id: 'q4', name: 'Q4 (Okt–Dec)', startDate: `${year}-10-01`, endDate: `${year}-12-31` },
    ];
}

/* ============================================================
 * getPersonPeriods — Hämta personens aktiva perioder
 *
 * Returnerar bara perioder från personens startperiod och framåt.
 * Ex: person med calculationPeriodStart='q2' → [Q2, Q3, Q4]
 * ============================================================ */
export function getPersonPeriods(person, settings, year) {
    const allPeriods = (settings?.calculationPeriods?.length > 0)
        ? settings.calculationPeriods
        : getDefaultPeriods(year);

    const startPeriodId = person?.calculationPeriodStart || 'q1';

    /* Hitta index för startperioden */
    const startIdx = allPeriods.findIndex(p => p.id === startPeriodId);
    if (startIdx === -1) return allPeriods; /* fallback: alla perioder */

    return allPeriods.slice(startIdx);
}

/* ============================================================
 * getActivePeriod — Vilken period är ett datum i?
 * ============================================================ */
export function getActivePeriod(dateStr, periods) {
    if (!dateStr || !Array.isArray(periods)) return null;
    return periods.find(p => dateStr >= p.startDate && dateStr <= p.endDate) || null;
}

/* ============================================================
 * getHRFWeeklyTarget — Måltimmar per vecka baserat på tjänstgöringsgrad
 * ============================================================ */
export function getHRFWeeklyTarget(employmentPct) {
    const pct = (typeof employmentPct === 'number' && employmentPct > 0) ? employmentPct : 100;
    return (pct / 100) * HRF_FULL_TIME_HOURS_WEEK;
}

/* ============================================================
 * calcPeriodTarget — Beräkna mål-timmar för en period
 *
 * HRF: genomsnitt 40h/vecka under perioden.
 * Om personen jobbar 80% → 80% × 40h × antal veckor i perioden.
 * ============================================================ */
export function calcPeriodTarget(person, period) {
    const pct = (person?.employmentPct || person?.degree || 100) / 100;

    /* Räkna antal veckor i perioden */
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000)) + 1; /* +1 inkluderar sista dagen */
    const weeks = diffDays / 7;

    return pct * HRF_FULL_TIME_HOURS_WEEK * weeks;
}

/* ============================================================
 * calcPeriodBalance — Beräkna saldo för EN person i EN period
 *
 * Returnerar:
 *   {
 *     periodId, periodName,
 *     targetHours,        // Mål (vad personen SKA jobba)
 *     scheduledHours,     // Schemalagda timmar
 *     balanceHours,       // Differens (scheduled - target)
 *     balancePct,         // % av mål (100% = perfekt)
 *     workedDays,         // Antal schemalagda dagar
 *     avgHoursPerWeek,    // Genomsnitt timmar/vecka
 *     isOvertime,         // Sant om > mål
 *     isUndertime,        // Sant om < mål (> 2h under)
 *   }
 * ============================================================ */
export function calcPeriodBalance(person, period, scheduleMonths, shifts, shiftTemplates) {
    const targetHours = calcPeriodTarget(person, period);
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    let scheduledHours = 0;
    let workedDays = 0;

    if (!Array.isArray(scheduleMonths) || !person?.id) {
        return buildBalanceResult(period, targetHours, 0, 0);
    }

    /* Iterera alla dagar i perioden */
    const startDate = period.startDate;
    const endDate = period.endDate;

    scheduleMonths.forEach(month => {
        if (!month || !Array.isArray(month.days)) return;
        month.days.forEach(day => {
            if (!day || !Array.isArray(day.entries)) return;

            /* Kolla om dagen är inom perioden */
            const dayDate = day.date;
            if (!dayDate || dayDate < startDate || dayDate > endDate) return;

            /* Hitta personens entries för denna dag */
            const personEntries = day.entries.filter(e =>
                e.personId === person.id && e.status === 'A'
            );

            if (personEntries.length > 0) {
                workedDays++;
                personEntries.forEach(entry => {
                    const shift = allShifts[entry.shiftId];
                    if (shift) {
                        scheduledHours += calcShiftHours(shift, entry);
                    }
                });
            }
        });
    });

    return buildBalanceResult(period, targetHours, scheduledHours, workedDays);
}

function buildBalanceResult(period, targetHours, scheduledHours, workedDays) {
    const balanceHours = scheduledHours - targetHours;
    const balancePct = targetHours > 0 ? (scheduledHours / targetHours) * 100 : 0;

    /* Beräkna veckor i perioden */
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const weeks = Math.max(1, ((end - start) / (7 * 24 * 60 * 60 * 1000)));
    const avgHoursPerWeek = scheduledHours / weeks;

    return {
        periodId: period.id,
        periodName: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        targetHours: round2(targetHours),
        scheduledHours: round2(scheduledHours),
        balanceHours: round2(balanceHours),
        balancePct: round1(balancePct),
        workedDays,
        avgHoursPerWeek: round1(avgHoursPerWeek),
        isOvertime: balanceHours > 2,        /* > 2h över mål */
        isUndertime: balanceHours < -2,      /* > 2h under mål */
    };
}

/* ============================================================
 * calcAllPersonBalances — Beräkna alla personers saldo
 *
 * Returnerar Map<personId, { person, periods: [...balances], totalBalance }>
 * ============================================================ */
export function calcAllPersonBalances(people, settings, scheduleMonths, shifts, shiftTemplates, year) {
    const result = new Map();

    if (!Array.isArray(people)) return result;

    const activePeople = people.filter(p => p?.isActive);

    activePeople.forEach(person => {
        const periods = getPersonPeriods(person, settings, year);
        const balances = periods.map(period =>
            calcPeriodBalance(person, period, scheduleMonths, shifts, shiftTemplates)
        );

        const totalScheduled = balances.reduce((sum, b) => sum + b.scheduledHours, 0);
        const totalTarget = balances.reduce((sum, b) => sum + b.targetHours, 0);
        const totalBalance = round2(totalScheduled - totalTarget);

        result.set(person.id, {
            person,
            periods: balances,
            totalScheduled: round2(totalScheduled),
            totalTarget: round2(totalTarget),
            totalBalance,
            totalPct: totalTarget > 0 ? round1((totalScheduled / totalTarget) * 100) : 0,
        });
    });

    return result;
}

/* ============================================================
 * HELPERS
 * ============================================================ */
function round2(n) { return Math.round((n || 0) * 100) / 100; }
function round1(n) { return Math.round((n || 0) * 10) / 10; }

/* ============================================================
 * PERIOD_NAMES export (för UI)
 * ============================================================ */
export { PERIOD_NAMES, HRF_FULL_TIME_HOURS_WEEK, WEEKS_PER_QUARTER };
