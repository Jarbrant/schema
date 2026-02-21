/*
 * AO-02E + AO-09 — SCHEDULER ENGINE v1.4 (AUTOPATCH)
 * FIL: engine.js (HEL FIL)
 *
 * Syfte (som det ska fungera):
 * - Gruppfilter ska styra:
 *   1) vilka personer som får schemaläggas (endast personer i valda grupper)
 *   2) vilka A-entries som rensas (endast A för personer i valda grupper — inte hela månaden)
 *   3) behov ska i första hand komma från state.demand.groupDemands (summa av valda grupper)
 *      och annars falla tillbaka till input.needByWeekday om demand saknas
 *
 * ÄNDRINGSLOGG (≤8)
 * 1) P0: Rensning av gamla A-entries: rensa endast A för valda grupper (inte alla A).
 * 2) P0: Behov: beräkna needByWeekday från state.demand.groupDemands + selectedGroupIds (summa), fallback till input.needByWeekday.
 * 3) P0: Robust groupfilter: normaliserar selectedGroupIds och person.groups till string, fail-closed vid tomt urval.
 * 4) P0: Logg och feltexter: tar bort hårdkodad "/2026" i logg, använder year.
 * 5) P1: Stabilare kandidatval: sortering utan "Math.random" jitter (mindre fladdrigt mellan körningar).
 * 6) P1: Guardrails: tydliga fel om schedule/month saknas i state.
 * 7) P2: Småstäd: helper-funktioner (weekdayIdx, buildNeedByWeekday) för läsbarhet.
 *
 * AUTOPATCH v1.3 → v1.4:
 * 8) P0: Entry-format standardiserat: startTime/endTime + shiftId + groupId
 *    (kompatibelt med kalender-vy, schedule-engine.js och rules.js)
 * 9) P0: person.groups stödjer även person.groupIds som fallback
 *
 * BUGGSÖK (hittade & patchade)
 * - BUGG: engine rensade ALLA A i månaden → slog ut andra grupper (P0).
 * - BUGG: engine ignorerade groupDemands (AO-02C) → fel behov vid generering (P0).
 * - BUGG: entry-format använde start/end istf startTime/endTime → osynligt i kalender (P0).
 */

import { evaluate } from '../rules.js';

/* ========================================================================
   BLOCK 1 — PUBLIC API: generate(state, input)
   ======================================================================== */

/**
 * Huvudfunktion: Generera schemaförslag för en månad
 * @param {object} state - Store state
 * @param {object} input - { year, month, needByWeekday, selectedGroupIds }
 * @returns { proposedState, vacancies: [], notes: [], summary: {} }
 */
