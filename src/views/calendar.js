/*
 * AO-07 — Schedule View (Calendar) — v2.0
 *
 * Personalkollen-inspirerad veckovy med:
 *   1. Drag & drop av personkort mellan dagar/pass
 *   2. Redigera enskilda pass (tid, status) via inline-edit
 *   3. AI/auto-generering av schema från veckomall
 *   4. Grupp-sektioner med timmar + kostnad
 *   5. Frånvaro + vakanser inline
 *   6. Veckolåsning
 *
 * Kontrakt:
 *   - ctx.store måste finnas
 *   - Exporterar renderCalendar(container, ctx)
 *   - XSS-safe: escapeHtml + sanitizeColor
 *   - Inga globala DOM-side-effects (utom drag-listeners)
 */

/* ============================================================
 * IMPORTS
 * ============================================================ */
import { showSuccess, showWarning } from '../ui.js';
import {
    getEligiblePersons,
    assignPersonToShift,
    unassignPerson,
    getDaySummary,
    calcShiftHours,
    calcDayCost,
    isPersonAvailable,
    getPersonWorkload,
    generateWeekSchedule,
    validateScheduleIntegrity,
} from '../modules/schedule-engine.js';

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const MONTH_NAMES = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

const ABSENCE_LABELS = {
    SEM: 'Semester', SJ: 'Sjuk', VAB: 'VAB', FÖR: 'Föräldraledig',
    PERM: 'Permission', UTB: 'Utbildning', TJL: 'Tjänstledig',
};
const ABSENCE_COLORS = {
    SEM:  { bg: '#fff9c4', text: '#f57f17',  border: '#fbc02d' },
    SJ:   { bg: '#ffcdd2', text: '#b71c1c',  border: '#ef5350' },
    VAB:  { bg: '#ffe0b2', text: '#e65100',  border: '#ff9800' },
    FÖR:  { bg: '#f8bbd0', text: '#880e4f',  border: '#ec407a' },
    PERM: { bg: '#b2dfdb', text: '#004d40',  border: '#26a69a' },
    UTB:  { bg: '#e1bee7', text: '#4a148c',  border: '#ab47bc' },
    TJL:  { bg: '#b2dfdb', text: '#004d40',  border: '#26a69a' },
};
const STATUS_COLORS = {
    A:     { bg: '#c8e6c9', text: '#1b5e20',  border: '#66bb6a' },
    L:     { bg: '#f0f0f0', text: '#424242',  border: '#bdbdbd' },
    X:     { bg: '#bbdefb', text: '#0d47a1',  border: '#42a5f5' },
    EXTRA: { bg: '#424242', text: '#ffeb3b',  border: '#616161' },
};

/* ============================================================
 * MAIN RENDER
 * ============================================================ */
