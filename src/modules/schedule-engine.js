/*
 * AO-07 — Schedule Engine — v2.2 (AUTOPATCH)
 * FIL: src/modules/schedule-engine.js
 *
 * v2.2 TILLÄGG:
 *   - generatePeriodSchedule(): bulk-generering med beräkningsperiod (16/26v)
 *   - generateWeekSchedule() uppdaterad med accumulatedHours-stöd
 *
 * v2.0 TILLÄGG (bevarade):
 *   - validateRules(): validerar state.rules mot schemat
 *   - calcFullPersonCost(): total kostnad inkl semester, FORA, arbetsgivaravgift
 *   - checkMinimumWage(): timlön mot kollektivavtal
 *
 * Alla befintliga exporter oförändrade (bakåtkompatibla).
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const VALID_STATUSES = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB', 'EXTRA'];
const ABSENCE_STATUSES = ['SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB'];

const MINIMUM_WAGES = {
    HRF:      { hourly: 146, monthly: 25370, label: 'HRF (Hotell & Restaurang)' },
    Unionen:  { hourly: 155, monthly: 26900, label: 'Unionen' },
    Kommunal: { hourly: 145, monthly: 25000, label: 'Kommunal' },
    none:     { hourly: 0,   monthly: 0,     label: 'Inget avtal' },
};

/* ============================================================
 * BLOCK 1 — EXISTING EXPORTS (OFÖRÄNDRADE)
 * ============================================================ */

export function getEligiblePersons({ date, groupId, shiftId, groups, shifts, groupShifts, people, dayData, absences, scheduleMonths }) {
    if (!date || !groupId || !Array.isArray(people)) return [];
    const dayEntries = dayData?.entries || [];
    const groupPeople = people.filter(p => {
        if (!p || !p.isActive) return false;
        const pGroups = p.groups || p.groupIds || [];
        return Array.isArray(pGroups) && pGroups.includes(groupId);
    });
    const results = groupPeople.map(person => {
        const pid = person.id;
        let eligible = true, reason = null;
        const alreadySameShift = dayEntries.some(e => e.personId === pid && e.shiftId === shiftId && e.status === 'A');
        if (alreadySameShift) { eligible = false; reason = 'Redan schemalagd på detta pass'; }
        if (eligible) { const otherShift = dayEntries.some(e => e.personId === pid && e.shiftId !== shiftId && e.status === 'A'); if (otherShift) { eligible = false; reason = 'Arbetar annat pass denna dag'; } }
        if (eligible && Array.isArray(absences)) { const isAbsent = absences.some(abs => abs.personId === pid && isAbsenceOnDate(abs, date)); if (isAbsent) { eligible = false; const absType = absences.find(a => a.personId === pid && isAbsenceOnDate(a, date)); reason = `Frånvarande (${absType?.type || '?'})`; } }
        if (eligible) { const absEntry = dayEntries.find(e => e.personId === pid && ABSENCE_STATUSES.includes(e.status)); if (absEntry) { eligible = false; reason = `Frånvarande (${absEntry.status})`; } }
        if (eligible && Array.isArray(person.availability)) { const dow = new Date(date).getDay(); const ai = dow === 0 ? 6 : dow - 1; if (!person.availability[ai]) { eligible = false; reason = 'Ej tillgänglig denna veckodag'; } }
        const workedDays = countWorkedDays(pid, dayEntries, scheduleMonths, date);
        const isPreferred = Array.isArray(person.preferredShifts) && person.preferredShifts.includes(shiftId);
        const isAvoided = Array.isArray(person.avoidShifts) && person.avoidShifts.includes(shiftId);
        return { person, eligible, reason, workedDays, isPreferred, isAvoided };
    });
    results.sort((a, b) => { if (a.eligible && !b.eligible) return -1; if (!a.eligible && b.eligible) return 1; if (a.isPreferred && !b.isPreferred) return -1; if (!a.isPreferred && b.isPreferred) return 1; const nA = (a.person.lastName || a.person.name || '').toLowerCase(); const nB = (b.person.lastName || b.person.name || '').toLowerCase(); return nA.localeCompare(nB, 'sv'); });
    return results;
}

