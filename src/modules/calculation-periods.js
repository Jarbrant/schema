/*
 * AO-12 — Calculation Periods Module — v1.1 (BUGFIX)
 * FIL: src/modules/calculation-periods.js
 *
 * v1.1 FIXES:
 *   - calcPeriodBalance: härleder day.date från monthIndex + dayIndex
 *     (day.date existerar inte i schemat — det var buggen som gav 0.0h)
 *   - calcShiftHours fallback: om inget skift hittas, beräkna från entry-tider
 *   - Stödjer både shiftId och shiftTemplateId i entries
 *
 * Datamodell:
 *   state.settings.calculationPeriods = [
 *     { id: 'q1', name: 'Q1', startDate: '2025-01-01', endDate: '2025-03-31' },
 *     ...
 *   ]
 *   state.people[n].calculationPeriodStart = 'q1' | 'q2' | 'q3' | 'q4'
 */

import { calcShiftHours } from './schedule-engine.js';

/* ============================================================
 * CONSTANTS — HRF
 * ============================================================ */
const HRF_FULL_TIME_HOURS_WEEK = 40;
const HRF_FULL_TIME_HOURS_YEAR = 2080;
const WEEKS_PER_QUARTER = 13;

const PERIOD_NAMES = {
    q1: 'Q1 (Jan–Mar)',
    q2: 'Q2 (Apr–Jun)',
    q3: 'Q3 (Jul–Sep)',
    q4: 'Q4 (Okt–Dec)',
};

/* ============================================================
 * getDefaultPeriods
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
 * getPersonPeriods
 * ============================================================ */
export function getPersonPeriods(person, settings, year) {
    const allPeriods = (settings?.calculationPeriods?.length > 0)
        ? settings.calculationPeriods
        : getDefaultPeriods(year);

    const startPeriodId = person?.calculationPeriodStart || 'q1';
    const startIdx = allPeriods.findIndex(p => p.id === startPeriodId);
    if (startIdx === -1) return allPeriods;
    return allPeriods.slice(startIdx);
}

/* ============================================================
 * getActivePeriod
 * ============================================================ */
export function getActivePeriod(dateStr, periods) {
    if (!dateStr || !Array.isArray(periods)) return null;
    return periods.find(p => dateStr >= p.startDate && dateStr <= p.endDate) || null;
}

/* ============================================================
 * getHRFWeeklyTarget
 * ============================================================ */
export function getHRFWeeklyTarget(employmentPct) {
    const pct = (typeof employmentPct === 'number' && employmentPct > 0) ? employmentPct : 100;
    return (pct / 100) * HRF_FULL_TIME_HOURS_WEEK;
}

/* ============================================================
 * calcPeriodTarget
 * ============================================================ */
export function calcPeriodTarget(person, period) {
    const pct = (person?.employmentPct || person?.degree || 100) / 100;
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000)) + 1;
    const weeks = diffDays / 7;
    return pct * HRF_FULL_TIME_HOURS_WEEK * weeks;
}

/* ============================================================
 * calcPeriodBalance — v1.1 FIXAD
 *
 * BUGG I v1.0: day.date existerade inte → alla dagar hoppades över.
 * FIX: Härleder datumet från year + monthIndex + dayIndex.
 * ============================================================ */
export function calcPeriodBalance(person, period, scheduleMonths, shifts, shiftTemplates, year) {
    const targetHours = calcPeriodTarget(person, period);
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    let scheduledHours = 0;
    let workedDays = 0;

    if (!Array.isArray(scheduleMonths) || !person?.id) {
        return buildBalanceResult(period, targetHours, 0, 0);
    }

    const startDate = period.startDate;
    const endDate = period.endDate;

    /* Detektera year från period eller fallback */
    const periodYear = year || parseInt(startDate.split('-')[0], 10) || new Date().getFullYear();

    scheduleMonths.forEach((month, monthIdx) => {
        if (!month || !Array.isArray(month.days)) return;

        month.days.forEach((day, dayIdx) => {
            if (!day || !Array.isArray(day.entries)) return;

            /* v1.1 FIX: Härleda datum från index istället för day.date */
            const dayDate = day.date || buildDateStr(periodYear, monthIdx, dayIdx);
            if (!dayDate || dayDate < startDate || dayDate > endDate) return;

            /* Hitta personens entries */
            const personEntries = day.entries.filter(e =>
                e.personId === person.id && e.status === 'A'
            );

            if (personEntries.length > 0) {
                workedDays++;
                personEntries.forEach(entry => {
                    /* v1.1: Sök skift via shiftId ELLER shiftTemplateId */
                    const shift = allShifts[entry.shiftId] || allShifts[entry.shiftTemplateId];

                    if (shift) {
                        scheduledHours += calcShiftHours(shift, entry);
                    } else if (entry.startTime && entry.endTime) {
                        /* Fallback: beräkna direkt från entry-tider */
                        scheduledHours += calcShiftHours({}, entry);
                    } else {
                        /* Sista fallback: anta 8h */
                        scheduledHours += 8;
                    }
                });
            }
        });
    });

    return buildBalanceResult(period, targetHours, scheduledHours, workedDays);
}

/* ============================================================
 * buildDateStr — Bygg "YYYY-MM-DD" från year + monthIdx + dayIdx
 * ============================================================ */
function buildDateStr(year, monthIdx, dayIdx) {
    const m = String(monthIdx + 1).padStart(2, '0');
    const d = String(dayIdx + 1).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

function buildBalanceResult(period, targetHours, scheduledHours, workedDays) {
    const balanceHours = scheduledHours - targetHours;
    const balancePct = targetHours > 0 ? (scheduledHours / targetHours) * 100 : 0;

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
        isOvertime: balanceHours > 2,
        isUndertime: balanceHours < -2,
    };
}

/* ============================================================
 * calcAllPersonBalances — v1.1 FIXAD
 *
 * Skickar nu year till calcPeriodBalance
 * ============================================================ */
export function calcAllPersonBalances(people, settings, scheduleMonths, shifts, shiftTemplates, year) {
    const result = new Map();
    if (!Array.isArray(people)) return result;

    const activePeople = people.filter(p => p?.isActive);

    activePeople.forEach(person => {
        const periods = getPersonPeriods(person, settings, year);
        const balances = periods.map(period =>
            calcPeriodBalance(person, period, scheduleMonths, shifts, shiftTemplates, year)
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

export { PERIOD_NAMES, HRF_FULL_TIME_HOURS_WEEK, WEEKS_PER_QUARTER };
