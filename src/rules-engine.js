/*
 * RULES-ENGINE.JS — Konsoliderad regelmotor v2.0
 * 
 * ÄNDRINGSLOGG (konsolidering):
 *   - Använder holidays.js (dynamisk, flerårs) istället för hårdkodad 2026-lista
 *   - Standardiserat till employmentPct (inte degree) och groups (inte groupIds)
 *   - Stöd för båda fältnamnen (bakåtkompatibelt med fallback)
 *   - Importerar HR-regler från hr-rules.js för semestervalidering
 *   - Exporterar allt som scheduler.js behöver
 *
 * PERSON-DATAMODELL (standardiserad):
 *   person.employmentPct    = number (10–100)       ← primär
 *   person.degree           = number (10–100)       ← fallback (bakåtkompatibel)
 *   person.groups           = string[]              ← primär
 *   person.groupIds         = string[]              ← fallback (bakåtkompatibel)
 *   person.availability     = boolean[7]            ← 0=Mån..6=Sön
 *   person.vacationDates    = string[]              ← YYYY-MM-DD
 *   person.leaveDates       = string[]              ← YYYY-MM-DD
 *   person.workdaysPerWeek  = number (1–7)
 *   person.startDate        = string                ← YYYY-MM-DD
 *   person.sector           = 'private'|'municipal'
 */

import { isHoliday, isRedDay as isRedDayHolidays } from './data/holidays_2026.js';
import {
    getVacationDaysPerYear,
    getRemainingVacationDays,
    validatePersonAgainstHRF,
    getAccumulatedVacationDays,
    getPersonVacationYearInfo,
} from './hr-rules.js';

/* ============================================================
 * HELPERS
 * ============================================================ */

/** Hämta anställningsgrad — stödjer båda fältnamnen */
function getEmploymentPct(person) {
    return person.employmentPct ?? person.degree ?? 100;
}

/** Hämta grupper — stödjer båda fältnamnen */
function getGroups(person) {
    const g = person.groups || person.groupIds || [];
    return Array.isArray(g) ? g.map(String) : [];
}

/** Parse "HH:MM" → minuter */
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/* ============================================================
 * RÖDA DAGAR — Delegerar till holidays.js (dynamisk, alla år)
 * ============================================================ */

export { isHoliday };

export function isRedDay(dateStr) {
    return isRedDayHolidays(dateStr);
}

/* ============================================================
 * TILLGÄNGLIGHET & LEDIGHET
 * ============================================================ */

export function canWorkOnDay(person, dateStr) {
    if (!person || !dateStr) return false;

    if (isVacationDay(person, dateStr)) return false;
    if (isLeaveDay(person, dateStr)) return false;

    // Röda dagar: person kan jobba, men det påverkar OB/extra-ledighet
    return true;
}

export function isAvailableOnDayOfWeek(person, dateStr) {
    if (!person || !person.availability || !dateStr) return false;
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1;
    return person.availability[dayOfWeek] === true;
}

export function canWorkInGroup(person, groupId) {
    if (!person || !groupId) return false;
    return getGroups(person).includes(String(groupId));
}

export function isVacationDay(person, dateStr) {
    if (!person || !person.vacationDates) return false;
    return person.vacationDates.includes(dateStr);
}

export function isLeaveDay(person, dateStr) {
    if (!person || !person.leaveDates) return false;
    return person.leaveDates.includes(dateStr);
}

/* ============================================================
 * ARBETSTID
 * ============================================================ */

export function getAvailableHours(person) {
    const pct = getEmploymentPct(person);
    const wdpw = person.workdaysPerWeek || 5;
    if (!pct || !wdpw) return 0;
    return (8 * pct) / 100;
}

export function getShiftDuration(shift) {
    if (!shift) return 0;
    const start = parseTime(shift.startTime);
    const end = parseTime(shift.endTime);
    let dur = end - start;
    if (dur < 0) dur += 24 * 60; // nattpass
    return dur / 60;
}

export function getHoursWorkedThisWeek(person, dateStr, shifts = []) {
    if (!dateStr || !shifts) return 0;

    const date = new Date(dateStr);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const personShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date);
        return shift.personId === person.id &&
               shiftDate >= weekStart &&
               shiftDate <= weekEnd;
    });

    return personShifts.reduce((total, shift) => {
        const start = parseTime(shift.startTime);
        const end = parseTime(shift.endTime);
        let dur = end - start;
        if (dur < 0) dur += 24 * 60;
        return total + dur / 60;
    }, 0);
}

