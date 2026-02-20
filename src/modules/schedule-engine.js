/*
 * AO-07 — SCHEDULE ENGINE v1.0
 * FIL: modules/schedule-engine.js
 *
 * Syfte:
 * - generateWeekSchedule(): Generera schema för EN vecka baserat på veckomall
 * - generatePeriodSchedule(): Generera schema för FLERA veckor med ackumulerade timmar
 *
 * Beräkningsperioder (svensk arbetsrätt):
 * - Heltid (100%): 26 veckor
 * - Deltid (<100%): 16 veckor
 *
 * Principen:
 * - Varje person har ett tim-mål för beräkningsperioden
 * - Engine:n håller koll på ackumulerade timmar vecka för vecka
 * - Den som ligger mest under sitt mål får förtur
 */

/* ========================================================================
   BLOCK 1 — PUBLIC API
   ======================================================================== */

/**
 * Generera schema för EN vecka (anropas från kalendern)
 *
 * @param {object} options
 * @param {Date[]} options.weekDates - 7 datum (mån-sön)
 * @param {object} options.weekTemplate - veckomall med slots
 * @param {object} options.groups - alla grupper
 * @param {object} options.shifts - alla skift
 * @param {object} options.shiftTemplates - skift-mallar
 * @param {object} options.groupShifts - gruppens skift-kopplingar
 * @param {object[]} options.people - aktiva personer
 * @param {object[]} options.absences - frånvaro
 * @param {object} options.existingEntries - redan tilldelade entries { 'YYYY-MM-DD': [...] }
 * @param {object} options.demand - bemanningsbehov
 * @param {object} [options.accumulatedHours] - ackumulerade timmar per person { personId: number }
 * @param {number} [options.weekIndex] - vilken vecka i perioden (0-baserad)
 * @param {number} [options.totalWeeks] - totalt antal veckor i perioden
 * @returns {{ suggestions: object[], vacancies: object[], stats: object }}
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
        const weeklyTarget = (p.employmentPct || 100) / 100 * 40; // 40h = heltidsvecka
        const periodTarget = weeklyTarget * periodWeeks;

        tracker[p.id] = {
            person: p,
            periodWeeks,
            weeklyTarget,
            periodTarget,
            accumulated: accumulatedHours[p.id] || 0,
            thisWeek: 0,
            maxThisWeek: calcMaxWeekHours(p, weekIndex, totalWeeks, accumulatedHours[p.id] || 0, periodWeeks, weeklyTarget),
        };
    });

    /* ── Processera varje slot i veckomallen ── */
    weekTemplate.slots.forEach(slot => {
        const dayIndex = slot.dayIndex; // 0=mån, 6=sön
        if (dayIndex < 0 || dayIndex > 6) return;

        const date = weekDates[dayIndex];
        if (!date) return;

        const dateStr = formatDate(date);
        const groupId = slot.groupId;
        const shiftId = slot.shiftId || slot.shiftTemplateId;
        const needCount = slot.count || 1;

        /* Hitta skiftets timmar */
        const shiftHours = getShiftHours(shiftId, shifts, shiftTemplates);

        /* Hitta kandidater för denna slot */
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

                const suggestion = {
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
                };

                suggestions.push(suggestion);

                /* Uppdatera tracker */
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
 * Anropas från handleApplyLink för bulk-generering
 *
 * @param {object} options
 * @param {number[]} options.weekOffsets - lista av weekOffset-värden
 * @param {number} options.year - kalenderår
 * @param {object} options.weekTemplate - veckomall
 * @param {object} options.state - hela store state
 * @param {function} options.getWeekDates - funktion(year, weekOffset) => Date[7]
 * @returns {{ allSuggestions: object[][], allVacancies: object[], totalStats: object }}
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

    /* Ackumulerade timmar — startar med redan befintliga entries */
    const accumulatedHours = calcExistingHours(state, people, year);

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

        /* Uppdatera ackumulerade timmar för nästa vecka */
        result.suggestions.forEach(sug => {
            accumulatedHours[sug.personId] = (accumulatedHours[sug.personId] || 0) + (sug.hours || 0);
        });
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
            hours,
            periodTarget,
            periodWeeks,
            pctUsed: periodTarget > 0 ? Math.round((hours / periodTarget) * 100) : 0,
        };
    });

    return { allSuggestions, allVacancies, totalStats };
}

