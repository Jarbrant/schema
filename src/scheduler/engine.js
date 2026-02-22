/*
 * AO-02E + AO-09 — SCHEDULER ENGINE v3.0 (RULES INTEGRATION)
 * FIL: src/scheduler/engine.js (HEL FIL)
 *
 * Syfte (som det ska fungera):
 * - Gruppfilter ska styra:
 *   1) vilka personer som får schemaläggas (endast personer i valda grupper)
 *   2) vilka A-entries som rensas (endast A för personer i valda grupper — inte hela månaden)
 *   3) behov ska i första hand komma från state.demand.groupDemands (summa av valda grupper)
 *      och annars falla tillbaka till input.needByWeekday om demand saknas
 *
 * ÄNDRINGSLOGG
 * v1.3: Grundversion med gruppfilter, groupDemands, deterministisk sort
 * v1.4: Entry-format standardiserat (startTime/endTime + groupId + shiftId)
 * v2.0: findBestCandidate med availability, frånvaro, helg-rotation, streak
 * v3.0: RULES INTEGRATION — läser state.rules från #/rules-vyn
 *
 * v3.0 ÄNDRINGAR:
 * 10) P0: findBestCandidate() läser state.rules (aktiva regler)
 * 11) P0: Alla P0-regler blockerar: availability, absence, maxDaysPerWeek,
 *         maxConsecutive, maxHoursWeek, startDate, periodTarget
 * 12) P1: Alla P1-regler ger penalty: weekendRotation (-3000/-1500),
 *         redDayHandling (-200), substituteLastPriority (-200),
 *         streak-penalty (-500/dag), veckobalans (+50/dag)
 * 13) P0: evaluateSchedule() validerar EFTER generering mot state.rules
 * 14) P0: Borttagen trasig import { evaluate } from '../rules.js'
 *
 * BUGGSÖK (hittade & patchade i tidigare versioner)
 * - BUGG: engine rensade ALLA A i månaden → slog ut andra grupper (P0).
 * - BUGG: engine ignorerade groupDemands (AO-02C) → fel behov vid generering (P0).
 * - BUGG: entry-format använde start/end istf startTime/endTime → osynligt i kalender (P0).
 * - BUGG: evaluate() importerades från rules.js men existerade inte → alla regler ignorerades (P0).
 * - BUGG: findBestCandidate saknade availability/absence/helg-rotation → samma schema varje vecka (P0).
 */

// v3.0: Ingen import av evaluate — vi har inbyggd evaluateSchedule()
// v3.0: Ingen import från schedule-engine.js behövs — reglerna läses från state.rules

/* ========================================================================
   BLOCK 1 — PUBLIC API: generate(state, input)
   ======================================================================== */

