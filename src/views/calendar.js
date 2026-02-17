/*
 * AO-07 — Schedule View (Calendar)
 *
 * Minsta schemavy:
 *   1. Välj månad (1–12)
 *   2. Välj dag → ser behov vs tillsatta per grupp
 *   3. Välj grupp + pass → lista "eligible persons"
 *   4. Klicka "Tilldela" → sparar entry i store
 *   5. Klicka "Ta bort" → tar bort entry
 *
 * Använder ctx.store (inte importerat singleton).
 * XSS-safe: escapeHtml + sanitizeColor.
 */

import { getEligiblePersons, assignPersonToShift, unassignPerson, getDaySummary } from '../modules/schedule-engine.js';
import { isRedDay, getHolidayName } from '../data/holidays.js';

/* ============================================================
 * MAIN RENDER
 * ============================================================ */
export function renderCalendar(container, ctx) {
    if (!container) return;

    const store = ctx?.store;
    if (!store) {
        container.innerHTML = `<div class="view-container"><h2>❌ Fel</h2><p class="empty-state">Store saknas.</p></div>`;
        return;
    }

    try {
        const state = store.getState();

        if (!state.schedule || typeof state.schedule.year !== 'number') {
            container.innerHTML = `<div class="view-container"><h2>❌ Fel</h2><p class="error-text">Schedule saknas eller är korrupt.</p></div>`;
            return;
        }

        if (!ctx || typeof ctx !== 'object') ctx = {};

        const year = state.schedule.year;
        const selectedMonth = ctx.scheduleMonth || new Date().getMonth() + 1; // 1-indexed
        const selectedDay = ctx.scheduleDay || null;
        const selectedGroupId = ctx.scheduleGroupId || null;
        const selectedShiftId = ctx.scheduleShiftId || null;

        const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};
        const shifts = state.shifts && typeof state.shifts === 'object' ? state.shifts : {};
        const groupShifts = state.groupShifts && typeof state.groupShifts === 'object' ? state.groupShifts : {};
        const people = Array.isArray(state.people) ? state.people : [];
        const demand = state.demand || {};

        const monthData = state.schedule.months[selectedMonth - 1];
        if (!monthData || !Array.isArray(monthData.days)) {
            container.innerHTML = `<div class="view-container"><h2>❌ Fel</h2><p class="error-text">Månad ${selectedMonth} saknas.</p></div>`;
            return;
        }

        const monthNames = ['Januari','Februari','Mars','April','Maj','Juni',
                            'Juli','Augusti','September','Oktober','November','December'];

        // Build month selector + day grid + detail panel
        container.innerHTML = `
            <div class="schedule-container">
                <div class="schedule-content">
                    <h1>📅 Schema ${year}</h1>

                    <!-- MONTH SELECTOR -->
                    <div class="schedule-month-selector">
                        <button class="btn btn-secondary" data-action="prev-month" ${selectedMonth <= 1 ? 'disabled' : ''}>◀</button>
                        <span class="schedule-month-label">${escapeHtml(monthNames[selectedMonth - 1])} ${year}</span>
                        <button class="btn btn-secondary" data-action="next-month" ${selectedMonth >= 12 ? 'disabled' : ''}>▶</button>
                    </div>

                    <!-- DAY GRID -->
                    <div class="schedule-day-grid">
                        ${renderDayGrid(monthData, selectedDay, people, groups, demand, year, selectedMonth)}
                    </div>

                    <!-- DAY DETAIL PANEL -->
                    <div id="schedule-day-detail">
                        ${selectedDay
                            ? renderDayDetail({
                                date: monthData.days[selectedDay - 1]?.date,
                                dayData: monthData.days[selectedDay - 1],
                                groups, shifts, groupShifts, people, demand,
                                selectedGroupId, selectedShiftId, state,
                              })
                            : '<p class="empty-state">👆 Välj en dag ovan för att se detaljer och schemalägga.</p>'
                        }
                    </div>
                </div>
            </div>
        `;

        setupScheduleListeners(container, store, ctx);

    } catch (err) {
        console.error('❌ renderCalendar kraschade:', err);
        container.innerHTML = `<div class="view-container"><h2>❌ Fel</h2><p class="empty-state">Kunde inte visa schema: ${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ============================================================
 * DAY GRID (mini-calendar)
 * ============================================================ */
function renderDayGrid(monthData, selectedDay, people, groups, demand, year, month) {
    const days = monthData.days || [];
    const weekdayHeaders = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];

    // Find first day's weekday
    const firstDate = new Date(year, month - 1, 1);
    const startWeekday = firstDate.getDay(); // 0=sön
    const offset = startWeekday === 0 ? 6 : startWeekday - 1; // mån=0

    let html = '<div class="day-grid-header">';
    weekdayHeaders.forEach(w => { html += `<div class="day-grid-cell header">${w}</div>`; });
    html += '</div><div class="day-grid-body">';

    // Empty cells before first day
    for (let i = 0; i < offset; i++) {
        html += '<div class="day-grid-cell empty"></div>';
    }

    days.forEach((day, idx) => {
        const dayNum = idx + 1;
        const isSelected = dayNum === selectedDay;
        const assignedCount = (day.entries || []).filter(e => e.status === 'A').length;
        const isRed = isRedDay(day.date);
        const holidayName = getHolidayName(day.date);

        let cellClass = 'day-grid-cell day';
        if (isSelected) cellClass += ' selected';
        if (isRed) cellClass += ' red-day';
        if (assignedCount > 0) cellClass += ' has-assignments';

        html += `
            <div class="${cellClass}" data-action="select-day" data-day="${dayNum}"
                 title="${holidayName ? escapeHtml(holidayName) : day.date}">
                <span class="day-num">${dayNum}</span>
                ${assignedCount > 0 ? `<span class="day-badge">${assignedCount}</span>` : ''}
            </div>
        `;
    });

    html += '</div>';
    return html;
}

/* ============================================================
 * DAY DETAIL PANEL
 * ============================================================ */
function renderDayDetail({ date, dayData, groups, shifts, groupShifts, people, demand, selectedGroupId, selectedShiftId, state }) {
    if (!date || !dayData) return '<p class="empty-state">Ingen dag vald.</p>';

    const holidayName = getHolidayName(date);
    const isRed = isRedDay(date);

    // Day summary: needed vs assigned per group
    const summary = getDaySummary({ date, dayData, groups, demand, people });

    let html = `
        <h3>${escapeHtml(date)} ${isRed ? '🔴' : ''} ${holidayName ? `<small>(${escapeHtml(holidayName)})</small>` : ''}</h3>
    `;

    // Group summary cards
    html += '<div class="schedule-group-cards">';
    Object.keys(groups).forEach(gid => {
        const g = groups[gid];
        const s = summary[gid] || { needed: 0, assigned: 0, delta: 0 };
        const isSelectedGroup = gid === selectedGroupId;
        let statusClass = s.delta >= 0 ? 'ok' : 'undermanned';
        if (s.needed === 0 && s.assigned === 0) statusClass = 'none';

        html += `
            <div class="schedule-group-card ${isSelectedGroup ? 'selected' : ''} ${statusClass}"
                 data-action="select-group" data-group-id="${escapeHtml(gid)}">
                <span class="color-badge" style="background: ${sanitizeColor(g.color)}"></span>
                <strong>${escapeHtml(g.name)}</strong>
                <span class="schedule-count">${s.assigned}/${s.needed}</span>
            </div>
        `;
    });
    html += '</div>';

    // If a group is selected → show shift selector + eligible persons
    if (selectedGroupId && groups[selectedGroupId]) {
        const linkedShiftIds = Array.isArray(groupShifts[selectedGroupId]) ? groupShifts[selectedGroupId] : [];

        if (linkedShiftIds.length === 0) {
            html += '<p class="empty-state">Inga grundpass kopplade till denna grupp.</p>';
        } else {
            // Shift selector tabs
            html += '<div class="schedule-shift-tabs">';
            linkedShiftIds.forEach(sid => {
                const shift = shifts[sid];
                if (!shift) return;
                const isSelected = sid === selectedShiftId;
                const timeStr = shift.startTime && shift.endTime ? `${shift.startTime}–${shift.endTime}` : 'Flex';

                html += `
                    <button class="schedule-shift-tab ${isSelected ? 'active' : ''}"
                            data-action="select-shift" data-shift-id="${escapeHtml(sid)}">
                        <span class="color-badge small" style="background: ${sanitizeColor(shift.color)}"></span>
                        ${escapeHtml(shift.name)} (${escapeHtml(timeStr)})
                    </button>
                `;
            });
            html += '</div>';

            // Eligible persons list
            if (selectedShiftId && shifts[selectedShiftId]) {
                const eligible = getEligiblePersons({
                    date, groupId: selectedGroupId, shiftId: selectedShiftId,
                    groups, shifts, groupShifts, people, dayData,
                });

                if (eligible.length === 0) {
                    html += '<p class="empty-state">Inga personer i denna grupp.</p>';
                } else {
                    html += `
                        <div class="schedule-eligible-list">
                            <h4>Personal — ${escapeHtml(groups[selectedGroupId].name)} / ${escapeHtml(shifts[selectedShiftId].name)}</h4>
                            <table class="groups-table">
                                <thead>
                                    <tr>
                                        <th>Namn</th>
                                        <th>Tjänstegrad</th>
                                        <th>Arbetade dagar</th>
                                        <th>Status</th>
                                        <th>Åtgärd</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    eligible.forEach(item => {
                        const p = item.person;
                        const statusText = item.eligible ? '✅ Tillgänglig' : `❌ ${escapeHtml(item.reason || 'Ej tillgänglig')}`;

                        html += `
                            <tr class="${item.eligible ? '' : 'row-disabled'}">
                                <td><strong>${escapeHtml(p.lastName)}</strong>, ${escapeHtml(p.firstName)}</td>
                                <td>${p.employmentPct || 0}%</td>
                                <td>${item.workedDays ?? '—'}</td>
                                <td>${statusText}</td>
                                <td>
                                    ${item.eligible
                                        ? `<button class="btn-edit" data-action="assign" data-person-id="${escapeHtml(p.id)}">📌 Tilldela</button>`
                                        : (item.reason?.startsWith('Redan schemalagd')
                                            ? `<button class="btn-delete" data-action="unassign" data-person-id="${escapeHtml(p.id)}">🗑️ Ta bort</button>`
                                            : '—')
                                    }
                                </td>
                            </tr>
                        `;
                    });

                    html += '</tbody></table></div>';
                }
            }
        }
    }

    return html;
}

