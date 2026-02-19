/*
 * AO-05 — Shifts View (ShiftTemplates CRUD)
 * FIL: src/views/shifts.js (HEL FIL)
 *
 * Hanterar state.shiftTemplates (SPEC-datamodell) med:
 * - Skapa / Redigera / Radera passmallar
 * - Fält: name, startTime, endTime, breakStart, breakEnd, color, costCenter, workplace
 * - Gruppkoppling via groups[gid].shiftTemplateIds (checkboxar)
 * - Nattpass tillåtet (start > end → korsar midnatt)
 *
 * Store shape:
 *   state.shiftTemplates = { [id]: { id, name, startTime, endTime, breakStart, breakEnd, color, costCenter, workplace } }
 *   state.groups         = { [id]: { id, name, color, shiftTemplateIds: [...] } }
 */

import { showSuccess, showWarning } from '../ui.js';

/* ============================================================
 * BLOCK 1 — MAIN RENDER
 * ============================================================ */
export function renderShifts(container, ctx) {
    if (!container) {
        console.error('❌ renderShifts: container saknas');
        return;
    }

    try {
        const store = ctx?.store;
        if (!store) {
            container.innerHTML = `
                <div class="groups-container">
                    <div class="groups-content">
                        <h1>❌ Fel</h1>
                        <p class="empty-state">Store saknas i context. Kan inte visa grundpass.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (!ctx || typeof ctx !== 'object') ctx = {};

        const state = store.getState();
        const shiftTemplates = state.shiftTemplates && typeof state.shiftTemplates === 'object' ? state.shiftTemplates : {};
        const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};

        const editId = ctx._editShiftTemplateId || null;
        const editSt = editId ? shiftTemplates[editId] : null;
        const isEdit = !!editSt;

        const formHtml = renderForm(editId, editSt, isEdit, groups);
        const tableHtml = renderTable(shiftTemplates, groups, editId);

        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>📋 Grundpass (Passmallar)</h1>
                    <p class="groups-tagline">Skapa och hantera passmallar som används i veckomallar och schemaläggning.</p>
                    ${formHtml}
                    ${tableHtml}
                </div>
            </div>
        `;

        setupEventListeners(container, store, ctx);

    } catch (err) {
        console.error('❌ renderShifts kraschade:', err);
        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>❌ Fel</h1>
                    <p class="empty-state">Kunde inte rendera grundpass: ${escapeHtml(String(err.message || err))}</p>
                </div>
            </div>
        `;
    }
}

/* ============================================================
 * BLOCK 2 — FORMULÄR
 * ============================================================ */
function renderForm(editId, editSt, isEdit, groups) {
    const groupsArr = Object.values(groups);

    // Vilka grupper har denna shiftTemplate kopplad?
    const linkedGroupIds = new Set();
    if (isEdit) {
        groupsArr.forEach(g => {
            if (Array.isArray(g.shiftTemplateIds) && g.shiftTemplateIds.includes(editId)) {
                linkedGroupIds.add(g.id);
            }
        });
    }

    // Gruppcheckboxar
    let groupCheckboxes = '';
    if (groupsArr.length > 0) {
        const boxes = groupsArr.map(g => {
            const checked = linkedGroupIds.has(g.id) ? 'checked' : '';
            return `
                <label class="shift-group-checkbox">
                    <input type="checkbox" name="linkedGroups" value="${escapeHtml(g.id)}" ${checked}>
                    <span class="color-badge-sm" style="background: ${sanitizeColor(g.color)}"></span>
                    ${escapeHtml(g.name)}
                </label>
            `;
        }).join('');

        groupCheckboxes = `
            <div class="form-group form-group-full">
                <label>Koppla till grupper</label>
                <div class="shift-group-checkboxes">
                    ${boxes}
                </div>
            </div>
        `;
    } else {
        groupCheckboxes = `
            <div class="form-group form-group-full">
                <label>Koppla till grupper</label>
                <p style="color:#999; font-size:0.85rem; margin:0;">
                    Inga grupper finns. Skapa grupper under "Grupper"-sidan först.
                </p>
            </div>
        `;
    }

    return `
        <div class="groups-form-section">
            <h2>${isEdit ? '✏️ Redigera passmall: ' + escapeHtml(editSt.name) : '➕ Skapa ny passmall'}</h2>
            <form id="shift-template-form">
                ${isEdit ? `<input type="hidden" name="editShiftTemplateId" value="${escapeHtml(editId)}">` : ''}

                <div class="form-row">
                    <div class="form-group">
                        <label for="stName">Namn *</label>
                        <input type="text" name="stName" id="stName"
                               placeholder="T.ex. Lunchpass Kök" required maxlength="100"
                               value="${isEdit ? escapeHtml(editSt.name) : ''}">
                    </div>
                    ${isEdit ? `
                        <div class="form-group">
                            <label>Pass-ID</label>
                            <input type="text" value="${escapeHtml(editId)}" disabled
                                   style="background: #eee; cursor: not-allowed;">
                        </div>
                    ` : `
                        <div class="form-group">
                            <label for="stId">Pass-ID (auto om tomt)</label>
                            <input type="text" name="stId" id="stId"
                                   placeholder="T.ex. lunch-kok" maxlength="50">
                        </div>
                    `}
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="stStart">Starttid</label>
                        <input type="time" name="stStart" id="stStart"
                               value="${isEdit && editSt.startTime ? escapeHtml(editSt.startTime) : ''}">
                    </div>
                    <div class="form-group">
                        <label for="stEnd">Sluttid</label>
                        <input type="time" name="stEnd" id="stEnd"
                               value="${isEdit && editSt.endTime ? escapeHtml(editSt.endTime) : ''}">
                    </div>
                    <div class="form-group">
                        <label for="stBreakStart">Rast start</label>
                        <input type="time" name="stBreakStart" id="stBreakStart"
                               value="${isEdit && editSt.breakStart ? escapeHtml(editSt.breakStart) : ''}">
                    </div>
                    <div class="form-group">
                        <label for="stBreakEnd">Rast slut</label>
                        <input type="time" name="stBreakEnd" id="stBreakEnd"
                               value="${isEdit && editSt.breakEnd ? escapeHtml(editSt.breakEnd) : ''}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="stColor">Färg</label>
                        <input type="color" name="stColor" id="stColor"
                               value="${isEdit ? escapeHtml(editSt.color || '#667eea') : '#667eea'}">
                    </div>
                    <div class="form-group">
                        <label for="stCostCenter">Kostnadsställe</label>
                        <input type="text" name="stCostCenter" id="stCostCenter"
                               placeholder="T.ex. Kök" maxlength="100"
                               value="${isEdit ? escapeHtml(editSt.costCenter || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label for="stWorkplace">Arbetsplats</label>
                        <input type="text" name="stWorkplace" id="stWorkplace"
                               placeholder="T.ex. Restaurang A" maxlength="100"
                               value="${isEdit ? escapeHtml(editSt.workplace || '') : ''}">
                    </div>
                </div>

                ${groupCheckboxes}

                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary">
                        ${isEdit ? '💾 Spara ändringar' : '✓ Skapa passmall'}
                    </button>
                    ${isEdit ? `
                        <button type="button" class="btn btn-secondary" data-action="cancel-edit-st">
                            ✕ Avbryt
                        </button>
                    ` : ''}
                </div>
                ${!isEdit ? `
                    <p style="color:#999; font-size:0.85rem; margin-top:0.5rem;">
                        💡 Lämna tider tomma för Flex-pass. Start > Slut = nattpass (korsar midnatt).
                    </p>
                ` : ''}
            </form>
        </div>
    `;
}

/* ============================================================
 * BLOCK 3 — TABELL
 * ============================================================ */
function renderTable(shiftTemplates, groups, editId) {
    const stArr = Object.values(shiftTemplates);

    if (stArr.length === 0) {
        return `
            <div class="groups-table-section">
                <h2>Registrerade passmallar (0)</h2>
                <div class="empty-state">Inga passmallar skapade ännu. Använd formuläret ovan.</div>
            </div>
        `;
    }

    const groupsArr = Object.values(groups);

    const rows = stArr.map(st => {
        const timeStr = (st.startTime && st.endTime)
            ? `${st.startTime} – ${st.endTime}`
            : '— (Flex)';

        const isNight = st.startTime && st.endTime && st.startTime > st.endTime;
        const nightBadge = isNight ? ' <span class="badge badge-night">🌙 Natt</span>' : '';

        const breakStr = (st.breakStart && st.breakEnd)
            ? `${st.breakStart} – ${st.breakEnd}`
            : '—';

        // Hitta kopplade grupper
        const linked = groupsArr
            .filter(g => Array.isArray(g.shiftTemplateIds) && g.shiftTemplateIds.includes(st.id))
            .map(g => escapeHtml(g.name))
            .join(', ') || '—';

        const isBeingEdited = editId === st.id;

        return `
            <tr ${isBeingEdited ? 'style="background: #fff3cd;"' : ''}>
                <td>
                    <span class="color-badge" style="background: ${sanitizeColor(st.color)}"></span>
                </td>
                <td><strong>${escapeHtml(st.name)}</strong></td>
                <td>${escapeHtml(timeStr)}${nightBadge}</td>
                <td>${escapeHtml(breakStr)}</td>
                <td>${escapeHtml(st.costCenter || '—')}</td>
                <td>${escapeHtml(st.workplace || '—')}</td>
                <td>${linked}</td>
                <td class="groups-table-actions">
                    <button class="btn-edit" data-action="edit-st" data-id="${escapeHtml(st.id)}">
                        ✏️ Redigera
                    </button>
                    <button class="btn-delete" data-action="delete-st" data-id="${escapeHtml(st.id)}">
                        🗑️ Radera
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="groups-table-section">
            <h2>Registrerade passmallar (${stArr.length})</h2>
            <div class="groups-table-wrapper">
                <table class="groups-table">
                    <thead>
                        <tr>
                            <th>Färg</th>
                            <th>Namn</th>
                            <th>Tid</th>
                            <th>Rast</th>
                            <th>Kostnadsställe</th>
                            <th>Arbetsplats</th>
                            <th>Grupper</th>
                            <th>Åtgärd</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/* ============================================================
 * BLOCK 4 — EVENT LISTENERS
 * ============================================================ */
function setupEventListeners(container, store, ctx) {
    // Form submit
    const form = container.querySelector('#shift-template-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmit(form, store, container, ctx);
        });
    }

    // Delegated click listeners
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        try {
            if (action === 'edit-st' && id) {
                ctx._editShiftTemplateId = id;
                renderShifts(container, ctx);
            } else if (action === 'delete-st' && id) {
                handleDelete(id, store, container, ctx);
            } else if (action === 'cancel-edit-st') {
                ctx._editShiftTemplateId = null;
                renderShifts(container, ctx);
            }
        } catch (err) {
            console.error('❌ Shifts action fel:', err);
            showWarning('Ett fel uppstod: ' + (err.message || err));
        }
    });
}

