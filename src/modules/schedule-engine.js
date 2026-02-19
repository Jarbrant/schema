/*
 * AO-07 — Schedule Engine
 * FIL: src/modules/schedule-engine.js
 *
 * Motor-modul för schemaläggning. Används av calendar.js (AO-07).
 *
 * Exporterar:
 *   - getEligiblePersons({ date, groupId, shiftId, groups, shifts, groupShifts, people, dayData })
 *   - assignPersonToShift({ entries, personId, shiftId, shift, groupId })
 *   - unassignPerson({ entries, personId, shiftId })
 *   - getDaySummary({ date, dayData, groups, demand, people })
 *   - calcShiftHours(shift, entry)
 *   - calcDayCost(dayData, shifts, shiftTemplates, people)
 *   - isPersonAvailable(person, dateStr, absences)
 *   - getPersonWorkload(personId, scheduleMonths, monthIdx)
 *
 * Kontrakt:
 *   - Inga sido-effekter (ren logik)
 *   - Inga DOM-operationer
 *   - Inga store-imports (data skickas in)
 *   - Fail-closed: returnerar tomma/säkra defaults vid felaktig input
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const VALID_STATUSES = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB', 'EXTRA'];

const ABSENCE_STATUSES = ['SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB'];

/* ============================================================
 * getEligiblePersons
 *
 * Returnerar en lista med { person, eligible, reason, workedDays,
 * isPreferred, isAvoided } för alla personer som tillhör gruppen.
 *
 * Sorterad: tillgängliga först, sedan föredragna först, sedan namn.
 * ============================================================ */
export function getEligiblePersons({
    date,
    groupId,
    shiftId,
    groups,
    shifts,
    groupShifts,
    people,
    dayData,
    absences,
    scheduleMonths,
}) {
    if (!date || !groupId || !Array.isArray(people)) return [];

    const dayEntries = dayData?.entries || [];

    // Hitta alla aktiva personer i gruppen
    const groupPeople = people.filter(p => {
        if (!p || !p.isActive) return false;
        const pGroups = p.groups || p.groupIds || [];
        return Array.isArray(pGroups) && pGroups.includes(groupId);
    });

    const results = groupPeople.map(person => {
        const pid = person.id;
        let eligible = true;
        let reason = null;

        // 1) Redan tilldelad SAMMA pass?
        const alreadySameShift = dayEntries.some(e =>
            e.personId === pid && e.shiftId === shiftId && e.status === 'A'
        );
        if (alreadySameShift) {
            eligible = false;
            reason = 'Redan schemalagd på detta pass';
        }

        // 2) Redan tilldelad ANNAT pass denna dag?
        if (eligible) {
            const otherShift = dayEntries.some(e =>
                e.personId === pid && e.shiftId !== shiftId && e.status === 'A'
            );
            if (otherShift) {
                eligible = false;
                reason = 'Arbetar annat pass denna dag';
            }
        }

        // 3) Frånvaro (absences array)
        if (eligible && Array.isArray(absences)) {
            const isAbsent = absences.some(abs =>
                abs.personId === pid && isAbsenceOnDate(abs, date)
            );
            if (isAbsent) {
                eligible = false;
                const absType = absences.find(a => a.personId === pid && isAbsenceOnDate(a, date));
                reason = `Frånvarande (${absType?.type || '?'})`;
            }
        }

        // 4) Frånvaro via entry-status (legacy: entries med SEM/SJ etc.)
        if (eligible) {
            const absEntry = dayEntries.find(e =>
                e.personId === pid && ABSENCE_STATUSES.includes(e.status)
            );
            if (absEntry) {
                eligible = false;
                reason = `Frånvarande (${absEntry.status})`;
            }
        }

        // 5) Tillgänglighet (availability[0..6], mån=0)
        if (eligible && Array.isArray(person.availability)) {
            const dayOfWeek = new Date(date).getDay(); // 0=sön
            const availIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // mån=0
            if (!person.availability[availIdx]) {
                eligible = false;
                reason = 'Ej tillgänglig denna veckodag';
            }
        }

        // Arbetade dagar denna månad
        const workedDays = countWorkedDays(pid, dayEntries, scheduleMonths, date);

        // Preferenser
        const isPreferred = Array.isArray(person.preferredShifts) && person.preferredShifts.includes(shiftId);
        const isAvoided = Array.isArray(person.avoidShifts) && person.avoidShifts.includes(shiftId);

        return {
            person,
            eligible,
            reason,
            workedDays,
            isPreferred,
            isAvoided,
        };
    });

    // Sortera: tillgängliga först → föredragna först → efternamn
    results.sort((a, b) => {
        if (a.eligible && !b.eligible) return -1;
        if (!a.eligible && b.eligible) return 1;
        if (a.isPreferred && !b.isPreferred) return -1;
        if (!a.isPreferred && b.isPreferred) return 1;
        const nameA = (a.person.lastName || a.person.name || '').toLowerCase();
        const nameB = (b.person.lastName || b.person.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'sv');
    });

    return results;
}

