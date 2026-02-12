/*
 * AO-09 — SCHEDULER ENGINE v1: Heuristisk schemaläggning med P0-validering
 */

import { evaluate } from '../rules.js';

/**
 * Huvudfunktion: Generera schemaförslag för en månad
 * @param {object} state - Store state
 * @param {object} input - { year, month, needByWeekday: [6,7,7,7,6,4,4] }
 * @returns { proposedState, vacancies: [], notes: [] }
 */
export function generate(state, input) {
    const { year, month, needByWeekday } = input;

    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    if (month < 1 || month > 12) {
        throw new Error(`Månad måste vara 1–12`);
    }

    if (!needByWeekday || needByWeekday.length !== 7) {
        throw new Error('needByWeekday måste ha 7 värden (mån–sön)');
    }

    // Deep clone state för att inte ändra original
    const proposedState = JSON.parse(JSON.stringify(state));
    const monthData = proposedState.schedule.months[month - 1];
    const days = monthData.days || [];
    const activePeople = proposedState.people.filter((p) => p.isActive);

    const vacancies = [];
    const notes = [];

    console.log(`🔄 AO-09: Generera schema för ${month}/2026`);
    console.log(`  Behov: mån=${needByWeekday[0]}, tis=${needByWeekday[1]}, ... sön=${needByWeekday[6]}`);
    console.log(`  Personal: ${activePeople.length} aktiva`);

    // Beräkna total A-dagar behövs
    let totalNeedDays = 0;
    days.forEach((dayData, idx) => {
        const date = new Date(year, month - 1, idx + 1);
        const weekdayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
        totalNeedDays += needByWeekday[weekdayIdx];
    });

    console.log(`  Total A-dagar behövs: ${totalNeedDays}`);

    // Beräkna targetDays per person
    const personTargets = {};
    const sumPct = activePeople.reduce((sum, p) => sum + p.employmentPct, 0);

    activePeople.forEach((person) => {
        const targetDays = sumPct > 0 
            ? Math.round((totalNeedDays * person.employmentPct) / sumPct)
            : 0;
        personTargets[person.id] = {
            target: targetDays,
            current: 0,
            streak: 0,
            person,
        };
    });

    // Rensa gamla A-entries (behåll alla andra statuser)
    days.forEach((day) => {
        day.entries = day.entries.filter((e) => e.status !== 'A');
    });

    // Iterera genom varje dag och fyll behov
    days.forEach((dayData, dayIdx) => {
        const date = new Date(year, month - 1, dayIdx + 1);
        const weekdayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const need = needByWeekday[weekdayIdx];

        console.log(`  📅 ${dayData.date}: behov ${need} pers`);

        // Fyll idag för slot
        for (let slot = 0; slot < need; slot++) {
            const candidate = findBestCandidate(personTargets, dayIdx, days, proposedState);

            if (candidate) {
                // Lägg till A-entry
                const entry = {
                    personId: candidate.id,
                    status: 'A',
                    start: null,
                    end: null,
                    breakStart: null,
                    breakEnd: null,
                };
                dayData.entries.push(entry);
                personTargets[candidate.id].current++;

                // Uppdatera streak
                if (dayIdx > 0) {
                    const prevDay = days[dayIdx - 1];
                    const prevEntry = prevDay.entries.find((e) => e.personId === candidate.id && e.status === 'A');
                    if (prevEntry) {
                        personTargets[candidate.id].streak++;
                    } else {
                        personTargets[candidate.id].streak = 1;
                    }
                } else {
                    personTargets[candidate.id].streak = 1;
                }

                console.log(`    ✓ ${candidate.firstName} ${candidate.lastName} (target: ${personTargets[candidate.id].target}, current: ${personTargets[candidate.id].current})`);
            } else {
                // Vakans
                const extraEntry = {
                    personId: null,
                    status: 'EXTRA',
                    start: null,
                    end: null,
                    breakStart: null,
                    breakEnd: null,
                };
                dayData.entries.push(extraEntry);
                vacancies.push({ date: dayData.date, needed: 1 });
                console.log(`    ⚠️  EXTRA PERSONAL behövs`);
            }
        }

        // Validera denna dag mot P0-regler
        const dayRuleCheck = validateDay(dayData, proposedState, year, month);
        if (dayRuleCheck.hasP0) {
            console.log(`    ❌ P0-varning: ${dayRuleCheck.message}`);
            // Här kunde vi backa och prova igen, men för v1 accepterar vi det
        }
    });

    // Slut-validering av hela förslaget
    let hasP0 = false;
    try {
        const fullEvaluation = evaluate(proposedState, { year, month });
        const p0Warnings = fullEvaluation.warnings.filter((w) => w.level === 'P0');
        if (p0Warnings.length > 0) {
            hasP0 = true;
            console.log(`⚠️  P0-varningar i slutlig validering: ${p0Warnings.length}`);
            notes.push(`⚠️  ${p0Warnings.length} P0-varning(ar) vid slutlig kontroll`);
        }
    } catch (err) {
        console.warn('Slutlig validering misslyckades:', err);
        notes.push(`Validering misslyckades: ${err.message}`);
    }

    // Sammanfatta vakanser
    if (vacancies.length > 0) {
        const uniqueDates = new Set(vacancies.map((v) => v.date));
        notes.push(`⚠️  ${vacancies.length} vakans(er) på ${uniqueDates.size} dag(ar)`);
    }

    notes.push(`Förslag genererat: ${Object.values(personTargets).reduce((sum, t) => sum + t.current, 0)} A-dagar utlagda`);

    proposedState.meta.updatedAt = Date.now();

    return {
        proposedState,
        vacancies,
        notes,
        summary: {
            totalSlots: totalNeedDays,
            filledSlots: totalNeedDays - vacancies.length,
            vacancyCount: vacancies.length,
            hasP0Warnings: hasP0,
        },
    };
}

/**
 * Hitta bästa kandidat för nästa slot (heuristik)
 */
function findBestCandidate(personTargets, dayIdx, days, state) {
    const candidates = [];

    Object.values(personTargets).forEach((target) => {
        const person = target.person;
        const dayData = days[dayIdx];

        // 1. Hoppa över om redan schemalagd idag
        const alreadyScheduled = dayData.entries.some(
            (e) => e.personId === person.id && e.status === 'A'
        );
        if (alreadyScheduled) {
            return;
        }

        // 2. Undvik lång streak (P1)
        if (target.streak >= 9) {
            // Kan lägga 1 till dag 10, men prioritera andra
            return;
        }

        // 3. Beräkna hur långt under target denna person är
        const underage = target.target - target.current;
        if (underage <= 0) {
            return; // Redan uppnått target
        }

        // 4. Prioritet = hur långt under target + en lite random för variation
        const priority = underage * 100 + Math.random() * 10;

        candidates.push({
            person,
            priority,
            underage,
            target,
        });
    });

    // Sortera efter priority (högst först)
    candidates.sort((a, b) => b.priority - a.priority);

    if (candidates.length === 0) {
        return null;
    }

    // Returnera top-kandidat
    const chosen = candidates[0];
    return chosen.person;
}

/**
 * Validera en enskild dag mot P0-regler
 */
function validateDay(dayData, state, year, month) {
    // Mycket enkel validering för v1 — bara check om vi har för många på en dag
    const aCount = dayData.entries.filter((e) => e.status === 'A').length;

    // T.ex. max 10 personer per dag (godtyckligt)
    if (aCount > 15) {
        return {
            hasP0: true,
            message: `För många personer på dagen (${aCount} > 15)`,
        };
    }

    return { hasP0: false };
}