/* ============================================================
 * BLOCK 5 — FORM SUBMIT (Create / Update)
 * ============================================================ */
function handleFormSubmit(form, store, container, ctx) {
    try {
        const fd = new FormData(form);
        const editId = fd.get('editShiftTemplateId') || null;
        const isEdit = !!editId;

        // Hämta fält
        const name = (fd.get('stName') || '').trim();
        if (!name) {
            showWarning('Namn är obligatoriskt.');
            return;
        }

        let id = editId;
        if (!isEdit) {
            id = (fd.get('stId') || '').trim();
            if (!id) {
                // Auto-generera ID
                id = name
                    .toLowerCase()
                    .replace(/[åä]/g, 'a')
                    .replace(/[ö]/g, 'o')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 40);
                if (!id) id = 'st-' + Date.now();
            }

            // Kontrollera att ID inte redan finns
            const state = store.getState();
            if (state.shiftTemplates && state.shiftTemplates[id]) {
                showWarning(`Pass-ID "${id}" finns redan. Välj ett annat.`);
                return;
            }
        }

        const startTime = fd.get('stStart') || null;
        const endTime = fd.get('stEnd') || null;
        const breakStart = fd.get('stBreakStart') || null;
        const breakEnd = fd.get('stBreakEnd') || null;
        const color = fd.get('stColor') || '#667eea';
        const costCenter = (fd.get('stCostCenter') || '').trim() || undefined;
        const workplace = (fd.get('stWorkplace') || '').trim() || undefined;

        // Validering: om start eller end finns, båda ska finnas
        if ((startTime && !endTime) || (!startTime && endTime)) {
            showWarning('Fyll i både starttid och sluttid, eller lämna båda tomma för Flex.');
            return;
        }
        if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
            showWarning('Fyll i både rast-start och rast-slut, eller lämna båda tomma.');
            return;
        }

        // Hämta kopplade grupper
        const linkedGroupIds = fd.getAll('linkedGroups');

        // Bygg shiftTemplate-objekt
        const stObj = {
            id,
            name,
            startTime,
            endTime,
            breakStart,
            breakEnd,
            color,
        };
        if (costCenter) stObj.costCenter = costCenter;
        if (workplace) stObj.workplace = workplace;

        // Spara till store
        store.update((s) => {
            // Sätt shiftTemplate
            if (!s.shiftTemplates || typeof s.shiftTemplates !== 'object') s.shiftTemplates = {};
            s.shiftTemplates[id] = stObj;

            // Synka groups.shiftTemplateIds
            if (s.groups && typeof s.groups === 'object') {
                Object.values(s.groups).forEach(g => {
                    if (!Array.isArray(g.shiftTemplateIds)) g.shiftTemplateIds = [];

                    const shouldBeLinked = linkedGroupIds.includes(g.id);
                    const isLinked = g.shiftTemplateIds.includes(id);

                    if (shouldBeLinked && !isLinked) {
                        g.shiftTemplateIds.push(id);
                    } else if (!shouldBeLinked && isLinked) {
                        g.shiftTemplateIds = g.shiftTemplateIds.filter(x => x !== id);
                    }
                });
            }
        });

        showSuccess(isEdit ? `Passmall "${name}" uppdaterad!` : `Passmall "${name}" skapad!`);
        ctx._editShiftTemplateId = null;
        renderShifts(container, ctx);

    } catch (err) {
        console.error('❌ handleFormSubmit fel:', err);
        showWarning('Kunde inte spara: ' + (err.message || err));
    }
}

