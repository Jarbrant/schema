/*
 * AO-07 — Schedule View (Calendar) — v2.1 (modulariserad)
 * FIL: src/views/calendar.js
 *
 * Huvudfil: orchestrering, state-setup, event listeners, drag & drop.
 * Renderings-logik delegerad till:
 *   - calendar-helpers.js  (konstanter, datum, XSS)
 *   - calendar-topbar.js   (topbar, warnings, preview)
 *   - calendar-groups.js   (grupp-sektioner, personkort)
 *   - calendar-modals.js   (assign + edit modaler)
 */

import { showSuccess, showWarning } from '../ui.js';
import {
    calcShiftHours,
    generateWeekSchedule,
    validateScheduleIntegrity,
} from '../modules/schedule-engine.js';

import {
    WEEKDAY_NAMES, formatISO, formatDayMonth, isDateToday,
    getWeekDates, getISOWeekNumber, getMonthIndex, getDayIndex,
    escapeHtml,
} from './calendar-helpers.js';

import { renderTopBar, renderWarnings, renderGeneratePreview } from './calendar-topbar.js';
import { renderGroupSections } from './calendar-groups.js';
import { renderAssignModal, renderEditModal } from './calendar-modals.js';

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

        if (!ctx._cal) {
            const now = new Date();
            const startOfYear = new Date(year, 0, 1);
            const diffMs = now.getTime() - startOfYear.getTime();
            ctx._cal = {
                weekOffset: Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))),
                collapsedGroups: {},
                assignModal: null,
                editModal: null,
                generatePreview: null,
            };
        }
        const cal = ctx._cal;

        const weekDates = getWeekDates(year, cal.weekOffset);
        const weekNum = getISOWeekNumber(weekDates[0]);
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
        const isLocked = lockedWeeks.includes(weekKey);

        const linkedTemplateId = calendarWeeks[weekKey] || null;
        const linkedTemplate = linkedTemplateId ? weekTemplates[linkedTemplateId] : null;

        const weekSchedule = buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, groupShifts, people);
        const warnings = validateScheduleIntegrity(state.schedule.months, allPeople, absences);
        const weekWarnings = warnings.filter(w => weekDates.some(d => formatISO(d) === w.date));

        container.innerHTML = `
            <div class="cal-container">
                ${renderTopBar(cal, weekNum, weekDates, isLocked, linkedTemplate, weekTemplates, weekKey)}
                ${weekWarnings.length > 0 ? renderWarnings(weekWarnings) : ''}
                ${cal.generatePreview ? renderGeneratePreview(cal.generatePreview, people, groups, shifts, shiftTemplates) : ''}

                <div class="cal-week-header">
                    <div class="cal-row-label"></div>
                    ${weekDates.map((d, i) => `
                        <div class="cal-day-col-header ${isDateToday(d) ? 'today' : ''} ${i === 6 ? 'sunday' : ''} ${i === 5 ? 'saturday' : ''}">
                            <span class="cal-day-name">${WEEKDAY_NAMES[i]}</span>
                            <span class="cal-day-date">${formatDayMonth(d)}</span>
                        </div>
                    `).join('')}
                </div>

                ${renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, demand, absences, vacancies, cal, isLocked)}
                ${cal.assignModal ? renderAssignModal(cal.assignModal, groups, shifts, shiftTemplates, groupShifts, people, absences, weekDates, state) : ''}
                ${cal.editModal ? renderEditModal(cal.editModal, groups, shifts, shiftTemplates, people, state) : ''}
            </div>
        `;

        setupListeners(container, store, ctx, weekDates, isLocked, linkedTemplate);
        setupDragAndDrop(container, store, ctx, isLocked);

    } catch (err) {
        console.error('❌ renderCalendar kraschade:', err);
        container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ============================================================
 * BUILD WEEK SCHEDULE DATA
 * ============================================================ */
function buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, groupShifts, people) {
    const result = {};
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    Object.keys(groups).forEach(gid => {
        result[gid] = {};
        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const dayData = state.schedule?.months?.[getMonthIndex(dateStr)]?.days?.[getDayIndex(dateStr)];
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
function setupListeners(container, store, ctx, weekDates, isLocked, linkedTemplate) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cal]');
        if (!btn) return;
        const action = btn.dataset.cal;
        const cal = ctx._cal;

        try {
            if (action === 'prev-week') {
                cal.weekOffset = Math.max(0, cal.weekOffset - 1);
                cal.generatePreview = null;
                renderCalendar(container, ctx);
            } else if (action === 'next-week') {
                cal.weekOffset = Math.min(52, cal.weekOffset + 1);
                cal.generatePreview = null;
                renderCalendar(container, ctx);
            } else if (action === 'today') {
                const s = store.getState();
                const now = new Date();
                cal.weekOffset = Math.max(0, Math.floor((now - new Date(s.schedule.year, 0, 1)) / 604800000));
                cal.generatePreview = null;
                renderCalendar(container, ctx);
            } else if (action === 'toggle-group') {
                const gid = btn.dataset.groupId;
                if (gid) cal.collapsedGroups[gid] = !cal.collapsedGroups[gid];
                renderCalendar(container, ctx);
            } else if (action === 'open-assign' && !isLocked) {
                cal.assignModal = { date: btn.dataset.date, groupId: btn.dataset.groupId, shiftId: btn.dataset.shiftId };
                renderCalendar(container, ctx);
            } else if (action === 'close-modal') {
                cal.assignModal = null;
                renderCalendar(container, ctx);
            } else if (action === 'assign-person' && !isLocked) {
                handleAssign(btn, cal, store, container, ctx);
            } else if ((action === 'unassign' || action === 'unassign-modal') && !isLocked) {
                handleUnassign(btn, action, cal, store, container, ctx);
            } else if (action === 'edit-entry' && !isLocked) {
                cal.editModal = { date: btn.dataset.date, personId: btn.dataset.personId, shiftId: btn.dataset.shiftId, groupId: btn.dataset.groupId };
                renderCalendar(container, ctx);
            } else if (action === 'save-edit' && !isLocked) {
                handleSaveEdit(cal, store, container, ctx);
            } else if (action === 'close-edit') {
                cal.editModal = null;
                renderCalendar(container, ctx);
            } else if (action === 'delete-entry' && !isLocked) {
                handleDeleteEntry(btn, cal, store, container, ctx);
            } else if (action === 'lock-week') {
                handleLockWeek(store, weekDates, container, ctx, true);
            } else if (action === 'unlock-week') {
                handleLockWeek(store, weekDates, container, ctx, false);
            } else if (action === 'generate' && !isLocked && linkedTemplate) {
                handleGenerate(store, weekDates, linkedTemplate, cal, container, ctx);
            } else if (action === 'apply-generate' && !isLocked) {
                handleApplyGenerate(cal, store, container, ctx);
            } else if (action === 'cancel-generate') {
                cal.generatePreview = null;
                renderCalendar(container, ctx);
            } else if (action === 'fill-vacancy' && !isLocked) {
                handleFillVacancy(btn, cal, store, container, ctx);
            }
        } catch (err) {
            console.error('❌ Calendar action error:', err);
            showWarning('❌ Ett fel uppstod');
        }
    });
}

