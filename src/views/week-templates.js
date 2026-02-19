/*
 * AO-06 — Week Templates View (Veckomall-UI)
 * FIL: src/views/week-templates.js (HEL FIL)
 *
 * Hanterar state.weekTemplates (SPEC-datamodell) med:
 * - Skapa / Redigera / Radera veckomallar
 * - Slots: dayOfWeek, groupId, shiftTemplateId, countMin, count
 * - Visar slots per dag (mån–sön) i tabellform
 * - Grupp+pass-val filtreras via groups[gid].shiftTemplateIds
 *
 * Store shape:
 *   state.weekTemplates   = { [id]: { id, name, slots: [...] } }
 *   state.shiftTemplates  = { [id]: { id, name, startTime, endTime, ... } }
 *   state.groups          = { [id]: { id, name, color, shiftTemplateIds: [...] } }
 */

import { showSuccess, showWarning } from '../ui.js';

const DAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const DAY_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

/* ============================================================
 * BLOCK 1 — MAIN RENDER
 * ============================================================ */
export function renderWeekTemplates(container, ctx) {
    if (!container) {
        console.error('❌ renderWeekTemplates: container saknas');
        return;
    }

    try {
        const store = ctx?.store;
        if (!store) {
            container.innerHTML = `
                <div class="groups-container">
                    <div class="groups-content">
                        <h1>❌ Fel</h1>
                        <p class="empty-state">Store saknas i context.</p>
                    </div>
                </div>`;
            return;
        }

        if (!ctx || typeof ctx !== 'object') ctx = {};

        const state = store.getState();
        const weekTemplates = state.weekTemplates && typeof state.weekTemplates === 'object' ? state.weekTemplates : {};
        const shiftTemplates = state.shiftTemplates && typeof state.shiftTemplates === 'object' ? state.shiftTemplates : {};
        const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};

        const editId = ctx._editWeekTemplateId || null;
        const editWt = editId ? weekTemplates[editId] : null;
        const isEdit = !!editWt;

        // Kontrollera om det finns grupper + passmallar att jobba med
        const groupsArr = Object.values(groups);
        const stArr = Object.values(shiftTemplates);
        const hasData = groupsArr.length > 0 && stArr.length > 0;

        const formHtml = hasData
            ? renderForm(editId, editWt, isEdit, groups, shiftTemplates)
            : renderMissingDataWarning(groupsArr.length, stArr.length);

        const listHtml = renderTemplateList(weekTemplates, groups, shiftTemplates, editId);

        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>📅 Veckomallar</h1>
                    <p class="groups-tagline">Definiera bemanningsbehov per veckodag. Kopplas sedan till kalenderveckor.</p>
                    ${formHtml}
                    ${listHtml}
                </div>
            </div>
        `;

        setupEventListeners(container, store, ctx, groups, shiftTemplates);

    } catch (err) {
        console.error('❌ renderWeekTemplates kraschade:', err);
        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>❌ Fel</h1>
                    <p class="empty-state">Kunde inte rendera veckomallar: ${escapeHtml(String(err.message || err))}</p>
                </div>
            </div>`;
    }
}

/* ============================================================
 * BLOCK 2 — SAKNAR DATA-VARNING
 * ============================================================ */
function renderMissingDataWarning(groupCount, stCount) {
    const parts = [];
    if (groupCount === 0) parts.push('grupper (👥 Grupper-sidan)');
    if (stCount === 0) parts.push('passmallar (📋 Grundpass-sidan)');

    return `
        <div class="groups-form-section" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <h2>⚠️ Saknar data</h2>
            <p>För att skapa veckomallar behöver du först skapa ${parts.join(' och ')}.</p>
            <p>Veckomallar kopplar samman <strong>grupper</strong> med <strong>passmallar</strong> för att definiera bemanningsbehov.</p>
            <div style="margin-top: 1rem;">
                ${groupCount === 0 ? '<a href="#/groups" class="btn btn-primary" style="margin-right: 0.5rem;">👥 Skapa grupper</a>' : ''}
                ${stCount === 0 ? '<a href="#/shifts" class="btn btn-primary">📋 Skapa passmallar</a>' : ''}
            </div>
        </div>
    `;
}