/* ============================================================
 * assignPersonToShift
 *
 * Lägger till en entry i entries-arrayen.
 * Returnerar ny array (immutable).
 * ============================================================ */
export function assignPersonToShift({ entries, personId, shiftId, shift, groupId }) {
    if (!personId || !shiftId) return entries || [];

    const existing = Array.isArray(entries) ? [...entries] : [];

    // Kolla om redan tilldelad
    const alreadyExists = existing.some(e =>
        e.personId === personId && e.shiftId === shiftId &&
        (!groupId || e.groupId === groupId) && e.status === 'A'
    );
    if (alreadyExists) return existing;

    const newEntry = {
        personId: String(personId),
        shiftId: String(shiftId),
        groupId: groupId ? String(groupId) : '',
        status: 'A',
        startTime: shift?.startTime || null,
        endTime: shift?.endTime || null,
        breakStart: shift?.breakStart || null,
        breakEnd: shift?.breakEnd || null,
    };

    existing.push(newEntry);
    return existing;
}

/* ============================================================
 * unassignPerson
 *
 * Tar bort person från entries. Om shiftId anges, ta bara bort
 * den specifika tilldelningen; annars ta bort alla för personen.
 * Returnerar ny array (immutable).
 * ============================================================ */
export function unassignPerson({ entries, personId, shiftId }) {
    if (!personId || !Array.isArray(entries)) return entries || [];

    return entries.filter(e => {
        if (e.personId !== personId) return true;
        if (shiftId && e.shiftId !== shiftId) return true;
        return false;
    });
}

/* ============================================================
 * getDaySummary
 *
 * Returnerar { [groupId]: { needed, assigned, delta } }
 * ============================================================ */
export function getDaySummary({ date, dayData, groups, demand, people }) {
    const result = {};

    if (!date || !groups || typeof groups !== 'object') return result;

    const dayOfWeek = new Date(date).getDay(); // 0=sön
    const demandIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // mån=0

    const entries = dayData?.entries || [];
    const groupDemands = demand?.groupDemands || {};

    Object.keys(groups).forEach(gid => {
        const needed = Array.isArray(groupDemands[gid])
            ? (groupDemands[gid][demandIdx] || 0)
            : 0;

        const assigned = entries.filter(e =>
            e.groupId === gid && e.status === 'A' && e.personId
        ).length;

        result[gid] = {
            needed,
            assigned,
            delta: assigned - needed,
        };
    });

    return result;
}

/* ============================================================
 * calcShiftHours
 *
 * Beräknar arbetstimmar för ett pass (minus rast).
 * Hanterar nattpass (slut < start).
 * ============================================================ */
export function calcShiftHours(shift, entry) {
    const start = entry?.startTime || shift?.startTime;
    const end = entry?.endTime || shift?.endTime;
    const breakS = entry?.breakStart || shift?.breakStart;
    const breakE = entry?.breakEnd || shift?.breakEnd;

    if (!start || !end) return 0;

    let totalMinutes = timeToMinutes(end) - timeToMinutes(start);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // nattpass

    if (breakS && breakE) {
        let breakMinutes = timeToMinutes(breakE) - timeToMinutes(breakS);
        if (breakMinutes < 0) breakMinutes += 24 * 60;
        totalMinutes -= breakMinutes;
    }

    return Math.max(0, totalMinutes / 60);
}

