/*
 * AO-22 — SCHEDULER ENGINE v2: Rollbaserad schemaläggning
 */

import { evaluate } from '../rules.js';

const SKILLS = ['KITCHEN', 'PACK', 'DISH', 'SYSTEM', 'ADMIN'];
const ROLE_PRIORITY = ['SYSTEM', 'ADMIN', 'DISH', 'KITCHEN', 'PACK'];

/**
 * Huvudfunktion: generera rollbaserat schemaförslag
 */
export function generate(state, input) {
    const { year, month, mode = 'preview' } = input;

    if (!state.schedule || state.schedule.year !== year) {
        throw new Error('Schedule year mismatch');
    }

    if (month < 1 || month > 12) {
        throw new Error('Invalid month');
    }

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

    days.forEach((day) => {
        day.entries = day.entries.filter((e) => e.status !== 'A' && e.status !== 'EXTRA');
    });

    const sumPct = activePeople.reduce((sum, p) => sum + p.employmentPct, 0);
    const personTargets = {};

    activePeople.forEach((person) => {
        const totalNeed = days.length * 7;
        const targetDays = Math.round((totalNeed * person.employmentPct) / sumPct);
        personTargets[person.id] = {
            target: targetDays,
            current: 0,
            person,
        };
    });

    days.forEach((dayData, dayIdx) => {
        const dayOfWeek = new Date(year, month - 1, dayIdx + 1).getDay();
        const weekdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const dayDemand = demand[weekdayIndex] || {};

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

        ROLE_PRIORITY.forEach((role) => {
            const roleSlots = slots.filter((s) => s.role === role && !s.filled);

            roleSlots.forEach((slot) => {
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
                    const extraEntry = {
                        personId: null,
                        status: 'EXTRA',
                        role: role,
                        note: `EXTRA PERSONAL – ${role}`,
                    };
                    dayData.entries.push(extraEntry);

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

        const alreadyScheduled = dayData.entries.some((e) => e.personId === personId && e.status === 'A');
        if (alreadyScheduled) {
            return;
        }

        if (!target.person.skills || !target.person.skills[role]) {
            return;
        }

        if (isCoreSlot && !corePersonIds.includes(personId)) {
            return;
        }

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

        dayData.entries = originalEntries;

        if (breaksP0) {
            return;
        }

        const underage = target.target - target.current;

        candidates.push({
            personId,
            score: underage,
            person: target.person,
        });
    });

    candidates.sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0].person : null;
}