/* ============================================================
 * BLOCK 3 — FORMULÄR (skapa/redigera veckomall)
 * ============================================================ */
function renderForm(editId, editWt, isEdit, groups, shiftTemplates) {
    const groupsArr = Object.values(groups);

    // Bygg grupp→pass lookup
    const groupShiftOptions = buildGroupShiftOptions(groupsArr, shiftTemplates);

    // Befintliga slots (vid edit)
    const existingSlots = isEdit && Array.isArray(editWt.slots) ? editWt.slots : [];

    // Bygg slot-rader per dag
    let slotsHtml = '';
    for (let day = 0; day < 7; day++) {
        const daySlots = existingSlots.filter(s => s.dayOfWeek === day);
        slotsHtml += renderDaySection(day, daySlots, groupShiftOptions);
    }

    return `
        <div class="groups-form-section">
            <h2>${isEdit ? '✏️ Redigera veckomall: ' + escapeHtml(editWt.name) : '➕ Skapa ny veckomall'}</h2>
            <form id="week-template-form">
                ${isEdit ? `<input type="hidden" name="editWeekTemplateId" value="${escapeHtml(editId)}">` : ''}

                <div class="form-row">
                    <div class="form-group">
                        <label for="wtName">Mallnamn *</label>
                        <input type="text" name="wtName" id="wtName"
                               placeholder="T.ex. Standardvecka" required maxlength="100"
                               value="${isEdit ? escapeHtml(editWt.name) : ''}">
                    </div>
                    ${!isEdit ? `
                        <div class="form-group">
                            <label for="wtId">Mall-ID (auto om tomt)</label>
                            <input type="text" name="wtId" id="wtId"
                                   placeholder="T.ex. standard" maxlength="50">
                        </div>
                    ` : ''}
                </div>

                <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Bemanningsbehov per dag</h3>
                <p style="color: #666; font-size: 0.85rem; margin-bottom: 1rem;">
                    Lägg till pass-behov per dag. <strong>Min</strong> = vakans om under.
                    <strong>Önskat</strong> = målvärde.
                </p>

                <div id="wt-slots-container">
                    ${slotsHtml}
                </div>

                <div class="form-buttons" style="margin-top: 1.5rem;">
                    <button type="submit" class="btn btn-primary">
                        ${isEdit ? '💾 Spara ändringar' : '✓ Skapa veckomall'}
                    </button>
                    ${isEdit ? `
                        <button type="button" class="btn btn-secondary" data-action="cancel-edit-wt">
                            ✕ Avbryt
                        </button>
                    ` : ''}
                </div>
            </form>
        </div>
    `;
}

/* ============================================================
 * BLOCK 4 — DAG-SEKTION (en dag med slots)
 * ============================================================ */
function renderDaySection(dayOfWeek, existingSlots, groupShiftOptions) {
    let slotRows = '';

    if (existingSlots.length > 0) {
        slotRows = existingSlots.map((slot, idx) =>
            renderSlotRow(dayOfWeek, idx, slot, groupShiftOptions)
        ).join('');
    }

    return `
        <div class="wt-day-section" data-day="${dayOfWeek}">
            <div class="wt-day-header">
                <strong>${escapeHtml(DAY_NAMES[dayOfWeek])}</strong>
                <button type="button" class="btn btn-sm btn-secondary" data-action="add-slot" data-day="${dayOfWeek}">
                    + Lägg till pass
                </button>
            </div>
            <div class="wt-day-slots" data-day-slots="${dayOfWeek}">
                ${slotRows || '<p class="wt-empty-day">Inga pass denna dag.</p>'}
            </div>
        </div>
    `;
}

/* ============================================================
 * BLOCK 5 — SLOT-RAD (en rad i en dag)
 * ============================================================ */
