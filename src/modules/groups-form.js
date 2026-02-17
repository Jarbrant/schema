/*
 * AO-04 + EDIT — GROUPS FORM — Event listeners & CRUD (ESM-säkert)
 *
 * Store shape (Object/Map — INTE arrays):
 *   state.groups      = { [id]: { id, name, color, textColor } }
 *   state.shifts      = { [id]: { id, name, shortName, startTime, endTime, breakStart, breakEnd, color, description } }
 *   state.groupShifts = { [groupId]: [shiftId, ...] }
 *
 * Alla mutationer via store.update(fn) — fail-closed.
 * Inga require() — ren ESM.
 */

import {
    validateGroupName,
    validateGroupId,
    validatePassTime,
    validateShiftName,
    validateShiftId
} from './groups-validate.js';

/* ============================================================
 * PUBLIC: Setup alla event listeners
 * Anropas från views/groups.js efter render
 * ============================================================ */
export function setupGroupsEventListeners(container, store, ctx, reRender) {
    if (!container || !store) {
        console.error('❌ setupGroupsEventListeners: container eller store saknas');
        return;
    }

    const render = typeof reRender === 'function'
        ? reRender
        : () => { console.warn('⚠️ reRender callback saknas'); };

    setupGroupFormSubmit(container, store, ctx, render);
    setupShiftFormSubmit(container, store, ctx, render);
    setupDeleteGroupButtons(container, store, ctx, render);
    setupDeleteShiftButtons(container, store, ctx, render);
    setupEditGroupButtons(container, store, ctx, render);
    setupEditShiftButtons(container, store, ctx, render);
    setupCancelEditButtons(container, ctx, render);
}

/* ============================================================
 * CREATE / UPDATE: Grupp
 * ============================================================ */
function setupGroupFormSubmit(container, store, ctx, render) {
    const form = container.querySelector('#group-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const state = store.getState();
            const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};

            const nameInput = form.querySelector('[name="groupName"]');
            const idInput = form.querySelector('[name="groupId"]');
            const colorInput = form.querySelector('[name="groupColor"]');
            const editIdInput = form.querySelector('[name="editGroupId"]');

            const name = (nameInput?.value || '').trim();
            const rawId = (idInput?.value || '').trim();
            const color = (colorInput?.value || '#777').trim();
            const editId = (editIdInput?.value || '').trim();

            // Validera namn
            const nameErr = validateGroupName(name);
            if (nameErr) { showFormError(form, nameErr); return; }

            if (editId) {
                // === UPDATE MODE ===
                if (!groups[editId]) {
                    showFormError(form, `Grupp "${editId}" hittades inte`);
                    return;
                }

                store.update((s) => {
                    if (!s.groups || typeof s.groups !== 'object') s.groups = {};
                    s.groups[editId] = {
                        ...s.groups[editId],
                        name: name,
                        color: color,
                        textColor: isLightColor(color) ? '#000000' : '#FFFFFF'
                    };
                });

                console.log(`✓ Grupp uppdaterad: ${editId}`);
                // Rensa edit-mode
                if (ctx) ctx.editGroupId = null;
                render();

            } else {
                // === CREATE MODE ===
                const id = rawId
                    ? rawId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
                    : name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

                const idErr = validateGroupId(id, groups);
                if (idErr) { showFormError(form, idErr); return; }

                store.update((s) => {
                    if (!s.groups || typeof s.groups !== 'object') s.groups = {};
                    s.groups[id] = {
                        id: id,
                        name: name,
                        color: color,
                        textColor: isLightColor(color) ? '#000000' : '#FFFFFF'
                    };

                    if (!s.groupShifts || typeof s.groupShifts !== 'object') s.groupShifts = {};
                    if (!s.groupShifts[id]) s.groupShifts[id] = [];
                });

                console.log(`✓ Grupp skapad: ${id} (${name})`);
                render();
            }

        } catch (err) {
            console.error('❌ Grupp-formulär misslyckades:', err);
            showFormError(form, 'Kunde inte spara grupp: ' + err.message);
        }
    });
}

/* ============================================================
 * CREATE / UPDATE: Grundpass (shift)
 * ============================================================ */