/* ── Action handlers ── */

function handleAssign(btn, cal, store, container, ctx) {
    const personId = btn.dataset.personId;
    const modal = cal.assignModal;
    if (!personId || !modal) return;

    const { date, groupId, shiftId } = modal;
    const state = store.getState();
    const allShifts = { ...(state.shifts || {}), ...(state.shiftTemplates || {}) };
    const shift = allShifts[shiftId];

    store.update(s => {
        const day = s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
        if (!day) return;
        if (!Array.isArray(day.entries)) day.entries = [];
        if (day.entries.some(e => e.personId === personId && e.shiftId === shiftId && e.groupId === groupId)) return;
        day.entries.push({
            personId, shiftId, groupId, status: 'A',
            startTime: shift?.startTime || null, endTime: shift?.endTime || null,
            breakStart: shift?.breakStart || null, breakEnd: shift?.breakEnd || null,
        });
    });

    showSuccess('✓ Person tilldelad');
    cal.assignModal = null;
    renderCalendar(container, ctx);
}

function handleUnassign(btn, action, cal, store, container, ctx) {
    const personId = btn.dataset.personId;
    const date = btn.dataset.date || cal.assignModal?.date;
    const shiftId = btn.dataset.shiftId || cal.assignModal?.shiftId;
    if (!personId || !date) return;

    store.update(s => {
        const day = s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
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
}

function handleSaveEdit(cal, store, container, ctx) {
    if (!cal.editModal) return;
    const { date, personId, shiftId, groupId } = cal.editModal;

    store.update(s => {
        const day = s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
        if (!day || !Array.isArray(day.entries)) return;
        const entry = day.entries.find(e => e.personId === personId && e.shiftId === shiftId && e.groupId === groupId);
        if (!entry) return;
        entry.startTime = document.getElementById('cal-edit-start')?.value || null;
        entry.endTime = document.getElementById('cal-edit-end')?.value || null;
        entry.breakStart = document.getElementById('cal-edit-break-start')?.value || null;
        entry.breakEnd = document.getElementById('cal-edit-break-end')?.value || null;
        entry.status = document.getElementById('cal-edit-status')?.value || 'A';
    });

    showSuccess('✓ Pass uppdaterat');
    cal.editModal = null;
    renderCalendar(container, ctx);
}

function handleDeleteEntry(btn, cal, store, container, ctx) {
    const { personId, date, shiftId } = btn.dataset;
    if (!personId || !date) return;

    store.update(s => {
        const day = s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
        if (!day || !Array.isArray(day.entries)) return;
        day.entries = day.entries.filter(e => !(e.personId === personId && e.shiftId === shiftId));
    });

    showWarning('🗑️ Pass borttaget');
    cal.editModal = null;
    renderCalendar(container, ctx);
}

function handleLockWeek(store, weekDates, container, ctx, lock) {
    const state = store.getState();
    const year = state.schedule.year;
    const weekNum = getISOWeekNumber(weekDates[0]);
    const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

    store.update(s => {
        if (!Array.isArray(s.schedule.lockedWeeks)) s.schedule.lockedWeeks = [];
        if (lock) {
            if (!s.schedule.lockedWeeks.includes(weekKey)) s.schedule.lockedWeeks.push(weekKey);
        } else {
            s.schedule.lockedWeeks = s.schedule.lockedWeeks.filter(w => w !== weekKey);
        }
    });

    lock ? showSuccess(`🔒 Vecka ${weekNum} är nu låst`) : showWarning(`🔓 Vecka ${weekNum} upplåst`);
    renderCalendar(container, ctx);
}

function handleGenerate(store, weekDates, linkedTemplate, cal, container, ctx) {
    const state = store.getState();
    cal.generatePreview = generateWeekSchedule({
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
    renderCalendar(container, ctx);
}

function handleApplyGenerate(cal, store, container, ctx) {
    if (!cal.generatePreview) return;
    const { suggestions } = cal.generatePreview;

    store.update(s => {
        suggestions.forEach(sug => {
            const day = s.schedule.months?.[getMonthIndex(sug.date)]?.days?.[getDayIndex(sug.date)];
            if (!day) return;
            if (!Array.isArray(day.entries)) day.entries = [];
            if (day.entries.some(e => e.personId === sug.personId && e.shiftId === sug.shiftId && e.groupId === sug.groupId)) return;
            day.entries.push({
                personId: sug.personId, shiftId: sug.shiftId, groupId: sug.groupId,
                status: sug.status || 'A', startTime: sug.startTime, endTime: sug.endTime,
                breakStart: sug.breakStart, breakEnd: sug.breakEnd,
            });
        });
    });

    showSuccess(`✓ ${suggestions.length} tilldelningar tillämpade`);
    cal.generatePreview = null;
    renderCalendar(container, ctx);
}

function handleFillVacancy(btn, cal, store, container, ctx) {
    const vacancy = (store.getState().vacancies || []).find(v => v.id === btn.dataset.vacancyId);
    if (!vacancy) return;
    cal.assignModal = { date: vacancy.date, groupId: vacancy.groupId, shiftId: vacancy.shiftTemplateId };
    renderCalendar(container, ctx);
}

/* ============================================================
 * DRAG & DROP
 * ============================================================ */
function setupDragAndDrop(container, store, ctx, isLocked) {
    if (isLocked) return;
    let dragData = null;

    container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('[data-drag-person]');
        if (!card) return;
        dragData = {
            personId: card.dataset.dragPerson, shiftId: card.dataset.dragShift,
            groupId: card.dataset.dragGroup, fromDate: card.dataset.dragDate,
        };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        card.classList.add('cal-dragging');
        setTimeout(() => { card.style.opacity = '0.4'; }, 0);
    });

    container.addEventListener('dragend', (e) => {
        const card = e.target.closest('[data-drag-person]');
        if (card) { card.classList.remove('cal-dragging'); card.style.opacity = ''; }
        container.querySelectorAll('.cal-drop-target').forEach(el => el.classList.remove('cal-drop-target'));
        dragData = null;
    });

    container.addEventListener('dragover', (e) => {
        const dz = e.target.closest('[data-drop-zone]');
        if (!dz || !dragData) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dz.classList.add('cal-drop-target');
    });

    container.addEventListener('dragleave', (e) => {
        const dz = e.target.closest('[data-drop-zone]');
        if (dz) dz.classList.remove('cal-drop-target');
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const dz = e.target.closest('[data-drop-zone]');
        if (!dz || !dragData) return;
        dz.classList.remove('cal-drop-target');

        const { personId, shiftId: fromShift, groupId: fromGroup, fromDate } = dragData;
        const toDate = dz.dataset.dropDate, toGroup = dz.dataset.dropGroup, toShift = dz.dataset.dropShift;

        if (toDate === fromDate && toGroup === fromGroup && toShift === fromShift) { dragData = null; return; }

        try {
            const allShifts = { ...(store.getState().shifts || {}), ...(store.getState().shiftTemplates || {}) };
            const targetShift = allShifts[toShift];

            store.update(s => {
                // Remove from source
                const fromDay = s.schedule.months?.[getMonthIndex(fromDate)]?.days?.[getDayIndex(fromDate)];
                if (fromDay?.entries) {
                    fromDay.entries = fromDay.entries.filter(e =>
                        !(e.personId === personId && e.shiftId === fromShift && e.groupId === fromGroup));
                }
                // Add to target
                const toDay = s.schedule.months?.[getMonthIndex(toDate)]?.days?.[getDayIndex(toDate)];
                if (toDay) {
                    if (!Array.isArray(toDay.entries)) toDay.entries = [];
                    if (!toDay.entries.some(e => e.personId === personId && e.shiftId === toShift && e.
