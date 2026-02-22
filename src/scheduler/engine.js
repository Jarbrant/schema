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
       BLOCK 9 — MAIN SCHEDULING LOOP v2.0
       [ÄNDRING] findBestCandidate() får nu year + month för datumberäkning
       ==================================================================== */

    days.forEach((dayData, dayIdx) => {
        const wIdx = getWeekdayIdx(year, month, dayIdx + 1);
        const need = needByWeekday[wIdx] || 0;

        if (!Array.isArray(dayData.entries)) dayData.entries = [];

        let filledToday = 0;

        for (let slot = 0; slot < need; slot++) {
            // [v2.0] Skickar year + month till findBestCandidate
            const candidate = findBestCandidate(personTargets, dayIdx, days, year, month);

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

                // Uppdatera streak (enkel, baserat på föregående dag)
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
       BLOCK 11 — RULES VALIDATION v2.0 (INBYGGD EVALUATE)

       [ÄNDRING] Använder den nya inbyggda evaluate() istället för
       den trasiga importen från rules.js (som saknade funktionen).
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
   BLOCK 14 — CANDIDATE SELECTION v2.0 (MED REGELINTEGRATION)

   NYTT I v2.0:
   - P0: Kontrollerar person.availability[dayIdx] (lör/sön-tillgänglighet)
   - P0: Kontrollerar frånvaro (vacationDates, leaveDates)
   - P0: Max 5 arbetsdagar per vecka (person.workdaysPerWeek)
   - P0: Streak max 6 (istället för 9) — garanterar minst 1 ledig dag/vecka
   - P1: Helg-rotation — straffar person som jobbade FÖRRA helgen
   - P1: Veckobalans — sprider dagar jämnare över veckan
   ======================================================================== */

function findBestCandidate(personTargets, dayIdx, days, year, month) {
    const dayData = days[dayIdx];
    const entries = Array.isArray(dayData.entries) ? dayData.entries : [];

    // Beräkna veckodag (0=Mån..6=Sön)
    const date = new Date(year, month - 1, dayIdx + 1);
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mån, 5=Lör, 6=Sön
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;

    // Beräkna vilken vecka (0-baserad) i månaden denna dag tillhör
    const weekIndex = Math.floor(dayIdx / 7);

    const candidates = [];

    Object.values(personTargets).forEach((t) => {
        const person = t.person;

        /* ════════════════════════════════════════════
         * P0 REGLER — Blockerar kandidaten helt
         * ════════════════════════════════════════════ */

        // P0: Redan schemalagd idag
        const alreadyScheduled = entries.some(
            (e) => e && e.status === 'A' && e.personId === person.id
        );
        if (alreadyScheduled) return;

        // P0: Tillgänglighet — kontrollera person.availability för denna veckodag
        if (Array.isArray(person.availability) && person.availability.length >= 7) {
            if (person.availability[dayOfWeek] === false) return;
        }

        // P0: Frånvaro — semester eller ledighet
        if (Array.isArray(person.vacationDates) && person.vacationDates.includes(dateStr)) return;
        if (Array.isArray(person.leaveDates) && person.leaveDates.includes(dateStr)) return;

        // P0: Max dagar i rad — sänkt från 9 till 6 för att garantera vila
        const maxConsecutive = person.maxConsecutiveDays || 6;
        if ((t.streak || 0) >= maxConsecutive) return;

        // P0: Max arbetsdagar denna vecka (räkna redan schemalagda dagar i samma vecka)
        const maxDaysPerWeek = person.workdaysPerWeek || 5;
        const weekStart = weekIndex * 7;
        const weekEnd = Math.min(weekStart + 7, days.length);
        let daysThisWeek = 0;
        for (let d = weekStart; d < weekEnd; d++) {
            if (d === dayIdx) continue; // räkna inte den dag vi försöker fylla
            const dayEntries = Array.isArray(days[d].entries) ? days[d].entries : [];
            const isScheduled = dayEntries.some(
                (e) => e && e.status === 'A' && e.personId === person.id
            );
            if (isScheduled) daysThisWeek++;
        }
        if (daysThisWeek >= maxDaysPerWeek) return;

        // P0: Behöver fortfarande fler dagar
        const under = (t.target || 0) - (t.current || 0);
        if (under <= 0) return;

        /* ════════════════════════════════════════════
         * P1 REGLER — Påverkar prioritet (penalty/bonus)
         * ════════════════════════════════════════════ */

        let priority = under * 1000 - (t.current || 0);

        // P1: Helg-rotation — kontrollera om personen jobbade FÖRRA helgen
        if (isWeekend && weekIndex > 0) {
            const prevWeekStart = (weekIndex - 1) * 7;
            const prevWeekEnd = Math.min(prevWeekStart + 7, days.length);
            let workedLastWeekend = false;

            for (let d = prevWeekStart; d < prevWeekEnd; d++) {
                const prevDate = new Date(year, month - 1, d + 1);
                const prevJsDay = prevDate.getDay();
                const isPrevWeekend = (prevJsDay === 0 || prevJsDay === 6);

                if (isPrevWeekend) {
                    const prevEntries = Array.isArray(days[d].entries) ? days[d].entries : [];
                    const wasScheduled = prevEntries.some(
                        (e) => e && e.status === 'A' && e.personId === person.id
                    );
                    if (wasScheduled) {
                        workedLastWeekend = true;
                        break;
                    }
                }
            }

            if (workedLastWeekend) {
                // Kraftig penalty: varannan helg ledig
                priority -= 3000;
            }
        }

        // P1: Streak-penalty — ju längre streak, desto mer ovillig
        if ((t.streak || 0) >= 4) {
            priority -= ((t.streak || 0) - 3) * 500;
        }

        // P1: Veckobalans — bonus om personen har många dagar kvar att fylla denna vecka
        const daysBalanceThisWeek = maxDaysPerWeek - daysThisWeek;
        if (daysBalanceThisWeek > 2) {
            priority += daysBalanceThisWeek * 50;
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
   BLOCK 15A — evaluateSchedule() (NYTT — ersätter trasig evaluate-import)

   Validerar genererat schema mot arbetstidsregler:
   - P0: Max dagar i rad (>6)
   - P0: Samma person jobbar >5 dagar/vecka
   - P0: Ingen veckovila (minst 1 ledig dag per 7-dagarsperiod)
   - P1: Helg-obalans (samma person jobbar helg >2 veckor i rad)
   - P1: Ojämn fördelning (>20% avvikelse från target)
   ======================================================================== */

function evaluateSchedule(state, { year, month }) {
    const warnings = [];

    if (!state?.schedule?.months?.[month - 1]) {
        return { warnings };
    }

    const monthData = state.schedule.months[month - 1];
    const days = Array.isArray(monthData.days) ? monthData.days : [];
    const people = Array.isArray(state.people) ? state.people : [];

    // Bygg person-lookup
    const personMap = new Map();
    people.forEach((p) => {
        if (p && p.id) personMap.set(p.id, p);
    });

    // Samla per-person-data
    const personDays = new Map(); // personId → [dayIdx, dayIdx, ...]

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
        const personName = person
            ? `${person.firstName || ''} ${person.lastName || ''}`.trim()
            : personId;

        const maxDaysPerWeek = person?.workdaysPerWeek || 5;
        const sortedDays = [...dayIndices].sort((a, b) => a - b);

        // P0: Max dagar i rad
        let maxStreak = 1;
        let currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === sortedDays[i - 1] + 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }

        if (maxStreak > 6) {
            warnings.push({
                level: 'P0',
                severity: 'P0',
                message: `${personName}: ${maxStreak} dagar i rad (max 6)`,
                personId,
                ruleName: 'maxConsecutive',
            });
        }

        // P0: Max dagar per vecka
        const weekBuckets = {};
        sortedDays.forEach((d) => {
            const weekNum = Math.floor(d / 7);
            weekBuckets[weekNum] = (weekBuckets[weekNum] || 0) + 1;
        });

        Object.entries(weekBuckets).forEach(([weekNum, count]) => {
            if (count > maxDaysPerWeek) {
                warnings.push({
                    level: 'P0',
                    severity: 'P0',
                    message: `${personName}: ${count} dagar vecka ${Number(weekNum) + 1} (max ${maxDaysPerWeek})`,
                    personId,
                    ruleName: 'maxDaysPerWeek',
                });
            }
        });

        // P1: Helg-obalans (jobbar helg >2 veckor i rad)
        const weekendWeeks = new Set();
        sortedDays.forEach((d) => {
            const date = new Date(year, month - 1, d + 1);
            const jsDay = date.getDay();
            if (jsDay === 0 || jsDay === 6) {
                weekendWeeks.add(Math.floor(d / 7));
            }
        });

        const weekendWeeksList = [...weekendWeeks].sort((a, b) => a - b);
        let consecutiveWeekendWeeks = 1;
        let maxConsecutiveWeekends = 1;
        for (let i = 1; i < weekendWeeksList.length; i++) {
            if (weekendWeeksList[i] === weekendWeeksList[i - 1] + 1) {
                consecutiveWeekendWeeks++;
                maxConsecutiveWeekends = Math.max(maxConsecutiveWeekends, consecutiveWeekendWeeks);
            } else {
                consecutiveWeekendWeeks = 1;
            }
        }

        if (maxConsecutiveWeekends > 2) {
            warnings.push({
                level: 'P1',
                severity: 'P1',
                message: `${personName}: jobbar helg ${maxConsecutiveWeekends} veckor i rad (rekommendation: varannan helg)`,
                personId,
                ruleName: 'weekendRotation',
            });
        }
    });

    return { warnings };
}
