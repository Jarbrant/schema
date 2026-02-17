/*
 * AO-03 — Groups View: UI för grupper + grundpass (render-only)
 * PATCH v1.1 — QA-fixar:
 *   P0: Använder ctx.store istället för importerad singleton
 *   P0: sanitizeColor() mot CSS-injection i inline style
 *   P1: Guard för ctx i tab-listeners
 *   P1: memberCount läser groupIds som fallback
 *
 * Store shape:
 *   state.groups      = Object/Map  { [id]: { id, name, color, textColor } }
 *   state.shifts      = Object/Map  { [id]: { id, name, shortName, startTime, endTime, breakStart, breakEnd, color, description } }
 *   state.groupShifts = Object/Map  { [groupId]: [shiftId, ...] }
 *   state.people      = Array       [{ id, firstName, lastName, groups/groupIds: [groupId, ...], ... }]
 *
 * Exporterar: renderGroups(container, ctx)
 * Inga formulär / inga mutationer — enbart render.
 */

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

        // Säkerställ att ctx är muterbar
        if (!ctx || typeof ctx !== 'object') {
            ctx = {};
        }

        const activeTab = ctx.groupsTab || 'groups';

        container.innerHTML = `
            <div class="groups-container">
                <div class="groups-content">
                    <h1>👥 Grupper & Grundpass</h1>
                    <p class="groups-tagline">Hantera arbetsgrupper och kopplade grundpass.</p>

                    <!-- TABS -->
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

                    <!-- TAB CONTENT -->
                    <div id="groups-tab-content">
                        ${activeTab === 'groups'
                            ? renderGroupsTab(groups, groupShifts, shifts, people)
                            : renderShiftsTab(shifts, groupShifts, groups)}
                    </div>
                </div>
            </div>
        `;

        // Setup tab-klick
        setupTabListeners(container, ctx);

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
function renderGroupsTab(groups, groupShifts, shifts, people) {
    const groupsArr = Object.values(groups);

    if (groupsArr.length === 0) {
        return `<div class="empty-state">Inga grupper hittades.</div>`;
    }

    const rows = groupsArr.map(g => {
        // Räkna medlemmar: stöd både groups och groupIds
        const memberCount = people.filter(p => {
            const pGroups = Array.isArray(p.groups) ? p.groups
                          : Array.isArray(p.groupIds) ? p.groupIds
                          : [];
            return pGroups.includes(g.id);
        }).length;

        // Hämta kopplade pass via groupShifts
        const linkedShiftIds = Array.isArray(groupShifts[g.id]) ? groupShifts[g.id] : [];
        const linkedShiftNames = linkedShiftIds
            .map(sid => shifts[sid]?.name || sid)
            .join(', ') || '—';

        return `
            <tr>
                <td>
                    <span class="color-badge" style="background: ${sanitizeColor(g.color)}"></span>
                </td>
                <td><strong>${escapeHtml(g.name)}</strong></td>
                <td>${escapeHtml(g.id)}</td>
                <td>${memberCount}</td>
                <td>${escapeHtml(linkedShiftNames)}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="groups-table-section">
            <h2>Registrerade grupper</h2>
            <div class="groups-table-wrapper">
                <table class="groups-table">
                    <thead>
                        <tr>
                            <th>Färg</th>
                            <th>Namn</th>
                            <th>ID</th>
                            <th>Medlemmar</th>
                            <th>Kopplade pass</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/* ============================================================
 * TAB: Grundpass (Shifts)
 * ============================================================ */
function renderShiftsTab(shifts, groupShifts, groups) {
    const shiftsArr = Object.values(shifts);

    if (shiftsArr.length === 0) {
        return `<div class="empty-state">Inga grundpass hittades.</div>`;
    }

    const rows = shiftsArr.map(s => {
        const timeStr = (s.startTime && s.endTime)
            ? `${s.startTime} – ${s.endTime}`
            : '— (Flex)';

        const breakStr = (s.breakStart && s.breakEnd)
            ? `${s.breakStart} – ${s.breakEnd}`
            : '—';

        // Vilka grupper använder detta pass?
        const linkedGroups = Object.keys(groupShifts)
            .filter(gid => {
                const arr = groupShifts[gid];
                return Array.isArray(arr) && arr.includes(s.id);
            })
            .map(gid => groups[gid]?.name || gid)
            .join(', ') || '—';

        return `
            <tr>
                <td>
                    <span class="color-badge" style="background: ${sanitizeColor(s.color)}"></span>
                </td>
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.shortName || '—')}</td>
                <td>${escapeHtml(timeStr)}</td>
                <td>${escapeHtml(breakStr)}</td>
                <td>${escapeHtml(linkedGroups)}</td>
                <td class="shift-description">${escapeHtml(s.description || '—')}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="groups-table-section">
            <h2>Registrerade grundpass</h2>
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
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/* ============================================================
 * EVENT LISTENERS (tab-switch only)
 * ============================================================ */
function setupTabListeners(container, ctx) {
    // Guard: ctx måste vara muterbart objekt
    if (!ctx || typeof ctx !== 'object') {
        ctx = {};
    }

    const tabs = container.querySelectorAll('.groups-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            try {
                ctx.groupsTab = tab.dataset.tab;
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

/**
 * sanitizeColor — Tillåter bara säkra CSS-färgformat.
 * Accepterar: #hex, rgb(), rgba(), hsl(), hsla(), namngivna CSS-färger.
 * Allt annat → fallback #777.
 */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|hsl\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)|hsla\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+\s*\)|[a-zA-Z]{1,20})$/;

function sanitizeColor(input) {
    if (typeof input !== 'string') return '#777';
    const trimmed = input.trim();
    return SAFE_COLOR_RE.test(trimmed) ? trimmed : '#777';
}

/**
 * escapeHtml — XSS-skydd för textnoder i HTML-sträng.
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
