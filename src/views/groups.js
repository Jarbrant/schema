/*
 * AO-03 + AO-04 + EDIT — Groups View
 * Formulär växlar mellan "Skapa" och "Redigera" läge via ctx.editGroupId / ctx.editShiftId
 *
 * Store shape:
 *   state.groups      = Object/Map  { [id]: { id, name, color, textColor } }
 *   state.shifts      = Object/Map  { [id]: { id, name, shortName, startTime, endTime, breakStart, breakEnd, color, description } }
 *   state.groupShifts = Object/Map  { [groupId]: [shiftId, ...] }
 *   state.people      = Array       [{ id, firstName, lastName, groups/groupIds: [groupId, ...], ... }]
 */

import { setupGroupsEventListeners } from '../modules/groups-form.js';

/* ============================================================
 * MAIN RENDER
 * ============================================================ */
export function renderGroups(container, ctx) {
    if (!container) {
        console.error('❌ renderGroups: container saknas');
        return;
    }

    try {
        const store = ctx?.store;
        if (!store) {
            container.innerHTML = `
                <div class="groups-container">
                    <div class="groups-content">
                        <h1>❌ Fel</h1>
                        <p class="empty-state">Store saknas i context. Kan inte visa grupper.</p>
                    </div>
                </div>
            `;
            return;
        }

        const state = store.getState();

        const groups      = state.groups      && typeof state.groups === 'object'      ? state.groups      : {};
        const shifts      = state.shifts      && typeof state.shifts === 'object'      ? state.shifts      : {};
        const groupShifts = state.groupShifts && typeof state.groupShifts === 'object' ? state.groupShifts : {};
        const people      = Array.isArray(state.people) ? state.people : [];

        if (!ctx || typeof ctx !== 'object') {
            ctx = {};
        }

        const activeTab = ctx.groupsTab || 'groups';

        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>👥 Grupper & Grundpass</h1>
                    <p class="groups-tagline">Hantera arbetsgrupper och kopplade grundpass.</p>

                    <div class="groups-tabs">
                        <button class="groups-tab ${activeTab === 'groups' ? 'active' : ''}"
                                data-tab="groups">
                            👥 Grupper
                        </button>
                        <button class="groups-tab ${activeTab === 'shifts' ? 'active' : ''}"
                                data-tab="shifts">
                            📋 Grundpass
                        </button>
                    </div>

                    <div id="groups-tab-content">
                        ${activeTab === 'groups'
                            ? renderGroupsTab(groups, groupShifts, shifts, people, ctx)
                            : renderShiftsTab(shifts, groupShifts, groups, ctx)}
                    </div>
                </div>
            </div>
        `;

        setupTabListeners(container, ctx);

        const reRender = () => renderGroups(container, ctx);
        setupGroupsEventListeners(container, store, ctx, reRender);

    } catch (err) {
        console.error('❌ renderGroups kraschade:', err);
        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>❌ Fel</h1>
                    <p class="empty-state">Kunde inte rendera grupper: ${escapeHtml(String(err.message || err))}</p>
                </div>
            </div>
        `;
    }
}

/* ============================================================
 * TAB: Grupper
 * ============================================================ */
