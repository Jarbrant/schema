/*
 * AO-07 — Schedule View (Calendar) — KOMPLETT OMSKRIVNING
 *
 * Personalkollen-inspirerad veckovy:
 *   - Veckonavigering (◀ Vecka 8 ▶) med datum-spann
 *   - Grupper som hopfällbara sektioner
 *   - Per grupp: pass-rader med personkort (namn + tid + färg)
 *   - Frånvaro (SEM/SJ/VAB etc.) visas inline
 *   - Vakanser ("Utlagt pass") markeras
 *   - Timmar + kostnad per grupp/dag
 *   - Klickbar tilldelning: välj person → spara entry
 *   - Månadsväljare som alternativ vy
 *
 * Kontrakt:
 *   - ctx.store måste finnas
 *   - Exporterar renderCalendar(container, ctx)
 *   - XSS-safe: escapeHtml + sanitizeColor
 *   - Inga globala DOM-side-effects
 */

/* ============================================================
 * IMPORTS
 * ============================================================ */
import { showSuccess, showWarning } from '../ui.js';

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const WEEKDAY_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTH_NAMES = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

const ABSENCE_LABELS = {
    SEM: 'Semester',
    SJ: 'Sjuk',
    VAB: 'VAB',
    FÖR: 'Föräldraledig',
    PERM: 'Permission',
    UTB: 'Utbildning',
    TJL: 'Tjänstledig',
};

const ABSENCE_COLORS = {
    SEM: { bg: '#fff9c4', text: '#f57f17', border: '#fbc02d' },
    SJ: { bg: '#ffcdd2', text: '#b71c1c', border: '#ef5350' },
    VAB: { bg: '#ffe0b2', text: '#e65100', border: '#ff9800' },
    FÖR: { bg: '#f8bbd0', text: '#880e4f', border: '#ec407a' },
    PERM: { bg: '#b2dfdb', text: '#004d40', border: '#26a69a' },
    UTB: { bg: '#e1bee7', text: '#4a148c', border: '#ab47bc' },
    TJL: { bg: '#b2dfdb', text: '#004d40', border: '#26a69a' },
};

