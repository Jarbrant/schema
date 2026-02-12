/*
 * AO-15 — STATS: Statistik-beräkningar med startsaldo
 */

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

function countWorkDays(year, month) {
    let count = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            count++;
        }
    }

    return count;
}

function calculateTargetHours(year, month, employmentPct) {
    const workDays = countWorkDays(year, month);
    const targetHours = workDays * 8 * (employmentPct / 100);
    return targetHours;
}

function isHolidayDate(dateStr) {
    const holidays = {
        '2026-01-01': true, '2026-01-06': true, '2026-04-02': true, '2026-04-03': true,
        '2026-04-05': true, '2026-04-06': true, '2026-05-01': true, '2026-05-14': true,
        '2026-06-06': true, '2026-06-20': true, '2026-11-01': true, '2026-12-24': true,
        '2026-12-25': true, '2026-12-26': true, '2026-12-31': true,
    };
    return holidays[dateStr] || false;
}

function getStatusColor(deltaHours) {
    const tolerance = 0.25;
    if (deltaHours < -tolerance) {
        return 'YELLOW';
    } else if (deltaHours > tolerance) {
        return 'RED';
    } else {
        return 'OK';
    }
}

function calcPersonMonthStats(personId, person, monthData, monthIndex, year, settings) {
    const defaults = getDefaultTimes(monthData, settings);
    const days = monthData.days || [];

    let hoursWorked = 0;
    let daysWorked = 0;
    let redDaysWorked = 0;
    let extraTakenDays = 0;

    days.forEach((dayData) => {
        const entry = dayData.entries.find((e) => e.personId === personId);

        if (!entry) return;

        if (entry.status === 'A') {
            daysWorked++;

            const workMin = calculateWorkMinutes(entry, defaults);
            if (workMin !== null) {
                hoursWorked += workMin / 60;
            }

            if (isHolidayDate(dayData.date)) {
                redDaysWorked++;
            }
        } else if (entry.status === 'X') {
            extraTakenDays++;
        }
    });

    const targetHours = calculateTargetHours(year, monthIndex + 1, person.employmentPct);
    const deltaHours = hoursWorked - targetHours;
    const statusColor = getStatusColor(deltaHours);

    const extraStartBalanceDays = person.extraDaysStartBalance || 0;
    const extraEarnedDays = redDaysWorked;
    const extraBalanceDays = extraStartBalanceDays + extraEarnedDays - extraTakenDays;
    const extraToPlanDays = Math.max(0, extraBalanceDays);
    const extraNegativeDays = Math.max(0, -extraBalanceDays);

    return {
        personId,
        firstName: person.firstName,
        lastName: person.lastName,
        employmentPct: person.employmentPct,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        daysWorked,
        redDaysWorked,
        extraStartBalanceDays,
        extraEarnedDays,
        extraTakenDays,
        extraBalanceDays,
        extraToPlanDays,
        extraNegativeDays,
        targetHours: Math.round(targetHours * 100) / 100,
        deltaHours: Math.round(deltaHours * 100) / 100,
        statusColor,
        month: monthIndex + 1,
        year,
    };
}

function calcPersonYearStats(personId, person, monthsData, year, settings) {
    let hoursWorked = 0;
    let daysWorked = 0;
    let redDaysWorked = 0;
    let extraTakenDays = 0;
    let targetHours = 0;

    monthsData.forEach((monthData, monthIndex) => {
        const monthStats = calcPersonMonthStats(personId, person, monthData, monthIndex, year, settings);
        hoursWorked += monthStats.hoursWorked;
        daysWorked += monthStats.daysWorked;
        redDaysWorked += monthStats.redDaysWorked;
        extraTakenDays += monthStats.extraTakenDays;
        targetHours += monthStats.targetHours;
    });

    const deltaHours = hoursWorked - targetHours;
    const statusColor = getStatusColor(deltaHours);

    const extraStartBalanceDays = person.extraDaysStartBalance || 0;
    const extraEarnedDays = redDaysWorked;
    const extraBalanceDays = extraStartBalanceDays + extraEarnedDays - extraTakenDays;
    const extraToPlanDays = Math.max(0, extraBalanceDays);
    const extraNegativeDays = Math.max(0, -extraBalanceDays);

    return {
        personId,
        firstName: person.firstName,
        lastName: person.lastName,
        employmentPct: person.employmentPct,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        daysWorked,
        redDaysWorked,
        extraStartBalanceDays,
        extraEarnedDays,
        extraTakenDays,
        extraBalanceDays,
        extraToPlanDays,
        extraNegativeDays,
        targetHours: Math.round(targetHours * 100) / 100,
        deltaHours: Math.round(deltaHours * 100) / 100,
        statusColor,
        year,
        isYearView: true,
    };
}

export function calcMonthStats(state, { year, month }) {
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

    const statsByPerson = {};

    state.people.forEach((person) => {
        const stats = calcPersonMonthStats(person.id, person, monthData, month - 1, year, state.settings);
        statsByPerson[person.id] = stats;
    });

    return {
        statsByPerson,
        month,
        year,
        isMonthView: true,
    };
}

export function calcYearStats(state, { year }) {
    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    const statsByPerson = {};

    state.people.forEach((person) => {
        const stats = calcPersonYearStats(person.id, person, state.schedule.months, year, state.settings);
        statsByPerson[person.id] = stats;
    });

    return {
        statsByPerson,
        year,
        isYearView: true,
    };
}