/* ============================================================
 * EVENT LISTENERS
 * ============================================================ */
function setupScheduleListeners(container, store, ctx) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        try {
            switch (action) {
                case 'prev-month':
                    ctx.scheduleMonth = Math.max(1, (ctx.scheduleMonth || new Date().getMonth() + 1) - 1);
                    ctx.scheduleDay = null;
                    ctx.scheduleGroupId = null;
                    ctx.scheduleShiftId = null;
                    renderCalendar(container, ctx);
                    break;

                case 'next-month':
                    ctx.scheduleMonth = Math.min(12, (ctx.scheduleMonth || new Date().getMonth() + 1) + 1);
                    ctx.scheduleDay = null;
                    ctx.scheduleGroupId = null;
                    ctx.scheduleShiftId = null;
                    renderCalendar(container, ctx);
                    break;

                case 'select-day':
                    ctx.scheduleDay = parseInt(btn.dataset.day, 10) || null;
                    ctx.scheduleGroupId = null;
                    ctx.scheduleShiftId = null;
                    renderCalendar(container, ctx);
                    break;

                case 'select-group':
                    ctx.scheduleGroupId = btn.dataset.groupId || null;
                    ctx.scheduleShiftId = null;
                    renderCalendar(container, ctx);
                    break;

                case 'select-shift':
                    ctx.scheduleShiftId = btn.dataset.shiftId || null;
                    renderCalendar(container, ctx);
                    break;

                case 'assign': {
                    const personId = btn.dataset.personId;
                    if (!personId || !ctx.scheduleDay || !ctx.scheduleShiftId) break;

                    const monthIdx = (ctx.scheduleMonth || 1) - 1;
                    const dayIdx = ctx.scheduleDay - 1;
                    const shiftId = ctx.scheduleShiftId;
                    const state = store.getState();
                    const shift = state.shifts?.[shiftId];

                    store.update(s => {
                        const day = s.schedule.months[monthIdx]?.days[dayIdx];
                        if (!day) return;
                        day.entries = assignPersonToShift({
                            entries: day.entries,
                            personId,
                            shiftId,
                            shift,
                        });
                    });

                    renderCalendar(container, ctx);
                    break;
                }

                case 'unassign': {
                    const personId = btn.dataset.personId;
                    if (!personId || !ctx.scheduleDay) break;

                    const monthIdx = (ctx.scheduleMonth || 1) - 1;
                    const dayIdx = ctx.scheduleDay - 1;

                    store.update(s => {
                        const day = s.schedule.months[monthIdx]?.days[dayIdx];
                        if (!day) return;
                        day.entries = unassignPerson({ entries: day.entries, personId });
                    });

                    renderCalendar(container, ctx);
                    break;
                }
            }
        } catch (err) {
            console.error('❌ Schedule action error:', err);
        }
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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
