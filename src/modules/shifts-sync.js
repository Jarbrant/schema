/*
 * S3-03 — SHIFTS SYNC MIDDLEWARE
 * FIL: src/modules/shifts-sync.js
 *
 * Automatisk synk: state.shifts → state.shiftTemplates
 * Körs som post-mutation hook i Store.
 *
 * PROBLEMET SOM LÖSES:
 *   state.shifts   = källa (skapas/redigeras i Grupper-vyn)
 *   state.shiftTemplates = konsument (veckomallar, kalender, AI-fill, kontroll)
 *   Utan denna synk måste användaren besöka shifts-vyn manuellt.
 *
 * DESIGN:
 *   - Idempotent: kan köras flera gånger utan bieffekt
 *   - Fail-safe: om synk misslyckas → loggar, kraschar inte
 *   - Enkel delta-check: kör bara om shifts faktiskt ändrats
 */

/* ============================================================
 * BLOCK 1 — MAIN SYNC FUNCTION
 *
 * Anropas med mutable state (inuti store.update/setState)
 * MUTERAR state.shiftTemplates + state.groups[].shiftTemplateIds
 * ============================================================ */
export function syncShiftsToTemplates(state) {
    if (!state || typeof state !== 'object') return;

    const shifts = state.shifts;
    if (!shifts || typeof shifts !== 'object') return;

    // Säkerställ att shiftTemplates finns
    if (!state.shiftTemplates || typeof state.shiftTemplates !== 'object') {
        state.shiftTemplates = {};
    }

    const templates = state.shiftTemplates;

    // --- Delta-check: skippa om inget ändrats ---
    const shiftIds = Object.keys(shifts);
    const templateIds = Object.keys(templates);

    let needsSync = shiftIds.length !== templateIds.length;

    if (!needsSync) {
        for (let i = 0; i < shiftIds.length; i++) {
            const id = shiftIds[i];
            const s = shifts[id];
            const t = templates[id];
            if (!t || !s) { needsSync = true; break; }
            if (s.name !== t.name ||
                s.startTime !== t.startTime ||
                s.endTime !== t.endTime ||
                s.breakStart !== t.breakStart ||
                s.breakEnd !== t.breakEnd ||
                s.color !== t.color) {
                needsSync = true;
                break;
            }
        }
    }

    if (!needsSync) return;

    // --- Synka: shifts → shiftTemplates ---
    Object.values(shifts).forEach(shift => {
        if (!shift || !shift.id) return;
        templates[shift.id] = {
            id: shift.id,
            name: shift.name || '',
            startTime: shift.startTime || null,
            endTime: shift.endTime || null,
            breakStart: shift.breakStart || null,
            breakEnd: shift.breakEnd || null,
            color: shift.color || '#667eea',
            // Behåll eventuella extra fält från befintlig template
            ...(templates[shift.id] || {}),
            // Men överskrivna fält ska vinna:
            id: shift.id,
            name: shift.name || '',
            startTime: shift.startTime || null,
            endTime: shift.endTime || null,
            breakStart: shift.breakStart || null,
            breakEnd: shift.breakEnd || null,
            color: shift.color || '#667eea',
        };
    });

    // Ta bort templates som inte längre finns i shifts
    Object.keys(templates).forEach(tid => {
        if (!shifts[tid]) {
            delete templates[tid];
        }
    });

    // --- Synka: groupShifts → groups[].shiftTemplateIds ---
    const groupShifts = state.groupShifts;
    const groups = state.groups;
    if (groupShifts && typeof groupShifts === 'object' &&
        groups && typeof groups === 'object') {
        Object.entries(groupShifts).forEach(([groupId, shiftIds]) => {
            if (groups[groupId]) {
                groups[groupId].shiftTemplateIds = Array.isArray(shiftIds) ? [...shiftIds] : [];
            }
        });
    }
}

/* ============================================================
 * BLOCK 2 — STORE MIDDLEWARE HOOK
 *
 * Kopplas in i Store via: store.addPostMutationHook(shiftsSyncHook)
 * Eller anropas explicit i store.update() / store.setState()
 * ============================================================ */
export function shiftsSyncHook(state) {
    try {
        syncShiftsToTemplates(state);
    } catch (err) {
        console.warn('⚠️ shifts-sync middleware misslyckades:', err?.message || err);
        // Fail-safe: kraschar inte store
    }
}
