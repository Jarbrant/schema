/*
 * AO-07 — SCHEDULE ENGINE v1.1
 * FIL: modules/schedule-engine.js
 *
 * Syfte:
 * - generateWeekSchedule(): Generera schema för EN vecka baserat på veckomall
 * - generatePeriodSchedule(): Generera schema för FLERA veckor med ackumulerade timmar
 * - calcShiftHours(): Beräkna timmar för ett skift (exporterad för calendar.js)
 *
 * Beräkningsperioder (svensk arbetsrätt):
 * - Heltid (100%): 26 veckor
 * - Deltid (<100%): 16 veckor
 */

/* ========================================================================
   BLOCK 1 — PUBLIC API
   ======================================================================== */

/**
 * Beräkna timmar för ett skift (exporterad helper)
 * Kompatibel med src/modules/schedule-engine.js API
 */
export function calcShiftHours(shift, entry) {
    const start = entry?.startTime || shift?.startTime;
    const end = entry?.endTime || shift?.endTime;
    const breakS = entry?.breakStart || shift?.breakStart;
    const breakE = entry?.breakEnd || shift?.breakEnd;
    if (!start || !end) return 0;

    let totalMinutes = timeToMinutes(end) - timeToMinutes(start);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    if (breakS && breakE) {
        let bm = timeToMinutes(breakE) - timeToMinutes(breakS);
        if (bm < 0) bm += 24 * 60;
        totalMinutes -= bm;
    }
    return Math.max(0, totalMinutes / 60);
}

/**
 * Generera schema för EN vecka (anropas från kalendern)
 */
export function generateWeekSchedule(options) {
    const {
        weekDates,
        weekTemplate,
        groups,
        shifts = {},
        shiftTemplates = {},
        groupShifts = {},
        people = [],
        absences = [],
        existingEntries = {},
        demand,
        accumulatedHours = {},
        weekIndex = 0,
        totalWeeks = 1,
    } = options || {};

    if (!weekDates || !Array.isArray(weekDates) || weekDates.length !== 7) {
        console.warn('generateWeekSchedule: weekDates saknas eller har fel längd');
        return { suggestions: [], vacancies: [], stats: {} };
    }

    if (!weekTemplate || !weekTemplate.slots || !Array.isArray(weekTemplate.slots)) {
        console.warn('generateWeekSchedule: weekTemplate saknas eller har inga slots');
        return { suggestions: [], vacancies: [], stats: {} };
    }

    const suggestions = [];
    const vacancies = [];

    /* ── Bygg absence-lookup ── */
    const absenceMap = buildAbsenceMap(absences, weekDates);

    /* ── Bygg tracker för ackumulerade timmar ── */
    const tracker = {};
    people.forEach(p => {
        const periodWeeks = getCalculationPeriod(p);
        const weeklyTarget = (p.employmentPct || 100) / 100 * 40;
        const periodTarget = weeklyTarget * periodWeeks;

        tracker[p.id] = {
            person: p,
            periodWeeks,
            weeklyTarget,
            periodTarget,
            accumulated: accumulatedHours[p.id] || 0,
            thisWeek: 0,
            maxThisWeek: calcMaxWeekHoursInternal(p, weekIndex, totalWeeks, accumulatedHours[p.id] || 0, periodWeeks, weeklyTarget),
        };
    });

    /* ── Processera varje slot i veckomallen ── */
    weekTemplate.slots.forEach(slot => {
        const dayIndex = slot.dayIndex ?? slot.dayOfWeek;
        if (dayIndex == null || dayIndex < 0 || dayIndex > 6) return;

        const date = weekDates[dayIndex];
        if (!date) return;

        const dateStr = formatDate(date);
        const groupId = slot.groupId;
        const shiftId = slot.shiftId || slot.shiftTemplateId;
        const needCount = slot.count || 1;

        const shiftHours = getShiftHours(shiftId, shifts, shiftTemplates);

        const groupPeople = people.filter(p => {
            const pGroups = Array.isArray(p.groups) ? p.groups.map(g => String(g)) : [];
            return pGroups.includes(String(groupId));
        });

        for (let i = 0; i < needCount; i++) {
            const candidate = findBestWeekCandidate({
                groupPeople,
                tracker,
                dateStr,
                dayIndex,
                shiftId,
                groupId,
                shiftHours,
                absenceMap,
                existingEntries,
                suggestions,
            });

            if (candidate) {
                const st = shiftTemplates[shiftId] || shifts[shiftId] || {};

                suggestions.push({
                    date: dateStr,
                    personId: candidate.id,
                    groupId,
                    shiftId,
                    shiftTemplateId: slot.shiftTemplateId || shiftId,
                    status: 'A',
                    startTime: st.startTime || slot.startTime || null,
                    endTime: st.endTime || slot.endTime || null,
                    breakStart: st.breakStart || null,
                    breakEnd: st.breakEnd || null,
                    hours: shiftHours,
                });

                tracker[candidate.id].thisWeek += shiftHours;
                tracker[candidate.id].accumulated += shiftHours;
            } else {
                vacancies.push({
                    date: dateStr,
                    groupId,
                    shiftId,
                    reason: 'Ingen tillgänglig personal',
                });
            }
        }
    });

    /* ── Stats ── */
    const stats = {
        totalSlots: weekTemplate.slots.reduce((sum, s) => sum + (s.count || 1), 0),
        filled: suggestions.length,
        vacancies: vacancies.length,
        hoursAssigned: suggestions.reduce((sum, s) => sum + (s.hours || 0), 0),
        perPerson: {},
    };

    Object.values(tracker).forEach(t => {
        if (t.thisWeek > 0) {
            stats.perPerson[t.person.id] = {
                name: `${t.person.firstName} ${t.person.lastName}`,
                thisWeek: t.thisWeek,
                accumulated: t.accumulated,
                periodTarget: t.periodTarget,
                pctUsed: t.periodTarget > 0 ? Math.round((t.accumulated / t.periodTarget) * 100) : 0,
            };
        }
    });

    return { suggestions, vacancies, stats };
}