export function generate(state, input) {
    /* ====================================================================
       BLOCK 1A — Parse input + normalisera groups
       ==================================================================== */
    const year = input?.year;
    const month = input?.month;

    // P0: normalisera till string och filtrera bort tomma
    const selectedGroupIdsRaw = Array.isArray(input?.selectedGroupIds) ? input.selectedGroupIds : [];
    const selectedGroupIds = selectedGroupIdsRaw.map((x) => String(x)).filter(Boolean);

    /* ====================================================================
       BLOCK 2 — INPUT VALIDATION (FAIL-CLOSED)
       ==================================================================== */
    if (!state || typeof state !== 'object') {
        throw new Error('State saknas eller är fel typ');
    }

    if (!state.schedule || typeof state.schedule !== 'object') {
        throw new Error('Schedule saknas i state');
    }

    if (typeof year !== 'number' || year <= 2000) {
        throw new Error('Input.year måste vara ett giltigt år (number)');
    }

    if (state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    if (typeof month !== 'number' || month < 1 || month > 12) {
        throw new Error('Månad måste vara 1–12');
    }

    if (!Array.isArray(state.schedule.months) || !state.schedule.months[month - 1]) {
        throw new Error(`Schedule saknar månad ${month}`);
    }

    if (!Array.isArray(state.people)) {
        throw new Error('people saknas eller är fel typ (måste vara array)');
    }

    if (!selectedGroupIds || selectedGroupIds.length === 0) {
        throw new Error('Inga grupper valda. Välj minst en grupp i filtret innan generering.');
    }

    /* ====================================================================
       BLOCK 3 — NEED (AO-02C + AO-02E)
       ==================================================================== */

    const needByWeekday = buildNeedByWeekday(state, selectedGroupIds, input?.needByWeekday);

    console.log(`🔄 AO-09: Generera schema för ${month}/${year}`);
    console.log(`  Behov (mån–sön): ${needByWeekday.join(', ')}`);
    console.log(`  Valda grupper: ${selectedGroupIds.join(', ')}`);

    /* ====================================================================
       BLOCK 4 — FILTER PEOPLE BY GROUPS (AO-02E)
       ==================================================================== */

    // [AUTOPATCH v1.4] Stödjer BÅDA person.groups OCH person.groupIds (fallback)
    let activePeople = state.people.filter((p) => p && p.isActive);

    activePeople = activePeople.filter((person) => {
        const personGroups = getPersonGroups(person);
        return personGroups.some((gid) => selectedGroupIds.includes(gid));
    });

    console.log(`  Personal (valda grupper): ${activePeople.length} aktiva`);

    /* ====================================================================
       BLOCK 5 — PERSONAL DATA VALIDATION
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
        throw new Error('Ingen aktiv personal hör till de valda grupperna. Välj fler grupper eller lägg till personal.');
    }

    /* ====================================================================
       BLOCK 6 — STATE CLONING & BASIC CALCULATIONS
       ==================================================================== */

    const proposedState = JSON.parse(JSON.stringify(state));
    const monthData = proposedState.schedule.months[month - 1];
    const days = Array.isArray(monthData.days) ? monthData.days : [];

    let totalNeedDays = 0;
    days.forEach((_, idx) => {
        const wIdx = getWeekdayIdx(year, month, idx + 1);
        totalNeedDays += needByWeekday[wIdx] || 0;
    });

    console.log(`  Total A-slots behövs: ${totalNeedDays}`);

    /* ====================================================================
       BLOCK 7 — TARGET CALCULATION (per person)
       ==================================================================== */

    const personTargets = {};
    const sumPct = activePeople.reduce((sum, p) => sum + p.employmentPct, 0);

    activePeople.forEach((person) => {
        const targetDays = sumPct > 0 ? Math.round((totalNeedDays * person.employmentPct) / sumPct) : 0;
        personTargets[person.id] = {
            target: targetDays,
            current: 0,
            streak: 0,
            person,
        };
    });

    /* ====================================================================
       BLOCK 8 — CLEAN OLD ENTRIES (P0 FIX)
       ==================================================================== */

    // [AUTOPATCH v1.4] Uppdaterad att använda getPersonGroups() för att stödja
    // person.groupIds som fallback
    const personIdIsInSelectedGroups = buildPersonGroupChecker(state.people, selectedGroupIds);

    days.forEach((day) => {
        const entries = Array.isArray(day.entries) ? day.entries : [];

        day.entries = entries.filter((e) => {
            if (!e || typeof e !== 'object') return false;

            if (e.status !== 'A') return true;

            const pid = typeof e.personId === 'string' ? e.personId : null;
            if (!pid) return false;

            return !personIdIsInSelectedGroups(pid);
        });
    });

    const vacancies = [];
    const notes = [];

    /* ====================================================================
       BLOCK 9 — MAIN SCHEDULING LOOP
       [AUTOPATCH v1.4] Entry-format standardiserat:
         - start  → startTime
         - end    → endTime
         - +groupId (krävs för kalender-vy)
         - +shiftId (krävs för schedule-engine.js validateRules)
       ==================================================================== */

    days.forEach((dayData, dayIdx) => {
        const wIdx = getWeekdayIdx(year, month, dayIdx + 1);
        const need = needByWeekday[wIdx] || 0;

        if (!Array.isArray(dayData.entries)) dayData.entries = [];

        let filledToday = 0;

        for (let slot = 0; slot < need; slot++) {
            const candidate = findBestCandidate(personTargets, dayIdx, days);

            if (candidate) {
                if (!candidate.id || typeof candidate.id !== 'string') {
                    throw new Error(
                        `INTERNAL ERROR: Candidate person har felaktig id: "${candidate.id}". ` +
                        `Detta bör inte hända — kontakta support.`
                    );
                }

                // [AUTOPATCH v1.4] Standardiserat entry-format
                // GAMMALT: { start, end }
                // NYTT:    { startTime, endTime, groupId, shiftId }
                // Kompatibelt med: kalender-vy, schedule-engine.js, rules.js
                const entry = {
                    personId: String(candidate.id),
                    status: 'A',
                    startTime: null,        // ← ÄNDRAT från 'start'
                    endTime: null,          // ← ÄNDRAT från 'end'
                    breakStart: null,
                    breakEnd: null,
                    groupId: '',            // ← NYTT (krävs för kalender-vy)
                    shiftId: '',            // ← NYTT (krävs för schedule-engine.js validateRules)
                };

                dayData.entries.push(entry);
                personTargets[candidate.id].current++;
                filledToday++;

                // Uppdatera streak (enkel, baserat på föregående dag)
                if (dayIdx > 0) {
                    const prevDay = days[dayIdx - 1];
                    const prevEntry = Array.isArray(prevDay.entries)
                        ? prevDay.entries.find((e) => e && e.status === 'A' && e.personId === candidate.id)
                        : null;
                    personTargets[candidate.id].streak = prevEntry ? (personTargets[candidate.id].streak + 1) : 1;
                } else {
                    personTargets[candidate.id].streak = 1;
                }
            } else {
                // [AUTOPATCH v1.4] Vakans-entry med standardiserat format
                const extraEntry = {
                    personId: null,
                    status: 'EXTRA',
                    startTime: null,        // ← ÄNDRAT från 'start'
                    endTime: null,          // ← ÄNDRAT från 'end'
                    breakStart: null,
                    breakEnd: null,
                    groupId: '',            // ← NYTT
                    shiftId: '',            // ← NYTT
                };
                dayData.entries.push(extraEntry);
                vacancies.push({ date: dayData.date, needed: 1 });
            }
        }
    });

    /* ====================================================================
       BLOCK 10 — GENERATED SCHEMA VALIDATION (month-level)
       ==================================================================== */

    console.log('🔍 Validerar genererat schema (månaden)...');

    try {
        const monthIdx = month - 1;

        const monthObj = proposedState.schedule.months[monthIdx];
        monthObj.days.forEach((day, dayIdx) => {
            const entries = Array.isArray(day.entries) ? day.entries : [];
            entries.forEach((entry, entryIdx) => {
                if (!entry || typeof entry !== 'object') {
                    throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}] är inte ett objekt`);
                }

                const validStatuses = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'PERM', 'UTB', 'EXTRA'];
                if (!validStatuses.includes(entry.status)) {
                    throw new Error(
                        `Entry [${monthIdx}][${dayIdx}][${entryIdx}].status = "${entry.status}" ` +
                        `är inte giltig. Måste vara en av: ${validStatuses.join(', ')}`
                    );
                }

                if (entry.status === 'A') {
                    if (typeof entry.personId !== 'string' || !entry.personId) {
                        throw new Error(
                            `Entry [${monthIdx}][${dayIdx}][${entryIdx}].personId måste vara non-empty string, ` +
                            `fick: "${entry.personId}" (typ: ${typeof entry.personId})`
                        );
                    }

                    const personExists = state.people.some((p) => p && p.id === entry.personId);
                    if (!personExists) {
                        throw new Error(
                            `Entry [${monthIdx}][${dayIdx}][${entryIdx}] refererar till okänd personId: "${entry.personId}"`
                        );
                    }
                }
            });
        });
    } catch (validationErr) {
        console.error('❌ Validering misslyckades:', validationErr);
        throw new Error(
            `Schemavalideringen misslyckades (data korrupt). Originalschemat är oförändrat.\n\n${validationErr.message}`
        );
    }

    console.log('✓ Validering passerad');

    /* ====================================================================
       BLOCK 11 — RULES VALIDATION (evaluate)
       ==================================================================== */

    let hasP0 = false;
    try {
        const fullEvaluation = evaluate(proposedState, { year, month });
        const warnings = Array.isArray(fullEvaluation?.warnings) ? fullEvaluation.warnings : [];
        const p0Warnings = warnings.filter((w) => w.level === 'P0');

        if (p0Warnings.length > 0) {
            hasP0 = true;
            notes.push(`⚠️  ${p0Warnings.length} P0-varning(ar) vid slutlig kontroll`);
        }
    } catch (err) {
        console.warn('Slutlig regelvalidering misslyckades:', err);
        notes.push(`Regelvalidering varning: ${err.message}`);
    }

    /* ====================================================================
       BLOCK 12 — VACANCY SUMMARY & FINAL NOTES
       ==================================================================== */

    if (vacancies.length > 0) {
        const uniqueDates = new Set(vacancies.map((v) => v.date));
        notes.push(`⚠️  ${vacancies.length} vakans(er) på ${uniqueDates.size} dag(ar)`);
    }

    const totalAssigned = Object.values(personTargets).reduce((sum, t) => sum + (t.current || 0), 0);
    notes.push(`Förslag genererat: ${totalAssigned} A-slots utlagda (valda grupper)`);

    proposedState.meta.updatedAt = Date.now();

    /* ====================================================================
       BLOCK 13 — RETURN RESULT
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
   BLOCK 14 — CANDIDATE SELECTION (stabilare, deterministisk sort)
   ======================================================================== */

/**
 * Hitta bästa kandidat för nästa slot (heuristik)
 */
function findBestCandidate(personTargets, dayIdx, days) {
    const dayData = days[dayIdx];
    const entries = Array.isArray(dayData.entries) ? dayData.entries : [];

    const candidates = [];

    Object.values(personTargets).forEach((t) => {
        const person = t.person;

        const alreadyScheduled = entries.some((e) => e && e.status === 'A' && e.personId === person.id);
        if (alreadyScheduled) return;

        if ((t.streak || 0) >= 9) return;

        const under = (t.target || 0) - (t.current || 0);
        if (under <= 0) return;

        const priority = under * 1000 - (t.current || 0);

        candidates.push({
            person,
            priority,
            under,
            current: t.current || 0,
            nameKey: `${person.lastName || ''}|${person.firstName || ''}`.toLowerCase(),
        });
    });

    candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.current !== b.current) return a.current - b.current;
        return a.nameKey.localeCompare(b.nameKey);
    });

    return candidates.length > 0 ? candidates[0].person : null;
}

/* ========================================================================
   BLOCK 15 — HELPERS
   ======================================================================== */

function getWeekdayIdx(year, month, dayOfMonth) {
    const date = new Date(year, month - 1, dayOfMonth);
    const d = date.getDay();
    return d === 0 ? 6 : d - 1;
}

/**
 * [AUTOPATCH v1.4] Hämta person-grupper med fallback: groups → groupIds
 * Normaliserar till string-array.
 */
function getPersonGroups(person) {
    const raw = Array.isArray(person.groups) ? person.groups
              : Array.isArray(person.groupIds) ? person.groupIds
              : [];
    return raw.map((g) => String(g)).filter(Boolean);
}

function buildNeedByWeekday(state, selectedGroupIds, fallbackNeedByWeekday) {
    const demand = state?.demand;
    const groupDemands = demand?.groupDemands;

    if (groupDemands && typeof groupDemands === 'object') {
        const sum = [0, 0, 0, 0, 0, 0, 0];

        selectedGroupIds.forEach((gid) => {
            const arr = groupDemands[gid];
            if (Array.isArray(arr) && arr.length === 7) {
                for (let i = 0; i < 7; i++) {
                    const v = parseInt(arr[i], 10);
                    sum[i] += Number.isFinite(v) && v >= 0 ? v : 0;
                }
            }
        });

        const any = sum.some((v) => v > 0);
        if (any) return sum;
    }

    if (Array.isArray(fallbackNeedByWeekday) && fallbackNeedByWeekday.length === 7) {
        return fallbackNeedByWeekday.map((x) => {
            const v = parseInt(x, 10);
            return Number.isFinite(v) && v >= 0 ? v : 0;
        });
    }

    throw new Error('Bemanningsbehov saknas: sätt groupDemands i Kontroll-vyn eller skicka giltig needByWeekday');
}

function buildPersonGroupChecker(people, selectedGroupIds) {
    const map = new Map();

    (Array.isArray(people) ? people : []).forEach((p) => {
        if (!p || typeof p !== 'object') return;
        if (typeof p.id !== 'string' || !p.id) return;

        // [AUTOPATCH v1.4] Stödjer båda groups och groupIds
        const gs = getPersonGroups(p);
        map.set(p.id, new Set(gs));
    });

    const selected = new Set(selectedGroupIds.map((x) => String(x)).filter(Boolean));

    return (personId) => {
        const set = map.get(personId);
        if (!set) return false;
        for (const gid of set.values()) {
            if (selected.has(gid)) return true;
        }
        return false;
    };
}
