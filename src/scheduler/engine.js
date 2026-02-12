/*
 * AO-02E + AO-09 — SCHEDULER ENGINE v1: Heuristisk schemaläggning med grupp-filter
 * Organized in clearly marked blocks for easy maintenance
 */

import { evaluate } from '../rules.js';

/* ========================================================================
   BLOCK 1: MAIN GENERATE FUNCTION
   ======================================================================== */

/**
 * Huvudfunktion: Generera schemaförslag för en månad
 * @param {object} state - Store state
 * @param {object} input - { year, month, needByWeekday, selectedGroupIds }
 * @returns { proposedState, vacancies: [], notes: [] }
 */
export function generate(state, input) {
    const { year, month, needByWeekday, selectedGroupIds } = input;

    /* ====================================================================
       BLOCK 2: INPUT VALIDATION
       ==================================================================== */

    // VALIDERING: Input
    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    if (month < 1 || month > 12) {
        throw new Error(`Månad måste vara 1–12`);
    }

    if (!needByWeekday || needByWeekday.length !== 7) {
        throw new Error('needByWeekday måste ha 7 värden (mån–sön)');
    }

    /* ====================================================================
       BLOCK 3: AO-02E — GROUP FILTERING
       ==================================================================== */

    // AO-02E: Filtrera personal baserat på valda grupper
    let activePeople = state.people.filter((p) => p.isActive);

    if (selectedGroupIds && selectedGroupIds.length > 0) {
        console.log(`🔍 Filtrerar personal för grupper: ${selectedGroupIds.join(', ')}`);
        
        activePeople = activePeople.filter((person) => {
            const personGroups = person.groups || [];
            return personGroups.some((groupId) => selectedGroupIds.includes(groupId));
        });

        console.log(`✓ ${activePeople.length} personer matches valda grupper`);
    }

    /* ====================================================================
       BLOCK 4: PERSONAL DATA VALIDATION
       ==================================================================== */

    for (let i = 0; i < activePeople.length; i++) {
        const person = activePeople[i];
        if (!person.id || typeof person.id !== 'string') {
            throw new Error(
                `Person ${i + 1} har felaktig id: "${person.id}" (måste vara non-empty string). ` +
                `Kontrollera persondata i "Personal"-vyn.`
            );
        }
        if (typeof person.employmentPct !== 'number' || person.employmentPct < 1 || person.employmentPct > 100) {
            throw new Error(`Person "${person.firstName}" har felaktig employmentPct: ${person.employmentPct}`);
        }
    }

    if (activePeople.length === 0) {
        if (selectedGroupIds && selectedGroupIds.length > 0) {
            throw new Error(
                'Ingen personal hör till de valda grupperna. Välj fler grupper eller lägg till personal.'
            );
        }
        throw new Error('Ingen aktiv personal. Lägg till personal först i "Personal"-vyn.');
    }

    console.log(`🔄 AO-09: Generera schema för ${month}/2026`);
    console.log(`  Behov: mån=${needByWeekday[0]}, tis=${needByWeekday[1]}, ... sön=${needByWeekday[6]}`);
    console.log(`  Personal: ${activePeople.length} aktiva`);

    /* ====================================================================
       BLOCK 5: STATE CLONING & BASIC CALCULATIONS
       ==================================================================== */

    // Deep clone state för att inte ändra original vid fel
    let proposedState = JSON.parse(JSON.stringify(state));
    const monthData = proposedState.schedule.months[month - 1];
    const days = monthData.days || [];

    // Beräkna total A-dagar behövs
    let totalNeedDays = 0;
    days.forEach((dayData, idx) => {
        const date = new Date(year, month - 1, idx + 1);
        const weekdayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
        totalNeedDays += needByWeekday[weekdayIdx];
    });

    console.log(`  Total A-dagar behövs: ${totalNeedDays}`);

    /* ====================================================================
       BLOCK 6: TARGET CALCULATION
       ==================================================================== */

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

    /* ====================================================================
       BLOCK 7: CLEAN OLD ENTRIES
       ==================================================================== */

    // Rensa gamla A-entries (behåll alla andra statuser)
    days.forEach((day) => {
        day.entries = day.entries.filter((e) => e.status !== 'A');
    });

    const vacancies = [];
    const notes = [];

    /* ====================================================================
       BLOCK 8: MAIN SCHEDULING LOOP
       ==================================================================== */

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
                // AO-02A: Validera att personId är string innan vi skapar entry
                if (!candidate.id || typeof candidate.id !== 'string') {
                    throw new Error(
                        `INTERNAL ERROR: Candidate person har felaktig id: "${candidate.id}". ` +
                        `Detta bör inte hända — kontakta support.`
                    );
                }

                // Skapa entry med STRING personId
                const entry = {
                    personId: String(candidate.id),  // SÄKRA att det är string
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
    });

    /* ====================================================================
       BLOCK 9: GENERATED SCHEMA VALIDATION
       ==================================================================== */

    // AO-02A: Validera hela förslaget innan vi sparar
    console.log('🔍 Validerar genererat schema...');
    try {
        proposedState.schedule.months.forEach((month, monthIdx) => {
            month.days.forEach((day, dayIdx) => {
                day.entries.forEach((entry, entryIdx) => {
                    // Validera entry-struktur
                    if (!entry || typeof entry !== 'object') {
                        throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}] är inte ett objekt`);
                    }

                    // Validera personId för A-entries
                    if (entry.status === 'A') {
                        if (typeof entry.personId !== 'string' || !entry.personId) {
                            throw new Error(
                                `Entry [${monthIdx}][${dayIdx}][${entryIdx}].personId måste vara non-empty string, ` +
                                `fick: "${entry.personId}" (typ: ${typeof entry.personId})`
                            );
                        }

                        // Validera att personId faktiskt finns i people
                        const personExists = state.people.some((p) => p.id === entry.personId);
                        if (!personExists) {
                            throw new Error(
                                `Entry [${monthIdx}][${dayIdx}][${entryIdx}] refererar till okänd personId: "${entry.personId}"`
                            );
                        }
                    }

                    // Validera status
                    const validStatuses = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'PERM', 'UTB', 'EXTRA'];
                    if (!validStatuses.includes(entry.status)) {
                        throw new Error(
                            `Entry [${monthIdx}][${dayIdx}][${entryIdx}].status = "${entry.status}" ` +
                            `är inte giltig. Måste vara en av: ${validStatuses.join(', ')}`
                        );
                    }
                });
            });
        });
    } catch (validationErr) {
        console.error('❌ Validering misslyckades:', validationErr);
        // FAIL-CLOSED: Returnera felmeddelande, ändra INGENTING
        throw new Error(
            `Schemavalideringen misslyckades (data korrupt). ` +
            `Originalschemat är oförändrat.\n\n${validationErr.message}`
        );
    }

    console.log('✓ Validering passerad');

    /* ====================================================================
       BLOCK 10: RULES VALIDATION
       ==================================================================== */

    // Slut-validering av hela förslaget mot regler
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
        console.warn('Slutlig regelvalidering misslyckades:', err);
        notes.push(`Regelvalidering varning: ${err.message}`);
    }

    /* ====================================================================
       BLOCK 11: VACANCY SUMMARY & FINAL NOTES
       ==================================================================== */

    // Sammanfatta vakanser
    if (vacancies.length > 0) {
        const uniqueDates = new Set(vacancies.map((v) => v.date));
        notes.push(`⚠️  ${vacancies.length} vakans(er) på ${uniqueDates.size} dag(ar)`);
    }

    notes.push(`Förslag genererat: ${Object.values(personTargets).reduce((sum, t) => sum + t.current, 0)} A-dagar utlagda`);

    proposedState.meta.updatedAt = Date.now();

    /* ====================================================================
       BLOCK 12: RETURN RESULT
       ==================================================================== */

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

/* ========================================================================
   BLOCK 13: CANDIDATE SELECTION LOGIC
   ======================================================================== */

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