function renderGroupsTab(groups, groupShifts, shifts, people, ctx) {
    const groupsArr = Object.values(groups);
    const editId = ctx?.editGroupId || null;
    const editGroup = editId ? groups[editId] : null;
    const isEdit = !!editGroup;

    // FORMULÄR
    const formHtml = `
        <div class="groups-form-section">
            <h2>${isEdit ? '✏️ Redigera grupp: ' + escapeHtml(editGroup.name) : '➕ Skapa ny grupp'}</h2>
            <form id="group-form">
                ${isEdit ? `<input type="hidden" name="editGroupId" value="${escapeHtml(editId)}">` : ''}
                <div class="form-row">
                    <div class="form-group">
                        <label for="groupName">Gruppnamn *</label>
                        <input type="text" name="groupName" id="groupName"
                               placeholder="T.ex. Kockar" required maxlength="100"
                               value="${isEdit ? escapeHtml(editGroup.name) : ''}">
                    </div>
                    ${isEdit ? `
                        <div class="form-group">
                            <label>Grupp-ID</label>
                            <input type="text" value="${escapeHtml(editId)}" disabled
                                   style="background: #eee; cursor: not-allowed;">
                        </div>
                    ` : `
                        <div class="form-group">
                            <label for="groupId">Grupp-ID (auto om tomt)</label>
                            <input type="text" name="groupId" id="groupId"
                                   placeholder="T.ex. COOKS" maxlength="50">
                        </div>
                    `}
                    <div class="form-group">
                        <label for="groupColor">Färg</label>
                        <input type="color" name="groupColor" id="groupColor"
                               value="${isEdit ? escapeHtml(editGroup.color || '#667eea') : '#667eea'}">
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary">
                        ${isEdit ? '💾 Spara ändringar' : '✓ Skapa grupp'}
                    </button>
                    ${isEdit ? `
                        <button type="button" class="btn btn-secondary" data-action="cancel-edit">
                            ✕ Avbryt
                        </button>
                    ` : ''}
                </div>
            </form>
        </div>
    `;

    // TABELL
    let tableHtml = '';
    if (groupsArr.length === 0) {
        tableHtml = `<div class="empty-state">Inga grupper hittades.</div>`;
    } else {
        const rows = groupsArr.map(g => {
            const memberCount = people.filter(p => {
                const pGroups = Array.isArray(p.groups) ? p.groups
                              : Array.isArray(p.groupIds) ? p.groupIds
                              : [];
                return pGroups.includes(g.id);
            }).length;

            const linkedShiftIds = Array.isArray(groupShifts[g.id]) ? groupShifts[g.id] : [];
            const linkedShiftNames = linkedShiftIds
                .map(sid => shifts[sid]?.name || sid)
                .join(', ') || '—';

            const isBeingEdited = editId === g.id;

            return `
                <tr ${isBeingEdited ? 'style="background: #fff3cd;"' : ''}>
                    <td>
                        <span class="color-badge" style="background: ${sanitizeColor(g.color)}"></span>
                    </td>
                    <td><strong>${escapeHtml(g.name)}</strong></td>
                    <td>${escapeHtml(g.id)}</td>
                    <td>${memberCount}</td>
                    <td>${escapeHtml(linkedShiftNames)}</td>
                    <td class="groups-table-actions">
                        <button class="btn-edit" data-action="edit-group" data-id="${escapeHtml(g.id)}">
                            ✏️ Redigera
                        </button>
                        <button class="btn-delete" data-action="delete-group" data-id="${escapeHtml(g.id)}">
                            🗑️ Radera
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tableHtml = `
            <div class="groups-table-section">
                <h2>Registrerade grupper (${groupsArr.length})</h2>
                <div class="groups-table-wrapper">
                    <table class="groups-table">
                        <thead>
                            <tr>
                                <th>Färg</th>
                                <th>Namn</th>
                                <th>ID</th>
                                <th>Medlemmar</th>
                                <th>Kopplade pass</th>
                                <th>Åtgärd</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return formHtml + tableHtml;
}

/* ============================================================
 * TAB: Grundpass (Shifts)
 * ============================================================ */
function renderShiftsTab(shifts, groupShifts, groups, ctx) {
    const shiftsArr = Object.values(shifts);
    const editId = ctx?.editShiftId || null;
    const editShift = editId ? shifts[editId] : null;
    const isEdit = !!editShift;

    // FORMULÄR
    const formHtml = `
        <div class="groups-form-section">
            <h2>${isEdit ? '✏️ Redigera grundpass: ' + escapeHtml(editShift.name) : '➕ Skapa nytt grundpass'}</h2>
            <form id="shift-form">
                ${isEdit ? `<input type="hidden" name="editShiftId" value="${escapeHtml(editId)}">` : ''}
                <div class="form-row">
                    <div class="form-group">
                        <label for="shiftName">Pass-namn *</label>
                        <input type="text" name="shiftName" id="shiftName"
                               placeholder="T.ex. Morgon" required maxlength="100"
                               value="${isEdit ? escapeHtml(editShift.name) : ''}">
                    </div>
                    ${isEdit ? `
                        <div class="form-group">
                            <label>Pass-ID</label>
                            <input type="text" value="${escapeHtml(editId)}" disabled
                                   style="background: #eee; cursor: not-allowed;">
                        </div>
                    ` : `
                        <div class="form-group">
                            <label for="shiftId">Pass-ID (auto om tomt)</label>
                            <input type="text" name="shiftId" id="shiftId"
                                   placeholder="T.ex. MORNING" maxlength="50">
                        </div>
                    `}
                    <div class="form-group">
                        <label for="shiftShortName">Kortnamn</label>
                        <input type="text" name="shiftShortName" id="shiftShortName"
                               placeholder="T.ex. M" maxlength="5"
                               value="${isEdit ? escapeHtml(editShift.shortName || '') : ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="shiftStart">Starttid</label>
                        <input type="time" name="shiftStart" id="shiftStart"
                               value="${isEdit && editShift.startTime ? escapeHtml(editShift.startTime) : ''}">
                    </div>
                    <div class="form-group">
                        <label for="shiftEnd">Sluttid</label>
                        <input type="time" name="shiftEnd" id="shiftEnd"
                               value="${isEdit && editShift.endTime ? escapeHtml(editShift.endTime) : ''}">
                    </div>
                    <div class="form-group">
                        <label for="shiftBreakStart">Rast start</label>
                        <input type="time" name="shiftBreakStart" id="shiftBreakStart"
                               value="${isEdit && editShift.breakStart ? escapeHtml(editShift.breakStart) : ''}">
                    </div>
                    <div class="form-group">
                        <label for="shiftBreakEnd">Rast slut</label>
                        <input type="time" name="shiftBreakEnd" id="shiftBreakEnd"
                               value="${isEdit && editShift.breakEnd ? escapeHtml(editShift.breakEnd) : ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="shiftColor">Färg</label>
                        <input type="color" name="shiftColor" id="shiftColor"
                               value="${isEdit ? escapeHtml(editShift.color || '#FFD93D') : '#FFD93D'}">
                    </div>
                    <div class="form-group">
                        <label for="shiftDescription">Beskrivning</label>
                        <input type="text" name="shiftDescription" id="shiftDescription"
                               placeholder="T.ex. Dagtid 07:00–16:00" maxlength="200"
                               value="${isEdit ? escapeHtml(editShift.description || '') : ''}">
                    </div>
                </div>
                <div class="form-buttons">
                    <button type="submit" class="btn btn-primary">
                        ${isEdit ? '💾 Spara ändringar' : '✓ Skapa grundpass'}
                    </button>
                    ${isEdit ? `
                        <button type="button" class="btn btn-secondary" data-action="cancel-edit">
                            ✕ Avbryt
                        </button>
                    ` : ''}
                </div>
                ${!isEdit ? `
                    <p style="color:#999; font-size:0.85rem; margin-top:0.5rem;">
                        💡 Lämna tider tomma för att skapa ett Flex-pass.
                    </p>
                ` : ''}
            </form>
        </div>
    `;

    // TABELL
    let tableHtml = '';
    if (shiftsArr.length === 0) {
        tableHtml = `<div class="empty-state">Inga grundpass hittades.</div>`;
    } else {
        const rows = shiftsArr.map(s => {
            const timeStr = (s.startTime && s.endTime)
                ? `${s.startTime} – ${s.endTime}`
                : '— (Flex)';

            const breakStr = (s.breakStart && s.breakEnd)
                ? `${s.breakStart} – ${s.breakEnd}`
                : '—';

            const linkedGroups = Object.keys(groupShifts)
                .filter(gid => {
                    const arr = groupShifts[gid];
                    return Array.isArray(arr) && arr.includes(s.id);
                })
                .map(gid => groups[gid]?.name || gid)
                .join(', ') || '—';

            const isBeingEdited = editId === s.id;

            return `
                <tr ${isBeingEdited ? 'style="background: #fff3cd;"' : ''}>
                    <td>
                        <span class="color-badge" style="background: ${sanitizeColor(s.color)}"></span>
                    </td>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td>${escapeHtml(s.shortName || '—')}</td>
                    <td>${escapeHtml(timeStr)}</td>
                    <td>${escapeHtml(breakStr)}</td>
                    <td>${escapeHtml(linkedGroups)}</td>
                    <td>${escapeHtml(s.description || '—')}</td>
                    <td class="groups-table-actions">
                        <button class="btn-edit" data-action="edit-shift" data-id="${escapeHtml(s.id)}">
                            ✏️ Redigera
                        </button>
                        <button class="btn-delete" data-action="delete-shift" data-id="${escapeHtml(s.id)}">
                            🗑️ Radera
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tableHtml = `
            <div class="groups-table-section">
                <h2>Registrerade grundpass (${shiftsArr.length})</h2>
                <div class="groups-table-wrapper">
                    <table class="groups-table">
                        <thead>
                            <tr>
                                <th>Färg</th>
                                <th>Namn</th>
                                <th>Kort</th>
                                <th>Tid</th>
                                <th>Rast</th>
                                <th>Grupper</th>
                                <th>Beskrivning</th>
                                <th>Åtgärd</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return formHtml + tableHtml;
}

/* ============================================================
 * TAB LISTENERS
 * ============================================================ */
function setupTabListeners(container, ctx) {
    if (!ctx || typeof ctx !== 'object') ctx = {};

    const tabs = container.querySelectorAll('.groups-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            try {
                ctx.groupsTab = tab.dataset.tab;
                ctx.editGroupId = null;
                ctx.editShiftId = null;
                renderGroups(container, ctx);
            } catch (err) {
                console.error('❌ Tab-switch fel:', err);
            }
        });
    });
}

/* ============================================================
 * HELPERS
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
