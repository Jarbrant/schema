/*
 * AO-07 — Schedule Engine: Eligible persons + assign/unassign
 *
 * Pure functions — ingen DOM, ingen store-import.
 * Anropas av views/calendar.js med data från store.
 *
 * "Eligible" = person som KAN arbeta ett visst pass en viss dag:
 *   1. isActive === true
 *   2. Tillhör rätt grupp (person.groups/groupIds inkluderar gruppens id)
 *   3. Gruppen har det valda passet kopplat (groupShifts)
 *   4. Inte redan schemalagd på det datumet
 *   5. Har availability för veckodagen (om availability finns)
 *   6. Sorteras: lägst arbetade dagar först (fairness)
 */

import { isRedDay } from '../data/holidays.js';

/* ============================================================
 * GET ELIGIBLE PERSONS
 * ============================================================ */

/**
 * @param {object} params
 * @param {string} params.date        — "2026-03-15"
 * @param {string} params.groupId     — "COOKS"
 * @param {string} params.shiftId     — "MORNING"
 * @param {object} params.groups      — state.groups
 * @param {object} params.shifts      — state.shifts
 * @param {object} params.groupShifts — state.groupShifts
 * @param {Array}  params.people      — state.people
 * @param {object} params.dayData     — schedule.months[m].days[d] (entries for this date)
 * @param {object} [params.monthStats] — { [personId]: { workedDays } } from rules engine (optional)
 * @returns {Array} [{ person, reason?, eligible, workedDays }]
 */
export function getEligiblePersons({
    date,
    groupId,
    shiftId,
    groups,
    shifts,
    groupShifts,
    people,
    dayData,
    monthStats,
}) {
    // Validate inputs
    if (!date || !groupId || !shiftId) return [];
    if (!groups?.[groupId]) return [];
    if (!shifts?.[shiftId]) return [];

    // Check that this shift is linked to this group
    const linkedShifts = Array.isArray(groupShifts?.[groupId]) ? groupShifts[groupId] : [];
    if (!linkedShifts.includes(shiftId)) return [];

    const entries = dayData?.entries || [];
    const dateObj = parseDateStr(date);
    const dayOfWeek = dateObj ? dateObj.getDay() : -1; // 0=sön, 1=mån, ...
    // Convert to mån=0...sön=6 (availability index)
    const availIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const results = [];

    (people || []).forEach(person => {
        if (!person || !person.id) return;

        // 1. Active
        if (!person.isActive) {
            results.push({ person, eligible: false, reason: 'Inaktiv' });
            return;
        }

        // 2. Belongs to group
        const pGroups = Array.isArray(person.groups) ? person.groups
                      : Array.isArray(person.groupIds) ? person.groupIds
                      : [];
        if (!pGroups.includes(groupId)) {
            // Don't include — not in this group at all
            return;
        }

        // 3. Already scheduled on this date (any shift)
        const existingEntry = entries.find(e => e.personId === person.id);
        if (existingEntry && existingEntry.status === 'A') {
            results.push({
                person,
                eligible: false,
                reason: `Redan schemalagd (${existingEntry.shiftId || 'okänt pass'})`,
                currentShiftId: existingEntry.shiftId,
            });
            return;
        }

        // 4. On leave / vacation / sick
        if (existingEntry && ['SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB'].includes(existingEntry.status)) {
            results.push({
                person,
                eligible: false,
                reason: `Frånvarande (${existingEntry.status})`,
            });
            return;
        }

        // 5. Availability check (mån=0, tis=1, ..., sön=6)
        if (Array.isArray(person.availability) && person.availability.length >= 7) {
            if (!person.availability[availIdx]) {
                results.push({
                    person,
                    eligible: false,
                    reason: 'Inte tillgänglig denna veckodag',
                });
                return;
            }
        }

        // 6. Eligible!
        const workedDays = monthStats?.[person.id]?.workedDays ?? 0;

        results.push({
            person,
            eligible: true,
            workedDays,
            reason: null,
        });
    });

    // Sort: eligible first, then by workedDays asc (fairness), then alphabetical
    results.sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        if (a.eligible && b.eligible) {
            if (a.workedDays !== b.workedDays) return a.workedDays - b.workedDays;
        }
        const nameA = `${a.person.lastName} ${a.person.firstName}`;
        const nameB = `${b.person.lastName} ${b.person.firstName}`;
        return nameA.localeCompare(nameB, 'sv');
    });

    return results;
}

/* ============================================================
 * ASSIGN / UNASSIGN
 * ============================================================ */

/**
 * Tilldela en person till ett pass på ett datum.
 * Returnerar uppdaterad entries-array (mutation-free).
 */
export function assignPersonToShift({ entries, personId, shiftId, shift }) {
    if (!personId || !shiftId) return entries || [];

    const existing = (entries || []).filter(e => e.personId !== personId);

    const newEntry = {
        personId,
        status: 'A',
        shiftId,
        start: shift?.startTime || null,
        end: shift?.endTime || null,
        breakStart: shift?.breakStart || null,
        breakEnd: shift?.breakEnd || null,
    };

    return [...existing, newEntry];
}

/**
 * Ta bort en person från ett datum (sätter till L eller tar bort entry).
 */
export function unassignPerson({ entries, personId }) {
    if (!personId) return entries || [];
    return (entries || []).filter(e => e.personId !== personId);
}

/* ============================================================
 * DAY SUMMARY — vad behövs vs vad som är schemalagt
 * ============================================================ */

/**
 * Beräkna behov vs tillsatta per grupp för en dag.
 *
 * @param {object} params
 * @param {string} params.date
 * @param {object} params.dayData     — { entries }
 * @param {object} params.groups
 * @param {object} params.demand      — state.demand
 * @param {Array}  params.people
 * @returns {{ [groupId]: { needed, assigned, delta } }}
 */
export function getDaySummary({ date, dayData, groups, demand, people }) {
    const dateObj = parseDateStr(date);
    if (!dateObj) return {};

    const dayOfWeek = dateObj.getDay(); // 0=sön
    const demandIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // mån=0...sön=6

    const groupDemands = demand?.groupDemands || {};
    const entries = dayData?.entries || [];

    const summary = {};

    Object.keys(groups || {}).forEach(gid => {
        const needed = Array.isArray(groupDemands[gid]) ? (groupDemands[gid][demandIdx] || 0) : 0;

        // Count assigned: entries where personId belongs to this group and status='A'
        const assigned = entries.filter(e => {
            if (e.status !== 'A') return false;
            const person = (people || []).find(p => p.id === e.personId);
            if (!person) return false;
            const pGroups = Array.isArray(person.groups) ? person.groups
                          : Array.isArray(person.groupIds) ? person.groupIds
                          : [];
            return pGroups.includes(gid);
        }).length;

        summary[gid] = {
            needed,
            assigned,
            delta: assigned - needed, // negative = undermanned
        };
    });

    return summary;
}

/* ============================================================
 * HELPERS
 * ============================================================ */
function parseDateStr(dateStr) {
    if (typeof dateStr !== 'string' || dateStr.length < 10) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
}
