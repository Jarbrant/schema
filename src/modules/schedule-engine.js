/*
 * AO-07 — Schedule Engine — v2.0 (RULES + COST)
 * FIL: src/modules/schedule-engine.js
 *
 * v2.0 TILLÄGG:
 *   - validateRules(): validerar state.rules mot schemat
 *   - calcFullPersonCost(): beräknar total kostnad inkl semester, FORA, arbetsgivaravgift
 *   - checkMinimumWage(): kollar timlön mot kollektivavtal
 *
 * Befintliga exporter oförändrade (bakåtkompatibla).
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const VALID_STATUSES = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB', 'EXTRA'];
const ABSENCE_STATUSES = ['SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB'];

/* Minimilöner per kollektivavtal (kr/tim, ungefärliga 2025-nivåer) */
const MINIMUM_WAGES = {
    HRF:      { hourly: 146, monthly: 25370, label: 'HRF (Hotell & Restaurang)' },
    Unionen:  { hourly: 155, monthly: 26900, label: 'Unionen' },
    Kommunal: { hourly: 145, monthly: 25000, label: 'Kommunal' },
    none:     { hourly: 0,   monthly: 0,     label: 'Inget avtal' },
};

/* ============================================================
 * EXISTING EXPORTS — OFÖRÄNDRADE
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

export function generateWeekSchedule({ weekDates, weekTemplate, groups, shifts, shiftTemplates, groupShifts, people, absences, existingEntries, demand }) {
    const suggestions = [], vacancySuggestions = [];
    if (!weekTemplate || !Array.isArray(weekTemplate.slots) || !Array.isArray(weekDates)) return { suggestions, vacancySuggestions };
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const weekAssignments = new Map();
    if (existingEntries && typeof existingEntries === 'object') { weekDates.forEach(date => { const ds = formatISO(date); const de = existingEntries[ds] || []; de.forEach(e => { if (e.personId && e.status === 'A') { if (!weekAssignments.has(e.personId)) weekAssignments.set(e.personId, new Set()); weekAssignments.get(e.personId).add(ds); } }); }); }
    weekTemplate.slots.forEach(slot => { const { dayOfWeek, groupId, shiftTemplateId, count } = slot; if (dayOfWeek < 0 || dayOfWeek > 6) return; const dateObj = weekDates[dayOfWeek]; if (!dateObj) return; const dateStr = formatISO(dateObj); const shift = allShifts[shiftTemplateId]; if (!shift) return; const gp = (people || []).filter(p => { if (!p || !p.isActive) return false; const pg = p.groups || p.groupIds || []; return Array.isArray(pg) && pg.includes(groupId); }); const sorted = [...gp].sort((a, b) => { const ap = Array.isArray(a.preferredShifts) && a.preferredShifts.includes(shiftTemplateId) ? -2 : 0; const bp = Array.isArray(b.preferredShifts) && b.preferredShifts.includes(shiftTemplateId) ? -2 : 0; const aa = Array.isArray(a.avoidShifts) && a.avoidShifts.includes(shiftTemplateId) ? 2 : 0; const ba = Array.isArray(b.avoidShifts) && b.avoidShifts.includes(shiftTemplateId) ? 2 : 0; const at = a.employmentType === 'substitute' ? 1 : 0; const bt = b.employmentType === 'substitute' ? 1 : 0; return (ap + aa + at) - (bp + ba + bt); }); let assigned = 0; const tc = count || 0; for (const person of sorted) { if (assigned >= tc) break; const { available } = isPersonAvailable(person, dateStr, absences || []); if (!available) continue; const pd = weekAssignments.get(person.id); if (pd && pd.has(dateStr)) continue; suggestions.push({ date: dateStr, groupId, shiftId: shiftTemplateId, shiftTemplateId, personId: person.id, status: 'A', startTime: shift.startTime || null, endTime: shift.endTime || null, breakStart: shift.breakStart || null, breakEnd: shift.breakEnd || null }); if (!weekAssignments.has(person.id)) weekAssignments.set(person.id, new Set()); weekAssignments.get(person.id).add(dateStr); assigned++; } const rem = tc - assigned; for (let i = 0; i < rem; i++) vacancySuggestions.push({ date: dateStr, groupId, shiftTemplateId, status: 'open' }); });
    return { suggestions, vacancySuggestions };
}

export function validateScheduleIntegrity(scheduleMonths, people, absences) {
    const warnings = []; const pm = new Map();
    if (Array.isArray(people)) people.forEach(p => { if (p?.id) pm.set(p.id, p); });
    if (!Array.isArray(scheduleMonths)) return warnings;
    scheduleMonths.forEach((month, mIdx) => { if (!month || !Array.isArray(month.days)) return; month.days.forEach((day, dIdx) => { if (!day || !Array.isArray(day.entries)) return; const ds = day.date || `?-${mIdx + 1}-${dIdx + 1}`; const dps = new Map(); day.entries.forEach(entry => { if (!entry || entry.status !== 'A' || !entry.personId) return; if (!pm.has(entry.personId)) { warnings.push({ type: 'ghost', severity: 'warning', message: `Okänd person "${entry.personId}" schemalagd`, date: ds, personId: entry.personId }); return; } if (!dps.has(entry.personId)) dps.set(entry.personId, []); const prev = dps.get(entry.personId); if (prev.length > 0 && !prev.includes(entry.shiftId)) { const p = pm.get(entry.personId); const nm = p ? `${p.firstName} ${p.lastName}` : entry.personId; warnings.push({ type: 'double-booking', severity: 'error', message: `${nm} har ${prev.length + 1} pass på samma dag`, date: ds, personId: entry.personId }); } prev.push(entry.shiftId); if (Array.isArray(absences)) { const abs = absences.find(a => a.personId === entry.personId && isAbsenceOnDate(a, ds)); if (abs) { const p = pm.get(entry.personId); const nm = p ? `${p.firstName} ${p.lastName}` : entry.personId; warnings.push({ type: 'absence-conflict', severity: 'error', message: `${nm} är schemalagd men har ${abs.type}`, date: ds, personId: entry.personId }); } } }); }); });
    return warnings;
}

/* ============================================================
 * NEW: validateRules — v2.0
 *
 * Validerar state.rules mot schemat för en given vecka.
 * Returnerar array av { type, severity, message, date, personId, ruleId, ruleName }
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

    /* Bygg veckodata per person */
    const personWeekData = new Map(); // personId → { days: [{ date, entries, hours }], totalHours, consecutiveDays }

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

    /* Kör varje aktiv regel */
    activeRules.forEach(rule => {
        const ruleValue = typeof rule.value === 'number' ? rule.value : null;
        if (ruleValue === null && rule.type !== 'custom' && rule.type !== 'obTillagg') return;

        const ruleBase = { ruleId: rule.id, ruleName: rule.name };

        switch (rule.type) {

            /* ── Max timmar/vecka ── */
            case 'maxHoursWeek': {
                personWeekData.forEach((data, pid) => {
                    if (data.totalHours > ruleValue) {
                        const p = pm.get(pid);
                        const nm = p ? `${p.firstName} ${p.lastName}` : pid;
                        /* Justera för deltid */
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

            /* ── Max timmar/dag ── */
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

            /* ── Min vila mellan pass ── */
            case 'minRestBetween': {
                personWeekData.forEach((data, pid) => {
                    for (let i = 1; i < data.days.length; i++) {
                        const prevDay = data.days[i - 1];
                        const currDay = data.days[i];
                        if (prevDay.entries.length === 0 || currDay.entries.length === 0) continue;

                        /* Hitta senaste sluttid föregående dag */
                        let latestEnd = 0;
                        prevDay.entries.forEach(e => {
                            const shift = allShifts[e.shiftId];
                            const endStr = e.endTime || shift?.endTime;
                            if (endStr) {
                                let endMin = timeToMinutes(endStr);
                                const startStr = e.startTime || shift?.startTime;
                                if (startStr && endMin < timeToMinutes(startStr)) endMin += 24 * 60; // nattpass
                                latestEnd = Math.max(latestEnd, endMin);
                            }
                        });

                        /* Hitta tidigaste starttid denna dag */
                        let earliestStart = 24 * 60;
                        currDay.entries.forEach(e => {
                            const shift = allShifts[e.shiftId];
                            const startStr = e.startTime || shift?.startTime;
                            if (startStr) earliestStart = Math.min(earliestStart, timeToMinutes(startStr));
                        });

                        /* Vila = tid från slut igår till start idag (+ 24h för ny dag) */
                        let restHours = (earliestStart + 24 * 60 - latestEnd) / 60;
                        if (restHours >= 24) restHours -= 24; // normalisera

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

            /* ── Max dagar i rad ── */
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

            /* ── Min bemanning per pass ── */
            case 'minStaffPerShift': {
                weekDates.forEach(date => {
                    const ds = formatISO(date);
                    const mi = getMonthIndex(ds), di = getDayIndex(ds);
                    const dayData = scheduleMonths?.[mi]?.days?.[di];
                    if (!dayData || !Array.isArray(dayData.entries)) return;

                    /* Räkna per shiftId */
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
 * NEW: calcFullPersonCost — v2.0
 *
 * Beräknar TOTAL personalkostnad inkl:
 *   - Bruttolön
 *   - Semesterersättning
 *   - FORA
 *   - Arbetsgivaravgift
 *
 * Returnerar { grossWage, vacationPay, fora, employerTax, totalCost }
 * ============================================================ */
export function calcFullPersonCost(person, hours, settings) {
    const wage = person?.hourlyWage || 0;
    const grossWage = hours * wage;

    /* Personspecifika satser eller fallback till settings/defaults */
    const vacRate = person?.vacationPayRate ?? settings?.defaultVacationPayRate ?? 0.12;
    const foraRate = person?.foraRate ?? settings?.defaultForaRate ?? 0.043;
    const taxRate = settings?.defaultEmployerTaxRate ?? 0.3142;

    const vacationPay = grossWage * vacRate;
    const fora = grossWage * foraRate;
    const employerTax = grossWage * taxRate;

    const totalCost = grossWage + vacationPay + fora + employerTax;

    return { grossWage, vacationPay, fora, employerTax, totalCost };
}

/* ============================================================
 * NEW: checkMinimumWage — v2.0
 *
 * Kollar om personens timlön understiger kollektivavtalets minimum.
 * Returnerar array av varningar.
 * ============================================================ */
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
            warnings.push({
                type: 'minimumWage',
                severity: 'error',
                ruleId: 'system-min-wage',
                ruleName: 'Minimilön',
                message: `${nm}: ${hourlyWage} kr/tim — under ${minWage.label} minimum ${minWage.hourly} kr/tim`,
                personId: person.id,
            });
        }
    });

    return warnings;
}

/* ============================================================
 * INTERNAL HELPERS — OFÖRÄNDRADE
 * ============================================================ */
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