/**
 * Generera schema för FLERA veckor med ackumulering
 */
export function generatePeriodSchedule(options) {
    const {
        weekOffsets,
        year,
        weekTemplate,
        state,
        getWeekDates,
    } = options;

    const people = (state.people || []).filter(p => p.isActive);
    const totalWeeks = weekOffsets.length;

    const accumulatedHours = calcExistingHours(state, people, year);

    console.log('📊 Period-generering startar:');
    people.forEach(p => {
        const period = getCalculationPeriod(p);
        const target = (p.employmentPct || 100) / 100 * 40 * period;
        const existing = accumulatedHours[p.id] || 0;
        console.log(`  ${p.firstName} ${p.lastName}: ${p.employmentPct}% → ${period}v period, mål ${target.toFixed(0)}h, redan ${existing.toFixed(0)}h`);
    });

    const allSuggestions = [];
    const allVacancies = [];

    weekOffsets.forEach((wo, idx) => {
        const weekDates = getWeekDates(year, wo);

        const result = generateWeekSchedule({
            weekDates,
            weekTemplate,
            groups: state.groups,
            shifts: state.shifts,
            shiftTemplates: state.shiftTemplates,
            groupShifts: state.groupShifts,
            people,
            absences: state.absences || [],
            existingEntries: {},
            demand: state.demand,
            accumulatedHours,
            weekIndex: idx,
            totalWeeks,
        });

        allSuggestions.push(result.suggestions);
        allVacancies.push(...result.vacancies);

        result.suggestions.forEach(sug => {
            accumulatedHours[sug.personId] = (accumulatedHours[sug.personId] || 0) + (sug.hours || 0);
        });

        console.log(`  Vecka ${idx + 1}/${totalWeeks}: ${result.suggestions.length} tilldelningar`);
    });

    const totalStats = {
        weeks: totalWeeks,
        totalFilled: allSuggestions.reduce((sum, arr) => sum + arr.length, 0),
        totalVacancies: allVacancies.length,
        totalHours: allSuggestions.flat().reduce((sum, s) => sum + (s.hours || 0), 0),
        perPerson: {},
    };

    people.forEach(p => {
        const hours = accumulatedHours[p.id] || 0;
        const periodWeeks = getCalculationPeriod(p);
        const periodTarget = (p.employmentPct || 100) / 100 * 40 * periodWeeks;
        totalStats.perPerson[p.id] = {
            name: `${p.firstName} ${p.lastName}`,
            employmentPct: p.employmentPct,
            hours: Math.round(hours * 10) / 10,
            periodTarget: Math.round(periodTarget),
            periodWeeks,
            pctUsed: periodTarget > 0 ? Math.round((hours / periodTarget) * 100) : 0,
        };
    });

    console.log('📊 Period-generering klar:', JSON.stringify(totalStats, null, 2));

    return { allSuggestions, allVacancies, totalStats };
}

/* ========================================================================
   BLOCK 2 — CANDIDATE SELECTION
   ======================================================================== */