/**
 * Huvudfunktion: Generera schemaförslag för en månad
 * @param {object} state - Store state (inkl state.rules från #/rules-vyn)
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

    // [v3.0] Logga aktiva regler
    const stateRules = Array.isArray(state.rules) ? state.rules : [];
    const activeRuleCount = stateRules.filter(r => r.isActive).length;

    console.log(`🔄 AO-09 v3.0: Generera schema för ${month}/${year}`);
    console.log(`  Behov (mån–sön): ${needByWeekday.join(', ')}`);
    console.log(`  Valda grupper: ${selectedGroupIds.join(', ')}`);
    console.log(`  Aktiva regler: ${activeRuleCount} st`);

    /* ====================================================================
       BLOCK 4 — FILTER PEOPLE BY GROUPS (AO-02E)
       ==================================================================== */

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
       BLOCK 9 — MAIN SCHEDULING LOOP v3.0
       [v3.0] findBestCandidate() får year, month, stateRules, state.people
       ==================================================================== */

    days.forEach((dayData, dayIdx) => {
        const wIdx = getWeekdayIdx(year, month, dayIdx + 1);
        const need = needByWeekday[wIdx] || 0;

        if (!Array.isArray(dayData.entries)) dayData.entries = [];

        let filledToday = 0;

        for (let slot = 0; slot < need; slot++) {
            // [v3.0] Skickar state.rules + state.people till findBestCandidate
            const candidate = findBestCandidate(
                personTargets, dayIdx, days, year, month, stateRules, state.people
            );

            if (candidate) {
                if (!candidate.id || typeof candidate.id !== 'string') {
                    throw new Error(
                        `INTERNAL ERROR: Candidate person har felaktig id: "${candidate.id}". ` +
                        `Detta bör inte hända — kontakta support.`
                    );
                }

                const entry = {
                    personId: String(candidate.id),
                    status: 'A',
                    startTime: null,
                    endTime: null,
                    breakStart: null,
                    breakEnd: null,
                    groupId: '',
                    shiftId: '',
                };

                dayData.entries.push(entry);
                personTargets[candidate.id].current++;
                filledToday++;

                // Uppdatera streak
                if (dayIdx > 0) {
                    const prevDay = days[dayIdx - 1];
                    const prevEntry = Array.isArray(prevDay.entries)
                        ? prevDay.entries.find(
                              (e) => e && e.status === 'A' && e.personId === candidate.id
                          )
                        : null;
                    personTargets[candidate.id].streak = prevEntry
                        ? personTargets[candidate.id].streak + 1
                        : 1;
                } else {
                    personTargets[candidate.id].streak = 1;
                }
            } else {
                const extraEntry = {
                    personId: null,
                    status: 'EXTRA',
                    startTime: null,
                    endTime: null,
                    breakStart: null,
                    breakEnd: null,
                    groupId: '',
                    shiftId: '',
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
       BLOCK 11 — RULES VALIDATION v3.0 (INBYGGD evaluateSchedule)
       [v3.0] Läser state.rules för validering efter generering
       ==================================================================== */

    let hasP0 = false;
    try {
        const fullEvaluation = evaluateSchedule(proposedState, { year, month });
        const warnings = Array.isArray(fullEvaluation?.warnings) ? fullEvaluation.warnings : [];
        const p0Warnings = warnings.filter((w) => w.severity === 'P0' || w.level === 'P0');

        if (p0Warnings.length > 0) {
            hasP0 = true;
            notes.push(`⚠️  ${p0Warnings.length} P0-varning(ar) vid slutlig kontroll`);
            p0Warnings.forEach((w) => {
                console.warn(`  P0: ${w.message || w.ruleName || 'okänd'}`);
            });
        }

        const p1Warnings = warnings.filter((w) => w.severity === 'P1' || w.level === 'P1');
        if (p1Warnings.length > 0) {
            notes.push(`ℹ️  ${p1Warnings.length} P1-varning(ar) (rekommendation)`);
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
    notes.push(`Regler tillämpade: ${activeRuleCount} aktiva regler från Arbetstidsregler-vyn`);

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
            activeRulesApplied: activeRuleCount,
        },
    };
}

/* ========================================================================
   BLOCK 14 — CANDIDATE SELECTION v3.0 (LÄSER state.rules)

   Kopplar ihop med state.rules (samma regler som visas i #/rules):
   - Läser aktiva regler från state.rules
   - P0-regler blockerar kandidaten helt
   - P1-regler ger penalty (lägre prioritet)

   Regeltyper som hanteras:
     P0: maxHoursWeek, maxHoursDay, maxDaysPerWeek, minRestBetween,
         maxConsecutive, weeklyRest36h, availabilityCheck, absenceCheck,
         startDateCheck, periodTarget
     P1: weekendRotation, redDayHandling, substituteLastPriority
   ======================================================================== */

function findBestCandidate(personTargets, dayIdx, days, year, month, stateRules, statePeople) {
    const dayData = days[dayIdx];
    const entries = Array.isArray(dayData.entries) ? dayData.entries : [];

    // Beräkna datum och veckodag
    const date = new Date(year, month - 1, dayIdx + 1);
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mån..6=Sön
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;

    // ISO-vecka: beräkna index för måndagen i denna vecka
    const isoWeekStart = dayIdx - dayOfWeek;

    // Läs aktiva regler
    const rules = Array.isArray(stateRules) ? stateRules.filter(r => r.isActive) : [];

    // Snabb-lookup för regelvärden
    const ruleValue = (type, fallback) => {
        const r = rules.find(r => r.type === type);
        return r && r.value !== null && r.value !== undefined ? r.value : fallback;
    };
    const ruleActive = (type) => rules.some(r => r.type === type);

    // Regelvärden (med fallback om regler saknas)
    const maxHoursWeek = ruleValue('maxHoursWeek', 40);
    const maxDaysPerWeekRule = ruleValue('maxDaysPerWeek', 5);
    const maxConsecutive = ruleValue('maxConsecutive', 6);

    const candidates = [];

    Object.values(personTargets).forEach((t) => {
        const person = t.person;
        const personMaxDays = Math.min(person.workdaysPerWeek || 5, maxDaysPerWeekRule);

        /* ════════════════════════════════════════════
         * P0 REGLER — Blockerar kandidaten helt
         * ════════════════════════════════════════════ */

        // P0: Redan schemalagd idag
        const alreadyScheduled = entries.some(
            (e) => e && e.status === 'A' && e.personId === person.id
        );
        if (alreadyScheduled) return;

        // P0: Tillgänglighet (availabilityCheck)
        if (ruleActive('availabilityCheck') || !rules.length) {
            if (Array.isArray(person.availability) && person.availability.length >= 7) {
                if (person.availability[dayOfWeek] === false) return;
            }
        }

        // P0: Frånvaro (absenceCheck) — semester, sjuk, VAB etc
        if (ruleActive('absenceCheck') || !rules.length) {
            if (Array.isArray(person.vacationDates) && person.vacationDates.includes(dateStr)) return;
            if (Array.isArray(person.leaveDates) && person.leaveDates.includes(dateStr)) return;

            // Kontrollera befintliga entries med frånvarostatus på denna dag
            const absenceStatuses = ['SEM', 'SJ', 'VAB', 'FÖR', 'TJL', 'PERM', 'UTB'];
            const hasAbsenceEntry = entries.some(
                (e) => e && e.personId === person.id && absenceStatuses.includes(e.status)
            );
            if (hasAbsenceEntry) return;
        }

        // P0: Startdatum (startDateCheck)
        if (ruleActive('startDateCheck') || !rules.length) {
            if (person.startDate && dateStr < person.startDate) return;
        }

        // P0: Max dagar i rad (maxConsecutive)
        if ((t.streak || 0) >= maxConsecutive) return;

        // P0: Max arbetsdagar per vecka (maxDaysPerWeek) — ISO-vecka
        let daysThisWeek = 0;
        const weekStartIdx = Math.max(0, isoWeekStart);
        const weekEndIdx = Math.min(isoWeekStart + 7, days.length);
        for (let d = weekStartIdx; d < weekEndIdx; d++) {
            if (d === dayIdx) continue;
            const dayEntries = Array.isArray(days[d]?.entries) ? days[d].entries : [];
            if (dayEntries.some((e) => e && e.status === 'A' && e.personId === person.id)) {
                daysThisWeek++;
            }
        }
        if (daysThisWeek >= personMaxDays) return;

        // P0: Max timmar per vecka (maxHoursWeek) — anpassat efter sysselsättningsgrad
        const pct = (person.employmentPct || 100) / 100;
        const adjustedMaxHoursWeek = maxHoursWeek * pct;
        const estimatedHoursThisWeek = daysThisWeek * 8; // estimat: 8h/dag
        if (estimatedHoursThisWeek + 8 > adjustedMaxHoursWeek) return;

        // P0: Periodmål nått — behöver fortfarande fler dagar
        const under = (t.target || 0) - (t.current || 0);
        if (under <= 0) return;

        /* ════════════════════════════════════════════
         * P1 REGLER — Penalty/Bonus (påverkar prioritet)
         * ════════════════════════════════════════════ */

        let priority = under * 1000 - (t.current || 0);

        // P1: Helg-rotation (weekendRotation) — varannan helg ledig
        if (isWeekend && ruleActive('weekendRotation')) {
            // Kontrollera om personen jobbade FÖRRA helgen
            const prevWeekStart = isoWeekStart - 7;
            if (prevWeekStart >= 0) {
                let workedLastWeekend = false;
                for (let d = Math.max(0, prevWeekStart); d < Math.min(prevWeekStart + 7, days.length); d++) {
                    const prevDate = new Date(year, month - 1, d + 1);
                    const prevJsDay = prevDate.getDay();
                    if (prevJsDay === 0 || prevJsDay === 6) {
                        const prevEntries = Array.isArray(days[d]?.entries) ? days[d].entries : [];
                        if (prevEntries.some((e) => e && e.status === 'A' && e.personId === person.id)) {
                            workedLastWeekend = true;
                            break;
                        }
                    }
                }
                if (workedLastWeekend) priority -= 3000;
            }

            // Kontrollera om personen jobbat helg ≥2 av senaste 4 veckor
            let recentWeekends = 0;
            for (let w = 1; w <= 4; w++) {
                const checkWeekStart = isoWeekStart - (w * 7);
                if (checkWeekStart < 0) break;
                let foundWeekend = false;
                for (let d = Math.max(0, checkWeekStart); d < Math.min(checkWeekStart + 7, days.length); d++) {
                    const checkDate = new Date(year, month - 1, d + 1);
                    const checkJsDay = checkDate.getDay();
                    if (checkJsDay === 0 || checkJsDay === 6) {
                        const checkEntries = Array.isArray(days[d]?.entries) ? days[d].entries : [];
                        if (checkEntries.some((e) => e && e.status === 'A' && e.personId === person.id)) {
                            foundWeekend = true;
                            break;
                        }
                    }
                }
                if (foundWeekend) recentWeekends++;
            }
            if (recentWeekends >= 2) priority -= 1500;
        }

        // P1: Dagar i rad — gradvis penalty (4+ dagar)
        if ((t.streak || 0) >= 4) {
            priority -= ((t.streak || 0) - 3) * 500;
        }

        // P1: Röd dag (redDayHandling) — rättvis rotation
        if (ruleActive('redDayHandling')) {
            if (isRedDayCheck(dateStr)) {
                priority -= 200;
            }
        }

        // P1: Vikarier sist (substituteLastPriority)
        if (ruleActive('substituteLastPriority')) {
            if (person.employmentType === 'substitute') {
                priority -= 200;
            }
        }

        // P1: Veckobalans — bonus om fler dagar kvar att fylla
        const daysBalance = personMaxDays - daysThisWeek;
        if (daysBalance > 2) {
            priority += daysBalance * 50;
        }

        candidates.push({
            person,
            priority,
            under,
            current: t.current || 0,
            nameKey: `${person.lastName || ''}|${person.firstName || ''}`.toLowerCase(),
        });
    });

    // Deterministisk sortering: prioritet → lägst current → namn
    candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.current !== b.current) return a.current - b.current;
        return a.nameKey.localeCompare(b.nameKey, 'sv');
    });

    return candidates.length > 0 ? candidates[0].person : null;
}

/* ========================================================================
   BLOCK 15 — HELPERS + evaluateSchedule()

   15A: evaluateSchedule()        — Validerar efter generering (läser state.rules)
   15B: getWeekdayIdx()           — Veckodag
   15C: getPersonGroups()         — Person-grupper med fallback
   15D: buildNeedByWeekday()      — Bemanningsbehov per veckodag
   15E: buildPersonGroupChecker() — Gruppfilter
   15F: isRedDayCheck()           — Röd dag (inline fallback)
   ======================================================================== */

/* ────────────────────────────────────────────────────────────────────────
   15A — evaluateSchedule() — validerar genererat schema mot state.rules
   ──────────────────────────────────────────────────────────────────────── */

function evaluateSchedule(state, { year, month }) {
    const warnings = [];

    if (!state?.schedule?.months?.[month - 1]) return { warnings };

    const monthData = state.schedule.months[month - 1];
    const days = Array.isArray(monthData.days) ? monthData.days : [];
    const people = Array.isArray(state.people) ? state.people : [];
    const rules = Array.isArray(state.rules) ? state.rules.filter(r => r.isActive) : [];

    // Regelvärden (med fallback)
    const rv = (type, fb) => { const r = rules.find(r => r.type === type); return r?.value ?? fb; };

    const maxConsecutive = rv('maxConsecutive', 6);
    const maxDaysPerWeek = rv('maxDaysPerWeek', 5);
    const maxHoursWeek = rv('maxHoursWeek', 40);

    const personMap = new Map();
    people.forEach((p) => { if (p && p.id) personMap.set(p.id, p); });

    // Samla per-person-data
    const personDays = new Map();
    days.forEach((day, dayIdx) => {
        const entries = Array.isArray(day.entries) ? day.entries : [];
        entries.forEach((e) => {
            if (e && e.status === 'A' && e.personId) {
                if (!personDays.has(e.personId)) personDays.set(e.personId, []);
                personDays.get(e.personId).push(dayIdx);
            }
        });
    });

    personDays.forEach((dayIndices, personId) => {
        const person = personMap.get(personId);
        const nm = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : personId;
        const personMaxDays = Math.min(person?.workdaysPerWeek || 5, maxDaysPerWeek);
        const sortedDays = [...dayIndices].sort((a, b) => a - b);

        // P0: Max dagar i rad
        let maxStreak = 1, currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === sortedDays[i - 1] + 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else { currentStreak = 1; }
        }
        if (maxStreak > maxConsecutive) {
            warnings.push({ level: 'P0', severity: 'P0', personId, ruleName: 'maxConsecutive',
                message: `${nm}: ${maxStreak} dagar i rad (max ${maxConsecutive})` });
        }

        // P0: Max dagar per vecka (ISO-vecka)
        const weekBuckets = {};
        sortedDays.forEach((d) => {
            const dt = new Date(year, month - 1, d + 1);
            const wd = dt.getDay();
            const dow = wd === 0 ? 6 : wd - 1;
            const weekStart = d - dow;
            weekBuckets[weekStart] = (weekBuckets[weekStart] || 0) + 1;
        });
        Object.entries(weekBuckets).forEach(([ws, count]) => {
            if (count > personMaxDays) {
                warnings.push({ level: 'P0', severity: 'P0', personId, ruleName: 'maxDaysPerWeek',
                    message: `${nm}: ${count} dagar i en vecka (max ${personMaxDays})` });
            }
        });

        // P0: Max timmar per vecka (estimat: dagar × 8h)
        const pct = (person?.employmentPct || 100) / 100;
        const adjMax = maxHoursWeek * pct;
        Object.entries(weekBuckets).forEach(([ws, count]) => {
            const estHours = count * 8;
            if (estHours > adjMax) {
                warnings.push({ level: 'P0', severity: 'P0', personId, ruleName: 'maxHoursWeek',
                    message: `${nm}: ~${estHours} tim/vecka (max ${adjMax.toFixed(0)} tim vid ${person?.employmentPct || 100}%)` });
            }
        });

        // P0: Tillgänglighet — schemalagd dag som person ej är tillgänglig
        if (Array.isArray(person?.availability) && person.availability.length >= 7) {
            sortedDays.forEach((d) => {
                const dt = new Date(year, month - 1, d + 1);
                const wd = dt.getDay();
                const dow = wd === 0 ? 6 : wd - 1;
                if (person.availability[dow] === false) {
                    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                    warnings.push({ level: 'P0', severity: 'P0', personId, ruleName: 'availabilityCheck',
                        message: `${nm}: schemalagd ${ds} men inte tillgänglig den veckodagen` });
                }
            });
        }

        // P1: Helg-obalans (jobbar helg >2 veckor i rad)
        const weekendWeekStarts = new Map();
        sortedDays.forEach((d) => {
            const dt = new Date(year, month - 1, d + 1);
            const wd = dt.getDay();
            if (wd === 0 || wd === 6) {
                const dow = wd === 0 ? 6 : wd - 1;
                weekendWeekStarts.set(d - dow, true);
            }
        });
        const weekendKeys = [...weekendWeekStarts.keys()].sort((a, b) => a - b);
        let consWeekends = 1, maxConsWeekends = 1;
        for (let i = 1; i < weekendKeys.length; i++) {
            if (weekendKeys[i] - weekendKeys[i - 1] === 7) {
                consWeekends++;
                maxConsWeekends = Math.max(maxConsWeekends, consWeekends);
            } else { consWeekends = 1; }
        }
        if (maxConsWeekends > 2) {
            warnings.push({ level: 'P1', severity: 'P1', personId, ruleName: 'weekendRotation',
                message: `${nm}: jobbar helg ${maxConsWeekends} veckor i rad (rekommendation: varannan)` });
        }
    });

    return { warnings };
}