function setupShiftFormSubmit(container, store, ctx, render) {
    const form = container.querySelector('#shift-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        try {
            const state = store.getState();
            const shifts = state.shifts && typeof state.shifts === 'object' ? state.shifts : {};

            const nameInput = form.querySelector('[name="shiftName"]');
            const idInput = form.querySelector('[name="shiftId"]');
            const shortInput = form.querySelector('[name="shiftShortName"]');
            const startInput = form.querySelector('[name="shiftStart"]');
            const endInput = form.querySelector('[name="shiftEnd"]');
            const breakStartInput = form.querySelector('[name="shiftBreakStart"]');
            const breakEndInput = form.querySelector('[name="shiftBreakEnd"]');
            const colorInput = form.querySelector('[name="shiftColor"]');
            const descInput = form.querySelector('[name="shiftDescription"]');
            const editIdInput = form.querySelector('[name="editShiftId"]');

            const name = (nameInput?.value || '').trim();
            const rawId = (idInput?.value || '').trim();
            const shortName = (shortInput?.value || '').trim();
            const startTime = (startInput?.value || '').trim() || null;
            const endTime = (endInput?.value || '').trim() || null;
            const breakStart = (breakStartInput?.value || '').trim() || null;
            const breakEnd = (breakEndInput?.value || '').trim() || null;
            const color = (colorInput?.value || '#777').trim();
            const description = (descInput?.value || '').trim();
            const editId = (editIdInput?.value || '').trim();

            // Validera namn
            const nameErr = validateShiftName(name);
            if (nameErr) { showFormError(form, nameErr); return; }

            // Validera tider (om angivna)
            if (startTime && endTime) {
                const timeErr = validatePassTime(startTime, endTime);
                if (timeErr) { showFormError(form, timeErr); return; }
            }

            if (editId) {
                // === UPDATE MODE ===
                if (!shifts[editId]) {
                    showFormError(form, `Grundpass "${editId}" hittades inte`);
                    return;
                }

                store.update((s) => {
                    if (!s.shifts || typeof s.shifts !== 'object') s.shifts = {};
                    s.shifts[editId] = {
                        ...s.shifts[editId],
                        name: name,
                        shortName: shortName || s.shifts[editId].shortName || editId.charAt(0),
                        startTime: startTime,
                        endTime: endTime,
                        breakStart: breakStart,
                        breakEnd: breakEnd,
                        color: color,
                        description: description
                    };
                });

                console.log(`✓ Grundpass uppdaterat: ${editId}`);
                if (ctx) ctx.editShiftId = null;
                render();

            } else {
                // === CREATE MODE ===
                const id = rawId
                    ? rawId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
                    : name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

                const idErr = validateShiftId(id, shifts);
                if (idErr) { showFormError(form, idErr); return; }

                store.update((s) => {
                    if (!s.shifts || typeof s.shifts !== 'object') s.shifts = {};
                    s.shifts[id] = {
                        id: id,
                        name: name,
                        shortName: shortName || id.charAt(0),
                        startTime: startTime,
                        endTime: endTime,
                        breakStart: breakStart,
                        breakEnd: breakEnd,
                        color: color,
                        description: description
                    };
                });

                console.log(`✓ Grundpass skapat: ${id} (${name})`);
                render();
            }

        } catch (err) {
            console.error('❌ Grundpass-formulär misslyckades:', err);
            showFormError(form, 'Kunde inte spara grundpass: ' + err.message);
        }
    });
}

/* ============================================================
 * EDIT: Grupp — fyll i formuläret med befintlig data
 * ============================================================ */
function setupEditGroupButtons(container, store, ctx, render) {
    const buttons = container.querySelectorAll('[data-action="edit-group"]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = e.currentTarget.dataset.id;
            if (!groupId) return;

            try {
                const state = store.getState();
                const group = state.groups?.[groupId];
                if (!group) {
                    alert('Gruppen hittades inte');
                    return;
                }

                // Sätt edit-mode i ctx och re-rendera
                if (ctx && typeof ctx === 'object') {
                    ctx.editGroupId = groupId;
                    ctx.groupsTab = 'groups';
                }
                render();

            } catch (err) {
                console.error('❌ Edit grupp misslyckades:', err);
            }
        });
    });
}

/* ============================================================
 * EDIT: Grundpass — fyll i formuläret med befintlig data
 * ============================================================ */
