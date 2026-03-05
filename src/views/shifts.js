/*
 * AO-05 — Shifts View (READONLY + SYNC)
 * FIL: src/views/shifts.js
 *
 * ÄNDRING (Alt A — konsolidering):
 *   Denna vy visar grundpass från state.shifts (samma som Grupper-fliken använder).
 *   All CRUD (skapa/redigera/radera) görs i Grupper → Grundpass-fliken.
 *   Vyn synkar även state.shifts → state.shiftTemplates så att veckomallar
 *   och kalender fortsätter fungera.
 *
 * Store shape (läser):
 *   state.shifts      = { [id]: { id, name, shortName, startTime, endTime, breakStart, breakEnd, color, description } }
 *   state.groups      = { [id]: { id, name, color, ... } }
 *   state.groupShifts = { [groupId]: [shiftId, ...] }
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
        const shifts = state.shifts && typeof state.shifts === 'object' ? state.shifts : {};
        const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};
        const groupShifts = state.groupShifts && typeof state.groupShifts === 'object' ? state.groupShifts : {};

        // SYNC: Kopiera shifts → shiftTemplates så veckomallar + kalender fungerar
        syncShiftsToTemplates(store, shifts);

        const tableHtml = renderTable(shifts, groups, groupShifts);

        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>📋 Grundpass — Översikt</h1>
                    <p class="groups-tagline">Alla grundpass som används i schemat. Skapa och redigera pass under <a href="#/groups">👥 Grupper → Grundpass-fliken</a>.</p>

                    <div class="groups-form-section" style="background: #e8f4fd; border-left: 4px solid #2196F3; padding: 1rem 1.5rem;">
                        <p style="margin: 0; color: #1565C0;">
                            💡 <strong>Tips:</strong> Gå till <a href="#/groups" style="color: #1565C0; text-decoration: underline;">Grupper → Grundpass</a> för att skapa, redigera eller radera pass.
                            Alla ändringar synkas automatiskt hit.
                        </p>
                    </div>

                    ${tableHtml}
                </div>
            </div>
        `;

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
 * BLOCK 2 — SYNC shifts → shiftTemplates
 *
 * Veckomallar (week-templates.js) och kalender (calendar.js) läser
 * state.shiftTemplates. Vi synkar state.shifts dit så allt fungerar
 * med EN källa (state.shifts).
 * ============================================================ */
function syncShiftsToTemplates(store, shifts) {
    try {
        const state = store.getState();
        const existing = state.shiftTemplates && typeof state.shiftTemplates === 'object'
            ? state.shiftTemplates : {};

        // Kolla om synk behövs (enkel jämförelse)
        const shiftIds = Object.keys(shifts);
        const templateIds = Object.keys(existing);
        const needsSync = shiftIds.length !== templateIds.length ||
            shiftIds.some(id => !existing[id]) ||
            shiftIds.some(id => {
                const s = shifts[id];
                const t = existing[id];
                return t && (s.name !== t.name || s.startTime !== t.startTime || s.endTime !== t.endTime);
            });

        if (!needsSync) return;

        store.update((s) => {
            if (!s.shiftTemplates || typeof s.shiftTemplates !== 'object') {
                s.shiftTemplates = {};
            }

            // Kopiera varje shift till shiftTemplates-format
            Object.values(shifts).forEach(shift => {
                s.shiftTemplates[shift.id] = {
                    id: shift.id,
                    name: shift.name,
                    startTime: shift.startTime || null,
                    endTime: shift.endTime || null,
                    breakStart: shift.breakStart || null,
                    breakEnd: shift.breakEnd || null,
                    color: shift.color || '#667eea',
                    costCenter: shift.costCenter || shift.description || undefined,
                    workplace: shift.workplace || undefined,
                };
            });

            // Ta bort templates som inte längre finns i shifts
            Object.keys(s.shiftTemplates).forEach(tid => {
                if (!shifts[tid]) {
                    delete s.shiftTemplates[tid];
                }
            });

            // Synka gruppkopplingar: groupShifts → groups.shiftTemplateIds
            if (s.groupShifts && s.groups) {
                Object.entries(s.groupShifts).forEach(([groupId, shiftIds]) => {
                    if (s.groups[groupId]) {
                        s.groups[groupId].shiftTemplateIds = Array.isArray(shiftIds) ? [...shiftIds] : [];
                    }
                });
            }
        });

        console.log('✓ shifts → shiftTemplates synkade');
    } catch (err) {
        console.warn('⚠️ Kunde inte synka shifts → shiftTemplates:', err);
    }
}

/* ============================================================
 * BLOCK 3 — TABELL (readonly)
 * ============================================================ */
function renderTable(shifts, groups, groupShifts) {
    const shiftsArr = Object.values(shifts);

    if (shiftsArr.length === 0) {
        return `
            <div class="groups-table-section">
                <h2>Registrerade grundpass (0)</h2>
                <div class="empty-state">
                    Inga grundpass skapade ännu.
                    <a href="#/groups">Skapa ditt första grundpass under Grupper →  Grundpass</a>.
                </div>
            </div>
        `;
    }

    // Bygg omvänd lookup: shiftId → [groupName, ...]
    const shiftToGroups = {};
    Object.entries(groupShifts).forEach(([groupId, shiftIds]) => {
        if (!Array.isArray(shiftIds)) return;
        shiftIds.forEach(sid => {
            if (!shiftToGroups[sid]) shiftToGroups[sid] = [];
            const group = groups[groupId];
            if (group) shiftToGroups[sid].push(group.name || groupId);
        });
    });

    const rows = shiftsArr.map(shift => {
        const timeStr = (shift.startTime && shift.endTime)
            ? `${shift.startTime} – ${shift.endTime}`
            : '— (Flex)';

        const isNight = shift.startTime && shift.endTime && shift.startTime > shift.endTime;
        const nightBadge = isNight ? ' <span class="badge badge-night">🌙 Natt</span>' : '';

        const breakStr = (shift.breakStart && shift.breakEnd)
            ? `${shift.breakStart} – ${shift.breakEnd}`
            : '—';

        const linkedGroups = (shiftToGroups[shift.id] || [])
            .map(n => escapeHtml(n))
            .join(', ') || '—';

        return `
            <tr>
                <td>
                    <span class="color-badge" style="background: ${sanitizeColor(shift.color)}"></span>
                </td>
                <td><strong>${escapeHtml(shift.name)}</strong></td>
                <td><code>${escapeHtml(shift.id)}</code></td>
                <td>${escapeHtml(shift.shortName || '—')}</td>
                <td>${escapeHtml(timeStr)}${nightBadge}</td>
                <td>${escapeHtml(breakStr)}</td>
                <td>${linkedGroups}</td>
                <td>${escapeHtml(shift.description || '—')}</td>
                <td>
                    <a href="#/groups" class="btn-edit" title="Redigera i Grupper-vyn">
                        ✏️ Redigera
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="groups-table-section">
            <h2>Registrerade grundpass (${shiftsArr.length})</h2>
            <div class="groups-table-wrapper">
                <table class="groups-table">
                    <thead>
                        <tr>
                            <th>Färg</th>
                            <th>Namn</th>
                            <th>ID</th>
                            <th>Kortnamn</th>
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

/* ============================================================
 * BLOCK 4 — HELPERS
 * ============================================================ */
function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function sanitizeColor(color) {
    if (!color || typeof color !== 'string') return '#999';
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
    if (/^[a-zA-Z]+$/.test(color)) return color;
    return '#999';
}