export function hasWorkedTooMuchThisWeek(person, dateStr, hoursWorkedThisWeek = 0) {
    const pct = getEmploymentPct(person);
    const wdpw = person.workdaysPerWeek || 5;
    if (!pct || !wdpw) return false;
    const maxHoursPerWeek = (wdpw * 8 * pct) / 100;
    return hoursWorkedThisWeek >= maxHoursPerWeek;
}

/* ============================================================
 * SEMESTER — Delegerar till hr-rules.js
 * ============================================================ */

export function hasVacationDaysAvailable(person, count = 1) {
    if (!person) return false;
    const remaining = getRemainingVacationDays(person, person.sector || 'private');
    return remaining >= count;
}

export function hasLeaveDaysAvailable(person, count = 1) {
    if (!person) return false;
    return (person.savedLeaveDays || 0) >= count;
}

/* ============================================================
 * HUVUDFUNKTION: canPersonWorkShift (kallas av scheduler.js)
 * ============================================================ */

export function canPersonWorkShift(person, shift, group, dateStr, hoursWorkedThisWeek = 0) {
    if (!person) return false;
    if (!canWorkOnDay(person, dateStr)) return false;
    if (!isAvailableOnDayOfWeek(person, dateStr)) return false;
    if (!canWorkInGroup(person, group?.id)) return false;

    const shiftHours = getShiftDuration(shift);
    const availableHours = getAvailableHours(person);

    if (shiftHours > availableHours) return false;
    if (hasWorkedTooMuchThisWeek(person, dateStr, hoursWorkedThisWeek + shiftHours)) return false;

    return true;
}

/* ============================================================
 * SCORING & ELIGIBILITY
 * ============================================================ */

export function scorePersonForShift(person, shift, group, dateStr, hoursWorkedThisWeek = 0) {
    if (!canPersonWorkShift(person, shift, group, dateStr, hoursWorkedThisWeek)) return -1;

    let score = 100;
    const shiftHours = getShiftDuration(shift);
    const pct = getEmploymentPct(person);
    const wdpw = person.workdaysPerWeek || 5;
    const maxWeeklyHours = (wdpw * 8 * pct) / 100;
    const remainingWeekly = maxWeeklyHours - hoursWorkedThisWeek;

    if (Math.abs(shiftHours - remainingWeekly) < 1) score += 50;
    if (remainingWeekly - shiftHours < 2) score += 20;

    // Röd dag bonus — rättvis rotation
    if (isRedDay(dateStr)) score += 10;

    return score;
}

export function getEligiblePersonsForShift(people, shift, group, dateStr, shifts = []) {
    if (!people || !shift || !group || !dateStr) return [];

    return people
        .map(person => {
            const hoursWorked = getHoursWorkedThisWeek(person, dateStr, shifts);
            return {
                person,
                score: scorePersonForShift(person, shift, group, dateStr, hoursWorked),
                hoursWorked,
            };
        })
        .filter(item => item.score >= 0)
        .sort((a, b) => b.score - a.score);
}

/* ============================================================
 * VALIDERING — Kombinerar grundvalidering + HR-rules
 * ============================================================ */

export function validatePersonForScheduling(person) {
    const errors = [];
    const groups = getGroups(person);

    if (groups.length === 0) errors.push('Ingen arbetsgrupp tilldelad');
    if (!person.availability || person.availability.length === 0) errors.push('Ingen tillgänglighet definierad');
    if (!person.startDate) errors.push('Inget startdatum');

    const pct = getEmploymentPct(person);
    if (!pct || pct < 10 || pct > 100) errors.push('Ogiltig tjänstgöringsgrad (10-100%)');

    const wdpw = person.workdaysPerWeek;
    if (!wdpw || wdpw < 1 || wdpw > 7) errors.push('Ogiltigt antal arbetsdagar per vecka');

    // HR-validering (semester/kollektivavtal)
    const hrResult = validatePersonAgainstHRF(person, person.sector || 'private');
    if (!hrResult.valid) errors.push(...hrResult.errors);

    return { valid: errors.length === 0, errors };
}

/* ============================================================
 * STATISTIK
 * ============================================================ */

export function getPersonWeekStats(person, dateStr, shifts = []) {
    const pct = getEmploymentPct(person);
    const wdpw = person.workdaysPerWeek || 5;
    const hoursWorked = getHoursWorkedThisWeek(person, dateStr, shifts);
    const maxHours = (wdpw * 8 * pct) / 100;

    return {
        hoursWorked,
        maxHours,
        utilizationPercent: maxHours > 0 ? Math.round((hoursWorked / maxHours) * 100) : 0,
        remainingHours: maxHours - hoursWorked,
        vacationInfo: getPersonVacationYearInfo(person, person.sector || 'private'),
    };
}