export function assignPersonToShift({ entries, personId, shiftId, shift, groupId }) {
    if (!personId || !shiftId) return entries || [];
    const existing = Array.isArray(entries) ? [...entries] : [];
    if (existing.some(e => e.personId === personId && e.shiftId === shiftId && (!groupId || e.groupId === groupId) && e.status === 'A')) return existing;
    existing.push({ personId: String(personId), shiftId: String(shiftId), groupId: groupId ? String(groupId) : '', status: 'A', startTime: shift?.startTime || null, endTime: shift?.endTime || null, breakStart: shift?.breakStart || null, breakEnd: shift?.breakEnd || null });
    return existing;
}

export function unassignPerson({ entries, personId, shiftId }) {
    if (!personId || !Array.isArray(entries)) return entries || [];
    return entries.filter(e => { if (e.personId !== personId) return true; if (shiftId && e.shiftId !== shiftId) return true; return false; });
}

export function getDaySummary({ date, dayData, groups, demand, people }) {
    const result = {};
    if (!date || !groups || typeof groups !== 'object') return result;
    const dow = new Date(date).getDay(); const di = dow === 0 ? 6 : dow - 1;
    const entries = dayData?.entries || []; const gd = demand?.groupDemands || {};
    Object.keys(groups).forEach(gid => { const needed = Array.isArray(gd[gid]) ? (gd[gid][di] || 0) : 0; const assigned = entries.filter(e => e.groupId === gid && e.status === 'A' && e.personId).length; result[gid] = { needed, assigned, delta: assigned - needed }; });
    return result;
}

export function calcShiftHours(shift, entry) {
    const start = entry?.startTime || shift?.startTime;
    const end = entry?.endTime || shift?.endTime;
    const breakS = entry?.breakStart || shift?.breakStart;
    const breakE = entry?.breakEnd || shift?.breakEnd;
    if (!start || !end) return 0;
    let totalMinutes = timeToMinutes(end) - timeToMinutes(start);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (breakS && breakE) { let bm = timeToMinutes(breakE) - timeToMinutes(breakS); if (bm < 0) bm += 24 * 60; totalMinutes -= bm; }
    return Math.max(0, totalMinutes / 60);
}

export function calcDayCost(dayData, shifts, shiftTemplates, people) {
    const entries = dayData?.entries || [];
    const result = { totalHours: 0, totalCost: 0, byGroup: {} };
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    entries.forEach(entry => { if (entry.status !== 'A' || !entry.personId) return; const shift = allShifts[entry.shiftId]; if (!shift) return; const hours = calcShiftHours(shift, entry); const person = Array.isArray(people) ? people.find(p => p.id === entry.personId) : null; const wage = person?.hourlyWage || 0; const cost = hours * wage; result.totalHours += hours; result.totalCost += cost; const gid = entry.groupId || '_unknown'; if (!result.byGroup[gid]) result.byGroup[gid] = { hours: 0, cost: 0 }; result.byGroup[gid].hours += hours; result.byGroup[gid].cost += cost; });
    return result;
}

export function isPersonAvailable(person, dateStr, absences) {
    if (!person || !person.isActive) return { available: false, reason: 'Inaktiv' };
    if (Array.isArray(person.availability)) { const dow = new Date(dateStr).getDay(); const ai = dow === 0 ? 6 : dow - 1; if (!person.availability[ai]) return { available: false, reason: 'Ej tillgänglig denna veckodag' }; }
    if (Array.isArray(absences)) { const abs = absences.find(a => a.personId === person.id && isAbsenceOnDate(a, dateStr)); if (abs) return { available: false, reason: `Frånvarande (${abs.type || '?'})` }; }
    return { available: true, reason: null };
}

export function getPersonWorkload(personId, scheduleMonths, monthIdx, shifts, shiftTemplates) {
    const result = { workedDays: 0, totalHours: 0 };
    if (!personId || !Array.isArray(scheduleMonths)) return result;
    const month = scheduleMonths[monthIdx]; if (!month || !Array.isArray(month.days)) return result;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    month.days.forEach(day => { if (!day || !Array.isArray(day.entries)) return; const pe = day.entries.filter(e => e.personId === personId && e.status === 'A'); if (pe.length > 0) { result.workedDays++; pe.forEach(entry => { const shift = allShifts[entry.shiftId]; if (shift) result.totalHours += calcShiftHours(shift, entry); }); } });
    return result;
}