/* ────────────────────────────────────────────────────────────────────────
   15B — getWeekdayIdx()
   JS: getDay() => 0=Sun..6=Sat. Vi vill 0=Mån..6=Sön
   Används av: Block 3, Block 6, Block 9
   ──────────────────────────────────────────────────────────────────────── */

function getWeekdayIdx(year, month, dayOfMonth) {
    const date = new Date(year, month - 1, dayOfMonth);
    const d = date.getDay();
    return d === 0 ? 6 : d - 1;
}

/* ────────────────────────────────────────────────────────────────────────
   15C — getPersonGroups()
   Hämta person-grupper med fallback: groups → groupIds
   Normaliserar till string-array.
   Används av: Block 4, Block 8 (via buildPersonGroupChecker)
   ──────────────────────────────────────────────────────────────────────── */

function getPersonGroups(person) {
    const raw = Array.isArray(person.groups)
        ? person.groups
        : Array.isArray(person.groupIds)
          ? person.groupIds
          : [];
    return raw.map((g) => String(g)).filter(Boolean);
}

/* ────────────────────────────────────────────────────────────────────────
   15D — buildNeedByWeekday()
   Beräkna bemanningsbehov per veckodag (mån–sön, 7 värden).
   Primärt: state.demand.groupDemands (summa av valda grupper)
   Fallback: input.needByWeekday
   Används av: Block 3
   ──────────────────────────────────────────────────────────────────────── */