function setupEditShiftButtons(container, store, ctx, render) {
    const buttons = container.querySelectorAll('[data-action="edit-shift"]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shiftId = e.currentTarget.dataset.id;
            if (!shiftId) return;

            try {
                const state = store.getState();
                const shift = state.shifts?.[shiftId];
                if (!shift) {
                    alert('Grundpasset hittades inte');
                    return;
                }

                if (ctx && typeof ctx === 'object') {
                    ctx.editShiftId = shiftId;
                    ctx.groupsTab = 'shifts';
                }
                render();

            } catch (err) {
                console.error('❌ Edit grundpass misslyckades:', err);
            }
        });
    });
}

/* ============================================================
 * CANCEL EDIT
 * ============================================================ */
function setupCancelEditButtons(container, ctx, render) {
    const buttons = container.querySelectorAll('[data-action="cancel-edit"]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (ctx && typeof ctx === 'object') {
                ctx.editGroupId = null;
                ctx.editShiftId = null;
            }
            render();
        });
    });
}

/* ============================================================
 * DELETE: Grupp
 * ============================================================ */
function setupDeleteGroupButtons(container, store, ctx, render) {
    const buttons = container.querySelectorAll('[data-action="delete-group"]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = e.currentTarget.dataset.id;
            if (!groupId) return;
            if (!confirm(`Radera grupp "${groupId}"? Detta tar även bort gruppens pass-kopplingar.`)) return;

            try {
                store.update((s) => {
                    if (s.groups && s.groups[groupId]) {
                        delete s.groups[groupId];
                    }
                    if (s.groupShifts && s.groupShifts[groupId]) {
                        delete s.groupShifts[groupId];
                    }
                    if (s.demand && s.demand.groupDemands && s.demand.groupDemands[groupId]) {
                        delete s.demand.groupDemands[groupId];
                    }
                    if (Array.isArray(s.people)) {
                        s.people.forEach(p => {
                            if (Array.isArray(p.groups)) {
                                p.groups = p.groups.filter(gid => gid !== groupId);
                            }
                            if (Array.isArray(p.groupIds)) {
                                p.groupIds = p.groupIds.filter(gid => gid !== groupId);
                            }
                        });
                    }
                });

                // Rensa ev. edit-mode
                if (ctx) ctx.editGroupId = null;
                console.log(`✓ Grupp raderad: ${groupId}`);
                render();

            } catch (err) {
                console.error('❌ Radera grupp misslyckades:', err);
                alert('Kunde inte radera grupp: ' + err.message);
            }
        });
    });
}

/* ============================================================
 * DELETE: Grundpass (shift)
 * ============================================================ */
function setupDeleteShiftButtons(container, store, ctx, render) {
    const buttons = container.querySelectorAll('[data-action="delete-shift"]');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shiftId = e.currentTarget.dataset.id;
            if (!shiftId) return;
            if (!confirm(`Radera grundpass "${shiftId}"? Detta tar bort passet från alla grupper.`)) return;

            try {
                store.update((s) => {
                    if (s.shifts && s.shifts[shiftId]) {
                        delete s.shifts[shiftId];
                    }
                    if (s.groupShifts && typeof s.groupShifts === 'object') {
                        Object.keys(s.groupShifts).forEach(gid => {
                            if (Array.isArray(s.groupShifts[gid])) {
                                s.groupShifts[gid] = s.groupShifts[gid].filter(sid => sid !== shiftId);
                            }
                        });
                    }
                });

                if (ctx) ctx.editShiftId = null;
                console.log(`✓ Grundpass raderat: ${shiftId}`);
                render();

            } catch (err) {
                console.error('❌ Radera grundpass misslyckades:', err);
                alert('Kunde inte radera grundpass: ' + err.message);
            }
        });
    });
}

/* ============================================================
 * HELPERS
 * ============================================================ */
function showFormError(form, message) {
    const old = form.querySelector('.form-error');
    if (old) old.remove();

    const div = document.createElement('div');
    div.className = 'form-error alert alert-warning';
    div.textContent = '❌ ' + message;
    form.prepend(div);

    setTimeout(() => { if (div.parentNode) div.remove(); }, 5000);
}

function isLightColor(hex) {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return false;
    const c = hex.replace('#', '');
    if (c.length < 6) return false;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6;
}