function renderSlotRow(dayOfWeek, idx, slot, groupShiftOptions) {
    // Grupp-select
    const groupOptions = groupShiftOptions.map(g => {
        const selected = slot && slot.groupId === g.groupId ? 'selected' : '';
        return `<option value="${escapeHtml(g.groupId)}" ${selected}>${escapeHtml(g.groupName)}</option>`;
    }).join('');

    // Pass-select (alla passmallar, filtreras med JS vid grupbyte)
    let allShifts = new Map();
    groupShiftOptions.forEach(g => {
        g.shifts.forEach(s => {
            if (!allShifts.has(s.id)) allShifts.set(s.id, s);
        });
    });

    const shiftOptions = Array.from(allShifts.values()).map(s => {
        const selected = slot && slot.shiftTemplateId === s.id ? 'selected' : '';
        const timeStr = s.startTime && s.endTime ? ` (${s.startTime}–${s.endTime})` : '';
        return `<option value="${escapeHtml(s.id)}" ${selected}>${escapeHtml(s.name)}${escapeHtml(timeStr)}</option>`;
    }).join('');

    const countMin = slot ? (slot.countMin || 0) : 1;
    const count = slot ? (slot.count || 0) : 1;

    return `
        <div class="wt-slot-row" data-day="${dayOfWeek}" data-slot-idx="${idx}">
            <select name="slot-group-${dayOfWeek}-${idx}" class="wt-slot-group" data-day="${dayOfWeek}">
                <option value="">— Välj grupp —</option>
                ${groupOptions}
            </select>
            <select name="slot-shift-${dayOfWeek}-${idx}" class="wt-slot-shift" data-day="${dayOfWeek}">
                <option value="">— Välj pass —</option>
                ${shiftOptions}
            </select>
            <label class="wt-slot-label">Min:
                <input type="number" name="slot-min-${dayOfWeek}-${idx}" class="wt-slot-num"
                       min="0" max="50" value="${countMin}">
            </label>
            <label class="wt-slot-label">Önskat:
                <input type="number" name="slot-max-${dayOfWeek}-${idx}" class="wt-slot-num"
                       min="0" max="50" value="${count}">
            </label>
            <button type="button" class="btn-delete wt-slot-remove" data-action="remove-slot"
                    data-day="${dayOfWeek}" data-slot-idx="${idx}">🗑️</button>
        </div>
    `;
}

/* ============================================================
 * BLOCK 6 — MALL-LISTA (alla veckomallar)
 * ============================================================ */
function renderTemplateList(weekTemplates, groups, shiftTemplates, editId) {
    const wtArr = Object.values(weekTemplates);

    if (wtArr.length === 0) {
        return `
            <div class="groups-table-section">
                <h2>Skapade veckomallar (0)</h2>
                <div class="empty-state">Inga veckomallar skapade ännu. Använd formuläret ovan.</div>
            </div>
        `;
    }

    const cards = wtArr.map(wt => {
        const isBeingEdited = editId === wt.id;
        const slots = Array.isArray(wt.slots) ? wt.slots : [];

        // Sammanfattning per dag
        let daySummaries = '';
        for (let d = 0; d < 7; d++) {
            const daySlots = slots.filter(s => s.dayOfWeek === d);
            if (daySlots.length === 0) {
                daySummaries += `<div class="wt-card-day"><strong>${escapeHtml(DAY_SHORT[d])}</strong>: <em>—</em></div>`;
                continue;
            }
            const entries = daySlots.map(s => {
                const gName = groups[s.groupId]?.name || s.groupId;
                const stName = shiftTemplates[s.shiftTemplateId]?.name || s.shiftTemplateId;
                return `${escapeHtml(gName)}/${escapeHtml(stName)} ×${s.count}(min ${s.countMin})`;
            }).join(', ');
            daySummaries += `<div class="wt-card-day"><strong>${escapeHtml(DAY_SHORT[d])}</strong>: ${entries}</div>`;
        }

        const totalSlots = slots.reduce((sum, s) => sum + (s.count || 0), 0);
        const totalMin = slots.reduce((sum, s) => sum + (s.countMin || 0), 0);

        return `
            <div class="wt-card ${isBeingEdited ? 'wt-card-editing' : ''}">
                <div class="wt-card-header">
                    <h3>${escapeHtml(wt.name)}</h3>
                    <span class="wt-card-id">${escapeHtml(wt.id)}</span>
                    <span class="wt-card-stats">${slots.length} pass-regler, ${totalSlots} önskade (${totalMin} min)</span>
                </div>
                <div class="wt-card-body">
                    ${daySummaries}
                </div>
                <div class="wt-card-actions">
                    <button class="btn-edit" data-action="edit-wt" data-id="${escapeHtml(wt.id)}">✏️ Redigera</button>
                    <button class="btn-delete" data-action="delete-wt" data-id="${escapeHtml(wt.id)}">🗑️ Radera</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="groups-table-section">
            <h2>Skapade veckomallar (${wtArr.length})</h2>
            ${cards}
        </div>
    `;
}

/* ============================================================
 * BLOCK 7 — EVENT LISTENERS
 * ============================================================ */
function setupEventListeners(container, store, ctx, groups, shiftTemplates) {
    const groupShiftOptions = buildGroupShiftOptions(Object.values(groups), shiftTemplates);

    // Form submit
    const form = container.querySelector('#week-template-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmit(form, store, container, ctx);
        });
    }

    // Delegated click
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        try {
            if (action === 'add-slot') {
                const day = parseInt(btn.dataset.day, 10);
                addSlotRow(container, day, groupShiftOptions);
            } else if (action === 'remove-slot') {
                const row = btn.closest('.wt-slot-row');
                if (row) {
                    row.remove();
                    // Uppdatera "tom dag"-meddelande
                    const day = parseInt(btn.dataset.day, 10);
                    const slotsContainer = container.querySelector(`[data-day-slots="${day}"]`);
                    if (slotsContainer && slotsContainer.querySelectorAll('.wt-slot-row').length === 0) {
                        slotsContainer.innerHTML = '<p class="wt-empty-day">Inga pass denna dag.</p>';
                    }
                }
            } else if (action === 'edit-wt' && id) {
                ctx._editWeekTemplateId = id;
                renderWeekTemplates(container, ctx);
            } else if (action === 'delete-wt' && id) {
                handleDelete(id, store, container, ctx);
            } else if (action === 'cancel-edit-wt') {
                ctx._editWeekTemplateId = null;
                renderWeekTemplates(container, ctx);
            }
        } catch (err) {
            console.error('❌ WeekTemplates action fel:', err);
            showWarning('Ett fel uppstod: ' + (err.message || err));
        }
    });
}

