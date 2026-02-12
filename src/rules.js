/*
 * AO-14 — RULES: HRF-regelmotor med extra-ledighet-varningar
 */

import { isHoliday } from './data/holidays_2026.js';

const TIME_MINUTES_RE = /^(\d{2}):(\d{2})$/;

function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(TIME_MINUTES_RE);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function calculateWorkMinutes(entry, defaults) {
    const startMin = timeToMinutes(entry.start || defaults.start);
    const endMin = timeToMinutes(entry.end || defaults.end);
    const breakStartMin = timeToMinutes(entry.breakStart || defaults.breakStart);
    const breakEndMin = timeToMinutes(entry.breakEnd || defaults.breakEnd);

    if (startMin === null || endMin === null) {
        return null;
    }

    let workMin = endMin - startMin;

    if (breakStartMin !== null && breakEndMin !== null) {
        workMin -= breakEndMin - breakStartMin;
    }

    return Math.max(0, workMin);
}

function getDefaultTimes(monthData, settings) {
    return monthData?.timeDefaults || {
        start: settings?.defaultStart || '07:00',
        end: settings?.defaultEnd || '16:00',
        breakStart: settings?.breakStart || '12:00',
        breakEnd: settings?.breakEnd || '13:00',
    };
}

function evaluatePerson(personId, person, monthData, monthIndex, year, settings, allMonths) {
    const warnings = [];
    const stats = {
        personId,
        firstName: person.firstName,
        lastName: person.lastName,
        workedDays: 0,
        redDaysWorked: 0,
        earnedExtraDays: 0,
        extraTakenDays: 0,
        extraBalanceDays: 0,
        maxStreak: 0,
        currentStreak: 0,
        rest11hBreaches: 0,
        max10hBreaches: 0,
        rest36hBreaches: 0,
    };

    const days = monthData.days || [];

    days.forEach((dayData, dayIndex) => {
        const entry = dayData.entries.find((e) => e.personId === personId);

        if (entry && entry.status === 'A') {
            stats.workedDays++;
            stats.currentStreak++;
            stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

            if (isHoliday(dayData.date)) {
                stats.redDaysWorked++;
                stats.earnedExtraDays++;
            }

            const defaults = getDefaultTimes(monthData, settings);
            const workMin = calculateWorkMinutes(entry, defaults);
            if (workMin !== null && workMin > 10 * 60) {
                stats.max10hBreaches++;
                warnings.push({
                    level: 'P0',
                    code: 'MAX_10H',
                    personId,
                    dateFrom: dayData.date,
                    dateTo: dayData.date,
                    message: `${person.lastName}: Arbetstid > 10h på ${dayData.date} (${(workMin / 60).toFixed(1)}h)`,
                    details: { workMinutes: workMin, day: dayData.date },
                });
            }

            if (stats.currentStreak >= 10) {
                warnings.push({
                    level: 'P1',
                    code: 'STREAK_10',
                    personId,
                    dateFrom: dayData.date,
                    dateTo: dayData.date,
                    message: `${person.lastName}: ${stats.currentStreak} arbetsdagar i rad`,
                    details: { streak: stats.currentStreak },
                });
            }
        } else if (entry && entry.status === 'X') {
            stats.extraTakenDays++;
        } else {
            stats.currentStreak = 0;
        }

        if (entry && entry.status === 'A' && dayIndex < days.length - 1) {
            const nextDay = days[dayIndex + 1];
            const nextEntry = nextDay.entries.find((e) => e.personId === personId);

            if (nextEntry && nextEntry.status === 'A') {
                const defaults = getDefaultTimes(monthData, settings);
                const endMin = timeToMinutes(entry.end || defaults.end);
                const nextStartMin = timeToMinutes(nextEntry.start || defaults.start);

                if (endMin !== null && nextStartMin !== null) {
                    let restMin = nextStartMin - endMin;

                    if (nextStartMin < endMin) {
                        restMin += 24 * 60;
                    }

                    if (restMin < 11 * 60) {
                        stats.rest11hBreaches++;
                        warnings.push({
                            level: 'P0',
                            code: 'REST_11H',
                            personId,
                            dateFrom: dayData.date,
                            dateTo: nextDay.date,
                            message: `${person.lastName}: Dygnsvila < 11h mellan ${dayData.date} och ${nextDay.date}`,
                            details: { restMinutes: restMin },
                        });
                    }
                }
            }
        }
    });

    // Extra-ledighet
    stats.extraBalanceDays = (person.extraDaysStartBalance || 0) + stats.earnedExtraDays - stats.extraTakenDays;

    if (stats.extraTakenDays > stats.earnedExtraDays) {
        warnings.push({
            level: 'P0',
            code: 'EXTRA_NEGATIVE',
            personId,
            dateFrom: days[0]?.date || '',
            dateTo: days[days.length - 1]?.date || '',
            message: `${person.lastName}: Uttag extra utan tillräckligt saldo`,
            details: {
                earnedDays: stats.earnedExtraDays,
                takenDays: stats.extraTakenDays,
                balance: stats.extraBalanceDays,
            },
        });
    }

    if (stats.earnedExtraDays > stats.extraTakenDays) {
        warnings.push({
            level: 'P1',
            code: 'EXTRA_NOT_PLANNED',
            personId,
            dateFrom: days[0]?.date || '',
            dateTo: days[days.length - 1]?.date || '',
            message: `${person.lastName}: Intjänade extra dagar saknar uttag`,
            details: {
                earnedDays: stats.earnedExtraDays,
                takenDays: stats.extraTakenDays,
                balance: stats.extraBalanceDays,
            },
        });
    }

    return { warnings, stats };
}