/* ============================================================
 * BLOCK 2 — generateWeekSchedule v2.2 (med beräkningsperiod)
 * ============================================================ */
export function generateWeekSchedule({ weekDates, weekTemplate, groups, shifts, shiftTemplates, groupShifts, people, absences, existingEntries, demand, accumulatedHours, weekIndex, totalWeeks }) {
    const suggestions = [], vacancySuggestions = [];
    if (!weekTemplate || !Array.isArray(weekTemplate.slots) || !Array.isArray(weekDates)) return { suggestions, vacancySuggestions };

    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const accHours = accumulatedHours || {};
    const wIdx = weekIndex || 0;
    const wTotal = totalWeeks || 1;

    /* Tracker per person */
    const tracker = {};
    (people || []).forEach(p => {
        if (!p || !p.isActive) return;
        const periodWeeks = _getCalcPeriod(p);
        const weeklyTarget = (p.employmentPct || 100) / 100 * 40;
        const periodTarget = weeklyTarget * periodWeeks;
        const accumulated = accHours[p.id] || 0;

        tracker[p.id] = {
            person: p,
            periodWeeks,
            weeklyTarget,
            periodTarget,
            accumulated,
            thisWeek: 0,
            maxThisWeek: _calcMaxWeek(p, wIdx, wTotal, accumulated, periodWeeks, weeklyTarget),
        };
    });

    /* Absence-lookup */
    const absenceMap = {};
    if (Array.isArray(absences)) {
        (people || []).forEach(person => {
            if (!person) return;
            weekDates.forEach(date => {
                const ds = formatISO(date);
                if (absences.some(a => a.personId === person.id && isAbsenceOnDate(a, ds))) {
                    if (!absenceMap[person.id]) absenceMap[person.id] = {};
                    absenceMap[person.id][ds] = true;
                }
            });
        });
    }

    /* Existing entries lookup */
    const weekAssignments = new Map();
    if (existingEntries && typeof existingEntries === 'object') {
        weekDates.forEach(date => {
            const ds = formatISO(date);
            const de = existingEntries[ds] || [];
            de.forEach(e => {
                if (e.personId && e.status === 'A') {
                    if (!weekAssignments.has(e.personId)) weekAssignments.set(e.personId, new Set());
                    weekAssignments.get(e.personId).add(ds);
                }
            });
        });
    }

    /* Processera slots */
    weekTemplate.slots.forEach(slot => {
        const { dayOfWeek, dayIndex, groupId, shiftTemplateId, shiftId: slotShiftId, count, startTime: slotStart, endTime: slotEnd } = slot;
        const dIdx = typeof dayOfWeek === 'number' ? dayOfWeek : (typeof dayIndex === 'number' ? dayIndex : -1);
        if (dIdx < 0 || dIdx > 6) return;

        const dateObj = weekDates[dIdx];
        if (!dateObj) return;
        const dateStr = formatISO(dateObj);

        const resolvedShiftId = shiftTemplateId || slotShiftId;
        const shiftHours = _getShiftHoursInternal(resolvedShiftId, shifts, shiftTemplates);

        const gp = (people || []).filter(p => {
            if (!p || !p.isActive) return false;
            const pg = (p.groups || p.groupIds || []).map(g => String(g));
            return pg.includes(String(groupId));
        });

        const tc = count || 0;

        for (let i = 0; i < tc; i++) {
            const candidate = _findCandidate({
                groupPeople: gp, tracker, dateStr, resolvedShiftId, shiftHours,
                absenceMap, weekAssignments, suggestions,
            });

            if (candidate) {
                const st = allShifts[resolvedShiftId] || {};
                suggestions.push({
                    date: dateStr,
                    groupId,
                    shiftId: resolvedShiftId,
                    shiftTemplateId: shiftTemplateId || resolvedShiftId,
                    personId: candidate.id,
                    status: 'A',
                    startTime: st.startTime || slotStart || null,
                    endTime: st.endTime || slotEnd || null,
                    breakStart: st.breakStart || null,
                    breakEnd: st.breakEnd || null,
                    hours: shiftHours,
                });

                tracker[candidate.id].thisWeek += shiftHours;
                tracker[candidate.id].accumulated += shiftHours;

                if (!weekAssignments.has(candidate.id)) weekAssignments.set(candidate.id, new Set());
                weekAssignments.get(candidate.id).add(dateStr);
            } else {
                vacancySuggestions.push({ date: dateStr, groupId, shiftTemplateId: resolvedShiftId, status: 'open' });
            }
        }
    });

    return { suggestions, vacancySuggestions };
}