/* ============================================================
 * BLOCK 8 — LÄGG TILL SLOT-RAD DYNAMISKT
 * ============================================================ */
function addSlotRow(container, dayOfWeek, groupShiftOptions) {
    const slotsContainer = container.querySelector(`[data-day-slots="${dayOfWeek}"]`);
    if (!slotsContainer) return;

    // Ta bort "inga pass"-meddelande
    const emptyMsg = slotsContainer.querySelector('.wt-empty-day');
    if (emptyMsg) emptyMsg.remove();

    // Räkna befintliga slot-rader för att ge unikt idx
    const existingRows = slotsContainer.querySelectorAll('.wt-slot-row');
    const nextIdx = existingRows.length;

    const html = renderSlotRow(dayOfWeek, nextIdx, null, groupShiftOptions);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newRow = temp.firstElementChild;
    slotsContainer.appendChild(newRow);
}

/* ============================================================
 * BLOCK 9 — FORM SUBMIT (Create / Update)
 * ============================================================ */
function handleFormSubmit(form, store, container, ctx) {
    try {
        const fd = new FormData(form);
        const editId = fd.get('editWeekTemplateId') || null;
        const isEdit = !!editId;

        const name = (fd.get('wtName') || '').trim();
        if (!name) {
            showWarning('Mallnamn är obligatoriskt.');
            return;
        }

        let id = editId;
        if (!isEdit) {
            id = (fd.get('wtId') || '').trim();
            if (!id) {
                id = name
                    .toLowerCase()
                    .replace(/[åä]/g, 'a')
                    .replace(/[ö]/g, 'o')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 40);
                if (!id) id = 'wt-' + Date.now();
            }

            const state = store.getState();
            if (state.weekTemplates && state.weekTemplates[id]) {
                showWarning(`Mall-ID "${id}" finns redan. Välj ett annat.`);
                return;
            }
        }

        // Samla alla slots från DOM
        const slots = [];
        const slotRows = form.querySelectorAll('.wt-slot-row');

        slotRows.forEach(row => {
            const dayOfWeek = parseInt(row.dataset.day, 10);
            const groupSelect = row.querySelector('.wt-slot-group');
            const shiftSelect = row.querySelector('.wt-slot-shift');
            const minInput = row.querySelector('input[name^="slot-min-"]');
            const maxInput = row.querySelector('input[name^="slot-max-"]');

            const groupId = groupSelect?.value || '';
            const shiftTemplateId = shiftSelect?.value || '';
            const countMin = parseInt(minInput?.value || '0', 10);
            const count = parseInt(maxInput?.value || '0', 10);

            if (!groupId || !shiftTemplateId) return; // hoppa över tomma

            if (countMin > count) {
                showWarning(`${DAY_NAMES[dayOfWeek]}: Min (${countMin}) kan inte vara större än Önskat (${count}).`);
                return;
            }

            slots.push({ dayOfWeek, groupId, shiftTemplateId, countMin, count });
        });

        // Bygg weekTemplate-objekt
        const wtObj = { id, name, slots };

        store.update((s) => {
            if (!s.weekTemplates || typeof s.weekTemplates !== 'object') s.weekTemplates = {};
            s.weekTemplates[id] = wtObj;
        });

        showSuccess(isEdit ? `Veckomall "${name}" uppdaterad!` : `Veckomall "${name}" skapad!`);
        ctx._editWeekTemplateId = null;
        renderWeekTemplates(container, ctx);

    } catch (err) {
        console.error('❌ handleFormSubmit fel:', err);
        showWarning('Kunde inte spara: ' + (err.message || err));
    }
}