function findBestWeekCandidate(ctx) {
    const {
        groupPeople, tracker, dateStr, dayIndex, shiftId, groupId,
        shiftHours, absenceMap, existingEntries, suggestions,
    } = ctx;

    const candidates = [];

    groupPeople.forEach(person => {
        const t = tracker[person.id];
        if (!t) return;

        const alreadyToday = suggestions.some(s =>
            s.date === dateStr && s.personId === person.id
        );
        if (alreadyToday) return;

        const existing = existingEntries[dateStr];
        if (Array.isArray(existing) && existing.some(e => e.personId === person.id)) return;

        if (absenceMap[person.id]?.[dateStr]) return;

        if (t.thisWeek + shiftHours > t.maxThisWeek) return;

        if (t.accumulated >= t.periodTarget) return;

        const pctUsed = t.periodTarget > 0 ? t.accumulated / t.periodTarget : 1;
        const weekBalance = t.weeklyTarget - t.thisWeek;

        const isPreferred = Array.isArray(person.preferredShifts) && person.preferredShifts.includes(shiftId) ? 500 : 0;
        const isAvoided = Array.isArray(person.avoidShifts) && person.avoidShifts.includes(shiftId) ? -500 : 0;
        const isSub = person.employmentType === 'substitute' ? -200 : 0;

        const priority = (1 - pctUsed) * 10000 + weekBalance * 100 + isPreferred + isAvoided + isSub;

        candidates.push({
            person,
            priority,
            pctUsed,
            weekBalance,
            nameKey: `${person.lastName || ''}|${person.firstName || ''}`.toLowerCase(),
        });
    });

    candidates.sort((a, b) => {
        if (Math.abs(b.priority - a.priority) > 0.01) return b.priority - a.priority;
        return a.nameKey.localeCompare(b.nameKey);
    });

    return candidates.length > 0 ? candidates[0].person : null;
}

/* ========================================================================
   BLOCK 3 — HELPERS
   ======================================================================== */

function getCalculationPeriod(person) {
    if (person.calculationPeriod) return person.calculationPeriod;
    return (person.employmentPct || 100) >= 100 ? 26 : 16;
}

function calcMaxWeekHoursInternal(person, weekIndex, totalWeeks, accumulated, periodWeeks, weeklyTarget) {
    const hardMax = 48;
    const periodTarget = (person.employmentPct || 100) / 100 * 40 * periodWeeks;
    const remaining = Math.max(0, periodTarget - accumulated);
    const weeksLeft = Math.max(1, totalWeeks - weekIndex);
    const softMax = Math.min(hardMax, (remaining / weeksLeft) * 1.2);
    return Math.max(8, Math.min(hardMax, softMax));
}

function getShiftHours(shiftId, shifts, shiftTemplates) {
    const shift = shifts[shiftId] || shiftTemplates[shiftId];
    if (!shift) return 8;
    if (typeof shift.hours === 'number') return shift.hours;

    if (shift.startTime && shift.endTime) {
        const start = parseTime(shift.startTime);
        const end = parseTime(shift.endTime);
        if (start !== null && end !== null) {
            let diff = end - start;
            if (diff <= 0) diff += 24;
            if (shift.breakStart && shift.breakEnd) {
                const bs = parseTime(shift.breakStart);
                const be = parseTime(shift.breakEnd);
                if (bs !== null && be !== null && be > bs) diff -= (be - bs);
            }
            return Math.max(0, diff);
        }
    }
    return 8;
}

function parseTime(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h + m / 60;
}

function timeToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const p = hhmm.split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

function formatDate(d) {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function buildAbsenceMap(absences, weekDates) {
    const map = {};
    if (!Array.isArray(absences)) return map;

    const weekStart = weekDates[0]?.getTime();
    const weekEnd = weekDates[6]?.getTime();
    if (!weekStart || !weekEnd) return map;

    absences.forEach(abs => {
        if (!abs || !abs.personId) return;
        const from = new Date(abs.startDate || abs.from).getTime();
        const to = new Date(abs.endDate || abs.to).getTime();
        if (isNaN(from) || isNaN(to)) return;
        if (to < weekStart || from > weekEnd) return;

        if (!map[abs.personId]) map[abs.personId] = {};
        weekDates.forEach(d => {
            const t = d.getTime();
            if (t >= from && t <= to) {
                map[abs.personId][formatDate(d)] = true;
            }
        });
    });

    return map;
}

function calcExistingHours(state, people, year) {
    const hours = {};
    people.forEach(p => { hours[p.id] = 0; });

    const months = state.schedule?.months;
    if (!Array.isArray(months)) return hours;

    const allShifts = { ...(state.shifts || {}), ...(state.shiftTemplates || {}) };

    months.forEach(monthData => {
        const days = Array.isArray(monthData?.days) ? monthData.days : [];
        days.forEach(day => {
            const entries = Array.isArray(day?.entries) ? day.entries : [];
            entries.forEach(entry => {
                if (!entry || entry.status !== 'A') return;
                if (!entry.personId || hours[entry.personId] === undefined) return;

                const shift = allShifts[entry.shiftId];
                const h = shift ? calcShiftHours(shift, entry) : 8;
                hours[entry.personId] += h;
            });
        });
    });

    return hours;
}