/* ============================================================
 * BLOCK 6 — DELETE
 * ============================================================ */
function handleDelete(id, store, container, ctx) {
    try {
        const state = store.getState();
        const st = state.shiftTemplates?.[id];
        if (!st) {
            showWarning('Passmallen hittades inte.');
            return;
        }

        const confirmed = confirm(`Radera passmall "${st.name}"?\n\nDetta tar även bort kopplingen från alla grupper.`);
        if (!confirmed) return;

        store.update((s) => {
            // Ta bort från shiftTemplates
            if (s.shiftTemplates && s.shiftTemplates[id]) {
                delete s.shiftTemplates[id];
            }

            // Rensa från groups.shiftTemplateIds
            if (s.groups && typeof s.groups === 'object') {
                Object.values(s.groups).forEach(g => {
                    if (Array.isArray(g.shiftTemplateIds)) {
                        g.shiftTemplateIds = g.shiftTemplateIds.filter(x => x !== id);
                    }
                });
            }
        });

        showSuccess(`Passmall "${st.name}" raderad.`);
        ctx._editShiftTemplateId = null;
        renderShifts(container, ctx);

    } catch (err) {
        console.error('❌ handleDelete fel:', err);
        showWarning('Kunde inte radera: ' + (err.message || err));
    }
}

/* ============================================================
 * BLOCK 7 — HELPERS
 * ============================================================ */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|hsl\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)|hsla\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+\s*\)|[a-zA-Z]{1,20})$/;

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
