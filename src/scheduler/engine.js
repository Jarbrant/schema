/*
 * AO-22 — SCHEDULER ENGINE v2: Rollbaserad schemaläggning
 */

import { evaluate } from '../rules.js';

const SKILLS = ['KITCHEN', 'PACK', 'DISH', 'SYSTEM', 'ADMIN'];
const ROLE_PRIORITY = ['SYSTEM', 'ADMIN', 'DISH', 'KITCHEN', 'PACK'];

/**
 * Huvudfunktion: generera rollbaserat schemaförslag
 * @param {object} state - Store state
 * @param {object} input - { year, month, mode: "preview"|"apply" }
 * @returns { proposedState, vacancies: [], notes: "" }
 */
export function generate(state, input) {
    const { year, month, mode = 'preview' } = input;

    if (!state.schedule || state.schedule.year !== year) {
        throw new Error('Schedule year mismatch');
    }

    if (month < 1 || month > 12) {
        throw new Error('Invalid month');
    }

    // Deep clone state
    const proposedState = JSON.parse(JSON.stringify(state));
    const monthData = proposedState.schedule.months[month - 1];
    const days = monthData.days || [];

    const activePeople = proposedState.people.filter((p) => p.isActive);
    const demand = state.demand?.weekdayTemplate || [];
    const kitchenCore = state.kitchenCore || { enabled: true, corePersonIds: [], minCorePerDay: 1 };

    const vacancies = [];
    const notes = [];
    let totalSlots = 0;
    let filledSlots = 0;

    // Rensa gamla A-entries (andra statuser behålls)
    days.forEach((day) => {
        day.entries = day.entries.filter((e) => e.status !== 'A' && e.status !== 'EXTRA');
    });

    // Beräkna target-dagar per person (från tjänstgöringsgrad)
    const sumPct = activePeople.reduce((sum, p) => sum + p.employmentPct, 0);
    const personTargets = {};

    activePeople.forEach((person) => {
        const totalNeed = days.length * 7; // Ungefär 7 personer per dag i genomsnitt
        const targetDays = Math.round((totalNeed * person.employmentPct) / sumPct);
        personTargets[person.id] = {
            target: targetDays,
            current: 0,
            person,
        };
    });

    // Iterera genom dagarna
    days.forEach((dayData, dayIdx) => {
        const dayOfWeek = new Date(year, month - 1, dayIdx + 1).getDay();
        const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = mån, 6 = sön

        const dayDemand = demand[weekdayIndex] || {};

        // Skapa slots för denna dag
        const slots = [];
        SKILLS.forEach((skill) => {
            const count = dayDemand[skill] || 0;
            for (let i = 0; i < count; i++) {
                slots.push({
                    role: skill,
                    filled: false,
                    isCoreSlot: skill === 'KITCHEN' && kitchenCore.enabled && kitchenCore.corePersonIds.length > 0,
                });
            }
        });

        totalSlots += slots.length;

        // Fyll slots enligt prioritet
        ROLE_PRIORITY.forEach((role) => {
            const roleSlots = slots.filter((s) => s.role === role && !s.filled);

            roleSlots.forEach((slot) => {
                // Hitta kandidat för denna slot
                const candidate = findBestCandidate(
                    personTargets,
                    role,
                    dayIdx,
                    days,
                    month,
                    year,
                    proposedState,
                    slot.isCoreSlot,
                    kitchenCore.corePersonIds
                );

                if (candidate) {
                    // Lägg in A-entry med roll
                    const entry = {
                        personId: candidate.id,
                        status: 'A',
                        role: role,
                        start: null,
                        end: null,
                        breakStart: null,
                        breakEnd: null,
                    };
                    dayData.entries.push(entry);
                    slot.filled = true;
                    filledSlots++;
                    personTargets[candidate.id].current++;
                } else {
                    // Vakans: skapa EXTRA PERSONAL entry
                    const extraEntry = {
                        personId: null,
                        status: 'EXTRA',
                        role: role,
                        note: `EXTRA PERSONAL – ${role}`,
                    };
                    dayData.entries.push(extraEntry);

                    // Registrera vakans
                    const existingVacancy = vacancies.find((v) => v.date === dayData.date && v.role === role);
                    if (existingVacancy) {
                        existingVacancy.count++;
                    } else {
                        vacancies.push({
                            date: dayData.date,
                            role: role,
                            count: 1,
                        });
                    }
                }
            });
        });
    });

    // Generera notes
    notes.push(`Rollbaserat schemaförslag för månad ${month} ${year}`);
    notes.push(`Totalt slots: ${totalSlots}`);
    notes.push(`Fyllda slots: ${filledSlots}`);
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    notes.push(`Behov uppfyllt: ${fillRate}%`);

    if (vacancies.length > 0) {
        const uniqueVacantRoles = new Set(vacancies.map((v) => v.role));
        notes.push(`⚠️ Vakanser: ${vacancies.length} pass (${Array.from(uniqueVacantRoles).join(', ')})`);
    }

    proposedState.meta.updatedAt = Date.now();

    return {
        proposedState,
        vacancies,
        notes: notes.join('; '),
        fillRate,
        totalSlots,
        filledSlots,
        month,
    };
}

/**
 * Hitta bästa kandidat för en roll-slot
 */
function findBestCandidate(personTargets, role, dayIdx, days, month, year, proposedState, isCoreSlot, corePersonIds) {
    const candidates = [];

    Object.keys(personTargets).forEach((personId) => {
        const target = personTargets[personId];
        const dayData = days[dayIdx];

        // Hoppa över om redan schemalagd denna dag
        const alreadyScheduled = dayData.entries.some((e) => e.personId === personId && e.status === 'A');
        if (alreadyScheduled) {
            return;
        }

        // Hoppa över om inte har skill för rollen
        if (!target.person.skills || !target.person.skills[role]) {
            return;
        }

        // Om det är en kökskärna-slot: måste vara i corePersonIds
        if (isCoreSlot && !corePersonIds.includes(personId)) {
            return;
        }

        // Skapa test-entry
        const testEntry = {
            personId,
            status: 'A',
            role: role,
            start: null,
            end: null,
            breakStart: null,
            breakEnd: null,
        };

        const originalEntries = dayData.entries;
        dayData.entries.push(testEntry);

        // Testa P0-regler
        let breaksP0 = false;
        try {
            const ruleResult = evaluate(proposedState, { year, month });
            const personWarnings = ruleResult.warnings.filter((w) => w.personId === personId && w.level === 'P0');
            if (personWarnings.length > 0) {
                breaksP0 = true;
            }
        } catch (err) {
            console.warn('Rule-check misslyckades', err);
            breaksP0 = true;
        }

        dayData.entries = originalEntries; // Ångra test

        if (breaksP0) {
            return; // Denna person kan inte läggas denna dag
        }

        // Avstånd från target
        const underage = target.target - target.current;

        candidates.push({
            personId,
            score: underage,
            person: target.person,
        });
    });

    // Sortera efter score (högast först = längst från target)
    candidates.sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0].person : null;
}
