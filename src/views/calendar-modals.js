/*
 * AO-07 — Calendar Modals (Assign + Edit)
 * FIL: src/views/calendar-modals.js
 */

import { getEligiblePersons } from '../modules/schedule-engine.js';
import { escapeHtml, sanitizeColor, getMonthIndex, getDayIndex } from './calendar-helpers.js';

/* ============================================================
 * ASSIGN MODAL
 * ============================================================ */
export function renderAssignModal(modal, groups, shifts, shiftTemplates, groupShifts, people, absences, weekDates, state) {
    const { date, groupId, shiftId } = modal;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const group = groups[groupId];
    const shift = allShifts[shiftId];
    if (!group || !shift) return '';

    const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : 'Flex';
    const monthIdx = getMonthIndex(date);
    const dayIdx = getDayIndex(date);
    const dayData = state.schedule?.months?.[monthIdx]?.days?.[dayIdx];

    const eligible = getEligiblePersons({
        date, groupId, shiftId, groups, shifts, groupShifts, people,
        dayData, absences, scheduleMonths: state.schedule?.months,
    });

    return `
        <div class="cal-modal-overlay" data-cal="close-modal">
            <div class="cal-modal" onclick="event.stopPropagation()">
                <div class="cal-modal-header">
                    <h3>📌 Tilldela pass</h3>
                    <button class="cal-modal-close" data-cal="close-modal">×</button>
                </div>
                <div class="cal-modal-info">
                    <span class="cal-modal-badge" style="background: ${sanitizeColor(group.color)}; color: ${sanitizeColor(group.textColor || '#fff')}">${escapeHtml(group.name)}</span>
                    <span class="cal-modal-badge" style="background: ${sanitizeColor(shift.color || '#777')}; color: #fff">${escapeHtml(shift.name)} (${escapeHtml(timeStr)})</span>
                    <span class="cal-modal-date">${escapeHtml(date)}</span>
                </div>
                <div class="cal-modal-body">
                    ${eligible.length === 0
                        ? '<p class="cal-empty">Inga personer i denna grupp.</p>'
                        : renderEligibleTable(eligible)}
                </div>
            </div>
        </div>
    `;
}

