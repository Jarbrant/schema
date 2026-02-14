/*
 * RULES-ENGINE.JS — HR & Schedule Rules
 * 
 * Regler för:
 * - Kompetens (grupp-medlemskap)
 * - Tillgänglighet (vecka + dagar)
 * - Semesterdagar & ledighetsdagar
 * - Röda dagar
 * - Arbetsvecka
 * - Max arbete per vecka
 */

/**
 * Check if person can work on a specific day
 */
export function canWorkOnDay(person, dateStr) {
    if (!person || !dateStr) return false;

    // Check if vacation day
    if (isVacationDay(person, dateStr)) {
        console.log(`❌ ${person.name} på semester: ${dateStr}`);
        return false;
    }

    // Check if leave day
    if (isLeaveDay(person, dateStr)) {
        console.log(`❌ ${person.name} på ledighet: ${dateStr}`);
        return false;
    }

    // Check if red day (arbetstidsslag)
    if (isRedDay(dateStr)) {
        // Can work on red day if not vacation/leave
        // Red day might affect pay but person can still work
        console.log(`⚠️ ${person.name} arbetar röd dag: ${dateStr}`);
        return true;
    }

    return true;
}

/**
 * Check if person is available on day of week (0=Mon, 6=Sun)
 */
export function isAvailableOnDayOfWeek(person, dateStr) {
    if (!person || !person.availability || !dateStr) return false;

    const date = new Date(dateStr);
    const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1; // Convert JS day (0=Sun) to our format (0=Mon)

    return person.availability[dayOfWeek] === true;
}

/**
 * Check if person is in group (can work on pass)
 */
export function canWorkInGroup(person, groupId) {
    if (!person || !person.groupIds) return false;
    return person.groupIds.includes(groupId);
}

/**
 * Get person's available work hours on date
 * Based on degree (%) and workdays per week
 */
export function getAvailableHours(person, dateStr) {
    if (!person || !person.degree || !person.workdaysPerWeek) {
        return 0;
    }

    // Standard work day = 8 hours
    const standardHours = 8;
    
    // Calculate daily hours based on employment degree
    const dailyHours = (standardHours * person.degree) / 100;

    return dailyHours;
}

/**
 * Check vacation days available
 */
export function hasVacationDaysAvailable(person, count = 1) {
    if (!person) return false;

    const totalVacation = (person.savedVacationDays || 0) + (person.newVacationDays || 0);
    return totalVacation >= count;
}

/**
 * Check leave days available
 */
export function hasLeaveDaysAvailable(person, count = 1) {
    if (!person) return false;

    return (person.savedLeaveDays || 0) >= count;
}

/**
 * Check if person has worked too much this week
 */
export function hasWorkedTooMuchThisWeek(person, dateStr, hoursWorkedThisWeek = 0) {
    if (!person || !person.workdaysPerWeek) return false;

    // Max hours per week = (workdaysPerWeek × 8) × (degree / 100)
    const standardHours = 8;
    const maxHoursPerWeek = (person.workdaysPerWeek * standardHours * person.degree) / 100;

    // If already worked more than max this week, can't add more
    return hoursWorkedThisWeek >= maxHoursPerWeek;
}

/**
 * Check if date is red day (Swedish holidays/red days)
 */
export function isRedDay(dateStr) {
    // Swedish red days 2026
    const redDays = [
        '2026-01-01', // Nyårsdagen
        '2026-01-06', // Trettondedag jul
        '2026-04-10', // Långfredagen
        '2026-04-13', // Påskdagen
        '2026-04-14', // Annandag påsk
        '2026-05-01', // Första maj
        '2026-06-06', // Sveriges nationaldag
        '2026-06-21', // Midsommarafton (not official but common)
        '2026-06-22', // Midsommardagen
        '2026-11-01', // Alla helgons dag
        '2026-12-24', // Julafton
        '2026-12-25', // Juldagen
        '2026-12-26', // Annandag jul
        '2026-12-31', // Nyårsafton
    ];

    return redDays.includes(dateStr);
}

/**
 * Check if date is vacation day for person
 */
export function isVacationDay(person, dateStr) {
    if (!person || !person.vacationDates) return false;
    return person.vacationDates.includes(dateStr);
}

/**
 * Check if date is leave day for person
 */
export function isLeaveDay(person, dateStr) {
    if (!person || !person.leaveDates) return false;
    return person.leaveDates.includes(dateStr);
}

/**
 * Calculate total hours worked in week
 */
export function getHoursWorkedThisWeek(person, dateStr, shifts = []) {
    if (!dateStr || !shifts) return 0;

    const date = new Date(dateStr);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)); // Monday

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday

    const personShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.date);
        return shift.personId === person.id &&
               shiftDate >= weekStart &&
               shiftDate <= weekEnd;
    });

    return personShifts.reduce((total, shift) => {
        const startTime = parseTime(shift.startTime);
        const endTime = parseTime(shift.endTime);
        const hours = (endTime - startTime) / 60;
        return total + hours;
    }, 0);
}

