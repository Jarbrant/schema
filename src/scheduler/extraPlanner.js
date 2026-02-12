/*
 * AO-20 — EXTRA PLANNER: Automatisk planering av X-dagar från saldo
 */

import { evaluate } from '../rules.js';
import { calcMonthStats } from '../stats.js';

const PROTECTED_STATUSES = ['SEM', 'SJ', 'VAB', 'PERM', 'UTB'];

/**
 * Planera X-dagar från extra-saldo (preview eller apply)
 */
export function planExtraDays(state, input) {
    const { year, month, mode = 'preview', maxPerPersonPerMonth = 2, preferWeekdays = true } = input;

    if (!state.schedule || state.schedule.year !== year) {
        throw new Error(`Schedule för år ${year} saknas`);
    }

    if (month < 1 || month > 12) {
        throw new Error(`Månad måste vara 1–12`);
    }

    const monthData = state.schedule.months[month - 1];
    if (!monthData) {
        throw new Error(`Månad ${month} saknas`);
    }

    const proposedState = JSON.parse(JSON.stringify(state));
    const proposedMonthData = proposedState.schedule.months[month - 1];

    let statsResult;
    try {
        statsResult = calcMonthStats(proposedState, { year, month });
    } catch (err) {
        throw new Error(`Stats-beräkning misslyckades: ${err.message}`);
    }

    const planned = [];
    const unplanned = [];
    const notes = [];

    const activePeople = proposedState.people.filter((p) => p.isActive);

    activePeople.forEach((person) => {
        const stats = statsResult.statsByPerson[person.id];
        if (!stats || stats.extraToPlanDays <= 0) {
            return;
        }

        const daysToPlans = Math.min(stats.extraToPlanDays, maxPerPersonPerMonth);
        const plannedForPerson = [];

        const candidates = findCandidateDates(
            person.id,
            proposedMonthData,
            daysToPlans,
            preferWeekdays,
            year,
            month
        );

        let placedCount = 0;

        for (const dateStr of candidates) {
            if (placedCount >= daysToPlans) {
                break;
            }

            const [y, m, d] = dateStr.split('-').map(Number);
            const dayIndex = d - 1;
            const dayData = proposedMonthData.days[dayIndex];

            if (!dayData) {
                continue;
            }

            const testEntry = {
                personId: person.id,
                status: 'X',
                start: null,
                end: null,
                breakStart: null,
                breakEnd: null,
            };

            const originalEntries = dayData.entries;
            dayData.entries = dayData.entries.filter((e) => e.personId !== person.id);
            dayData.entries.push(testEntry);

            let breaksP0 = false;
            try {
                const ruleResult = evaluate(proposedState, { year, month });
                const personP0s = ruleResult.warnings.filter(
                    (w) => w.personId === person.id && w.level === 'P0'
                );
                if (personP0s.length > 0) {
                    breaksP0 = true;
                }
            } catch (err) {
                console.warn('Rule-check misslyckades', err);
                breaksP0 = true;
            }

            if (breaksP0) {
                dayData.entries = originalEntries;
            } else {
                plannedForPerson.push(dateStr);
                placedCount++;
            }
        }

        if (plannedForPerson.length > 0) {
            planned.push({
                personId: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                dates: plannedForPerson,
                count: plannedForPerson.length,
            });
        }

        if (placedCount < daysToPlans) {
            unplanned.push({
                personId: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                plannedCount: placedCount,
                kvarCount: daysToPlans - placedCount,
            });
        }
    });

    notes.push(`Planering för månad ${month} ${year}`);
    notes.push(`Planerade X-dagar: ${planned.reduce((sum, p) => sum + p.count, 0)}`);
    if (unplanned.length > 0) {
        notes.push(`Kunde ej planera för ${unplanned.length} person(er)`);
    }

    if (mode !== 'preview') {
        proposedState.meta.updatedAt = Date.now();
    }

    return {
        proposedState,
        planned,
        unplanned,
        notes: notes.join('; '),
        mode,
        month,
        year,
    };
}

function findCandidateDates(personId, monthData, count, preferWeekdays, year, month) {
    const days = monthData.days || [];
    const candidates = [];

    days.forEach((dayData) => {
        const dateStr = dayData.date;
        const [, , d] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();

        const entry = dayData.entries.find((e) => e.personId === personId);

        if (entry && PROTECTED_STATUSES.includes(entry.status)) {
            return;
        }

        let priority = 0;

        if (preferWeekdays && dayOfWeek >= 1 && dayOfWeek <= 5) {
            priority += 1000;
        }

        if (entry && entry.status === 'A') {
            priority += 100;
        }

        priority -= d;

        candidates.push({
            dateStr,
            priority,
            dayOfWeek,
        });
    });

    candidates.sort((a, b) => b.priority - a.priority);

    const selected = [];
    let lastSelectedDay = -10;

    for (const cand of candidates) {
        const [, , d] = cand.dateStr.split('-').map(Number);

        if (d - lastSelectedDay >= 3 || lastSelectedDay === -10) {
            selected.push(cand.dateStr);
            lastSelectedDay = d;

            if (selected.length >= count) {
                break;
            }
        }
    }

    if (selected.length < count) {
        for (const cand of candidates) {
            if (!selected.includes(cand.dateStr)) {
                selected.push(cand.dateStr);
                if (selected.length >= count) {
                    break;
                }
            }
        }
    }

    return selected;
}