/* ============================================================
 * calcDayCost
 *
 * Beräknar total personalkostnad för en dag.
 * Returnerar { totalHours, totalCost, byGroup: { [gid]: { hours, cost } } }
 * ============================================================ */
export function calcDayCost(dayData, shifts, shiftTemplates, people) {
    const entries = dayData?.entries || [];
    const result = { totalHours: 0, totalCost: 0, byGroup: {} };

    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    entries.forEach(entry => {
        if (entry.status !== 'A' || !entry.personId) return;

        const shift = allShifts[entry.shiftId];
        if (!shift) return;

        const hours = calcShiftHours(shift, entry);
        const person = Array.isArray(people)
            ? people.find(p => p.id === entry.personId)
            : null;

        const wage = person?.hourlyWage || 0;
        const cost = hours * wage;

        result.totalHours += hours;
        result.totalCost += cost;

        const gid = entry.groupId || '_unknown';
        if (!result.byGroup[gid]) result.byGroup[gid] = { hours: 0, cost: 0 };
        result.byGroup[gid].hours += hours;
        result.byGroup[gid].cost += cost;
    });

    return result;
}

/* ============================================================
 * isPersonAvailable
 *
 * Kontrollerar om en person är tillgänglig ett visst datum.
 * Kollar: isActive, availability[weekday], absences.
 * ============================================================ */
export function isPersonAvailable(person, dateStr, absences) {
    if (!person || !person.isActive) return { available: false, reason: 'Inaktiv' };

    // Veckodag
    if (Array.isArray(person.availability)) {
        const dayOfWeek = new Date(dateStr).getDay();
        const availIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (!person.availability[availIdx]) {
            return { available: false, reason: 'Ej tillgänglig denna veckodag' };
        }
    }

    // Frånvaro
    if (Array.isArray(absences)) {
        const abs = absences.find(a => a.personId === person.id && isAbsenceOnDate(a, dateStr));
        if (abs) {
            return { available: false, reason: `Frånvarande (${abs.type || '?'})` };
        }
    }

    return { available: true, reason: null };
}

/* ============================================================
 * getPersonWorkload
 *
 * Räknar arbetade dagar + timmar för en person i en given månad.
 * Returnerar { workedDays, totalHours }
 * ============================================================ */
export function getPersonWorkload(personId, scheduleMonths, monthIdx, shifts, shiftTemplates) {
    const result = { workedDays: 0, totalHours: 0 };

    if (!personId || !Array.isArray(scheduleMonths)) return result;

    const month = scheduleMonths[monthIdx];
    if (!month || !Array.isArray(month.days)) return result;

    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    month.days.forEach(day => {
        if (!day || !Array.isArray(day.entries)) return;

        const personEntries = day.entries.filter(e =>
            e.personId === personId && e.status === 'A'
        );

        if (personEntries.length > 0) {
            result.workedDays++;

            personEntries.forEach(entry => {
                const shift = allShifts[entry.shiftId];
                if (shift) {
                    result.totalHours += calcShiftHours(shift, entry);
                }
            });
        }
    });

    return result;
}

/* ============================================================
 * generateWeekSchedule
 *
 * Auto-genererar schema för en vecka baserat på veckomall
 * (weekTemplate) och bemanningsbehov (demand).
 *
 * Returnerar array av föreslagna entries:
 *   [{ date, groupId, shiftId, personId, status, ... }]
 *
 * Algoritm:
 *   1. Gå igenom veckomallens slots
 *   2. Per slot: hitta tillgängliga personer i gruppen
 *   3. Tilldela i ordning: föredragna → ordinarie → vikarier
 *   4. Markera vakanser om inte tillräckligt med folk
 * ============================================================ */
