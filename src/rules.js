/*
 * AO-06 + AO-14 — RULES ENGINE: HRF-regelmotor
 *
 * AO-06 FIX:
 *   - Importerar isHoliday + isRedDay från holidays.js (flerdårs-stöd)
 *   - Räknar SEM/SJ/VAB/FÖR-dagar och varnar vid överuttag av semester
 *   - REST_36H implementerad (veckovila 36h per 7-dagarsperiod)
 *   - Streak korsar månadsgräns (evaluateYear fixad)
 *   - Kopplar till person.vacationDaysPerYear + savedVacationDays
 *
 * Store-shape (person):
 *   person.vacationDaysPerYear  = number (25–40)
 *   person.usedVacationDays     = number
 *   person.savedVacationDays    = number
 *   person.extraDaysStartBalance = number
 *   person.employmentPct        = number (0–100)
 *   person.sector               = 'private' | 'municipal'
 */

import { isHoliday, isRedDay } from './data/holidays.js';

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

    if (startMin === null || endMin === null) return null;

    let workMin = endMin - startMin;
    if (workMin < 0) workMin += 24 * 60; // nattpass

    if (breakStartMin !== null && breakEndMin !== null) {
        let breakMin = breakEndMin - breakStartMin;
        if (breakMin < 0) breakMin += 24 * 60;
        workMin -= breakMin;
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

/**
 * Beräkna vilominuter mellan två på varandra följande arbetsdagar
 */
function calculateRestMinutes(entry, nextEntry, defaults) {
    const endMin = timeToMinutes(entry.end || defaults.end);
    const nextStartMin = timeToMinutes(nextEntry.start || defaults.start);

    if (endMin === null || nextStartMin === null) return null;

    let restMin = nextStartMin - endMin;
    if (nextStartMin <= endMin) {
        restMin += 24 * 60;
    }

    return restMin;
}

/* ============================================================
 * EVALUATE PERSON (en månad)
 * ============================================================ */
function evaluatePerson(personId, person, monthData, monthIndex, year, settings, prevMonthTrailingStreak) {
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
        semDays: 0,
        sjDays: 0,
        vabDays: 0,
        forDays: 0,
        maxStreak: 0,
        currentStreak: prevMonthTrailingStreak || 0,
        rest11hBreaches: 0,
        max10hBreaches: 0,
        rest36hBreaches: 0,
    };

    const days = monthData.days || [];
    const defaults = getDefaultTimes(monthData, settings);

    // Samla arbetstider för REST_36H-check
    const workTimeline = []; // { dayIndex, endMin }

    days.forEach((dayData, dayIndex) => {
        const entry = dayData.entries.find((e) => e.personId === personId);

        if (!entry) {
            stats.currentStreak = 0;
            return;
        }

        const status = entry.status || '';

        switch (status) {
            case 'A': {
                stats.workedDays++;
                stats.currentStreak++;
                stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

                // Röd dag = helgdag (inte bara söndag — branschpraxis)
                if (isRedDay(dayData.date)) {
                    stats.redDaysWorked++;
                    stats.earnedExtraDays++;
                }

                // MAX_10H
                const workMin = calculateWorkMinutes(entry, defaults);
                if (workMin !== null) {
                    workTimeline.push({ dayIndex, workMin, date: dayData.date });

                    if (workMin > 10 * 60) {
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
                }

                // STREAK_10
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

                // REST_11H (mot nästa dag)
                if (dayIndex < days.length - 1) {
                    const nextDay = days[dayIndex + 1];
                    const nextEntry = nextDay.entries.find((e) => e.personId === personId);

                    if (nextEntry && nextEntry.status === 'A') {
                        const restMin = calculateRestMinutes(entry, nextEntry, defaults);

                        if (restMin !== null && restMin < 11 * 60) {
                            stats.rest11hBreaches++;
                            warnings.push({
                                level: 'P0',
                                code: 'REST_11H',
                                personId,
                                dateFrom: dayData.date,
                                dateTo: nextDay.date,
                                message: `${person.lastName}: Dygnsvila < 11h mellan ${dayData.date} och ${nextDay.date} (${(restMin / 60).toFixed(1)}h)`,
                                details: { restMinutes: restMin },
                            });
                        }
                    }
                }
                break;
            }

            case 'X':
                stats.extraTakenDays++;
                stats.currentStreak = 0;
                break;

            case 'SEM':
                stats.semDays++;
                stats.currentStreak = 0;
                break;

            case 'SJ':
                stats.sjDays++;
                stats.currentStreak = 0;
                break;

            case 'VAB':
                stats.vabDays++;
                stats.currentStreak = 0;
                break;

            case 'FÖR':
                stats.forDays++;
                stats.currentStreak = 0;
                break;

            case 'L':
                // Ledig — bryter streak
                stats.currentStreak = 0;
                break;

            default:
                // Okänd status — fail-closed: bryt streak
                stats.currentStreak = 0;
                break;
        }
    });

    // REST_36H: veckovila-check (minst 36h vila per 7-dagarsperiod)
    for (let startDay = 0; startDay <= days.length - 7; startDay++) {
        const weekDays = days.slice(startDay, startDay + 7);
        const workedInWeek = weekDays.filter(d => {
            const e = d.entries.find(e => e.personId === personId);
            return e && e.status === 'A';
        });

        // Om alla 7 dagar är arbete → max 0h vila → breach
        // Om 6 av 7 → beror på tider, men som approximation:
        // 7 arbetsdagar i rad = 0 viloblock > 36h
        if (workedInWeek.length >= 7) {
            stats.rest36hBreaches++;
            warnings.push({
                level: 'P0',
                code: 'REST_36H',
                personId,
                dateFrom: weekDays[0].date,
                dateTo: weekDays[6].date,
                message: `${person.lastName}: Veckovila < 36h (${workedInWeek.length} dagar i rad) ${weekDays[0].date} – ${weekDays[6].date}`,
                details: { workedDaysInWeek: workedInWeek.length },
            });
        }
    }

    // Extra-ledighet balans
    stats.extraBalanceDays = (person.extraDaysStartBalance || 0) + stats.earnedExtraDays - stats.extraTakenDays;

    if (stats.extraTakenDays > (person.extraDaysStartBalance || 0) + stats.earnedExtraDays) {
        warnings.push({
            level: 'P0',
            code: 'EXTRA_NEGATIVE',
            personId,
            dateFrom: days[0]?.date || '',
            dateTo: days[days.length - 1]?.date || '',
            message: `${person.lastName}: Uttag extra-ledighet utan tillräckligt saldo (${stats.extraBalanceDays} dagar)`,
            details: {
                startBalance: person.extraDaysStartBalance || 0,
                earnedDays: stats.earnedExtraDays,
                takenDays: stats.extraTakenDays,
                balance: stats.extraBalanceDays,
            },
        });
    }

    if (stats.earnedExtraDays > 0 && stats.extraTakenDays === 0) {
        warnings.push({
            level: 'P1',
            code: 'EXTRA_NOT_PLANNED',
            personId,
            dateFrom: days[0]?.date || '',
            dateTo: days[days.length - 1]?.date || '',
            message: `${person.lastName}: ${stats.earnedExtraDays} intjänade extra-dagar utan uttag`,
            details: {
                earnedDays: stats.earnedExtraDays,
                takenDays: stats.extraTakenDays,
                balance: stats.extraBalanceDays,
            },
        });
    }

    // Semester-överuttag
    const totalVacAvailable = (person.vacationDaysPerYear || 25) + (person.savedVacationDays || 0);
    const totalVacUsed = (person.usedVacationDays || 0) + stats.semDays;

    if (totalVacUsed > totalVacAvailable) {
        warnings.push({
            level: 'P0',
            code: 'VACATION_OVERDRAWN',
            personId,
            dateFrom: days[0]?.date || '',
            dateTo: days[days.length - 1]?.date || '',
            message: `${person.lastName}: Semesteruttag (${totalVacUsed} dagar) överskrider tillgängliga (${totalVacAvailable} dagar)`,
            details: {
                vacationDaysPerYear: person.vacationDaysPerYear || 25,
                savedVacationDays: person.savedVacationDays || 0,
                usedVacationDays: person.usedVacationDays || 0,
                semDaysThisMonth: stats.semDays,
                totalUsed: totalVacUsed,
                totalAvailable: totalVacAvailable,
            },
        });
    }

    return { warnings, stats };
}

/* ============================================================
 * EVALUATE (en månad)
 * ============================================================ */
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

    (state.people || []).forEach((person) => {
        if (!person.isActive) return; // Hoppa över inaktiva

        const { warnings, stats } = evaluatePerson(
            person.id,
            person,
            monthData,
            month - 1,
            year,
            state.settings,
            0 // ingen trailing streak vid enstaka månad
        );

        statsByPerson[person.id] = stats;
        allWarnings.push(...warnings);
    });

    allWarnings.sort((a, b) => {
        if (a.level !== b.level) return a.level === 'P0' ? -1 : 1;
        return a.dateFrom.localeCompare(b.dateFrom);
    });

    return { warnings: allWarnings, statsByPerson, month, year };
}