const STATUS_COLORS = {
    A: { bg: '#c8e6c9', text: '#1b5e20', border: '#66bb6a' },
    L: { bg: '#f0f0f0', text: '#424242', border: '#bdbdbd' },
    X: { bg: '#bbdefb', text: '#0d47a1', border: '#42a5f5' },
    EXTRA: { bg: '#424242', text: '#ffeb3b', border: '#616161' },
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
        const demand = state.demand || {};
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const vacancies = Array.isArray(state.vacancies) ? state.vacancies : [];
        const lockedWeeks = Array.isArray(state.schedule.lockedWeeks) ? state.schedule.lockedWeeks : [];

        // ── View-state (persisted on ctx) ──
        if (!ctx._cal) {
            ctx._cal = {
                viewMode: 'week',       // 'week' | 'month'
                weekOffset: 0,          // 0 = current week
                selectedMonth: new Date().getMonth() + 1,
                collapsedGroups: {},     // { groupId: true }
                assignModal: null,      // { date, groupId, shiftId } or null
            };
            // Set weekOffset to show current week of the year
            const now = new Date();
            const startOfYear = new Date(year, 0, 1);
            const diffMs = now.getTime() - startOfYear.getTime();
            const currentWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
            ctx._cal.weekOffset = currentWeek;
        }
        const cal = ctx._cal;

        // ── Compute week dates ──
        const weekDates = getWeekDates(year, cal.weekOffset);
        const weekNum = getISOWeekNumber(weekDates[0]);
        const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
        const isLocked = lockedWeeks.includes(weekKey);

        // ── Build schedule data for this week ──
        const weekSchedule = buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, groupShifts, people, absences, vacancies);

        // ── Render ──
        const html = `
            <div class="cal-container">
                <!-- TOP BAR -->
                <div class="cal-topbar">
                    <div class="cal-topbar-left">
                        <button class="btn btn-secondary btn-sm" data-cal="view-week" ${cal.viewMode === 'week' ? 'disabled' : ''}>Veckovy</button>
                        <button class="btn btn-secondary btn-sm" data-cal="view-month" ${cal.viewMode === 'month' ? 'disabled' : ''}>Månadsvy</button>
                    </div>
                    <div class="cal-topbar-center">
                        <button class="btn btn-secondary" data-cal="prev-week">◀</button>
                        <div class="cal-week-display">
                            <strong>Vecka ${weekNum}</strong>
                            <span class="cal-week-range">${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}</span>
                        </div>
                        <button class="btn btn-secondary" data-cal="next-week">▶</button>
                        <button class="btn btn-secondary btn-sm" data-cal="today" title="Gå till denna vecka">Idag</button>
                    </div>
                    <div class="cal-topbar-right">
                        ${isLocked
                            ? `<span class="cal-locked-badge">🔒 Låst</span>`
                            : `<button class="btn btn-secondary btn-sm" data-cal="lock-week" title="Lås veckan">🔓 Lås vecka</button>`
                        }
                    </div>
                </div>

                <!-- WEEK HEADER (days) -->
                <div class="cal-week-header">
                    <div class="cal-row-label"></div>
                    ${weekDates.map((d, i) => {
                        const isToday = isDateToday(d);
                        const isSunday = i === 6;
                        const isSaturday = i === 5;
                        return `
                            <div class="cal-day-col-header ${isToday ? 'today' : ''} ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}">
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
            </div>
        `;

        container.innerHTML = html;
        setupCalendarListeners(container, store, ctx, weekDates, isLocked);

    } catch (err) {
        console.error('❌ renderCalendar kraschade:', err);
        container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>Kunde inte visa schema: ${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ============================================================
 * GROUP SECTIONS (Personalkollen-style)
 * ============================================================ */
function renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, demand, absences, vacancies, cal, isLocked) {
    const groupIds = Object.keys(groups).filter(gid => gid !== 'SYSTEM_ADMIN');

    if (groupIds.length === 0) {
        return '<p class="cal-empty">Inga grupper konfigurerade.</p>';
    }

    return groupIds.map(gid => {
        const g = groups[gid];
        const isCollapsed = !!cal.collapsedGroups[gid];
        const linkedShiftIds = Array.isArray(groupShifts[gid]) ? groupShifts[gid] : [];
        const groupData = weekSchedule[gid] || {};

        // Calculate totals for the group header
        let totalHours = 0;
        let totalCost = 0;
        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const dayData = groupData[dateStr] || { entries: [], hours: 0, cost: 0 };
            totalHours += dayData.hours;
            totalCost += dayData.cost;
        });

        return `
            <div class="cal-group-section" data-group-id="${escapeHtml(gid)}">
                <!-- GROUP HEADER -->
                <div class="cal-group-header" data-cal="toggle-group" data-group-id="${escapeHtml(gid)}"
                     style="border-left: 5px solid ${sanitizeColor(g.color)}">
                    <span class="cal-group-toggle">${isCollapsed ? '▶' : '▼'}</span>
                    <span class="cal-group-color" style="background: ${sanitizeColor(g.color)}; color: ${sanitizeColor(g.textColor || '#fff')}">
                        ${escapeHtml(g.name)}
                    </span>
                    <span class="cal-group-totals">
                        ${totalHours.toFixed(1)} tim &nbsp;·&nbsp; ${formatCurrency(totalCost)}
                    </span>
                    <!-- Per-day summary row -->
                    <div class="cal-group-day-summary">
                        ${weekDates.map(date => {
                            const dateStr = formatISO(date);
                            const dayData = groupData[dateStr] || { hours: 0, cost: 0 };
                            return `
                                <div class="cal-day-summary-cell">
                                    <span class="cal-summary-hours">${dayData.hours.toFixed(1)} tim</span>
                                    <span class="cal-summary-cost">${formatCurrency(dayData.cost)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- GROUP BODY (shift rows) -->
                ${!isCollapsed ? renderGroupBody(gid, groupData, weekDates, g, shifts, shiftTemplates, linkedShiftIds, people, absences, vacancies, demand, isLocked) : ''}
            </div>
        `;
    }).join('');
}

