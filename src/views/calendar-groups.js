/*
 * AO-07 — Calendar Group Sections & Person Cards
 * FIL: src/views/calendar-groups.js
 *
 * Renderar grupp-sektioner med pass-rader, personkort,
 * frånvaro, vakanser och drag & drop-attribut.
 */

import { calcShiftHours } from '../modules/schedule-engine.js';
import {
    escapeHtml, sanitizeColor, formatISO, formatCurrency,
    isDateToday, isAbsenceOnDate, getStatusStyle,
    ABSENCE_LABELS, ABSENCE_COLORS,
} from './calendar-helpers.js';

/* ============================================================
 * GROUP SECTIONS
 * ============================================================ */
export function renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, demand, absences, vacancies, cal, isLocked) {
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
 * GROUP BODY — shift rows with person cards
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
                    ${weekDates.map((date, dayIdx) => renderDayCell(
                        gid, sid, date, dayIdx, groupData, timeStr, people, absences, vacancies, isLocked
                    )).join('')}
                </div>
            </div>
        `;
    }).join('');

    return `<div class="cal-group-body">${shiftSections}</div>`;
}

/* ============================================================
 * DAY CELL — enskild dag-ruta med personkort
 * ============================================================ */
function renderDayCell(gid, sid, date, dayIdx, groupData, timeStr, people, absences, vacancies, isLocked) {
    const dateStr = formatISO(date);
    const dayData = groupData[dateStr] || { entries: [] };

    const shiftEntries = dayData.entries.filter(e => e.shiftId === sid && e.groupId === gid);

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

            ${shiftEntries.filter(e => e.personId).map(entry =>
                renderPersonCard(entry, sid, gid, dateStr, timeStr, people, isLocked)
            ).join('')}

            ${dayAbsences.map(abs => renderAbsenceCard(abs, people)).join('')}

            ${dayVacancies.map(vac => renderVacancyCard(vac, dateStr, timeStr, isLocked)).join('')}

            ${!isLocked ? `
                <button class="cal-add-btn" data-cal="open-assign"
                        data-date="${dateStr}" data-group-id="${escapeHtml(gid)}" data-shift-id="${escapeHtml(sid)}"
                        title="Lägg till person">+</button>
            ` : ''}
        </div>
    `;
}

/* ============================================================
 * PERSON CARD (assigned)
 * ============================================================ */
function renderPersonCard(entry, sid, gid, dateStr, timeStr, people, isLocked) {
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
}

/* ============================================================
 * ABSENCE CARD
 * ============================================================ */
function renderAbsenceCard(abs, people) {
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
}

/* ============================================================
 * VACANCY CARD
 * ============================================================ */
function renderVacancyCard(vac, dateStr, timeStr, isLocked) {
    return `
        <div class="cal-person-card cal-vacancy-card">
            <span class="cal-card-status">Utlagt pass</span>
            <span class="cal-card-time">${escapeHtml(timeStr)}</span>
            ${!isLocked ? `<button class="btn btn-sm cal-vacancy-accept" data-cal="fill-vacancy"
                    data-vacancy-id="${escapeHtml(vac.id)}" data-date="${dateStr}">+ Fyll</button>` : ''}
        </div>
    `;
}