/* ============================================================
 * EVALUATE YEAR (alla 12 månader, streak korsar månadsgräns)
 * ============================================================ */
export function evaluateYear(state, { year }) {
    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    const allWarnings = [];
    const yearStatsByPerson = {};

    // Init per person
    (state.people || []).forEach((person) => {
        if (!person.isActive) return;

        yearStatsByPerson[person.id] = {
            personId: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            workedDays: 0,
            redDaysWorked: 0,
            earnedExtraDays: 0,
            extraTakenDays: 0,
            extraBalanceDays: 0,
            semDays: 0,
            sjDays: 0,
            vabDays: 0,
            forDays: 0,
            maxStreak: 0,
            rest11hBreaches: 0,
            max10hBreaches: 0,
            rest36hBreaches: 0,
        };
    });

    // Spåra trailing streak per person (korsar månadsgräns)
    const trailingStreaks = {};

    for (let m = 1; m <= 12; m++) {
        const monthData = state.schedule.months[m - 1];
        if (!monthData) continue;

        (state.people || []).forEach((person) => {
            if (!person.isActive) return;

            const prevStreak = trailingStreaks[person.id] || 0;

            const { warnings, stats } = evaluatePerson(
                person.id,
                person,
                monthData,
                m - 1,
                year,
                state.settings,
                prevStreak
            );

            // Spara trailing streak för nästa månad
            trailingStreaks[person.id] = stats.currentStreak;

            // Ackumulera
            const ys = yearStatsByPerson[person.id];
            ys.workedDays += stats.workedDays;
            ys.redDaysWorked += stats.redDaysWorked;
            ys.earnedExtraDays += stats.earnedExtraDays;
            ys.extraTakenDays += stats.extraTakenDays;
            ys.semDays += stats.semDays;
            ys.sjDays += stats.sjDays;
            ys.vabDays += stats.vabDays;
            ys.forDays += stats.forDays;
            ys.maxStreak = Math.max(ys.maxStreak, stats.maxStreak);
            ys.rest11hBreaches += stats.rest11hBreaches;
            ys.max10hBreaches += stats.max10hBreaches;
            ys.rest36hBreaches += stats.rest36hBreaches;

            allWarnings.push(...warnings);
        });
    }

    // Beräkna årsbalans för extra-ledighet
    (state.people || []).forEach((person) => {
        if (!person.isActive) return;
        const ys = yearStatsByPerson[person.id];
        ys.extraBalanceDays =
            (person.extraDaysStartBalance || 0) +
            ys.earnedExtraDays -
            ys.extraTakenDays;
    });

    allWarnings.sort((a, b) => {
        if (a.level !== b.level) return a.level === 'P0' ? -1 : 1;
        return a.dateFrom.localeCompare(b.dateFrom);
    });

    return {
        warnings: allWarnings,
        statsByPerson: yearStatsByPerson,
        year,
        isYearView: true,
    };
}