/* ============================================================
 * GROUP BODY — shift rows with person cards
 * ============================================================ */
function renderGroupBody(gid, groupData, weekDates, group, shifts, shiftTemplates, linkedShiftIds, people, absences, vacancies, demand, isLocked) {
    if (linkedShiftIds.length === 0) {
        return `<div class="cal-group-body"><p class="cal-empty-small">Inga grundpass kopplade.</p></div>`;
    }

    // Build one section per shift
    const shiftSections = linkedShiftIds.map(sid => {
        const shift = shifts[sid] || shiftTemplates[sid];
        if (!shift) return '';

        const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : 'Flex';
        const shiftColor = sanitizeColor(shift.color || '#777');

        // Demand for this group (weekday-based)
        const demandArr = demand?.groupDemands?.[gid];

        return `
            <div class="cal-shift-section">
                <!-- Shift label (left side) -->
                <div class="cal-shift-label" style="border-left: 4px solid ${shiftColor}">
                    <span class="cal-shift-dot" style="background: ${shiftColor}"></span>
                    <div class="cal-shift-info">
                        <strong>${escapeHtml(shift.name)}</strong>
                        <span class="cal-shift-time">${escapeHtml(timeStr)}</span>
                    </div>
                </div>

                <!-- Day columns -->
                <div class="cal-shift-days">
                    ${weekDates.map((date, dayIdx) => {
                        const dateStr = formatISO(date);
                        const dayData = groupData[dateStr] || { entries: [] };

                        // Entries for this shift on this day
                        const shiftEntries = dayData.entries.filter(e =>
                            e.shiftId === sid && e.groupId === gid
                        );

                        // Absences for people in this group on this day
                        const groupPeople = people.filter(p => {
                            const pGroups = p.groups || p.groupIds || [];
                            return pGroups.includes(gid);
                        });
                        const dayAbsences = absences.filter(abs =>
                            groupPeople.some(p => p.id === abs.personId) &&
                            isAbsenceOnDate(abs, dateStr)
                        );

                        // Vacancies for this shift/group/day
                        const dayVacancies = vacancies.filter(v =>
                            v.date === dateStr && v.groupId === gid &&
                            (v.shiftTemplateId === sid) && v.status !== 'filled'
                        );

                        const neededCount = Array.isArray(demandArr) ? (demandArr[dayIdx] || 0) : 0;
                        const assignedCount = shiftEntries.filter(e => e.personId && e.status === 'A').length;
                        const isSunday = dayIdx === 6;
                        const isSaturday = dayIdx === 5;

                        return `
                            <div class="cal-day-cell ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''} ${isDateToday(date) ? 'today' : ''}">
                                <!-- Assigned persons -->
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
                                        <div class="cal-person-card" style="background: ${statusStyle.bg}; color: ${statusStyle.text}; border-left: 4px solid ${statusStyle.border}"
                                             title="${escapeHtml(personName)} · ${escapeHtml(entryTime)}">
                                            <span class="cal-card-time">${escapeHtml(entryTime)}</span>
                                            <span class="cal-card-name">${escapeHtml(personName)}</span>
                                            ${!isLocked ? `<button class="cal-card-remove" data-cal="unassign" data-date="${dateStr}" data-person-id="${escapeHtml(entry.personId)}" data-shift-id="${escapeHtml(sid)}" title="Ta bort">×</button>` : ''}
                                        </div>
                                    `;
                                }).join('')}

                                <!-- Absences -->
                                ${dayAbsences.map(abs => {
                                    const person = people.find(p => p.id === abs.personId);
                                    if (!person) return '';
                                    // Don't show absence if person is already shown as assigned
                                    if (shiftEntries.some(e => e.personId === abs.personId)) return '';
                                    const personName = person.firstName && person.lastName
                                        ? `${person.firstName} ${person.lastName}`
                                        : (person.name || person.id);
                                    const absStyle = ABSENCE_COLORS[abs.type] || ABSENCE_COLORS.SEM;
                                    const absLabel = ABSENCE_LABELS[abs.type] || abs.type;

                                    return `
                                        <div class="cal-person-card cal-absence-card" style="background: ${absStyle.bg}; color: ${absStyle.text}; border-left: 4px solid ${absStyle.border}">
                                            <span class="cal-card-status">${escapeHtml(absLabel)}</span>
                                            <span class="cal-card-name">${escapeHtml(personName)}</span>
                                        </div>
                                    `;
                                }).join('')}

                                <!-- Vacancies -->
                                ${dayVacancies.map(vac => {
                                    return `
                                        <div class="cal-person-card cal-vacancy-card">
                                            <span class="cal-card-status">Utlagt pass</span>
                                            <span class="cal-card-time">${escapeHtml(timeStr)}</span>
                                            ${!isLocked ? `<button class="btn btn-sm cal-vacancy-accept" data-cal="fill-vacancy" data-vacancy-id="${escapeHtml(vac.id)}" data-date="${dateStr}">+ Fyll</button>` : ''}
                                        </div>
                                    `;
                                }).join('')}

                                <!-- Add button -->
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
    const group = groups[groupId];
    const shift = shifts[shiftId] || shiftTemplates[shiftId];
    if (!group || !shift) return '';

    const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : 'Flex';

    // Find eligible people (in this group, active, not absent, not already assigned)
    const monthIdx = getMonthIndex(date);
    const dayIdx = getDayIndex(date);
    const monthData = state.schedule?.months?.[monthIdx];
    const dayData = monthData?.days?.[dayIdx];
    const existingEntries = dayData?.entries || [];

    const alreadyAssigned = existingEntries
        .filter(e => e.shiftId === shiftId && e.groupId === groupId && e.personId)
        .map(e => e.personId);

    const groupPeople = people.filter(p => {
        const pGroups = p.groups || p.groupIds || [];
        return pGroups.includes(groupId) && p.isActive;
    });

    const absentIds = absences
        .filter(abs => isAbsenceOnDate(abs, date))
        .map(abs => abs.personId);

    const eligible = groupPeople.map(p => {
        const isAssigned = alreadyAssigned.includes(p.id);
        const isAbsent = absentIds.includes(p.id);
        // Check if already working another shift this day
        const isOtherShift = existingEntries.some(e =>
            e.personId === p.id && e.shiftId !== shiftId && e.status === 'A'
        );

        let reason = null;
        if (isAssigned) reason = 'Redan tilldelad detta pass';
        else if (isAbsent) reason = 'Frånvarande';
        else if (isOtherShift) reason = 'Arbetar annat pass';

        // Check availability (weekday)
        const dayOfWeek = new Date(date).getDay(); // 0=sun
        const availIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // mon=0
        if (!reason && Array.isArray(p.availability) && !p.availability[availIdx]) {
            reason = 'Ej tillgänglig denna dag';
        }

        // Check preferred/avoid shifts
        const isPreferred = Array.isArray(p.preferredShifts) && p.preferredShifts.includes(shiftId);
        const isAvoided = Array.isArray(p.avoidShifts) && p.avoidShifts.includes(shiftId);

        return {
            person: p,
            eligible: !reason,
            reason,
            isPreferred,
            isAvoided,
            isAssigned,
        };
    });

    // Sort: eligible first, then preferred first
    eligible.sort((a, b) => {
        if (a.eligible && !b.eligible) return -1;
        if (!a.eligible && b.eligible) return 1;
        if (a.isPreferred && !b.isPreferred) return -1;
        if (!a.isPreferred && b.isPreferred) return 1;
        return (a.person.lastName || '').localeCompare(b.person.lastName || '');
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
                                <thead>
                                    <tr>
                                        <th>Namn</th>
                                        <th>Tjänstegrad</th>
                                        <th>Typ</th>
                                        <th>Status</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${eligible.map(item => {
                                        const p = item.person;
                                        const name = p.firstName && p.lastName
                                            ? `${p.lastName}, ${p.firstName}`
                                            : (p.name || p.id);
                                        const typeLabel = p.employmentType === 'substitute' ? 'Vikarie' : 'Ordinarie';

                                        return `
                                            <tr class="${!item.eligible ? 'row-disabled' : ''} ${item.isPreferred ? 'row-preferred' : ''} ${item.isAvoided ? 'row-avoided' : ''}">
                                                <td><strong>${escapeHtml(name)}</strong></td>
                                                <td>${p.employmentPct || 0}%</td>
                                                <td>${escapeHtml(typeLabel)}</td>
                                                <td>
                                                    ${item.eligible
                                                        ? (item.isPreferred ? '⭐ Föredrar' : '✅ Tillgänglig')
                                                        : `❌ ${escapeHtml(item.reason || 'Ej tillgänglig')}`
                                                    }
                                                    ${item.isAvoided ? ' ⚠️ Undviker' : ''}
                                                </td>
                                                <td>
                                                    ${item.eligible
                                                        ? `<button class="btn btn-sm btn-primary" data-cal="assign-person" data-person-id="${escapeHtml(p.id)}">📌 Tilldela</button>`
                                                        : (item.isAssigned
                                                            ? `<button class="btn btn-sm btn-danger" data-cal="unassign-modal" data-person-id="${escapeHtml(p.id)}">🗑️ Ta bort</button>`
                                                            : '')
                                                    }
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        `
                    }
                </div>
            </div>
        </div>
    `;
}

/* ============================================================
 * BUILD WEEK SCHEDULE DATA
 * ============================================================ */
function buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, groupShifts, people, absences, vacancies) {
    const result = {}; // { groupId: { "YYYY-MM-DD": { entries: [], hours, cost } } }

    Object.keys(groups).forEach(gid => {
        result[gid] = {};
        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const monthIdx = getMonthIndex(dateStr);
            const dayIdx = getDayIndex(dateStr);
            const monthData = state.schedule?.months?.[monthIdx];
            const dayData = monthData?.days?.[dayIdx];

            const entries = (dayData?.entries || []).filter(e => e.groupId === gid);
            let hours = 0;
            let cost = 0;

            entries.forEach(e => {
                if (e.status !== 'A') return;
                const shift = shifts[e.shiftId] || shiftTemplates[e.shiftId];
                if (!shift) return;
                const h = calcShiftHours(shift, e);
                hours += h;
                if (e.personId) {
                    const person = people.find(p => p.id === e.personId);
                    if (person) {
                        const wage = person.hourlyWage || 0;
                        cost += h * wage;
                    }
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
function setupCalendarListeners(container, store, ctx, weekDates, isLocked) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cal]');
        if (!btn) return;
        const action = btn.dataset.cal;
        const cal = ctx._cal;

        try {
            switch (action) {
                case 'prev-week':
                    cal.weekOffset = Math.max(0, cal.weekOffset - 1);
                    renderCalendar(container, ctx);
                    break;

                case 'next-week':
                    cal.weekOffset = Math.min(52, cal.weekOffset + 1);
                    renderCalendar(container, ctx);
                    break;

                case 'today': {
                    const state = store.getState();
                    const year = state.schedule.year;
                    const now = new Date();
                    const startOfYear = new Date(year, 0, 1);
                    const diffMs = now.getTime() - startOfYear.getTime();
                    cal.weekOffset = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
                    renderCalendar(container, ctx);
                    break;
                }

                case 'view-week':
                    cal.viewMode = 'week';
                    renderCalendar(container, ctx);
                    break;

                case 'view-month':
                    cal.viewMode = 'month';
                    renderCalendar(container, ctx);
                    break;

                case 'toggle-group': {
                    const gid = btn.dataset.groupId;
                    if (gid) {
                        cal.collapsedGroups[gid] = !cal.collapsedGroups[gid];
                        renderCalendar(container, ctx);
                    }
                    break;
                }

                case 'open-assign': {
                    if (isLocked) break;
                    cal.assignModal = {
                        date: btn.dataset.date,
                        groupId: btn.dataset.groupId,
                        shiftId: btn.dataset.shiftId,
                    };
                    renderCalendar(container, ctx);
                    break;
                }

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
                    const shift = state.shifts?.[shiftId] || state.shiftTemplates?.[shiftId];

                    store.update(s => {
                        const day = s.schedule.months?.[monthIdx]?.days?.[dayIdx];
                        if (!day) return;
                        if (!Array.isArray(day.entries)) day.entries = [];

                        // Check not already assigned to this shift
                        const exists = day.entries.some(e =>
                            e.personId === personId && e.shiftId === shiftId && e.groupId === groupId
                        );
                        if (exists) return;

                        day.entries.push({
                            personId,
                            shiftId,
                            groupId,
                            status: 'A',
                            startTime: shift?.startTime || null,
                            endTime: shift?.endTime || null,
                            breakStart: shift?.breakStart || null,
                            breakEnd: shift?.breakEnd || null,
                        });
                    });

                    showSuccess(`✓ Person tilldelad`);
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

                case 'lock-week': {
                    const state = store.getState();
                    const year = state.schedule.year;
                    const weekNum = getISOWeekNumber(weekDates[0]);
                    const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

                    store.update(s => {
                        if (!Array.isArray(s.schedule.lockedWeeks)) s.schedule.lockedWeeks = [];
                        if (!s.schedule.lockedWeeks.includes(weekKey)) {
                            s.schedule.lockedWeeks.push(weekKey);
                        }
                    });

                    showSuccess(`🔒 Vecka ${weekNum} är nu låst`);
                    renderCalendar(container, ctx);
                    break;
                }

                case 'fill-vacancy': {
                    if (isLocked) break;
                    const vacancyId = btn.dataset.vacancyId;
                    const date = btn.dataset.date;
                    if (!vacancyId || !date) break;

                    // Open assign modal for this vacancy
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
 * DATE HELPERS
 * ============================================================ */
function getWeekDates(year, weekOffset) {
    // Start from Jan 1 of the year, find monday of that week, then offset
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay(); // 0=sun
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
    const parts = dateStr.split('-');
    return parseInt(parts[1], 10) - 1;
}

function getDayIndex(dateStr) {
    const parts = dateStr.split('-');
    return parseInt(parts[2], 10) - 1;
}

function isAbsenceOnDate(absence, dateStr) {
    if (!absence) return false;
    if (absence.pattern === 'single') return absence.date === dateStr;
    if (absence.pattern === 'range') {
        return dateStr >= (absence.startDate || '') && dateStr <= (absence.endDate || '9999-12-31');
    }
    if (absence.pattern === 'recurring') {
        if (dateStr < (absence.startDate || '') || dateStr > (absence.endDate || '9999-12-31')) return false;
        if (!Array.isArray(absence.days)) return false;
        const dayOfWeek = new Date(dateStr).getDay(); // 0=sun
        return absence.days.includes(dayOfWeek);
    }
    return false;
}

function calcShiftHours(shift, entry) {
    const start = entry?.startTime || shift?.startTime;
    const end = entry?.endTime || shift?.endTime;
    const breakS = entry?.breakStart || shift?.breakStart;
    const breakE = entry?.breakEnd || shift?.breakEnd;

    if (!start || !end) return 0;

    let hours = timeToMinutes(end) - timeToMinutes(start);
    if (hours < 0) hours += 24 * 60; // overnight shift

    if (breakS && breakE) {
        let breakMin = timeToMinutes(breakE) - timeToMinutes(breakS);
        if (breakMin < 0) breakMin += 24 * 60;
        hours -= breakMin;
    }

    return Math.max(0, hours / 60);
}

function timeToMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const parts = hhmm.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function formatCurrency(amount) {
    if (!amount || !Number.isFinite(amount)) return '0 kr';
    return Math.round(amount).toLocaleString('sv-SE') + ' kr';
}

function getStatusStyle(status) {
    if (ABSENCE_COLORS[status]) return ABSENCE_COLORS[status];
    if (STATUS_COLORS[status]) return STATUS_COLORS[status];
    return STATUS_COLORS.A;
}

/* ============================================================
 * XSS HELPERS
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