export function evaluate(state, { year, month }) {
    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    if (month < 1 || month > 12) {
        throw new Error(`Månad måste vara 1–12`);
    }

    const monthData = state.schedule.months[month - 1];
    if (!monthData) {
        throw new Error(`Månad ${month} saknas`);
    }

    const allWarnings = [];
    const statsByPerson = {};

    state.people.forEach((person) => {
        const { warnings, stats } = evaluatePerson(
            person.id,
            person,
            monthData,
            month - 1,
            year,
            state.settings,
            state.schedule.months
        );

        statsByPerson[person.id] = stats;
        allWarnings.push(...warnings);
    });

    allWarnings.sort((a, b) => {
        if (a.level !== b.level) {
            return a.level === 'P0' ? -1 : 1;
        }
        return a.dateFrom.localeCompare(b.dateFrom);
    });

    return {
        warnings: allWarnings,
        statsByPerson,
        month,
        year,
    };
}

export function evaluateYear(state, { year }) {
    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    const allWarnings = [];
    const yearStatsByPerson = {};

    state.people.forEach((person) => {
        yearStatsByPerson[person.id] = {
            personId: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            workedDays: 0,
            redDaysWorked: 0,
            earnedExtraDays: 0,
            extraTakenDays: 0,
            extraBalanceDays: 0,
            maxStreak: 0,
            rest11hBreaches: 0,
            max10hBreaches: 0,
            rest36hBreaches: 0,
        };
    });

    for (let m = 1; m <= 12; m++) {
        const monthResult = evaluate(state, { year, month: m });
        allWarnings.push(...monthResult.warnings);

        Object.keys(monthResult.statsByPerson).forEach((personId) => {
            const monthStats = monthResult.statsByPerson[personId];
            yearStatsByPerson[personId].workedDays += monthStats.workedDays;
            yearStatsByPerson[personId].redDaysWorked += monthStats.redDaysWorked;
            yearStatsByPerson[personId].earnedExtraDays += monthStats.earnedExtraDays;
            yearStatsByPerson[personId].extraTakenDays += monthStats.extraTakenDays;
            yearStatsByPerson[personId].extraBalanceDays =
                (state.people.find(p => p.id === personId)?.extraDaysStartBalance || 0) +
                yearStatsByPerson[personId].earnedExtraDays -
                yearStatsByPerson[personId].extraTakenDays;
            yearStatsByPerson[personId].maxStreak = Math.max(
                yearStatsByPerson[personId].maxStreak,
                monthStats.maxStreak
            );
            yearStatsByPerson[personId].rest11hBreaches += monthStats.rest11hBreaches;
            yearStatsByPerson[personId].max10hBreaches += monthStats.max10hBreaches;
            yearStatsByPerson[personId].rest36hBreaches += monthStats.rest36hBreaches;
        });
    }

    return {
        warnings: allWarnings,
        statsByPerson: yearStatsByPerson,
        year,
        isYearView: true,
    };
}