/* ============================================================
 * BLOCK 3 — generatePeriodSchedule v2.2 (NY)
 * Bulk-generering med ackumulering + beräkningsperiod
 * ============================================================ */
export function generatePeriodSchedule({ weekOffsets, year, weekTemplate, state, getWeekDates }) {
    const people = (state.people || []).filter(p => p.isActive);
    const totalWeeks = weekOffsets.length;

    /* Ackumulerade timmar — starta med redan befintliga entries */
    const accumulatedHours = {};
    people.forEach(p => { accumulatedHours[p.id] = 0; });

    const months = state.schedule?.months;
    const allShifts = { ...(state.shifts || {}), ...(state.shiftTemplates || {}) };
    if (Array.isArray(months)) {
        months.forEach(monthData => {
            const days = Array.isArray(monthData?.days) ? monthData.days : [];
            days.forEach(day => {
                const entries = Array.isArray(day?.entries) ? day.entries : [];
                entries.forEach(entry => {
                    if (!entry || entry.status !== 'A') return;
                    if (!entry.personId || accumulatedHours[entry.personId] === undefined) return;
                    const shift = allShifts[entry.shiftId];
                    accumulatedHours[entry.personId] += shift ? calcShiftHours(shift, entry) : 8;
                });
            });
        });
    }

    console.log('📊 Period-generering startar:');
    people.forEach(p => {
        const period = _getCalcPeriod(p);
        const target = (p.employmentPct || 100) / 100 * 40 * period;
        console.log(`  ${p.firstName} ${p.lastName}: ${p.employmentPct}% → ${period}v, mål ${target.toFixed(0)}h, redan ${(accumulatedHours[p.id] || 0).toFixed(0)}h`);
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

        const weekSuggestions = result.suggestions || [];
        const weekVacancies = result.vacancySuggestions || [];

        allSuggestions.push(weekSuggestions);
        allVacancies.push(...weekVacancies);

        weekSuggestions.forEach(sug => {
            accumulatedHours[sug.personId] = (accumulatedHours[sug.personId] || 0) + (sug.hours || 0);
        });

        console.log(`  Vecka ${idx + 1}/${totalWeeks}: ${weekSuggestions.length} tilldelningar`);
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
        const periodWeeks = _getCalcPeriod(p);
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

/* ============================================================
 * BLOCK 4 — validateScheduleIntegrity
 * ============================================================ */
export function validateScheduleIntegrity(scheduleMonths, people, absences) {
    const warnings = []; const pm = new Map();
    if (Array.isArray(people)) people.forEach(p => { if (p?.id) pm.set(p.id, p); });
    if (!Array.isArray(scheduleMonths)) return warnings;
    scheduleMonths.forEach((month, mIdx) => { if (!month || !Array.isArray(month.days)) return; month.days.forEach((day, dIdx) => { if (!day || !Array.isArray(day.entries)) return; const ds = day.date || `?-${mIdx + 1}-${dIdx + 1}`; const dps = new Map(); day.entries.forEach(entry => { if (!entry || entry.status !== 'A' || !entry.personId) return; if (!pm.has(entry.personId)) { warnings.push({ type: 'ghost', severity: 'warning', message: `Okänd person "${entry.personId}" schemalagd`, date: ds, personId: entry.personId }); return; } if (!dps.has(entry.personId)) dps.set(entry.personId, []); const prev = dps.get(entry.personId); if (prev.length > 0 && !prev.includes(entry.shiftId)) { const p = pm.get(entry.personId); const nm = p ? `${p.firstName} ${p.lastName}` : entry.personId; warnings.push({ type: 'double-booking', severity: 'error', message: `${nm} har ${prev.length + 1} pass på samma dag`, date: ds, personId: entry.personId }); } prev.push(entry.shiftId); if (Array.isArray(absences)) { const abs = absences.find(a => a.personId === entry.personId && isAbsenceOnDate(a, ds)); if (abs) { const p = pm.get(entry.personId); const nm = p ? `${p.firstName} ${p.lastName}` : entry.personId; warnings.push({ type: 'absence-conflict', severity: 'error', message: `${nm} är schemalagd men har ${abs.type}`, date: ds, personId: entry.personId }); } } }); }); });
    return warnings;
}

/* ============================================================
 * BLOCK 5 — validateRules
 * ============================================================ */
export function validateRules({ weekDates, rules, scheduleMonths, people, shifts, shiftTemplates, groupShifts, groups, settings }) {
    const warnings = [];
    if (!Array.isArray(rules) || !Array.isArray(weekDates)) return warnings;

    const activeRules = rules.filter(r => r.isActive);
    if (!activeRules.length) return warnings;

    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const activePeople = Array.isArray(people) ? people.filter(p => p.isActive) : [];
    const pm = new Map();
    activePeople.forEach(p => pm.set(p.id, p));

    const personWeekData = new Map();

    activePeople.forEach(person => {
        const days = [];
        let totalHours = 0;

        weekDates.forEach(date => {
            const ds = formatISO(date);
            const mi = getMonthIndex(ds), di = getDayIndex(ds);
            const dayData = scheduleMonths?.[mi]?.days?.[di];
            const entries = (dayData?.entries || []).filter(e => e.personId === person.id && e.status === 'A');
            let dayHours = 0;

            entries.forEach(e => {
                const shift = allShifts[e.shiftId];
                if (shift) dayHours += calcShiftHours(shift, e);
            });

            days.push({ date: ds, entries, hours: dayHours });
            totalHours += dayHours;
        });

        personWeekData.set(person.id, { days, totalHours });
    });

    activeRules.forEach(rule => {
        const ruleValue = typeof rule.value === 'number' ? rule.value : null;
        if (ruleValue === null && rule.type !== 'custom' && rule.type !== 'obTillagg') return;

        const ruleBase = { ruleId: rule.id, ruleName: rule.name };

        switch (rule.type) {
            case 'maxHoursWeek': {
                personWeekData.forEach((data, pid) => {
                    if (data.totalHours > ruleValue) {
                        const p = pm.get(pid);
                        const nm = p ? `${p.firstName} ${p.lastName}` : pid;
                        const pct = (p?.employmentPct || 100) / 100;
                        const adjustedMax = ruleValue * pct;
                        if (data.totalHours > adjustedMax) {
                            warnings.push({ ...ruleBase, type: 'maxHoursWeek', severity: 'error',
                                message: `${nm}: ${data.totalHours.toFixed(1)} tim/vecka (max ${adjustedMax.toFixed(0)} tim vid ${p?.employmentPct || 100}%)`,
                                personId: pid, date: formatISO(weekDates[0]) });
                        }
                    }
                });
                break;
            }
            case 'maxHoursDay': {
                personWeekData.forEach((data, pid) => {
                    data.days.forEach(day => {
                        if (day.hours > ruleValue) {
                            const p = pm.get(pid);
                            const nm = p ? `${p.firstName} ${p.lastName}` : pid;
                            warnings.push({ ...ruleBase, type: 'maxHoursDay', severity: 'error',
                                message: `${nm}: ${day.hours.toFixed(1)} tim på en dag (max ${ruleValue})`,
                                personId: pid, date: day.date });
                        }
                    });
                });
                break;
            }
            case 'minRestBetween': {
                personWeekData.forEach((data, pid) => {
                    for (let i = 1; i < data.days.length; i++) {
                        const prevDay = data.days[i - 1];
                        const currDay = data.days[i];
                        if (prevDay.entries.length === 0 || currDay.entries.length === 0) continue;

                        let latestEnd = 0;
                        prevDay.entries.forEach(e => {
                            const shift = allShifts[e.shiftId];
                            const endStr = e.endTime || shift?.endTime;
                            if (endStr) {
                                let endMin = timeToMinutes(endStr);
                                const startStr = e.startTime || shift?.startTime;
                                if (startStr && endMin < timeToMinutes(startStr)) endMin += 24 * 60;
                                latestEnd = Math.max(latestEnd, endMin);
                            }
                        });

                        let earliestStart = 24 * 60;
                        currDay.entries.forEach(e => {
                            const shift = allShifts[e.shiftId];
                            const startStr = e.startTime || shift?.startTime;
                            if (startStr) earliestStart = Math.min(earliestStart, timeToMinutes(startStr));
                        });

                        let restHours = (earliestStart + 24 * 60 - latestEnd) / 60;
                        if (restHours >= 24) restHours -= 24;

                        if (restHours < ruleValue) {
                            const p = pm.get(pid);
                            const nm = p ? `${p.firstName} ${p.lastName}` : pid;
                            warnings.push({ ...ruleBase, type: 'minRestBetween', severity: 'error',
                                message: `${nm}: ${restHours.toFixed(1)} tim vila (min ${ruleValue} tim krävs)`,
                                personId: pid, date: currDay.date });
                        }
                    }
                });
                break;
            }
            case 'maxConsecutive': {
                personWeekData.forEach((data, pid) => {
                    let consecutive = 0;
                    data.days.forEach(day => {
                        if (day.entries.length > 0) {
                            consecutive++;
                            if (consecutive > ruleValue) {
                                const p = pm.get(pid);
                                const nm = p ? `${p.firstName} ${p.lastName}` : pid;
                                warnings.push({ ...ruleBase, type: 'maxConsecutive', severity: 'warning',
                                    message: `${nm}: ${consecutive} dagar i rad (max ${ruleValue})`,
                                    personId: pid, date: day.date });
                            }
                        } else {
                            consecutive = 0;
                        }
                    });
                });
                break;
            }
            case 'minStaffPerShift': {
                weekDates.forEach(date => {
                    const ds = formatISO(date);
                    const mi = getMonthIndex(ds), di = getDayIndex(ds);
                    const dayData = scheduleMonths?.[mi]?.days?.[di];
                    if (!dayData || !Array.isArray(dayData.entries)) return;

                    const shiftCounts = {};
                    dayData.entries.forEach(e => {
                        if (e.status !== 'A' || !e.personId) return;
                        if (!shiftCounts[e.shiftId]) shiftCounts[e.shiftId] = { count: 0, groupId: e.groupId };
                        shiftCounts[e.shiftId].count++;
                    });

                    Object.entries(shiftCounts).forEach(([sid, info]) => {
                        if (info.count < ruleValue) {
                            const shift = allShifts[sid];
                            const g = groups?.[info.groupId];
                            warnings.push({ ...ruleBase, type: 'minStaffPerShift', severity: 'warning',
                                message: `${g?.name || info.groupId} / ${shift?.name || sid}: ${info.count} person(er) (min ${ruleValue})`,
                                date: ds });
                        }
                    });
                });
                break;
            }
        }
    });

    return warnings;
}

/* ============================================================
 * BLOCK 6 — calcFullPersonCost + checkMinimumWage
 * ============================================================ */
export function calcFullPersonCost(person, hours, settings) {
    const wage = person?.hourlyWage || 0;
    const grossWage = hours * wage;
    const vacRate = person?.vacationPayRate ?? settings?.defaultVacationPayRate ?? 0.12;
    const foraRate = person?.foraRate ?? settings?.defaultForaRate ?? 0.043;
    const taxRate = settings?.defaultEmployerTaxRate ?? 0.3142;
    const vacationPay = grossWage * vacRate;
    const fora = grossWage * foraRate;
    const employerTax = grossWage * taxRate;
    const totalCost = grossWage + vacationPay + fora + employerTax;
    return { grossWage, vacationPay, fora, employerTax, totalCost };
}

export function checkMinimumWage(people, settings) {
    const warnings = [];
    if (!Array.isArray(people)) return warnings;
    const defaultAgreement = settings?.defaultCollectiveAgreement || 'HRF';
    people.forEach(person => {
        if (!person || !person.isActive) return;
        const agreement = person.collectiveAgreement || defaultAgreement;
        const minWage = MINIMUM_WAGES[agreement];
        if (!minWage || minWage.hourly === 0) return;
        const hourlyWage = person.hourlyWage || 0;
        if (hourlyWage > 0 && hourlyWage < minWage.hourly) {
            const nm = person.firstName && person.lastName ? `${person.firstName} ${person.lastName}` : (person.name || person.id);
            warnings.push({ type: 'minimumWage', severity: 'error', ruleId: 'system-min-wage', ruleName: 'Minimilön',
                message: `${nm}: ${hourlyWage} kr/tim — under ${minWage.label} minimum ${minWage.hourly} kr/tim`, personId: person.id });
        }
    });
    return warnings;
}

/* ============================================================
 * BLOCK 7 — INTERNAL HELPERS (v2.3 — workdaysPerWeek + availability)
 * ============================================================ */
function _getCalcPeriod(person) {
    if (person.calculationPeriod) return person.calculationPeriod;
    return (person.employmentPct || 100) >= 100 ? 26 : 16;
}

function _calcMaxWeek(person, weekIndex, totalWeeks, accumulated, periodWeeks, weeklyTarget) {
    const hardMax = 48;
    const periodTarget = (person.employmentPct || 100) / 100 * 40 * periodWeeks;
    const remaining = Math.max(0, periodTarget - accumulated);
    const weeksLeft = Math.max(1, totalWeeks - weekIndex);
    const softMax = Math.min(hardMax, (remaining / weeksLeft) * 1.2);
    return Math.max(8, Math.min(hardMax, softMax));
}

function _getShiftHoursInternal(shiftId, shifts, shiftTemplates) {
    const shift = (shifts || {})[shiftId] || (shiftTemplates || {})[shiftId];
    if (!shift) return 8;
    if (typeof shift.hours === 'number') return shift.hours;
    if (shift.startTime && shift.endTime) {
        let diff = timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime);
        if (diff <= 0) diff += 24 * 60;
        if (shift.breakStart && shift.breakEnd) {
            let bm = timeToMinutes(shift.breakEnd) - timeToMinutes(shift.breakStart);
            if (bm < 0) bm += 24 * 60;
            diff -= bm;
        }
        return Math.max(0, diff / 60);
    }
    return 8;
}

/* ============================================================
 * _findCandidate v2.3
 *
 * NYA KONTROLLER:
 *   1) workdaysPerWeek — max antal dagar denna vecka
 *   2) availability    — är personen tillgänglig denna veckodag?
 *   3) 36h veckovila   — blockera om redan 6 dagar i rad
 * ============================================================ */
function _findCandidate(ctx) {
    const { groupPeople, tracker, dateStr, resolvedShiftId, shiftHours, absenceMap, weekAssignments, suggestions } = ctx;
    const candidates = [];

    groupPeople.forEach(person => {
        const t = tracker[person.id];
        if (!t) return;

        /* --- Redan schemalagd idag? --- */
        const alreadyToday = suggestions.some(s => s.date === dateStr && s.personId === person.id);
        if (alreadyToday) return;

        const pd = weekAssignments.get(person.id);
        if (pd && pd.has(dateStr)) return;

        /* --- Frånvaro? --- */
        if (absenceMap[person.id]?.[dateStr]) return;

        /* ============================================================
         * NY KONTROLL 1: Tillgänglighet (availability)
         *
         * person.availability = [true, true, true, true, true, true, false]
         *                        mån   tis   ons   tor   fre   lör   sön
         * ============================================================ */
        if (Array.isArray(person.availability)) {
            const dateObj = new Date(dateStr);
            const jsDay = dateObj.getDay();               // 0=sön, 1=mån...6=lör
            const dayIdx = jsDay === 0 ? 6 : jsDay - 1;  // Konvertera till 0=mån, 6=sön
            if (person.availability[dayIdx] === false) return;
        }

        /* ============================================================
         * NY KONTROLL 2: Max dagar per vecka (workdaysPerWeek)
         *
         * Kidist: tillgänglig mån–lör (6 dagar) men workdaysPerWeek=5
         * → max 5 schemalagda dagar denna vecka
         * ============================================================ */
        const maxDaysPerWeek = person.workdaysPerWeek || 5;
        const daysThisWeek = pd ? pd.size : 0;
        if (daysThisWeek >= maxDaysPerWeek) return;

        /* ============================================================
         * NY KONTROLL 3: 36h veckovila (implicit)
         *
         * Med standardpass (7–8h) + 11h dygnsvila:
         * 6 dagar × 8h = person har bara 16h kvar av veckan
         * → Inte nog för 36h sammanhängande vila
         * → Blockera vid 6+ dagar oavsett workdaysPerWeek
         * ============================================================ */
        if (daysThisWeek >= 6) return;

        /* --- Max timmar denna vecka? --- */
        if (t.thisWeek + shiftHours > t.maxThisWeek) return;

        /* --- Redan nått periodmålet? --- */
        if (t.accumulated >= t.periodTarget) return;

        /* --- Prioritetsberäkning --- */
        const pctUsed = t.periodTarget > 0 ? t.accumulated / t.periodTarget : 1;
        const weekBalance = t.weeklyTarget - t.thisWeek;

        const isPreferred = Array.isArray(person.preferredShifts) && person.preferredShifts.includes(resolvedShiftId) ? 500 : 0;
        const isAvoided = Array.isArray(person.avoidShifts) && person.avoidShifts.includes(resolvedShiftId) ? -500 : 0;
        const isSub = person.employmentType === 'substitute' ? -200 : 0;

        /* NY: Bonus om personen är nära sitt dagsmål men inte över */
        const daysTarget = maxDaysPerWeek;
        const daysBalance = daysTarget - daysThisWeek;
        const daysBonus = daysBalance > 0 ? daysBalance * 50 : -1000;

        const priority = (1 - pctUsed) * 10000 + weekBalance * 100 + daysBonus + isPreferred + isAvoided + isSub;

        candidates.push({
            person, priority, pctUsed,
            nameKey: `${person.lastName || ''}|${person.firstName || ''}`.toLowerCase(),
        });
    });

    candidates.sort((a, b) => {
        if (Math.abs(b.priority - a.priority) > 0.01) return b.priority - a.priority;
        return a.nameKey.localeCompare(b.nameKey);
    });

    return candidates.length > 0 ? candidates[0].person : null;
}

/* ── Shared helpers ── */
function isAbsenceOnDate(absence, dateStr) {
    if (!absence || !dateStr) return false;
    if (absence.pattern === 'single') return absence.date === dateStr;
    if (absence.pattern === 'range') { const s = absence.startDate || '', e = absence.endDate || '9999-12-31'; return dateStr >= s && dateStr <= e; }
    if (absence.pattern === 'recurring') { const s = absence.startDate || '', e = absence.endDate || '9999-12-31'; if (dateStr < s || dateStr > e) return false; if (!Array.isArray(absence.days)) return false; return absence.days.includes(new Date(dateStr).getDay()); }
    return false;
}

function countWorkedDays(personId, currentDayEntries, scheduleMonths, dateStr) {
    if (!scheduleMonths || !dateStr) return currentDayEntries.filter(e => e.personId === personId && e.status === 'A').length > 0 ? 1 : 0;
    const parts = dateStr.split('-'); const monthIdx = parseInt(parts[1], 10) - 1;
    if (!Array.isArray(scheduleMonths) || !scheduleMonths[monthIdx]) return 0;
    const month = scheduleMonths[monthIdx]; let count = 0;
    if (Array.isArray(month.days)) { month.days.forEach(day => { if (!day || !Array.isArray(day.entries)) return; if (day.entries.some(e => e.personId === personId && e.status === 'A')) count++; }); }
    return count;
}

function timeToMinutes(hhmm) { if (!hhmm || typeof hhmm !== 'string') return 0; const p = hhmm.split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }

function formatISO(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function getMonthIndex(ds) { return parseInt(ds.split('-')[1], 10) - 1; }
function getDayIndex(ds) { return parseInt(ds.split('-')[2], 10) - 1; }