/* ============================================================
 * BLOCK 10 — DELETE
 * ============================================================ */
function handleDelete(id, store, container, ctx) {
    try {
        const state = store.getState();
        const wt = state.weekTemplates?.[id];
        if (!wt) {
            showWarning('Veckomallen hittades inte.');
            return;
        }

        // Kolla om mallen används i calendarWeeks
        const calWeeks = state.calendarWeeks || {};
        const usedIn = Object.keys(calWeeks).filter(wk => calWeeks[wk] === id);

        let confirmMsg = `Radera veckomall "${wt.name}"?`;
        if (usedIn.length > 0) {
            confirmMsg += `\n\n⚠️ Denna mall används i ${usedIn.length} kalenderveckor: ${usedIn.slice(0, 5).join(', ')}${usedIn.length > 5 ? '...' : ''}.\nDessa veckor kommer bli utan mall.`;
        }

        const confirmed = confirm(confirmMsg);
        if (!confirmed) return;

        store.update((s) => {
            if (s.weekTemplates && s.weekTemplates[id]) {
                delete s.weekTemplates[id];
            }
            // Rensa calendarWeeks som pekar på denna mall
            if (s.calendarWeeks && typeof s.calendarWeeks === 'object') {
                Object.keys(s.calendarWeeks).forEach(wk => {
                    if (s.calendarWeeks[wk] === id) {
                        delete s.calendarWeeks[wk];
                    }
                });
            }
        });

        showSuccess(`Veckomall "${wt.name}" raderad.`);
        ctx._editWeekTemplateId = null;
        renderWeekTemplates(container, ctx);

    } catch (err) {
        console.error('❌ handleDelete fel:', err);
        showWarning('Kunde inte radera: ' + (err.message || err));
    }
}

/* ============================================================
 * BLOCK 11 — HELPERS
 * ============================================================ */

/** Bygg grupp→pass lookup för select-menyer */
function buildGroupShiftOptions(groupsArr, shiftTemplates) {
    return groupsArr
        .filter(g => g.id !== 'SYSTEM_ADMIN') // Dölj systemgrupper
        .map(g => {
            const stIds = Array.isArray(g.shiftTemplateIds) ? g.shiftTemplateIds : [];
            const shifts = stIds
                .map(stId => shiftTemplates[stId])
                .filter(Boolean)
                .map(st => ({
                    id: st.id,
                    name: st.name,
                    startTime: st.startTime,
                    endTime: st.endTime,
                }));
            return {
                groupId: g.id,
                groupName: g.name,
                groupColor: g.color,
                shifts,
            };
        })
        .filter(g => g.shifts.length > 0); // Dölj grupper utan kopplade pass
}

const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,20})$/;

function sanitizeColor(input) {
    if (typeof input !== 'string') return '#777';
    const trimmed = input.trim();
    return SAFE_COLOR_RE.test(trimmed) ? trimmed : '#777';
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