export function renderCalendar(container, ctx) {
    if (!container) return;

    const store = ctx?.store;
    if (!store) {
        container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`;
        return;
    }

    try {
        const state = store.getState();
        if (!state.schedule || typeof state.schedule.year !== 'number') {
            container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>Schedule saknas eller är korrupt.</p></div>`;
            return;
        }

        // ── State data ──
        const year = state.schedule.year;
        const groups = state.groups && typeof state.groups === 'object' ? state.groups : {};
        const shifts = state.shifts && typeof state.shifts === 'object' ? state.shifts : {};
        const shiftTemplates = state.shiftTemplates && typeof state.shiftTemplates === 'object' ? state.shiftTemplates : {};
        const groupShifts = state.groupShifts && typeof state.groupShifts === 'object' ? state.groupShifts : {};
        const people = Array.isArray(state.people) ? state.people.filter(p => p.isActive) : [];
        const allPeople = Array.isArray(state.people) ? state.people : [];
        const demand = state.demand || {};
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const vacancies = Array.isArray(state.vacancies) ? state.vacancies : [];
        const weekTemplates = state.weekTemplates && typeof state.weekTemplates === 'object' ? state.weekTemplates : {};
        const calendarWeeks = state.calendarWeeks && typeof state.calendarWeeks === 'object' ? state.calendarWeeks : {};
        const lockedWeeks = Array.isArray(state.schedule.lockedWeeks) ? state.schedule.lockedWeeks : [];

        // ── View-state (persisted on ctx) ──
        if (!ctx._cal) {
            const now = new Date();
            const startOfYear = new Date(year, 0, 1);
            const diffMs = now.getTime() - startOfYear.getTime();
            const currentWeek = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));

            ctx._cal = {
                weekOffset: currentWeek,
                collapsedGroups: {},
                assignModal: null,        // { date, groupId, shiftId }
                editModal: null,          // { date, personId, shiftId, groupId }
                generatePreview: null,    // { suggestions, vacancySuggestions }
            };
        }
        const cal = ctx._cal;

        // ── Compute week dates ──
        const weekDates = getWeekDates(year, cal.weekOffset);
        const weekNum = getISOWeekNumber(weekDates[0]);
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
        const isLocked = lockedWeeks.includes(weekKey);

        // ── Linked week template? ──
        const linkedTemplateId = calendarWeeks[weekKey] || null;
        const linkedTemplate = linkedTemplateId ? weekTemplates[linkedTemplateId] : null;

        // ── Build schedule data for this week ──
        const weekSchedule = buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, groupShifts, people, absences, vacancies);

        // ── Integrity warnings ──
        const warnings = validateScheduleIntegrity(state.schedule.months, allPeople, absences);
        const weekWarnings = warnings.filter(w => {
            return weekDates.some(d => formatISO(d) === w.date);
        });

        // ── Render ──
        const html = `
            <div class="cal-container">
                <!-- TOP BAR -->
                ${renderTopBar(cal, weekNum, weekDates, isLocked, linkedTemplate, weekTemplates, weekKey)}

                <!-- WARNINGS -->
                ${weekWarnings.length > 0 ? renderWarnings(weekWarnings) : ''}

                <!-- GENERATE PREVIEW -->
                ${cal.generatePreview ? renderGeneratePreview(cal.generatePreview, people, groups, shifts, shiftTemplates) : ''}

                <!-- WEEK HEADER -->
                <div class="cal-week-header">
                    <div class="cal-row-label"></div>
                    ${weekDates.map((d, i) => {
                        const isToday = isDateToday(d);
                        return `
                            <div class="cal-day-col-header ${isToday ? 'today' : ''} ${i === 6 ? 'sunday' : ''} ${i === 5 ? 'saturday' : ''}">
                                <span class="cal-day-name">${WEEKDAY_NAMES[i]}</span>
                                <span class="cal-day-date">${formatDayMonth(d)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- GROUP SECTIONS -->
                ${renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, demand, absences, vacancies, cal, isLocked)}

                <!-- ASSIGN MODAL -->
                ${cal.assignModal ? renderAssignModal(cal.assignModal, groups, shifts, shiftTemplates, groupShifts, people, absences, weekDates, state) : ''}

                <!-- EDIT MODAL -->
                ${cal.editModal ? renderEditModal(cal.editModal, groups, shifts, shiftTemplates, people, state) : ''}
            </div>
        `;

        container.innerHTML = html;
        setupCalendarListeners(container, store, ctx, weekDates, isLocked, linkedTemplate);
        setupDragAndDrop(container, store, ctx, isLocked);

    } catch (err) {
        console.error('❌ renderCalendar kraschade:', err);
        container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>Kunde inte visa schema: ${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ============================================================
 * TOP BAR
 * ============================================================ */
function renderTopBar(cal, weekNum, weekDates, isLocked, linkedTemplate, weekTemplates, weekKey) {
    const templateOptions = Object.values(weekTemplates || {});

    return `
        <div class="cal-topbar">
            <div class="cal-topbar-left">
                ${linkedTemplate
                    ? `<span class="cal-template-badge" title="Kopplad veckomall">📋 ${escapeHtml(linkedTemplate.name)}</span>`
                    : `<span class="cal-template-badge cal-no-template">Ingen veckomall kopplad</span>`
                }
            </div>
            <div class="cal-topbar-center">
                <button class="btn btn-secondary" data-cal="prev-week" title="Föregående vecka">◀</button>
                <div class="cal-week-display">
                    <strong>Vecka ${weekNum}</strong>
                    <span class="cal-week-range">${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}</span>
                </div>
                <button class="btn btn-secondary" data-cal="next-week" title="Nästa vecka">▶</button>
                <button class="btn btn-secondary btn-sm" data-cal="today" title="Idag">Idag</button>
            </div>
            <div class="cal-topbar-right">
                ${!isLocked && linkedTemplate ? `
                    <button class="btn btn-primary btn-sm" data-cal="generate" title="Föreslå schema baserat på veckomall">
                        🤖 Generera schema
                    </button>
                ` : ''}
                ${isLocked
                    ? `<button class="btn btn-sm cal-locked-badge" data-cal="unlock-week" title="Lås upp veckan">🔒 Låst — klicka för att låsa upp</button>`
                    : `<button class="btn btn-secondary btn-sm" data-cal="lock-week" title="Lås veckan">🔓 Lås vecka</button>`
                }
            </div>
        </div>
    `;
}

/* ============================================================
 * WARNINGS BANNER
 * ============================================================ */
function renderWarnings(warnings) {
    const errors = warnings.filter(w => w.severity === 'error');
    const warns = warnings.filter(w => w.severity === 'warning');

    return `
        <div class="cal-warnings">
            ${errors.length > 0 ? `
                <div class="cal-warning-section cal-warning-error">
                    <strong>❌ ${errors.length} fel:</strong>
                    ${errors.slice(0, 5).map(w => `<span class="cal-warning-item">${escapeHtml(w.message)} (${escapeHtml(w.date)})</span>`).join('')}
                    ${errors.length > 5 ? `<span class="cal-warning-more">+${errors.length - 5} till...</span>` : ''}
                </div>
            ` : ''}
            ${warns.length > 0 ? `
                <div class="cal-warning-section cal-warning-warn">
                    <strong>⚠️ ${warns.length} varningar:</strong>
                    ${warns.slice(0, 3).map(w => `<span class="cal-warning-item">${escapeHtml(w.message)}</span>`).join('')}
                    ${warns.length > 3 ? `<span class="cal-warning-more">+${warns.length - 3} till...</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/* ============================================================
 * GENERATE PREVIEW
 * ============================================================ */
function renderGeneratePreview(preview, people, groups, shifts, shiftTemplates) {
    const { suggestions, vacancySuggestions } = preview;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    return `
        <div class="cal-generate-preview">
            <div class="cal-preview-header">
                <h3>🤖 Genererat schemaförslag</h3>
                <div class="cal-preview-actions">
                    <button class="btn btn-primary btn-sm" data-cal="apply-generate">✓ Tillämpa alla (${suggestions.length})</button>
                    <button class="btn btn-secondary btn-sm" data-cal="cancel-generate">✕ Avbryt</button>
                </div>
            </div>
            <div class="cal-preview-stats">
                <span class="cal-preview-stat cal-preview-ok">✅ ${suggestions.length} tilldelningar</span>
                ${vacancySuggestions.length > 0
                    ? `<span class="cal-preview-stat cal-preview-vacancy">⚠️ ${vacancySuggestions.length} vakanser (ej tillräckligt folk)</span>`
                    : `<span class="cal-preview-stat cal-preview-ok">✅ Inga vakanser</span>`
                }
            </div>
            <div class="cal-preview-list">
                ${suggestions.slice(0, 20).map(s => {
                    const person = people.find(p => p.id === s.personId);
                    const personName = person ? `${person.firstName} ${person.lastName}` : s.personId;
                    const group = groups[s.groupId];
                    const shift = allShifts[s.shiftId];
                    const timeStr = shift?.startTime && shift?.endTime ? `${shift.startTime}–${shift.endTime}` : 'Flex';

                    return `
                        <div class="cal-preview-item">
                            <span class="cal-preview-date">${escapeHtml(s.date)}</span>
                            <span class="cal-preview-badge" style="background: ${sanitizeColor(group?.color)}; color: ${sanitizeColor(group?.textColor || '#fff')}">${escapeHtml(group?.name || s.groupId)}</span>
                            <span>${escapeHtml(shift?.name || s.shiftId)} (${escapeHtml(timeStr)})</span>
                            <strong>${escapeHtml(personName)}</strong>
                        </div>
                    `;
                }).join('')}
                ${suggestions.length > 20 ? `<p class="cal-preview-more">+${suggestions.length - 20} fler tilldelningar...</p>` : ''}
            </div>
        </div>
    `;
}

/* ============================================================
 * GROUP SECTIONS
 * ============================================================ */
function renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, demand, absences, vacancies, cal, isLocked) {
    const groupIds = Object.keys(groups).filter(gid => gid !== 'SYSTEM_ADMIN');
    if (groupIds.length === 0) return '<p class="cal-empty">Inga grupper konfigurerade.</p>';

    return groupIds.map(gid => {
        const g = groups[gid];
        const isCollapsed = !!cal.collapsedGroups[gid];
        const linkedShiftIds = Array.isArray(groupShifts[gid]) ? groupShifts[gid] : [];
        const groupData = weekSchedule[gid] || {};

        let totalHours = 0, totalCost = 0;
        const daySummaries = weekDates.map(date => {
            const dateStr = formatISO(date);
            const d = groupData[dateStr] || { entries: [], hours: 0, cost: 0 };
            totalHours += d.hours;
            totalCost += d.cost;
            return d;
        });

        return `
            <div class="cal-group-section" data-group-id="${escapeHtml(gid)}">
                <div class="cal-group-header" data-cal="toggle-group" data-group-id="${escapeHtml(gid)}"
                     style="border-left: 5px solid ${sanitizeColor(g.color)}">
                    <div class="cal-group-label-area">
                        <span class="cal-group-toggle">${isCollapsed ? '▶' : '▼'}</span>
                        <span class="cal-group-color" style="background: ${sanitizeColor(g.color)}; color: ${sanitizeColor(g.textColor || '#fff')}">${escapeHtml(g.name)}</span>
                        <span class="cal-group-totals">${totalHours.toFixed(1)} tim · ${formatCurrency(totalCost)}</span>
                    </div>
                    <div class="cal-group-day-summary">
                        ${daySummaries.map(d => `
                            <div class="cal-day-summary-cell">
                                <span class="cal-summary-hours">${d.hours.toFixed(1)} tim</span>
                                <span class="cal-summary-cost">${formatCurrency(d.cost)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ${!isCollapsed ? renderGroupBody(gid, groupData, weekDates, g, shifts, shiftTemplates, linkedShiftIds, people, absences, vacancies, demand, isLocked) : ''}
            </div>
        `;
    }).join('');
}

/* ============================================================
 * GROUP BODY — shift rows with person cards + drag & drop
 * ============================================================ */
function renderGroupBody(gid, groupData, weekDates, group, shifts, shiftTemplates, linkedShiftIds, people, absences, vacancies, demand, isLocked) {
    if (linkedShiftIds.length === 0) {
        return `<div class="cal-group-body"><p class="cal-empty-small">Inga grundpass kopplade.</p></div>`;
    }

    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    const shiftSections = linkedShiftIds.map(sid => {
        const shift = allShifts[sid];
        if (!shift) return '';

        const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : 'Flex';
        const shiftColor = sanitizeColor(shift.color || '#777');
        const shiftHoursVal = calcShiftHours(shift, {});

        // Per-shift totals
        let shiftTotalPersons = 0;

        return `
            <div class="cal-shift-section">
                <div class="cal-shift-label" style="border-left: 4px solid ${shiftColor}">
                    <span class="cal-shift-dot" style="background: ${shiftColor}"></span>
                    <div class="cal-shift-info">
                        <strong>${escapeHtml(shift.name)}</strong>
                        <span class="cal-shift-time">${escapeHtml(timeStr)}</span>
                        <span class="cal-shift-hours">${shiftHoursVal.toFixed(1)} tim/pass</span>
                    </div>
                </div>
                <div class="cal-shift-days">
                    ${weekDates.map((date, dayIdx) => {
                        const dateStr = formatISO(date);
                        const dayData = groupData[dateStr] || { entries: [] };

                        const shiftEntries = dayData.entries.filter(e =>
                            e.shiftId === sid && e.groupId === gid
                        );
                        shiftTotalPersons += shiftEntries.filter(e => e.personId && e.status === 'A').length;

                        // Group people for absence display
                        const groupPeople = people.filter(p => {
                            const pGroups = p.groups || p.groupIds || [];
                            return pGroups.includes(gid);
                        });
                        const dayAbsences = absences.filter(abs =>
                            groupPeople.some(p => p.id === abs.personId) &&
                            isAbsenceOnDate(abs, dateStr) &&
                            !shiftEntries.some(e => e.personId === abs.personId)
                        );

                        const dayVacancies = vacancies.filter(v =>
                            v.date === dateStr && v.groupId === gid &&
                            v.shiftTemplateId === sid && v.status !== 'filled'
                        );

                        const isSunday = dayIdx === 6;
                        const isSaturday = dayIdx === 5;

                        return `
                            <div class="cal-day-cell ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''} ${isDateToday(date) ? 'today' : ''}"
                                 data-drop-zone data-drop-date="${dateStr}" data-drop-group="${escapeHtml(gid)}" data-drop-shift="${escapeHtml(sid)}">

                                ${shiftEntries.filter(e => e.personId).map(entry => {
                                    const person = people.find(p => p.id === entry.personId);
                                    if (!person) return '';
                                    const personName = person.firstName && person.lastName
                                        ? `${person.firstName} ${person.lastName}`
                                        : (person.name || person.id);
                                    const entryTime = entry.startTime && entry.endTime
                                        ? `${entry.startTime} – ${entry.endTime}`
                                        : timeStr;
                                    const statusStyle = getStatusStyle(entry.status || 'A');

                                    return `
                                        <div class="cal-person-card"
                                             style="background: ${statusStyle.bg}; color: ${statusStyle.text}; border-left: 4px solid ${statusStyle.border}"
                                             title="${escapeHtml(personName)} · ${escapeHtml(entryTime)}"
                                             ${!isLocked ? `draggable="true"` : ''}
                                             data-drag-person="${escapeHtml(entry.personId)}"
                                             data-drag-shift="${escapeHtml(sid)}"
                                             data-drag-group="${escapeHtml(gid)}"
                                             data-drag-date="${dateStr}">
                                            <span class="cal-card-time">${escapeHtml(entryTime)}</span>
                                            <span class="cal-card-name">${escapeHtml(personName)}</span>
                                            ${!isLocked ? `
                                                <div class="cal-card-actions">
                                                    <button class="cal-card-edit" data-cal="edit-entry"
                                                            data-date="${dateStr}" data-person-id="${escapeHtml(entry.personId)}"
                                                            data-shift-id="${escapeHtml(sid)}" data-group-id="${escapeHtml(gid)}"
                                                            title="Redigera">✏️</button>
                                                    <button class="cal-card-remove" data-cal="unassign"
                                                            data-date="${dateStr}" data-person-id="${escapeHtml(entry.personId)}"
                                                            data-shift-id="${escapeHtml(sid)}" title="Ta bort">×</button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('')}

                                ${dayAbsences.map(abs => {
                                    const person = people.find(p => p.id === abs.personId);
                                    if (!person) return '';
                                    const personName = person.firstName && person.lastName
                                        ? `${person.firstName} ${person.lastName}`
                                        : (person.name || person.id);
                                    const absStyle = ABSENCE_COLORS[abs.type] || ABSENCE_COLORS.SEM;

                                    return `
                                        <div class="cal-person-card cal-absence-card"
                                             style="background: ${absStyle.bg}; color: ${absStyle.text}; border-left: 4px solid ${absStyle.border}">
                                            <span class="cal-card-status">${escapeHtml(ABSENCE_LABELS[abs.type] || abs.type)}</span>
                                            <span class="cal-card-name">${escapeHtml(personName)}</span>
                                        </div>
                                    `;
                                }).join('')}

                                ${dayVacancies.map(vac => `
                                    <div class="cal-person-card cal-vacancy-card">
                                        <span class="cal-card-status">Utlagt pass</span>
                                        <span class="cal-card-time">${escapeHtml(timeStr)}</span>
                                        ${!isLocked ? `<button class="btn btn-sm cal-vacancy-accept" data-cal="fill-vacancy"
                                                data-vacancy-id="${escapeHtml(vac.id)}" data-date="${dateStr}">+ Fyll</button>` : ''}
                                    </div>
                                `).join('')}

                                ${!isLocked ? `
                                    <button class="cal-add-btn" data-cal="open-assign"
                                            data-date="${dateStr}" data-group-id="${escapeHtml(gid)}" data-shift-id="${escapeHtml(sid)}"
                                            title="Lägg till person">+</button>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    return `<div class="cal-group-body">${shiftSections}</div>`;
}

/* ============================================================
 * ASSIGN MODAL
 * ============================================================ */
function renderAssignModal(modal, groups, shifts, shiftTemplates, groupShifts, people, absences, weekDates, state) {
    const { date, groupId, shiftId } = modal;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const group = groups[groupId];
    const shift = allShifts[shiftId];
    if (!group || !shift) return '';

    const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : 'Flex';

    const monthIdx = getMonthIndex(date);
    const dayIdx = getDayIndex(date);
    const monthData = state.schedule?.months?.[monthIdx];
    const dayData = monthData?.days?.[dayIdx];

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
                        : `
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
                        `}
                </div>
            </div>
        </div>
    `;
}

/* ============================================================
 * EDIT MODAL — redigera enskilt pass (tid, status)
 * ============================================================ */
function renderEditModal(modal, groups, shifts, shiftTemplates, people, state) {
    const { date, personId, shiftId, groupId } = modal;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };
    const group = groups[groupId];
    const shift = allShifts[shiftId];
    const person = people.find(p => p.id === personId);
    if (!group || !shift || !person) return '';

    const personName = person.firstName && person.lastName
        ? `${person.firstName} ${person.lastName}` : (person.name || person.id);

    // Find entry
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
                                <option value="A" ${status === 'A' ? 'selected' : ''}>A — Arbetar</option>
                                <option value="L" ${status === 'L' ? 'selected' : ''}>L — Ledig</option>
                                <option value="X" ${status === 'X' ? 'selected' : ''}>X — Övrigt</option>
                                <option value="SEM" ${status === 'SEM' ? 'selected' : ''}>SEM — Semester</option>
                                <option value="SJ" ${status === 'SJ' ? 'selected' : ''}>SJ — Sjuk</option>
                                <option value="VAB" ${status === 'VAB' ? 'selected' : ''}>VAB</option>
                                <option value="FÖR" ${status === 'FÖR' ? 'selected' : ''}>FÖR — Föräldraledig</option>
                                <option value="TJL" ${status === 'TJL' ? 'selected' : ''}>TJL — Tjänstledig</option>
                                <option value="PERM" ${status === 'PERM' ? 'selected' : ''}>PERM — Permission</option>
                                <option value="UTB" ${status === 'UTB' ? 'selected' : ''}>UTB — Utbildning</option>
                                <option value="EXTRA" ${status === 'EXTRA' ? 'selected' : ''}>EXTRA — Extrapass</option>
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

/* ============================================================
 * BUILD WEEK SCHEDULE DATA
 * ============================================================ */
function buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, groupShifts, people, absences, vacancies) {
    const result = {};
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    Object.keys(groups).forEach(gid => {
        result[gid] = {};
        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const monthIdx = getMonthIndex(dateStr);
            const dayIdx = getDayIndex(dateStr);
            const dayData = state.schedule?.months?.[monthIdx]?.days?.[dayIdx];

            const entries = (dayData?.entries || []).filter(e => e.groupId === gid);
            let hours = 0, cost = 0;

            entries.forEach(e => {
                if (e.status !== 'A') return;
                const shift = allShifts[e.shiftId];
                if (!shift) return;
                const h = calcShiftHours(shift, e);
                hours += h;
                if (e.personId) {
                    const person = people.find(p => p.id === e.personId);
                    if (person) cost += h * (person.hourlyWage || 0);
                }
            });

            result[gid][dateStr] = { entries, hours, cost };
        });
    });

    return result;
}

/* ============================================================
 * EVENT LISTENERS
 * ============================================================ */
function setupCalendarListeners(container, store, ctx, weekDates, isLocked, linkedTemplate) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cal]');
        if (!btn) return;
        const action = btn.dataset.cal;
        const cal = ctx._cal;

        try {
            switch (action) {
                case 'prev-week':
                    cal.weekOffset = Math.max(0, cal.weekOffset - 1);
                    cal.generatePreview = null;
                    renderCalendar(container, ctx);
                    break;

                case 'next-week':
                    cal.weekOffset = Math.min(52, cal.weekOffset + 1);
                    cal.generatePreview = null;
                    renderCalendar(container, ctx);
                    break;

                case 'today': {
                    const state = store.getState();
                    const year = state.schedule.year;
                    const now = new Date();
                    const startOfYear = new Date(year, 0, 1);
                    const diffMs = now.getTime() - startOfYear.getTime();
                    cal.weekOffset = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
                    cal.generatePreview = null;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'toggle-group': {
                    const gid = btn.dataset.groupId;
                    if (gid) cal.collapsedGroups[gid] = !cal.collapsedGroups[gid];
                    renderCalendar(container, ctx);
                    break;
                }

                case 'open-assign':
                    if (isLocked) break;
                    cal.assignModal = { date: btn.dataset.date, groupId: btn.dataset.groupId, shiftId: btn.dataset.shiftId };
                    renderCalendar(container, ctx);
                    break;

                case 'close-modal':
                    cal.assignModal = null;
                    renderCalendar(container, ctx);
                    break;

                case 'assign-person': {
                    if (isLocked) break;
                    const personId = btn.dataset.personId;
                    const modal = cal.assignModal;
                    if (!personId || !modal) break;

                    const { date, groupId, shiftId } = modal;
                    const monthIdx = getMonthIndex(date);
                    const dayIdx = getDayIndex(date);
                    const state = store.getState();
                    const allShifts = { ...(state.shifts || {}), ...(state.shiftTemplates || {}) };
                    const shift = allShifts[shiftId];

                    store.update(s => {
                        const day = s.schedule.months?.[monthIdx]?.days?.[dayIdx];
                        if (!day) return;
                        if (!Array.isArray(day.entries)) day.entries = [];
                        const exists = day.entries.some(e =>
                            e.personId === personId && e.shiftId === shiftId && e.groupId === groupId
                        );
                        if (exists) return;
                        day.entries.push({
                            personId, shiftId, groupId, status: 'A',
                            startTime: shift?.startTime || null, endTime: shift?.endTime || null,
                            breakStart: shift?.breakStart || null, breakEnd: shift?.breakEnd || null,
                        });
                    });

                    showSuccess('✓ Person tilldelad');
                    cal.assignModal = null;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'unassign':
                case 'unassign-modal': {
                    if (isLocked) break;
                    const personId = btn.dataset.personId;
                    const date = btn.dataset.date || cal.assignModal?.date;
                    const shiftId = btn.dataset.shiftId || cal.assignModal?.shiftId;
                    if (!personId || !date) break;

                    const monthIdx = getMonthIndex(date);
                    const dayIdx = getDayIndex(date);

                    store.update(s => {
                        const day = s.schedule.months?.[monthIdx]?.days?.[dayIdx];
                        if (!day || !Array.isArray(day.entries)) return;
                        day.entries = day.entries.filter(e => {
                            if (e.personId !== personId) return true;
                            if (shiftId && e.shiftId !== shiftId) return true;
                            return false;
                        });
                    });

                    showWarning('🗑️ Tilldelning borttagen');
                    if (action === 'unassign-modal') cal.assignModal = null;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'edit-entry': {
                    if (isLocked) break;
                    cal.editModal = {
                        date: btn.dataset.date,
                        personId: btn.dataset.personId,
                        shiftId: btn.dataset.shiftId,
                        groupId: btn.dataset.groupId,
                    };
                    renderCalendar(container, ctx);
                    break;
                }

                case 'save-edit': {
                    if (isLocked || !cal.editModal) break;
                    const { date, personId, shiftId, groupId } = cal.editModal;
                    const monthIdx = getMonthIndex(date);
                    const dayIdx = getDayIndex(date);

                    const newStart = document.getElementById('cal-edit-start')?.value || null;
                    const newEnd = document.getElementById('cal-edit-end')?.value || null;
                    const newBreakStart = document.getElementById('cal-edit-break-start')?.value || null;
                    const newBreakEnd = document.getElementById('cal-edit-break-end')?.value || null;
                    const newStatus = document.getElementById('cal-edit-status')?.value || 'A';

                    store.update(s => {
                        const day = s.schedule.months?.[monthIdx]?.days?.[dayIdx];
                        if (!day || !Array.isArray(day.entries)) return;
                        const entry = day.entries.find(e =>
                            e.personId === personId && e.shiftId === shiftId && e.groupId === groupId
                        );
                        if (!entry) return;
                        entry.startTime = newStart;
                        entry.endTime = newEnd;
                        entry.breakStart = newBreakStart || null;
                        entry.breakEnd = newBreakEnd || null;
                        entry.status = newStatus;
                    });

                    showSuccess('✓ Pass uppdaterat');
                    cal.editModal = null;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'close-edit':
                    cal.editModal = null;
                    renderCalendar(container, ctx);
                    break;

                case 'delete-entry': {
                    if (isLocked) break;
                    const personId = btn.dataset.personId;
                    const date = btn.dataset.date;
                    const shiftId = btn.dataset.shiftId;
                    if (!personId || !date) break;

                    const monthIdx = getMonthIndex(date);
                    const dayIdx = getDayIndex(date);

                    store.update(s => {
                        const day = s.schedule.months?.[monthIdx]?.days?.[dayIdx];
                        if (!day || !Array.isArray(day.entries)) return;
                        day.entries = day.entries.filter(e =>
                            !(e.personId === personId && e.shiftId === shiftId)
                        );
                    });

                    showWarning('🗑️ Pass borttaget');
                    cal.editModal = null;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'lock-week': {
                    const state = store.getState();
                    const year = state.schedule.year;
                    const weekNum = getISOWeekNumber(weekDates[0]);
                    const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

                    store.update(s => {
                        if (!Array.isArray(s.schedule.lockedWeeks)) s.schedule.lockedWeeks = [];
                        if (!s.schedule.lockedWeeks.includes(weekKey)) s.schedule.lockedWeeks.push(weekKey);
                    });

                    showSuccess(`🔒 Vecka ${weekNum} är nu låst`);
                    renderCalendar(container, ctx);
                    break;
                }

                case 'unlock-week': {
                    const state = store.getState();
                    const year = state.schedule.year;
                    const weekNum = getISOWeekNumber(weekDates[0]);
                    const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

                    store.update(s => {
                        if (!Array.isArray(s.schedule.lockedWeeks)) return;
                        s.schedule.lockedWeeks = s.schedule.lockedWeeks.filter(w => w !== weekKey);
                    });

                    showWarning(`🔓 Vecka ${weekNum} upplåst`);
                    renderCalendar(container, ctx);
                    break;
                }

                case 'generate': {
                    if (isLocked || !linkedTemplate) break;
                    const state = store.getState();

                    const preview = generateWeekSchedule({
                        weekDates,
                        weekTemplate: linkedTemplate,
                        groups: state.groups,
                        shifts: state.shifts,
                        shiftTemplates: state.shiftTemplates,
                        groupShifts: state.groupShifts,
                        people: (state.people || []).filter(p => p.isActive),
                        absences: state.absences || [],
                        existingEntries: {},
                        demand: state.demand,
                    });

                    cal.generatePreview = preview;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'apply-generate': {
                    if (isLocked || !cal.generatePreview) break;
                    const { suggestions } = cal.generatePreview;

                    store.update(s => {
                        suggestions.forEach(sug => {
                            const monthIdx = getMonthIndex(sug.date);
                            const dayIdx = getDayIndex(sug.date);
                            const day = s.schedule.months?.[monthIdx]?.days?.[dayIdx];
                            if (!day) return;
                            if (!Array.isArray(day.entries)) day.entries = [];

                            const exists = day.entries.some(e =>
                                e.personId === sug.personId && e.shiftId === sug.shiftId && e.groupId === sug.groupId
                            );
                            if (exists) return;

                            day.entries.push({
                                personId: sug.personId,
                                shiftId: sug.shiftId,
                                groupId: sug.groupId,
                                status: sug.status || 'A',
                                startTime: sug.startTime,
                                endTime: sug.endTime,
                                breakStart: sug.breakStart,
                                breakEnd: sug.breakEnd,
                            });
                        });
                    });

                    showSuccess(`✓ ${suggestions.length} tilldelningar tillämpade`);
                    cal.generatePreview = null;
                    renderCalendar(container, ctx);
                    break;
                }

                case 'cancel-generate':
                    cal.generatePreview = null;
                    renderCalendar(container, ctx);
                    break;

                case 'fill-vacancy': {
                    if (isLocked) break;
                    const vacancyId = btn.dataset.vacancyId;
                    const state = store.getState();
                    const vacancy = (state.vacancies || []).find(v => v.id === vacancyId);
                    if (!vacancy) break;

                    cal.assignModal = {
                        date: vacancy.date,
                        groupId: vacancy.groupId,
                        shiftId: vacancy.shiftTemplateId,
                    };
                    renderCalendar(container, ctx);
                    break;
                }
            }
        } catch (err) {
            console.error('❌ Calendar action error:', err);
            showWarning('❌ Ett fel uppstod');
        }
    });
}

/* ============================================================
 * DRAG & DROP
 * ============================================================ */
function setupDragAndDrop(container, store, ctx, isLocked) {
    if (isLocked) return;

    let dragData = null;

    // Dragstart — på personkort
    container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('[data-drag-person]');
        if (!card) return;

        dragData = {
            personId: card.dataset.dragPerson,
            shiftId: card.dataset.dragShift,
            groupId: card.dataset.dragGroup,
            fromDate: card.dataset.dragDate,
        };

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));

        // Visual feedback
        card.classList.add('cal-dragging');
        setTimeout(() => card.style.opacity = '0.4', 0);
    });

    container.addEventListener('dragend', (e) => {
        const card = e.target.closest('[data-drag-person]');
        if (card) {
            card.classList.remove('cal-dragging');
            card.style.opacity = '';
        }
        // Remove all highlights
        container.querySelectorAll('.cal-drop-target').forEach(el => el.classList.remove('cal-drop-target'));
        dragData = null;
    });

    // Dragover — på dag-celler
    container.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('[data-drop-zone]');
        if (!dropZone || !dragData) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dropZone.classList.add('cal-drop-target');
    });

    container.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('[data-drop-zone]');
        if (dropZone) dropZone.classList.remove('cal-drop-target');
    });

    // Drop
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('[data-drop-zone]');
        if (!dropZone || !dragData) return;
        dropZone.classList.remove('cal-drop-target');

        const toDate = dropZone.dataset.dropDate;
        const toGroup = dropZone.dataset.dropGroup;
        const toShift = dropZone.dataset.dropShift;

        const { personId, shiftId: fromShift, groupId: fromGroup, fromDate } = dragData;

        // Don't drop on same cell
        if (toDate === fromDate && toGroup === fromGroup && toShift === fromShift) {
            dragData = null;
            return;
        }

        try {
            const state = store.getState();
            const allShifts = { ...(state.shifts || {}), ...(state.shiftTemplates || {}) };
            const targetShift = allShifts[toShift];

            store.update(s => {
                // 1) Remove from source
                const fromMonthIdx = getMonthIndex(fromDate);
                const fromDayIdx = getDayIndex(fromDate);
                const fromDay = s.schedule.months?.[fromMonthIdx]?.days?.[fromDayIdx];
                if (fromDay && Array.isArray(fromDay.entries)) {
                    fromDay.entries = fromDay.entries.filter(e =>
                        !(e.personId === personId && e.shiftId === fromShift && e.groupId === fromGroup)
                    );
                }

                // 2) Add to target
                const toMonthIdx = getMonthIndex(toDate);
                const toDayIdx = getDayIndex(toDate);
                const toDay = s.schedule.months?.[toMonthIdx]?.days?.[toDayIdx];
                if (toDay) {
                    if (!Array.isArray(toDay.entries)) toDay.entries = [];

                    const exists = toDay.entries.some(e =>
                        e.personId === personId && e.shiftId === toShift && e.groupId === toGroup
                    );
                    if (!exists) {
                        toDay.entries.push({
                            personId,
                            shiftId: toShift,
                            groupId: toGroup,
                            status: 'A',
                            startTime: targetShift?.startTime || null,
                            endTime: targetShift?.endTime || null,
                            breakStart: targetShift?.breakStart || null,
                            breakEnd: targetShift?.breakEnd || null,
                        });
                    }
                }
            });

            showSuccess('✓ Pass flyttat');
            renderCalendar(container, ctx);
        } catch (err) {
            console.error('❌ Drag & drop error:', err);
            showWarning('❌ Kunde inte flytta pass');
        }

        dragData = null;
    });
}

/* ============================================================
 * DATE HELPERS
 * ============================================================ */
function getWeekDates(year, weekOffset) {
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const daysToMonday = jan1Day === 0 ? -6 : 1 - jan1Day;
    const firstMonday = new Date(year, 0, 1 + daysToMonday);

    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + weekOffset * 7);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateShort(date) {
    const d = date.getDate();
    const m = MONTH_NAMES[date.getMonth()].toLowerCase().slice(0, 3);
    return `${d} ${m}`;
}

function formatDayMonth(date) {
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

function isDateToday(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
}

function getMonthIndex(dateStr) {
    return parseInt(dateStr.split('-')[1], 10) - 1;
}

function getDayIndex(dateStr) {
    return parseInt(dateStr.split('-')[2], 10) - 1;
}

function isAbsenceOnDate(absence, dateStr) {
    if (!absence || !dateStr) return false;
    if (absence.pattern === 'single') return absence.date === dateStr;
    if (absence.pattern === 'range') {
        return dateStr >= (absence.startDate || '') && dateStr <= (absence.endDate || '9999-12-31');
    }
    if (absence.pattern === 'recurring') {
        if (dateStr < (absence.startDate || '') || dateStr > (absence.endDate || '9999-12-31')) return false;
        if (!Array.isArray(absence.days)) return false;
        return absence.days.includes(new Date(dateStr).getDay());
    }
    return false;
}

function formatCurrency(amount) {
    if (!amount || !Number.isFinite(amount)) return '0 kr';
    return Math.round(amount).toLocaleString('sv-SE') + ' kr';