function buildNeedByWeekday(state, selectedGroupIds, fallbackNeedByWeekday) {
    const demand = state?.demand;
    const groupDemands = demand?.groupDemands;

    // Primärt: summera groupDemands för valda grupper
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

    // Fallback: input.needByWeekday (7 värden)
    if (Array.isArray(fallbackNeedByWeekday) && fallbackNeedByWeekday.length === 7) {
        return fallbackNeedByWeekday.map((x) => {
            const v = parseInt(x, 10);
            return Number.isFinite(v) && v >= 0 ? v : 0;
        });
    }

    // Fail-closed: inget behov definierat
    throw new Error(
        'Bemanningsbehov saknas: sätt groupDemands i Kontroll-vyn eller skicka giltig needByWeekday'
    );
}

/* ────────────────────────────────────────────────────────────────────────
   15E — buildPersonGroupChecker()
   Returnerar en funktion: (personId) => boolean
   True om personen tillhör någon av selectedGroupIds.
   Används av: Block 8 (rensning av gamla A-entries)
   ──────────────────────────────────────────────────────────────────────── */

function buildPersonGroupChecker(people, selectedGroupIds) {
    const map = new Map();

    (Array.isArray(people) ? people : []).forEach((p) => {
        if (!p || typeof p !== 'object') return;
        if (typeof p.id !== 'string' || !p.id) return;

        const gs = getPersonGroups(p);
        map.set(p.id, new Set(gs));
    });

    const selected = new Set(
        selectedGroupIds.map((x) => String(x)).filter(Boolean)
    );

    return (personId) => {
        const set = map.get(personId);
        if (!set) return false;
        for (const gid of set.values()) {
            if (selected.has(gid)) return true;
        }
        return false;
    };
}

/* ────────────────────────────────────────────────────────────────────────
   15F — isRedDayCheck()
   Enkel röd dag-kontroll (inline fallback).
   Söndagar + svenska helgdagar.
   Används av: Block 14 (redDayHandling penalty)
   ──────────────────────────────────────────────────────────────────────── */

function isRedDayCheck(dateStr) {
    try {
        const d = new Date(dateStr);
        const jsDay = d.getDay();
        if (jsDay === 0) return true; // Söndagar

        const m = d.getMonth() + 1;
        const day = d.getDate();
        if (m === 1 && day === 1) return true;   // Nyårsdagen
        if (m === 1 && day === 6) return true;   // Trettondedag jul
        if (m === 5 && day === 1) return true;   // Första maj
        if (m === 6 && day === 6) return true;   // Nationaldagen
        if (m === 12 && day === 25) return true;  // Juldagen
        if (m === 12 && day === 26) return true;  // Annandag jul

        return false;
    } catch {
        return false;
    }
}