export function generateWeekSchedule({
    weekDates,
    weekTemplate,
    groups,
    shifts,
    shiftTemplates,
    groupShifts,
    people,
    absences,
    existingEntries,
    demand,
}) {
    const suggestions = [];
    const vacancySuggestions = [];

    if (!weekTemplate || !Array.isArray(weekTemplate.slots) || !Array.isArray(weekDates)) {
        return { suggestions, vacancySuggestions };
    }

    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    // Track assignments this week to avoid double-booking
    const weekAssignments = new Map(); // personId → Set of dateStr

    // Pre-fill from existing entries
    if (existingEntries && typeof existingEntries === 'object') {
        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const dayEntries = existingEntries[dateStr] || [];
            dayEntries.forEach(e => {
                if (e.personId && e.status === 'A') {
                    if (!weekAssignments.has(e.personId)) weekAssignments.set(e.personId, new Set());
                    weekAssignments.get(e.personId).add(dateStr);
                }
            });
        });
    }

    // Process each slot in the template
    weekTemplate.slots.forEach(slot => {
        const { dayOfWeek, groupId, shiftTemplateId, count, countMin } = slot;

        if (dayOfWeek < 0 || dayOfWeek > 6) return;
        const dateObj = weekDates[dayOfWeek];
        if (!dateObj) return;
        const dateStr = formatISO(dateObj);

        const shift = allShifts[shiftTemplateId];
        if (!shift) return;

        // Find eligible people for this group
        const groupPeople = (people || []).filter(p => {
            if (!p || !p.isActive) return false;
            const pGroups = p.groups || p.groupIds || [];
            return Array.isArray(pGroups) && pGroups.includes(groupId);
        });

        // Sort: preferred → ordinarie → vikarier
        const sorted = [...groupPeople].sort((a, b) => {
            const aPref = Array.isArray(a.preferredShifts) && a.preferredShifts.includes(shiftTemplateId) ? -2 : 0;
            const bPref = Array.isArray(b.preferredShifts) && b.preferredShifts.includes(shiftTemplateId) ? -2 : 0;
            const aAvoid = Array.isArray(a.avoidShifts) && a.avoidShifts.includes(shiftTemplateId) ? 2 : 0;
            const bAvoid = Array.isArray(b.avoidShifts) && b.avoidShifts.includes(shiftTemplateId) ? 2 : 0;
            const aType = a.employmentType === 'substitute' ? 1 : 0;
            const bType = b.employmentType === 'substitute' ? 1 : 0;

            return (aPref + aAvoid + aType) - (bPref + bAvoid + bType);
        });

        let assigned = 0;
        const targetCount = count || 0;

        for (const person of sorted) {
            if (assigned >= targetCount) break;

            // Kolla tillgänglighet
            const { available } = isPersonAvailable(person, dateStr, absences || []);
            if (!available) continue;

            // Kolla om redan bokad denna dag
            const personDays = weekAssignments.get(person.id);
            if (personDays && personDays.has(dateStr)) continue;

            // Tilldela
            suggestions.push({
                date: dateStr,
                groupId,
                shiftId: shiftTemplateId,
                shiftTemplateId,
                personId: person.id,
                status: 'A',
                startTime: shift.startTime || null,
                endTime: shift.endTime || null,
                breakStart: shift.breakStart || null,
                breakEnd: shift.breakEnd || null,
            });

            if (!weekAssignments.has(person.id)) weekAssignments.set(person.id, new Set());
            weekAssignments.get(person.id).add(dateStr);
            assigned++;
        }

        // Vakanser om inte tillräckligt folk
        const remaining = targetCount - assigned;
        for (let i = 0; i < remaining; i++) {
            vacancySuggestions.push({
                date: dateStr,
                groupId,
                shiftTemplateId,
                status: 'open',
            });
        }
    });

    return { suggestions, vacancySuggestions };
}

/* ============================================================
 * validateScheduleIntegrity
 *
 * Kontrollerar integritet i schemat:
 *   - Dubbelbokning (samma person, samma dag, två pass)
 *   - Ghost entries (personId pekar på raderad person)
 *   - Frånvaro-konflikter
 *
 * Returnerar array av { type, severity, message, date, personId }
 * ============================================================ */