function renderEligibleTable(eligible) {
    return `
        <table class="cal-assign-table">
            <thead><tr>
                <th>Namn</th><th>Tjänstegrad</th><th>Typ</th><th>Arbetade dagar</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
                ${eligible.map(item => {
                    const p = item.person;
                    const name = p.firstName && p.lastName
                        ? `${p.lastName}, ${p.firstName}` : (p.name || p.id);
                    const typeLabel = p.employmentType === 'substitute' ? 'Vikarie' : 'Ordinarie';

                    return `
                        <tr class="${!item.eligible ? 'row-disabled' : ''} ${item.isPreferred ? 'row-preferred' : ''} ${item.isAvoided ? 'row-avoided' : ''}">
                            <td><strong>${escapeHtml(name)}</strong></td>
                            <td>${p.employmentPct || 0}%</td>
                            <td>${escapeHtml(typeLabel)}</td>
                            <td>${item.workedDays ?? '—'}</td>
                            <td>
                                ${item.eligible
                                    ? (item.isPreferred ? '⭐ Föredrar' : '✅ Tillgänglig')
                                    : `❌ ${escapeHtml(item.reason || '')}`}
                                ${item.isAvoided ? ' ⚠️ Undviker' : ''}
                            </td>
                            <td>
                                ${item.eligible
                                    ? `<button class="btn btn-sm btn-primary" data-cal="assign-person" data-person-id="${escapeHtml(p.id)}">📌 Tilldela</button>`
                                    : (item.reason?.startsWith('Redan schemalagd')
                                        ? `<button class="btn btn-sm btn-danger" data-cal="unassign-modal" data-person-id="${escapeHtml(p.id)}">🗑️</button>`
                                        : '')}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

/* ============================================================
 * EDIT MODAL
 * ============================================================ */
export function renderEditModal(modal, groups, shifts, shiftTemplates, people, state) {
    const { date, personId, shiftId, groupId } = modal;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const group = groups[groupId];
    const shift = allShifts[shiftId];
    const person = people.find(p => p.id === personId);
    if (!group || !shift || !person) return '';

    const personName = person.firstName && person.lastName
        ? `${person.firstName} ${person.lastName}` : (person.name || person.id);

    const monthIdx = getMonthIndex(date);
    const dayIdx = getDayIndex(date);
    const dayData = state.schedule?.months?.[monthIdx]?.days?.[dayIdx];
    const entry = (dayData?.entries || []).find(e =>
        e.personId === personId && e.shiftId === shiftId && e.groupId === groupId
    ) || {};

    const startTime = entry.startTime || shift.startTime || '07:00';
    const endTime = entry.endTime || shift.endTime || '16:00';
    const breakStart = entry.breakStart || shift.breakStart || '';
    const breakEnd = entry.breakEnd || shift.breakEnd || '';
    const status = entry.status || 'A';

    const statusOptions = [
        ['A', 'A — Arbetar'], ['L', 'L — Ledig'], ['X', 'X — Övrigt'],
        ['SEM', 'SEM — Semester'], ['SJ', 'SJ — Sjuk'], ['VAB', 'VAB'],
        ['FÖR', 'FÖR — Föräldraledig'], ['TJL', 'TJL — Tjänstledig'],
        ['PERM', 'PERM — Permission'], ['UTB', 'UTB — Utbildning'],
        ['EXTRA', 'EXTRA — Extrapass'],
    ];

    return `
        <div class="cal-modal-overlay" data-cal="close-edit">
            <div class="cal-modal cal-modal-sm" onclick="event.stopPropagation()">
                <div class="cal-modal-header">
                    <h3>✏️ Redigera pass</h3>
                    <button class="cal-modal-close" data-cal="close-edit">×</button>
                </div>
                <div class="cal-modal-info">
                    <span class="cal-modal-badge" style="background: ${sanitizeColor(group.color)}; color: ${sanitizeColor(group.textColor || '#fff')}">${escapeHtml(group.name)}</span>
                    <strong>${escapeHtml(personName)}</strong>
                    <span class="cal-modal-date">${escapeHtml(date)}</span>
                </div>
                <div class="cal-modal-body">
                    <div class="cal-edit-form">
                        <div class="cal-edit-row">
                            <label>Starttid</label>
                            <input type="time" id="cal-edit-start" value="${escapeHtml(startTime)}" />
                        </div>
                        <div class="cal-edit-row">
                            <label>Sluttid</label>
                            <input type="time" id="cal-edit-end" value="${escapeHtml(endTime)}" />
                        </div>
                        <div class="cal-edit-row">
                            <label>Rast start</label>
                            <input type="time" id="cal-edit-break-start" value="${escapeHtml(breakStart)}" />
                        </div>
                        <div class="cal-edit-row">
                            <label>Rast slut</label>
                            <input type="time" id="cal-edit-break-end" value="${escapeHtml(breakEnd)}" />
                        </div>
                        <div class="cal-edit-row">
                            <label>Status</label>
                            <select id="cal-edit-status">
                                ${statusOptions.map(([val, label]) =>
                                    `<option value="${val}" ${status === val ? 'selected' : ''}>${escapeHtml(label)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="cal-edit-actions">
                            <button class="btn btn-primary" data-cal="save-edit">💾 Spara</button>
                            <button class="btn btn-secondary" data-cal="close-edit">Avbryt</button>
                            <button class="btn btn-danger" data-cal="delete-entry"
                                    data-date="${escapeHtml(date)}" data-person-id="${escapeHtml(personId)}"
                                    data-shift-id="${escapeHtml(shiftId)}">🗑️ Ta bort</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