/* ========================================================================
   BLOCK 2 — CANDIDATE SELECTION (med beräkningsperiod)
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

        /* 1) Redan schemalagd idag? */
        const alreadyToday = suggestions.some(s =>
            s.date === dateStr && s.personId === person.id
        );
        if (alreadyToday) return;

        /* 2) Redan i existingEntries? */
        const existing = existingEntries[dateStr];
        if (Array.isArray(existing) && existing.some(e => e.personId === person.id)) return;

        /* 3) Frånvaro? */
        if (absenceMap[person.id]?.[dateStr]) return;

        /* 4) Överskrider veckans max? */
        if (t.thisWeek + shiftHours > t.maxThisWeek) return;

        /* 5) Redan över periodmålet? */
        if (t.accumulated >= t.periodTarget) return;

        /* 6) Beräkna prioritet — den som ligger mest under sitt mål får förtur */
        const pctUsed = t.periodTarget > 0 ? t.accumulated / t.periodTarget : 1;
        const weekBalance = t.weeklyTarget - t.thisWeek;

        // Lägre pctUsed = högre prioritet (ligger mer under mål)
        // Vid lika: den med mer kvar i veckan
        const priority = (1 - pctUsed) * 10000 + weekBalance * 100;

        candidates.push({
            person,
            priority,
            pctUsed,
            weekBalance,
            nameKey: `${person.lastName || ''}|${person.firstName || ''}`.toLowerCase(),
        });
    });

    /* Sortera: högst prioritet först, sedan namn (stabil) */
    candidates.sort((a, b) => {
        if (Math.abs(b.priority - a.priority) > 0.01) return b.priority - a.priority;
        return a.nameKey.localeCompare(b.nameKey);
    });

    return candidates.length > 0 ? candidates[0].person : null;
}

/* ========================================================================
   BLOCK 3 — HELPERS
   ======================================================================== */

/**
 * Beräkningsperiod: heltid=26v, deltid=16v
 */
function getCalculationPeriod(person) {
    if (person.calculationPeriod) return person.calculationPeriod;
    return (person.employmentPct || 100) >= 100 ? 26 : 16;
}

/**
 * Max timmar denna vecka — jämnar ut över perioden
 */
function calcMaxWeekHours(person, weekIndex, totalWeeks, accumulated, periodWeeks, weeklyTarget) {
    // Grundregel: max 48h/vecka (EU-arbetstidsdirektiv)
    const hardMax = 48;

    // Mjuk max: baserat på hur mycket som är kvar av periodmålet
    const periodTarget = (person.employmentPct || 100) / 100 * 40 * periodWeeks;
    const remaining = periodTarget - accumulated;
    const weeksLeft = Math.max(1, totalWeeks - weekIndex);

    // Fördela jämnt + 20% marginal
    const softMax = Math.min(hardMax, (remaining / weeksLeft) * 1.2);

    // Men minst 0 och inte under 8 (annars blockeras personen helt)
    return Math.max(8, Math.min(hardMax, softMax));
}

/**
 * Hämta timmar för ett skift
 */
function getShiftHours(shiftId, shifts, shiftTemplates) {
    const shift = shifts[shiftId] || shiftTemplates[shiftId];
    if (!shift) return 8; // default 8h

    if (typeof shift.hours === 'number') return shift.hours;

    // Beräkna från start/sluttid
    if (shift.startTime && shift.endTime) {
        const start = parseTime(shift.startTime);
        const end = parseTime(shift.endTime);
        if (start !== null && end !== null) {
            let diff = end - start;
            if (diff <= 0) diff += 24; // nattskift

            // Dra av rast om den finns
            if (shift.breakStart && shift.breakEnd) {
                const bs = parseTime(shift.breakStart);
                const be = parseTime(shift.breakEnd);
                if (bs !== null && be !== null && be > bs) {
                    diff -= (be - bs);
                }
            }
            return Math.max(0, diff);
        }
    }

    return 8;
}

/**
 * Parse "HH:MM" → decimaltal
 */
function parseTime(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h + m / 60;
}

/**
 * Formatera Date → "YYYY-MM-DD"
 */
function formatDate(d) {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Bygg absence-map: { personId: { 'YYYY-MM-DD': true } }
 */
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

/**
 * Räkna redan befintliga timmar i schemat (för ackumulering)
 */
function calcExistingHours(state, people, year) {
    const hours = {};
    people.forEach(p => { hours[p.id] = 0; });

    const months = state.schedule?.months;
    if (!Array.isArray(months)) return hours;

    months.forEach(monthData => {
        const days = Array.isArray(monthData?.days) ? monthData.days : [];
        days.forEach(day => {
            const entries = Array.isArray(day?.entries) ? day.entries : [];
            entries.forEach(entry => {
                if (!entry || entry.status !== 'A') return;
                if (!entry.personId || hours[entry.personId] === undefined) return;

                // Beräkna timmar från entry
                let h = 8; // default
                if (entry.startTime && entry.endTime) {
                    const s = parseTime(entry.startTime);
                    const e = parseTime(entry.endTime);
                    if (s !== null && e !== null) {
                        h = e - s;
                        if (h <= 0) h += 24;
                        if (entry.breakStart && entry.breakEnd) {
                            const bs = parseTime(entry.breakStart);
                            const be = parseTime(entry.breakEnd);
                            if (bs !== null && be !== null && be > bs) h -= (be - bs);
                        }
                        h = Math.max(0, h);
                    }
                }
                hours[entry.personId] += h;
            });
        });
    });

    return hours;
}