export function validateScheduleIntegrity(scheduleMonths, people, absences) {
    const warnings = [];
    const peopleMap = new Map();

    if (Array.isArray(people)) {
        people.forEach(p => { if (p?.id) peopleMap.set(p.id, p); });
    }

    if (!Array.isArray(scheduleMonths)) return warnings;

    scheduleMonths.forEach((month, mIdx) => {
        if (!month || !Array.isArray(month.days)) return;

        month.days.forEach((day, dIdx) => {
            if (!day || !Array.isArray(day.entries)) return;
            const dateStr = day.date || `?-${mIdx + 1}-${dIdx + 1}`;

            // Track person assignments per day
            const dayPersonShifts = new Map(); // personId → [shiftId, ...]

            day.entries.forEach((entry, eIdx) => {
                if (!entry || entry.status !== 'A' || !entry.personId) return;

                // Ghost check
                if (!peopleMap.has(entry.personId)) {
                    warnings.push({
                        type: 'ghost',
                        severity: 'warning',
                        message: `Okänd person "${entry.personId}" schemalagd`,
                        date: dateStr,
                        personId: entry.personId,
                    });
                    return;
                }

                // Dubbelbokning check
                if (!dayPersonShifts.has(entry.personId)) {
                    dayPersonShifts.set(entry.personId, []);
                }
                const prev = dayPersonShifts.get(entry.personId);
                if (prev.length > 0 && !prev.includes(entry.shiftId)) {
                    const person = peopleMap.get(entry.personId);
                    const name = person ? `${person.firstName} ${person.lastName}` : entry.personId;
                    warnings.push({
                        type: 'double-booking',
                        severity: 'error',
                        message: `${name} har ${prev.length + 1} pass på samma dag`,
                        date: dateStr,
                        personId: entry.personId,
                    });
                }
                prev.push(entry.shiftId);

                // Frånvaro-konflikt
                if (Array.isArray(absences)) {
                    const abs = absences.find(a =>
                        a.personId === entry.personId && isAbsenceOnDate(a, dateStr)
                    );
                    if (abs) {
                        const person = peopleMap.get(entry.personId);
                        const name = person ? `${person.firstName} ${person.lastName}` : entry.personId;
                        warnings.push({
                            type: 'absence-conflict',
                            severity: 'error',
                            message: `${name} är schemalagd men har ${abs.type}`,
                            date: dateStr,
                            personId: entry.personId,
                        });
                    }
                }
            });
        });
    });

    return warnings;
}

/* ============================================================
 * INTERNAL HELPERS
 * ============================================================ */

/**
 * Kontrollerar om en absence gäller för ett visst datum.
 */
function isAbsenceOnDate(absence, dateStr) {
    if (!absence || !dateStr) return false;

    if (absence.pattern === 'single') {
        return absence.date === dateStr;
    }

    if (absence.pattern === 'range') {
        const start = absence.startDate || '';
        const end = absence.endDate || '9999-12-31';
        return dateStr >= start && dateStr <= end;
    }

    if (absence.pattern === 'recurring') {
        const start = absence.startDate || '';
        const end = absence.endDate || '9999-12-31';
        if (dateStr < start || dateStr > end) return false;
        if (!Array.isArray(absence.days)) return false;
        const dayOfWeek = new Date(dateStr).getDay(); // 0=sön
        return absence.days.includes(dayOfWeek);
    }

    return false;
}

/**
 * Räknar arbetade dagar för en person i aktuell månad.
 */
function countWorkedDays(personId, currentDayEntries, scheduleMonths, dateStr) {
    if (!scheduleMonths || !dateStr) {
        // Fallback: räkna bara i nuvarande dags entries
        return currentDayEntries.filter(e => e.personId === personId && e.status === 'A').length > 0 ? 1 : 0;
    }

    const parts = dateStr.split('-');
    const monthIdx = parseInt(parts[1], 10) - 1;

    if (!Array.isArray(scheduleMonths) || !scheduleMonths[monthIdx]) return 0;

    const month = scheduleMonths[monthIdx];
    let count = 0;

    if (Array.isArray(month.days)) {
        month.days.forEach(day => {
            if (!day || !Array.isArray(day.entries)) return;
            const hasWork = day.entries.some(e => e.personId === personId && e.status === 'A');
            if (hasWork) count++;
        });
    }

    return count;
}

/**
 * HH:MM → minuter
 */
function timeToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const parts = hhmm.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

/**
 * Date → "YYYY-MM-DD"
 */
function formatISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