/**
 * Parse time string "HH:MM" to minutes
 */
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Calculate shift duration in hours
 */
export function getShiftDuration(shift) {
    if (!shift) return 0;
    const start = parseTime(shift.startTime);
    const end = parseTime(shift.endTime);
    return (end - start) / 60;
}

/**
 * Check if person matches all requirements for a shift
 */
export function canPersonWorkShift(person, shift, group, dateStr, hoursWorkedThisWeek = 0) {
    // Check all conditions
    if (!person) {
        console.log('❌ Person missing');
        return false;
    }

    if (!canWorkOnDay(person, dateStr)) {
        console.log(`❌ ${person.name} can't work on ${dateStr}`);
        return false;
    }

    if (!isAvailableOnDayOfWeek(person, dateStr)) {
        console.log(`❌ ${person.name} not available on day of week`);
        return false;
    }

    if (!canWorkInGroup(person, group?.id)) {
        console.log(`❌ ${person.name} not in group ${group?.name}`);
        return false;
    }

    const shiftHours = getShiftDuration(shift);
    const availableHours = getAvailableHours(person, dateStr);

    if (shiftHours > availableHours) {
        console.log(`❌ ${person.name} shift too long (${shiftHours}h > ${availableHours}h available)`);
        return false;
    }

    if (hasWorkedTooMuchThisWeek(person, dateStr, hoursWorkedThisWeek + shiftHours)) {
        console.log(`❌ ${person.name} would exceed weekly hours`);
        return false;
    }

    return true;
}

/**
 * Score person for shift (for intelligent scheduling)
 * Higher score = better match
 */
export function scorePersonForShift(person, shift, group, dateStr, hoursWorkedThisWeek = 0) {
    if (!canPersonWorkShift(person, shift, group, dateStr, hoursWorkedThisWeek)) {
        return -1; // Can't work
    }

    let score = 100;

    // Bonus if exactly matches weekly hours needed
    const shiftHours = getShiftDuration(shift);
    const dailyHours = getAvailableHours(person, dateStr);
    const maxWeeklyHours = (person.workdaysPerWeek * 8 * person.degree) / 100;
    const remainingWeekly = maxWeeklyHours - hoursWorkedThisWeek;

    if (Math.abs(shiftHours - remainingWeekly) < 1) {
        score += 50; // Perfect fit
    }

    // Penalty if person would have few hours left this week
    const hoursLeftAfter = remainingWeekly - shiftHours;
    if (hoursLeftAfter < 2) {
        score += 20; // Good utilization
    }

    // Penalty if has lots of vacation days left (save them)
    const vacationLeft = (person.newVacationDays || 0) - 5;
    if (vacationLeft > 10) {
        score -= 10;
    }

    return score;
}

/**
 * Get all eligible persons for a shift
 */
export function getEligiblePersonsForShift(people, shift, group, dateStr, shifts = []) {
    if (!people || !shift || !group || !dateStr) return [];

    return people
        .map(person => {
            const hoursWorked = getHoursWorkedThisWeek(person, dateStr, shifts);
            return {
                person,
                score: scorePersonForShift(person, shift, group, dateStr, hoursWorked),
                hoursWorked
            };
        })
        .filter(item => item.score >= 0)
        .sort((a, b) => b.score - a.score);
}

/**
 * Validate person data completeness for scheduling
 */
export function validatePersonForScheduling(person) {
    const errors = [];

    if (!person.groupIds || person.groupIds.length === 0) {
        errors.push('Ingen arbetgrupp tilldelad');
    }

    if (!person.availability || person.availability.length === 0) {
        errors.push('Ingen tillgänglighet definierad');
    }

    if (!person.startDate) {
        errors.push('Ingen startdatum');
    }

    if (!person.degree || person.degree < 10 || person.degree > 100) {
        errors.push('Ogiltigt tjänstgöringsgrad');
    }

    if (!person.workdaysPerWeek || person.workdaysPerWeek < 1 || person.workdaysPerWeek > 7) {
        errors.push('Ogiltigt antal arbetsdagar per vecka');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get person's schedule stats for a week
 */
export function getPersonWeekStats(person, dateStr, shifts = []) {
    const hoursWorked = getHoursWorkedThisWeek(person, dateStr, shifts);
    const maxHours = (person.workdaysPerWeek * 8 * person.degree) / 100;
    const utilizationPercent = Math.round((hoursWorked / maxHours) * 100);

    return {
        hoursWorked,
        maxHours,
        utilizationPercent,
        remainingHours: maxHours - hoursWorked,
        vacationDaysLeft: (person.newVacationDays || 0) + (person.savedVacationDays || 0),
        leaveDaysLeft: person.savedLeaveDays || 0
    };
}
