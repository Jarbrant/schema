/*
 * RULES.JS — Re-export proxy
 *
 * Denna fil existerar enbart för bakåtkompatibilitet.
 * All logik finns i rules-engine.js.
 * Alla nya importer ska använda rules-engine.js direkt.
 */

export {
    isHoliday,
    isRedDay,
    canWorkOnDay,
    isAvailableOnDayOfWeek,
    canWorkInGroup,
    isVacationDay,
    isLeaveDay,
    getAvailableHours,
    getShiftDuration,
    getHoursWorkedThisWeek,
    hasWorkedTooMuchThisWeek,
    hasVacationDaysAvailable,
    hasLeaveDaysAvailable,
    canPersonWorkShift,
    scorePersonForShift,
    getEligiblePersonsForShift,
    validatePersonForScheduling,
    getPersonWeekStats,
} from './rules-engine.js';
