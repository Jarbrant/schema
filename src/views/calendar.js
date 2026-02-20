/*
 * AO-07 — Schedule View (Calendar) — v2.6 STANDALONE (AUTOPATCH)
 * FIL: src/views/calendar.js
 */

import { showSuccess, showWarning } from '../ui.js';
import {
    calcShiftHours,
    generateWeekSchedule,
    generatePeriodSchedule,
    validateScheduleIntegrity,
    getEligiblePersons,
} from '../modules/schedule-engine.js';
/* ============================================================
 * BLOCK 1 — CONSTANTS
 * ============================================================ */
const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const MONTH_NAMES = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
const ABSENCE_LABELS = { SEM:'Semester', SJ:'Sjuk', VAB:'VAB', FÖR:'Föräldraledig', PERM:'Permission', UTB:'Utbildning', TJL:'Tjänstledig' };
const ABSENCE_COLORS = {
    SEM:{bg:'#fff9c4',text:'#f57f17',border:'#fbc02d'}, SJ:{bg:'#ffcdd2',text:'#b71c1c',border:'#ef5350'},
    VAB:{bg:'#ffe0b2',text:'#e65100',border:'#ff9800'}, FÖR:{bg:'#f8bbd0',text:'#880e4f',border:'#ec407a'},
    PERM:{bg:'#b2dfdb',text:'#004d40',border:'#26a69a'}, UTB:{bg:'#e1bee7',text:'#4a148c',border:'#ab47bc'},
    TJL:{bg:'#b2dfdb',text:'#004d40',border:'#26a69a'},
};
const STATUS_COLORS = {
    A:{bg:'#c8e6c9',text:'#1b5e20',border:'#66bb6a'}, L:{bg:'#f0f0f0',text:'#424242',border:'#bdbdbd'},
    X:{bg:'#bbdefb',text:'#0d47a1',border:'#42a5f5'}, EXTRA:{bg:'#424242',text:'#ffeb3b',border:'#616161'},
};
const MAX_WEEK_OFFSET = 53;

/* ============================================================
 * BLOCK 2 — MAIN RENDER
 * ============================================================ */
export function renderCalendar(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`; return; }

    try {
        const state = store.getState();
        if (!state.schedule || typeof state.schedule.year !== 'number') {
            container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>Schedule saknas.</p></div>`; return;
        }

        const year = state.schedule.year;
        const groups = (typeof state.groups === 'object' && state.groups) || {};
        const shifts = (typeof state.shifts === 'object' && state.shifts) || {};
        const shiftTemplates = (typeof state.shiftTemplates === 'object' && state.shiftTemplates) || {};
        const groupShifts = (typeof state.groupShifts === 'object' && state.groupShifts) || {};
        const people = Array.isArray(state.people) ? state.people.filter(p => p.isActive) : [];
        const allPeople = Array.isArray(state.people) ? state.people : [];
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const vacancies = Array.isArray(state.vacancies) ? state.vacancies : [];
        const weekTemplates = (typeof state.weekTemplates === 'object' && state.weekTemplates) || {};
        const calendarWeeks = (typeof state.calendarWeeks === 'object' && state.calendarWeeks) || {};
        const lockedWeeks = Array.isArray(state.schedule.lockedWeeks) ? state.schedule.lockedWeeks : [];

        if (!ctx._cal) {
            ctx._cal = {
                weekOffset: calcCurrentWeekOffset(year),
                collapsedGroups: {},
                collapsedShifts: {},
                assignModal: null,
                editModal: null,
                generatePreview: null,
                showLinkPanel: false,  /* v2.5: visa kopplingspanel */
            };
        }
        const cal = ctx._cal;
        if (!cal.collapsedShifts) cal.collapsedShifts = {};

        const weekDates = getWeekDates(year, cal.weekOffset);
        const weekNum = getISOWeekNumber(weekDates[0]);
        const weekKey = `${year}-W${String(weekNum).padStart(2,'0')}`;
        const isLocked = lockedWeeks.includes(weekKey);

        const linkedTemplateId = calendarWeeks[weekKey] || null;
        const linkedTemplate = linkedTemplateId ? weekTemplates[linkedTemplateId] : null;

        const weekSchedule = buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, people);
        const warnings = validateScheduleIntegrity(state.schedule.months, allPeople, absences);
        const weekWarnings = warnings.filter(w => weekDates.some(d => formatISO(d) === w.date));

        container.innerHTML = `
            <div class="cal-container">
                ${renderTopBar(cal, weekNum, weekDates, isLocked, linkedTemplate, weekTemplates, weekKey)}
                ${cal.showLinkPanel ? renderLinkPanel(weekKey, weekNum, linkedTemplateId, weekTemplates, calendarWeeks, year) : ''}
                ${weekWarnings.length > 0 ? renderWarnings(weekWarnings) : ''}
                ${cal.generatePreview ? renderGeneratePreview(cal.generatePreview, people, groups, shifts, shiftTemplates) : ''}
                <div class="cal-week-header">
                    <div class="cal-row-label"></div>
                    ${weekDates.map((d,i) => `
                        <div class="cal-day-col-header ${isDateToday(d)?'today':''} ${i===6?'sunday':''} ${i===5?'saturday':''}">
                            <span class="cal-day-name">${WEEKDAY_NAMES[i]}</span>
                            <span class="cal-day-date">${formatDayMonth(d)}</span>
                        </div>`).join('')}
                </div>
                ${renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, absences, vacancies, cal, isLocked)}
                ${cal.assignModal ? renderAssignModal(cal.assignModal, groups, shifts, shiftTemplates, groupShifts, people, absences, state) : ''}
                ${cal.editModal ? renderEditModal(cal.editModal, groups, shifts, shiftTemplates, people, state) : ''}
            </div>`;

        setupListeners(container, store, ctx, isLocked, linkedTemplate);
        setupDragAndDrop(container, store, ctx, isLocked);
    } catch (err) {
        console.error('❌ renderCalendar kraschade:', err);
        container.innerHTML = `<div class="cal-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ============================================================
 * BLOCK 3 — WEEK OFFSET HELPERS
 * ============================================================ */
function calcCurrentWeekOffset(year) {
    // NOTE: Om användaren bläddrar till annan year än "nu-år", så är detta en approximation.
    // Men den är stabil: den ger en offset relativt "första måndag i year".
    const now = new Date();
    const jan1 = new Date(year, 0, 1), d1 = jan1.getDay(), dtm = d1===0?-6:1-d1;
    const firstMonday = new Date(year, 0, 1 + dtm);
    const diffDays = Math.floor((now.getTime() - firstMonday.getTime()) / (24*60*60*1000));
    return Math.max(0, Math.min(MAX_WEEK_OFFSET, Math.floor(diffDays / 7)));
}

/* ============================================================
 * BLOCK 4 — TOP BAR (v2.5 link-panel trigger)
 * ============================================================ */
function renderTopBar(cal, weekNum, weekDates, isLocked, linkedTemplate, weekTemplates, weekKey) {
    const hasTemplates = Object.keys(weekTemplates).length > 0;

    // v2.5: badge är klickbar och togglar panelen
    const templateBadge = linkedTemplate
        ? `<span class="cal-template-badge" data-cal="toggle-link-panel" style="cursor:pointer;" title="Klicka för att ändra koppling">📋 ${escapeHtml(linkedTemplate.name)}</span>`
        : hasTemplates
            ? `<span class="cal-template-badge cal-no-template" data-cal="toggle-link-panel" style="cursor:pointer;" title="Klicka för att koppla veckomall">⚡ Koppla veckomall</span>`
            : `<span class="cal-template-badge cal-no-template" title="Skapa veckomallar först under Veckomallar">Inga veckomallar</span>`;

    return `<div class="cal-topbar">
        <div class="cal-topbar-left">${templateBadge}</div>
        <div class="cal-topbar-center">
            <button class="btn btn-secondary" data-cal="prev-week">◀</button>
            <div class="cal-week-display"><strong>Vecka ${weekNum}</strong>
                <span class="cal-week-range">${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}</span></div>
            <button class="btn btn-secondary" data-cal="next-week">▶</button>
            <button class="btn btn-secondary btn-sm" data-cal="today">Idag</button>
        </div>
        <div class="cal-topbar-right">
            ${!isLocked && linkedTemplate ? `<button class="btn btn-primary btn-sm" data-cal="generate">🤖 Generera</button>` : ''}
            ${isLocked
                ? `<button class="btn btn-sm cal-locked-badge" data-cal="unlock-week">🔒 Låst</button>`
                : `<button class="btn btn-secondary btn-sm" data-cal="lock-week">🔓 Lås vecka</button>`}
        </div></div>`;
}

/* ============================================================
 * BLOCK 5 — LINK PANEL (v2.5)
 * ============================================================ */
function renderLinkPanel(weekKey, weekNum, linkedTemplateId, weekTemplates, calendarWeeks, year) {
    const templateList = Object.values(weekTemplates);
    if (!templateList.length) {
        return `<div class="cal-link-panel">
            <div class="cal-link-header"><h3>📋 Koppla veckomall</h3>
                <button class="cal-modal-close" data-cal="toggle-link-panel" type="button">×</button></div>
            <p class="cal-empty">Inga veckomallar skapade. Gå till <a href="#/week-templates">📅 Veckomallar</a> och skapa en först.</p>
        </div>`;
    }

    const linkedCount = Object.keys(calendarWeeks).length;

    // Default: aktuell veckas måndag till +4 veckor
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const endDefault = new Date(monday);
    endDefault.setDate(monday.getDate() + 27);

    const fmtDate = (d) => d.toISOString().slice(0, 10);

    return `<div class="cal-link-panel">
        <div class="cal-link-header">
            <h3>📋 Koppla veckomall</h3>
            <button class="cal-modal-close" data-cal="toggle-link-panel" type="button">×</button>
        </div>
        <div class="cal-link-body">
            <div class="cal-link-current">
                <span class="cal-link-label">Nuvarande koppling (vecka ${weekNum}):</span>
                <strong>${linkedTemplateId ? escapeHtml(weekTemplates[linkedTemplateId]?.name || linkedTemplateId) : 'Ingen'}</strong>
            </div>

            <div class="cal-link-select-row">
                <label for="cal-link-template">Välj veckomall:</label>
                <select id="cal-link-template" class="cal-link-select">
                    <option value="">— Ingen (ta bort koppling) —</option>
                    ${templateList.map(t => `<option value="${escapeHtml(t.id)}" ${t.id === linkedTemplateId ? 'selected' : ''}>${escapeHtml(t.name)} (${t.slots ? t.slots.length : 0} slots)</option>`).join('')}
                </select>
            </div>

            <div class="cal-link-bulk-row" style="display:flex;gap:1rem;align-items:end;flex-wrap:wrap;">
                <div style="flex:1;min-width:140px;">
                    <label for="cal-link-from">Från datum:</label>
                    <input type="date" id="cal-link-from" class="cal-link-select" value="${fmtDate(monday)}">
                </div>
                <div style="flex:1;min-width:140px;">
                    <label for="cal-link-to">Till datum:</label>
                    <input type="date" id="cal-link-to" class="cal-link-select" value="${fmtDate(endDefault)}">
                </div>
            </div>

            <div class="cal-link-info">
                <span>ℹ️ ${linkedCount} veckor har kopplingar totalt</span>
            </div>

            <div class="cal-link-actions">
                <button class="btn btn-primary" data-cal="apply-link">✓ Koppla period</button>
                <button class="btn btn-primary" data-cal="apply-link-generate" style="background:#27ae60;">🤖 Koppla + Generera allt</button>
                <button class="btn btn-danger btn-sm" data-cal="clear-period">🗑️ Radera schema i period</button>
                ${linkedTemplateId ? `<button class="btn btn-danger btn-sm" data-cal="remove-link">🗑️ Ta bort koppling</button>` : ''}
                <button class="btn btn-secondary" data-cal="toggle-link-panel">Stäng</button>
            </div>
        </div>
    </div>`;
}

/* ============================================================
 * BLOCK 6 — WARNINGS / PREVIEW
 * ============================================================ */
function renderWarnings(warnings) {
    const errors = warnings.filter(w => w.severity === 'error');
    const warns = warnings.filter(w => w.severity === 'warning');
    return `<div class="cal-warnings">
        ${errors.length ? `<div class="cal-warning-section cal-warning-error"><strong>❌ ${errors.length} fel:</strong>
            ${errors.slice(0,5).map(w=>`<span class="cal-warning-item">${escapeHtml(w.message)} (${escapeHtml(w.date)})</span>`).join('')}</div>` : ''}
        ${warns.length ? `<div class="cal-warning-section cal-warning-warn"><strong>⚠️ ${warns.length} varningar:</strong>
            ${warns.slice(0,3).map(w=>`<span class="cal-warning-item">${escapeHtml(w.message)}</span>`).join('')}</div>` : ''}
    </div>`;
}

function renderGeneratePreview(preview, people, groups, shifts, shiftTemplates) {
    const { suggestions, vacancySuggestions } = preview;
    const allShifts = { ...shifts, ...shiftTemplates };
    return `<div class="cal-generate-preview">
        <div class="cal-preview-header"><h3>🤖 Schemaförslag</h3>
            <div class="cal-preview-actions">
                <button class="btn btn-primary btn-sm" data-cal="apply-generate">✓ Tillämpa (${suggestions.length})</button>
                <button class="btn btn-secondary btn-sm" data-cal="cancel-generate">✕ Avbryt</button></div></div>
        <div class="cal-preview-stats">
            <span class="cal-preview-stat cal-preview-ok">✅ ${suggestions.length} tilldelningar</span>
            ${vacancySuggestions.length ? `<span class="cal-preview-stat cal-preview-vacancy">⚠️ ${vacancySuggestions.length} vakanser</span>` : ''}
        </div>
        <div class="cal-preview-list">${suggestions.slice(0,20).map(s => {
            const p = people.find(pp => pp.id === s.personId); const g = groups[s.groupId]; const sh = allShifts[s.shiftId];
            return `<div class="cal-preview-item"><span class="cal-preview-date">${escapeHtml(s.date)}</span>
                <span class="cal-preview-badge" style="background:${sanitizeColor(g?.color)};color:${sanitizeColor(g?.textColor||'#fff')}">${escapeHtml(g?.name||s.groupId)}</span>
                <span>${escapeHtml(sh?.name||s.shiftId)}</span><strong>${escapeHtml(p?`${p.firstName} ${p.lastName}`:s.personId)}</strong></div>`;
        }).join('')}</div></div>`;
}

/* ============================================================
 * BLOCK 7 — GROUP RENDER
 * ============================================================ */
function renderGroupSections(weekSchedule, weekDates, groups, shifts, shiftTemplates, groupShifts, people, absences, vacancies, cal, isLocked) {
    const gids = Object.keys(groups).filter(g => g !== 'SYSTEM_ADMIN');
    if (!gids.length) return '<p class="cal-empty">Inga grupper.</p>';
    return gids.map(gid => {
        const g = groups[gid], collapsed = !!cal.collapsedGroups[gid];
        const linkedShifts = Array.isArray(groupShifts[gid]) ? groupShifts[gid] : [];
        const gd = weekSchedule[gid] || {};
        let tH = 0, tC = 0;
        const ds = weekDates.map(date => { const d = gd[formatISO(date)] || {entries:[],hours:0,cost:0}; tH+=d.hours; tC+=d.cost; return d; });
        return `<div class="cal-group-section">
            <div class="cal-group-header" data-cal="toggle-group" data-group-id="${escapeHtml(gid)}" style="border-left:5px solid ${sanitizeColor(g.color)}">
                <div class="cal-group-label-area">
                    <span class="cal-group-toggle">${collapsed?'▶':'▼'}</span>
                    <span class="cal-group-color" style="background:${sanitizeColor(g.color)};color:${sanitizeColor(g.textColor||'#fff')}">${escapeHtml(g.name)}</span>
                    <span class="cal-group-totals">${tH.toFixed(1)} tim · ${formatCurrency(tC)}</span></div>
                <div class="cal-group-day-summary">${ds.map(d=>`<div class="cal-day-summary-cell">
                    <span class="cal-summary-hours">${d.hours.toFixed(1)} tim</span><span class="cal-summary-cost">${formatCurrency(d.cost)}</span></div>`).join('')}</div>
            </div>
            ${!collapsed ? renderGroupBody(gid, gd, weekDates, shifts, shiftTemplates, linkedShifts, people, absences, vacancies, isLocked, cal) : ''}
        </div>`;
    }).join('');
}

function renderGroupBody(gid, groupData, weekDates, shifts, shiftTemplates, linkedShiftIds, people, absences, vacancies, isLocked, cal) {
    if (!linkedShiftIds.length) return `<div class="cal-group-body"><p class="cal-empty-small">Inga grundpass kopplade.</p></div>`;
    const allShifts = { ...shifts, ...shiftTemplates };
    return `<div class="cal-group-body">${linkedShiftIds.map(sid => {
        const shift = allShifts[sid]; if (!shift) return '';
        const timeStr = shift.startTime && shift.endTime ? `${shift.startTime} – ${shift.endTime}` : 'Flex';
        const sc = sanitizeColor(shift.color||'#777');
        const shiftKey = `${gid}::${sid}`;
        const isShiftCollapsed = !!cal.collapsedShifts[shiftKey];

        let shiftWeekPersons = 0;
        if (isShiftCollapsed) {
            weekDates.forEach(date => {
                const dateStr = formatISO(date), dd = groupData[dateStr]||{entries:[]};
                shiftWeekPersons += dd.entries.filter(e=>e.shiftId===sid&&e.groupId===gid&&e.personId&&e.status==='A').length;
            });
        }

        return `<div class="cal-shift-section ${isShiftCollapsed ? 'cal-shift-collapsed' : ''}">
            <div class="cal-shift-label" style="border-left:4px solid ${sc};cursor:pointer;"
                 data-cal="toggle-shift" data-shift-key="${escapeHtml(shiftKey)}">
                <span class="cal-shift-toggle" style="font-size:0.7rem;color:#999;margin-right:0.25rem;">${isShiftCollapsed?'▶':'▼'}</span>
                <span class="cal-shift-dot" style="background:${sc}"></span>
                <div class="cal-shift-info"><strong>${escapeHtml(shift.name)}</strong>
                    <span class="cal-shift-time">${escapeHtml(timeStr)}</span>
                    <span class="cal-shift-hours">${calcShiftHours(shift,{}).toFixed(1)} tim/pass</span>
                    ${isShiftCollapsed && shiftWeekPersons > 0 ? `<span style="color:#667eea;font-weight:600;font-size:0.75rem;">· ${shiftWeekPersons} tilldelningar</span>` : ''}
                </div>
            </div>
            ${!isShiftCollapsed ? `<div class="cal-shift-days">${weekDates.map((date,dayIdx) => {
                const dateStr = formatISO(date), dd = groupData[dateStr]||{entries:[]};
                const se = dd.entries.filter(e=>e.shiftId===sid&&e.groupId===gid);
                const gp = people.filter(p=>(p.groups||p.groupIds||[]).includes(gid));
                const da = absences.filter(a=>gp.some(p=>p.id===a.personId)&&isAbsenceOnDate(a,dateStr)&&!se.some(e=>e.personId===a.personId));
                const dv = vacancies.filter(v=>v.date===dateStr&&v.groupId===gid&&v.shiftTemplateId===sid&&v.status!=='filled');
                return `<div class="cal-day-cell ${dayIdx===6?'sunday':''} ${dayIdx===5?'saturday':''} ${isDateToday(date)?'today':''}"
                    data-drop-zone data-drop-date="${dateStr}" data-drop-group="${escapeHtml(gid)}" data-drop-shift="${escapeHtml(sid)}">
                    ${se.filter(e=>e.personId).map(entry=>{
                        const p=people.find(pp=>pp.id===entry.personId); if(!p) return '';
                        const nm=p.firstName&&p.lastName?`${p.firstName} ${p.lastName}`:(p.name||p.id);
                        const et=entry.startTime&&entry.endTime?`${entry.startTime} – ${entry.endTime}`:timeStr;
                        const ss=getStatusStyle(entry.status||'A');
                        return `<div class="cal-person-card" style="background:${ss.bg};color:${ss.text};border-left:4px solid ${ss.border}"
                            title="${escapeHtml(nm)} · ${escapeHtml(et)}" ${!isLocked?'draggable="true"':''}
                            data-drag-person="${escapeHtml(entry.personId)}" data-drag-shift="${escapeHtml(sid)}"
                            data-drag-group="${escapeHtml(gid)}" data-drag-date="${dateStr}">
                            <span class="cal-card-time">${escapeHtml(et)}</span><span class="cal-card-name">${escapeHtml(nm)}</span>
                            ${!isLocked?`<div class="cal-card-actions">
                                <button class="cal-card-edit" data-cal="edit-entry" data-date="${dateStr}" data-person-id="${escapeHtml(entry.personId)}" data-shift-id="${escapeHtml(sid)}" data-group-id="${escapeHtml(gid)}">✏️</button>
                                <button class="cal-card-remove" data-cal="unassign" data-date="${dateStr}" data-person-id="${escapeHtml(entry.personId)}" data-shift-id="${escapeHtml(sid)}">×</button></div>`:''}</div>`;
                    }).join('')}
                    ${da.map(abs=>{const p=people.find(pp=>pp.id===abs.personId);if(!p)return'';const nm=p.firstName&&p.lastName?`${p.firstName} ${p.lastName}`:(p.name||p.id);const as=ABSENCE_COLORS[abs.type]||ABSENCE_COLORS.SEM;
                        return `<div class="cal-person-card cal-absence-card" style="background:${as.bg};color:${as.text};border-left:4px solid ${as.border}"><span class="cal-card-status">${escapeHtml(ABSENCE_LABELS[abs.type]||abs.type)}</span><span class="cal-card-name">${escapeHtml(nm)}</span></div>`;}).join('')}
                    ${dv.map(v=>`<div class="cal-person-card cal-vacancy-card"><span class="cal-card-status">Utlagt pass</span><span class="cal-card-time">${escapeHtml(timeStr)}</span>
                        ${!isLocked?`<button class="btn btn-sm cal-vacancy-accept" data-cal="fill-vacancy" data-vacancy-id="${escapeHtml(v.id)}" data-date="${dateStr}">+ Fyll</button>`:''}</div>`).join('')}
                    ${!isLocked?`<button class="cal-add-btn" data-cal="open-assign" data-date="${dateStr}" data-group-id="${escapeHtml(gid)}" data-shift-id="${escapeHtml(sid)}">+</button>`:''}</div>`;
            }).join('')}</div>` : ''}
        </div>`;
    }).join('')}</div>`;
}

/* ============================================================
 * BLOCK 8 — MODALS
 * ============================================================ */
function renderAssignModal(modal, groups, shifts, shiftTemplates, groupShifts, people, absences, state) {
    const { date, groupId, shiftId } = modal;
    const allShifts = { ...shifts, ...shiftTemplates };
    const group = groups[groupId], shift = allShifts[shiftId];
    if (!group || !shift) return '';

    const startTime = shift.startTime || '07:00', endTime = shift.endTime || '16:00';
    const timeStr = `${startTime} – ${endTime}`;

    const dayData = state.schedule?.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
    const eligible = getEligiblePersons({ date, groupId, shiftId, groups, shifts, groupShifts, people, dayData, absences, scheduleMonths: state.schedule?.months });

    return `<div class="cal-modal-overlay" data-cal-overlay="assign">
        <div class="cal-modal" data-cal-modal-inner>
            <div class="cal-modal-header">
                <h3>📌 Tilldela pass</h3>
                <button class="cal-modal-close" data-cal="close-modal" type="button">×</button>
            </div>
            <div class="cal-modal-info">
                <span class="cal-modal-badge" style="background:${sanitizeColor(group.color)};color:${sanitizeColor(group.textColor||'#fff')}">${escapeHtml(group.name)}</span>
                <span class="cal-modal-badge" style="background:${sanitizeColor(shift.color||'#777')};color:#fff">${escapeHtml(shift.name)} (${escapeHtml(timeStr)})</span>
                <span class="cal-modal-date">${escapeHtml(date)}</span>
            </div>
            <div class="cal-modal-body">
                <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1rem;padding:0.5rem 0.75rem;background:#f5f7fa;border-radius:8px;border:1px solid #e0e0e0;">
                    <label style="font-size:0.85rem;font-weight:600;color:#555;">⏰ Tid:</label>
                    <input type="time" id="cal-assign-start" value="${escapeHtml(startTime)}" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;font-size:0.85rem;" />
                    <span style="color:#888;">–</span>
                    <input type="time" id="cal-assign-end" value="${escapeHtml(endTime)}" style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px;font-size:0.85rem;" />
                </div>
                ${!eligible.length ? '<p class="cal-empty">Inga personer i denna grupp.</p>' : `
                <table class="cal-assign-table"><thead><tr>
                    <th>Namn</th><th>%</th><th>Typ</th><th>Dagar</th><th>Status</th><th></th>
                </tr></thead><tbody>
                ${eligible.map(item => {
                    const p = item.person;
                    const nm = p.firstName && p.lastName ? `${p.lastName}, ${p.firstName}` : (p.name || p.id);
                    return `<tr class="${!item.eligible?'row-disabled':''} ${item.isPreferred?'row-preferred':''} ${item.isAvoided?'row-avoided':''}">
                        <td><strong>${escapeHtml(nm)}</strong></td>
                        <td>${p.employmentPct||0}%</td>
                        <td>${p.employmentType==='substitute'?'Vikarie':'Ordinarie'}</td>
                        <td>${item.workedDays??'—'}</td>
                        <td>${item.eligible
                            ? (item.isPreferred ? '⭐ Föredrar' : '✅ Tillgänglig')
                            : `❌ ${escapeHtml(item.reason||'')}`}${item.isAvoided?' ⚠️':''}</td>
                        <td>${item.eligible
                            ? `<button class="btn btn-sm btn-primary" data-cal="assign-person" data-person-id="${escapeHtml(p.id)}">📌 Tilldela</button>`
                            : (item.reason?.startsWith('Redan')
                                ? `<button class="btn btn-sm btn-danger" data-cal="unassign-modal" data-person-id="${escapeHtml(p.id)}">🗑️</button>`
                                : '')}</td></tr>`;
                }).join('')}
                </tbody></table>`}
            </div>
        </div>
    </div>`;
}

function renderEditModal(modal, groups, shifts, shiftTemplates, people, state) {
    const { date, personId, shiftId, groupId } = modal;
    const allShifts = { ...shifts, ...shiftTemplates };
    const group = groups[groupId], shift = allShifts[shiftId], person = people.find(p=>p.id===personId);
    if (!group||!shift||!person) return '';
    const nm = person.firstName&&person.lastName?`${person.firstName} ${person.lastName}`:(person.name||person.id);
    const dayData = state.schedule?.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
    const entry = (dayData?.entries||[]).find(e=>e.personId===personId&&e.shiftId===shiftId&&e.groupId===groupId)||{};
    const st=entry.startTime||shift.startTime||'07:00', en=entry.endTime||shift.endTime||'16:00';
    const bs=entry.breakStart||shift.breakStart||'', be=entry.breakEnd||shift.breakEnd||'', status=entry.status||'A';
    const opts=[['A','Arbetar'],['L','Ledig'],['X','Övrigt'],['SEM','Semester'],['SJ','Sjuk'],['VAB','VAB'],['FÖR','Föräldraledig'],['TJL','Tjänstledig'],['PERM','Permission'],['UTB','Utbildning'],['EXTRA','Extrapass']];

    return `<div class="cal-modal-overlay" data-cal-overlay="edit">
        <div class="cal-modal cal-modal-sm" data-cal-modal-inner>
            <div class="cal-modal-header">
                <h3>✏️ Redigera pass</h3>
                <button class="cal-modal-close" data-cal="close-edit" type="button">×</button>
            </div>
            <div class="cal-modal-info">
                <span class="cal-modal-badge" style="background:${sanitizeColor(group.color)};color:${sanitizeColor(group.textColor||'#fff')}">${escapeHtml(group.name)}</span>
                <strong>${escapeHtml(nm)}</strong><span class="cal-modal-date">${escapeHtml(date)}</span>
            </div>
            <div class="cal-modal-body"><div class="cal-edit-form">
                <div class="cal-edit-row"><label>Start</label><input type="time" id="cal-edit-start" value="${escapeHtml(st)}"/></div>
                <div class="cal-edit-row"><label>Slut</label><input type="time" id="cal-edit-end" value="${escapeHtml(en)}"/></div>
                <div class="cal-edit-row"><label>Rast start</label><input type="time" id="cal-edit-break-start" value="${escapeHtml(bs)}"/></div>
                <div class="cal-edit-row"><label>Rast slut</label><input type="time" id="cal-edit-break-end" value="${escapeHtml(be)}"/></div>
                <div class="cal-edit-row"><label>Status</label><select id="cal-edit-status">
                    ${opts.map(([v,l])=>`<option value="${v}" ${status===v?'selected':''}>${v} — ${escapeHtml(l)}</option>`).join('')}</select></div>
                <div class="cal-edit-actions">
                    <button class="btn btn-primary" data-cal="save-edit">💾 Spara</button>
                    <button class="btn btn-secondary" data-cal="close-edit">Avbryt</button>
                    <button class="btn btn-danger" data-cal="delete-entry" data-date="${escapeHtml(date)}" data-person-id="${escapeHtml(personId)}" data-shift-id="${escapeHtml(shiftId)}">🗑️</button>
                </div>
            </div></div>
        </div>
    </div>`;
}

/* ============================================================
 * BLOCK 9 — BUILD WEEK DATA
 * ============================================================ */
function buildWeekSchedule(weekDates, state, groups, shifts, shiftTemplates, people) {
    const result = {}, allShifts = { ...shifts, ...shiftTemplates };
    Object.keys(groups).forEach(gid => {
        result[gid] = {};
        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const dayData = state.schedule?.months?.[getMonthIndex(dateStr)]?.days?.[getDayIndex(dateStr)];
            const entries = (dayData?.entries||[]).filter(e=>e.groupId===gid);
            let hours=0, cost=0;
            entries.forEach(e => {
                if(e.status!=='A') return;
                const s=allShifts[e.shiftId]; if(!s) return;
                const h=calcShiftHours(s,e);
                hours+=h;
                if(e.personId){
                    const p=people.find(pp=>pp.id===e.personId);
                    if(p) cost+=h*(p.hourlyWage||0);
                }
            });
            result[gid][dateStr] = { entries, hours, cost };
        });
    });
    return result;
}

/* ============================================================
 * BLOCK 10 — EVENT LISTENERS
 * ============================================================ */
function setupListeners(container, store, ctx, isLocked, linkedTemplate) {
    if (ctx._calAbort) ctx._calAbort.abort();
    ctx._calAbort = new AbortController();
    const signal = ctx._calAbort.signal;

    container.addEventListener('click', (e) => {
        const cal = ctx._cal;

        // Overlay-klick: stäng modal (men inte när man klickar på knappar inuti modalen)
        const overlay = e.target.closest('[data-cal-overlay]');
        if (overlay && !e.target.closest('[data-cal-modal-inner]') && !e.target.closest('[data-cal]')) {
            if (overlay.dataset.calOverlay === 'assign') { cal.assignModal = null; renderCalendar(container, ctx); return; }
            if (overlay.dataset.calOverlay === 'edit')   { cal.editModal = null;   renderCalendar(container, ctx); return; }
        }

        const btn = e.target.closest('[data-cal]');
        if (!btn) return;
        const action = btn.dataset.cal;

        try {
            if (action==='prev-week') {
                cal.weekOffset = Math.max(0, cal.weekOffset - 1);
                cal.generatePreview = null;
                renderCalendar(container, ctx);

            } else if (action==='next-week') {
                cal.weekOffset = Math.min(MAX_WEEK_OFFSET, cal.weekOffset + 1);
                cal.generatePreview = null;
                renderCalendar(container, ctx);

            } else if (action==='today') {
                cal.weekOffset = calcCurrentWeekOffset(store.getState().schedule.year);
                cal.generatePreview = null;
                renderCalendar(container, ctx);

            /* v2.5: Toggle link panel */
            } else if (action==='toggle-link-panel') {
                cal.showLinkPanel = !cal.showLinkPanel;
                renderCalendar(container, ctx);

            /* v2.5: Koppla period */
            } else if (action==='apply-link') {
                handleApplyLink(store, ctx, container, false);

            /* v2.5: Koppla + generera */
            } else if (action==='apply-link-generate') {
                handleApplyLink(store, ctx, container, true);

            /* v2.5: Avkoppla (tar bort koppling för aktuell vecka) */
            } else if (action==='remove-link') {
                handleRemoveLink(store, ctx, container);

            /* v2.5: Radera alla entries i vald period */
            } else if (action==='clear-period') {
                handleClearPeriod(store, ctx, container);

            } else if (action==='toggle-group') {
                const gid = btn.dataset.groupId;
                if (gid) cal.collapsedGroups[gid] = !cal.collapsedGroups[gid];
                renderCalendar(container, ctx);

            } else if (action==='toggle-shift') {
                const key = btn.dataset.shiftKey;
                if (key) cal.collapsedShifts[key] = !cal.collapsedShifts[key];
                renderCalendar(container, ctx);

            } else if (action==='open-assign' && !isLocked) {
                cal.assignModal = { date: btn.dataset.date, groupId: btn.dataset.groupId, shiftId: btn.dataset.shiftId };
                renderCalendar(container, ctx);

            } else if (action==='close-modal') {
                cal.assignModal = null;
                renderCalendar(container, ctx);

            } else if (action==='close-edit') {
                cal.editModal = null;
                renderCalendar(container, ctx);

            } else if (action==='assign-person' && !isLocked) {
                handleAssign(btn, cal, store, container, ctx);

            } else if ((action==='unassign' || action==='unassign-modal') && !isLocked) {
                handleUnassign(btn, action, cal, store, container, ctx);

            } else if (action==='edit-entry' && !isLocked) {
                cal.editModal = { date: btn.dataset.date, personId: btn.dataset.personId, shiftId: btn.dataset.shiftId, groupId: btn.dataset.groupId };
                renderCalendar(container, ctx);

            } else if (action==='save-edit' && !isLocked) {
                handleSaveEdit(cal, store, container, ctx);

            } else if (action==='delete-entry' && !isLocked) {
                handleDeleteEntry(btn, cal, store, container, ctx);

            } else if (action==='lock-week') {
                handleLockWeek(store, ctx, container);

            } else if (action==='unlock-week') {
                handleUnlockWeek(store, ctx, container);

            } else if (action==='generate' && !isLocked && linkedTemplate) {
                handleGenerate(store, linkedTemplate, cal, container, ctx);

            } else if (action==='apply-generate' && !isLocked) {
                handleApplyGenerate(cal, store, container, ctx);

            } else if (action==='cancel-generate') {
                cal.generatePreview = null;
                renderCalendar(container, ctx);

            } else if (action==='fill-vacancy' && !isLocked) {
                handleFillVacancy(btn, cal, store, container, ctx);
            }
        } catch(err) {
            console.error('❌ Calendar error:', err);
            showWarning('❌ Ett fel uppstod');
        }
    }, { signal });
}
/* ============================================================
 * BLOCK 11 — ensureDay (fail-safe)
 * ============================================================ */
function ensureDay(schedule, monthIdx, dayIdx) {
    if (!Array.isArray(schedule.months)) schedule.months = [];
    while (schedule.months.length <= monthIdx) schedule.months.push({ days: [] });
    const month = schedule.months[monthIdx];
    if (!Array.isArray(month.days)) month.days = [];
    while (month.days.length <= dayIdx) month.days.push({ entries: [] });
    const day = month.days[dayIdx];
    if (!Array.isArray(day.entries)) day.entries = [];
    return day;
}

/* ============================================================
 * BLOCK 12 — LINK HANDLERS (v2.6 — med beräkningsperiod)
 * ============================================================ */
function handleApplyLink(store, ctx, container, alsoGenerate) {
    const cal = ctx._cal;
    const s = store.getState();
    const year = s.schedule.year;

    const selectEl = document.getElementById('cal-link-template');
    const fromEl = document.getElementById('cal-link-from');
    const toEl = document.getElementById('cal-link-to');
    if (!selectEl || !fromEl || !toEl) return;

    const templateId = selectEl.value;
    const fromDate = new Date(fromEl.value);
    const toDate = new Date(toEl.value);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        showWarning('⚠️ Ogiltiga datum'); return;
    }
    if (toDate < fromDate) {
        showWarning('⚠️ Till-datum måste vara efter från-datum'); return;
    }

    const diffDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 366) {
        showWarning('⚠️ Max 1 år (366 dagar)'); return;
    }

    /* Hitta alla vecko-nycklar i datumintervallet */
    const weekKeys = new Set();
    const weekOffsets = [];

    for (let i = 0; i < diffDays; i++) {
        const d = new Date(fromDate);
        d.setDate(d.getDate() + i);
        const dayOfWeek = d.getDay();

        const mon = new Date(d);
        mon.setDate(d.getDate() - ((dayOfWeek + 6) % 7));

        const wn = getISOWeekNumber(mon);
        const wy = mon.getFullYear();
        const wk = `${wy}-W${String(wn).padStart(2, '0')}`;

        if (!weekKeys.has(wk)) {
            weekKeys.add(wk);

            const jan1 = new Date(year, 0, 1);
            const d1 = jan1.getDay(), dtm = d1 === 0 ? -6 : 1 - d1;
            const firstMonday = new Date(year, 0, 1 + dtm);

            const wo = Math.floor((mon.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
            if (wo >= 0 && wo <= MAX_WEEK_OFFSET) weekOffsets.push(wo);
        }
    }

    const weekKeysArr = [...weekKeys];

    /* Koppla veckor till mall */
    store.update(st => {
        if (!st.calendarWeeks || typeof st.calendarWeeks !== 'object') st.calendarWeeks = {};
        weekKeysArr.forEach(wk => {
            if (templateId) st.calendarWeeks[wk] = templateId;
            else delete st.calendarWeeks[wk];
        });
    });

    const action = templateId ? 'kopplad' : 'avkopplad';
    const templateName = templateId ? (s.weekTemplates?.[templateId]?.name || templateId) : '';
    showSuccess(`✓ ${weekKeysArr.length} vecka(or) ${action}${templateName ? ': ' + templateName : ''}`);

    /* ── Generera med beräkningsperiod ── */
    if (alsoGenerate && templateId) {

        /* Kontrollera om det redan finns entries */
        const checkState = store.getState();
        let existingCount = 0;
        weekOffsets.forEach(wo => {
            const wd = getWeekDates(year, wo);
            wd.forEach(date => {
                const ds = formatISO(date);
                const dayData = checkState.schedule?.months?.[getMonthIndex(ds)]?.days?.[getDayIndex(ds)];
                if (dayData?.entries?.length) existingCount += dayData.entries.filter(e => e.status === 'A').length;
            });
        });

        if (existingCount > 0) {
            const ok = confirm(
                `⚠️ Det finns redan ${existingCount} tilldelningar i vald period.\n\n` +
                `Vill du generera ändå? (Kan ge dubbletter)\n\n` +
                `Tryck "Avbryt" för att koppla utan att generera.`
            );
            if (!ok) {
                cal.showLinkPanel = false;
                renderCalendar(container, ctx);
                return;
            }
        }

        /* Kör period-generering via engine */
        const state = store.getState();
        const wt = state.weekTemplates?.[templateId];

        if (wt) {
            try {
                const result = generatePeriodSchedule({
                    weekOffsets,
                    year,
                    weekTemplate: wt,
                    state,
                    getWeekDates,
                });

                /* Applicera alla suggestions till store */
                const shifts = state.shifts || {};
                const groupShifts = state.groupShifts || {};
                const shiftTemplates = state.shiftTemplates || {};
                let totalApplied = 0;

                result.allSuggestions.forEach(weekSuggestions => {
                    if (!weekSuggestions?.length) return;

                    store.update(s => {
                        weekSuggestions.forEach(sug => {
                            let resolvedShiftId = sug.shiftId || sug.shiftTemplateId;

                            /* Resolve templateId → verkligt shiftId */
                            if (resolvedShiftId && !shifts[resolvedShiftId]) {
                                const gsArr = Array.isArray(groupShifts[sug.groupId]) ? groupShifts[sug.groupId] : [];
                                const st = shiftTemplates[resolvedShiftId];

                                if (st && gsArr.length > 0) {
                                    const timeMatch = gsArr.find(sid => {
                                        const sh = shifts[sid];
                                        return sh && sh.startTime === st.startTime && sh.endTime === st.endTime;
                                    });
                                    resolvedShiftId = timeMatch || gsArr[0];
                                }
                            }

                            const day = ensureDay(s.schedule, getMonthIndex(sug.date), getDayIndex(sug.date));

                            /* Undvik exakt dubbletter */
                            if (day.entries.some(e =>
                                e.personId === sug.personId &&
                                e.shiftId === resolvedShiftId &&
                                e.groupId === sug.groupId
                            )) return;

                            day.entries.push({
                                personId: sug.personId,
                                shiftId: resolvedShiftId,
                                groupId: sug.groupId,
                                status: sug.status || 'A',
                                startTime: sug.startTime,
                                endTime: sug.endTime,
                                breakStart: sug.breakStart,
                                breakEnd: sug.breakEnd,
                            });
                            totalApplied++;
                        });
                    });
                });

                /* Visa sammanfattning */
                const stats = result.totalStats;
                let summaryMsg = `✓ ${totalApplied} tilldelningar genererade för ${stats.weeks} veckor`;
                summaryMsg += `\n${stats.totalHours.toFixed(0)} timmar totalt`;

                if (stats.totalVacancies > 0) {
                    summaryMsg += `\n⚠️ ${stats.totalVacancies} vakanser`;
                }

                /* Visa per-person info i konsolen */
                console.log('📊 Per person:');
                Object.values(stats.perPerson).forEach(p => {
                    const bar = '█'.repeat(Math.round(p.pctUsed / 5)) + '░'.repeat(Math.max(0, 20 - Math.round(p.pctUsed / 5)));
                    console.log(`  ${p.name} (${p.employmentPct}%, ${p.periodWeeks}v): ${p.hours}h / ${p.periodTarget}h [${bar}] ${p.pctUsed}%`);
                });

                showSuccess(summaryMsg);

            } catch (err) {
                console.error('❌ Period-generering misslyckades:', err);
                showWarning(`❌ Generering misslyckades: ${err.message}`);
            }
        }
    }

    cal.showLinkPanel = false;
    renderCalendar(container, ctx);
}

/* ── Radera alla entries i vald period ── */
function handleClearPeriod(store, ctx, container) {
    const cal = ctx._cal;
    const s = store.getState();

    const fromEl = document.getElementById('cal-link-from');
    const toEl = document.getElementById('cal-link-to');
    if (!fromEl || !toEl) return;

    const fromDate = new Date(fromEl.value);
    const toDate = new Date(toEl.value);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        showWarning('⚠️ Ogiltiga datum'); return;
    }

    const diffDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    /* Räkna befintliga entries */
    let totalEntries = 0;
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(fromDate);
        d.setDate(d.getDate() + i);
        const ds = formatISO(d);
        const dayData = s.schedule?.months?.[getMonthIndex(ds)]?.days?.[getDayIndex(ds)];
        if (dayData?.entries?.length) totalEntries += dayData.entries.length;
    }

    if (totalEntries === 0) {
        showWarning('ℹ️ Inga tilldelningar att radera i vald period.');
        return;
    }

    const ok = confirm(
        `⚠️ Radera ${totalEntries} tilldelningar?\n\n` +
        `Period: ${fromEl.value} → ${toEl.value}\n\n` +
        `Detta kan inte ångras!`
    );
    if (!ok) return;

    let removed = 0;
    store.update(st => {
        for (let i = 0; i < diffDays; i++) {
            const d = new Date(fromDate);
            d.setDate(d.getDate() + i);
            const ds = formatISO(d);
            const mi = getMonthIndex(ds), di = getDayIndex(ds);
            const day = st.schedule?.months?.[mi]?.days?.[di];
            if (day?.entries?.length) {
                removed += day.entries.length;
                day.entries = [];
            }
        }
    });

    showWarning(`🗑️ ${removed} tilldelningar raderade`);
    cal.showLinkPanel = false;
    renderCalendar(container, ctx);
}

function handleRemoveLink(store, ctx, container) {
    const cal = ctx._cal;
    const s = store.getState();
    const yr = s.schedule.year;

    const weekDates = getWeekDates(yr, cal.weekOffset);
    const wn = getISOWeekNumber(weekDates[0]);
    const weekKey = `${yr}-W${String(wn).padStart(2,'0')}`;

    store.update(st => {
        if (st.calendarWeeks && typeof st.calendarWeeks === 'object') {
            delete st.calendarWeeks[weekKey];
        }
    });

    showWarning(`🗑️ Vecka ${wn} avkopplad`);
    cal.showLinkPanel = false;
    renderCalendar(container, ctx);
}
/* ============================================================
 * BLOCK 13 — ACTION HANDLERS (existing)
 * ============================================================ */
function handleAssign(btn, cal, store, container, ctx) {
    const pid = btn.dataset.personId, m = cal.assignModal;
    if (!pid || !m) return;
    const { date, groupId, shiftId } = m;
    const s = store.getState();
    const shift = { ...(s.shifts||{}), ...(s.shiftTemplates||{}) }[shiftId];

    const customStart = document.getElementById('cal-assign-start')?.value || shift?.startTime || null;
    const customEnd = document.getElementById('cal-assign-end')?.value || shift?.endTime || null;

    store.update(st => {
        const day = ensureDay(st.schedule, getMonthIndex(date), getDayIndex(date));
        if (day.entries.some(e => e.personId===pid && e.shiftId===shiftId && e.groupId===groupId)) return;
        day.entries.push({
            personId:pid,
            shiftId,
            groupId,
            status:'A',
            startTime:customStart,
            endTime:customEnd,
            breakStart:shift?.breakStart||null,
            breakEnd:shift?.breakEnd||null
        });
    });

    showSuccess('✓ Person tilldelad');
    cal.assignModal = null;
    renderCalendar(container, ctx);
}

function handleUnassign(btn, action, cal, store, container, ctx) {
    const pid=btn.dataset.personId, date=btn.dataset.date||cal.assignModal?.date, sid=btn.dataset.shiftId||cal.assignModal?.shiftId;
    if (!pid || !date) return;

    store.update(s => {
        const d=s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
        if(!d?.entries) return;
        d.entries = d.entries.filter(e => {
            if(e.personId!==pid) return true;
            if(sid && e.shiftId!==sid) return true;
            return false;
        });
    });

    showWarning('🗑️ Borttagen');
    if(action==='unassign-modal') cal.assignModal=null;
    renderCalendar(container, ctx);
}

function handleSaveEdit(cal, store, container, ctx) {
    if (!cal.editModal) return;
    const { date, personId, shiftId, groupId } = cal.editModal;

    store.update(s => {
        const d=s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
        if(!d?.entries) return;
        const e=d.entries.find(e=>e.personId===personId&&e.shiftId===shiftId&&e.groupId===groupId);
        if(!e) return;

        e.startTime=document.getElementById('cal-edit-start')?.value||null;
        e.endTime=document.getElementById('cal-edit-end')?.value||null;
        e.breakStart=document.getElementById('cal-edit-break-start')?.value||null;
        e.breakEnd=document.getElementById('cal-edit-break-end')?.value||null;
        e.status=document.getElementById('cal-edit-status')?.value||'A';
    });

    showSuccess('✓ Uppdaterat');
    cal.editModal=null;
    renderCalendar(container, ctx);
}

function handleDeleteEntry(btn, cal, store, container, ctx) {
    const { personId, date, shiftId } = btn.dataset;
    if(!personId||!date) return;

    store.update(s => {
        const d=s.schedule.months?.[getMonthIndex(date)]?.days?.[getDayIndex(date)];
        if(!d?.entries) return;
        d.entries = d.entries.filter(e => !(e.personId===personId && e.shiftId===shiftId));
    });

    showWarning('🗑️ Borttaget');
    cal.editModal=null;
    renderCalendar(container, ctx);
}

function handleLockWeek(store, ctx, container) {
    const cal = ctx._cal, s = store.getState(), yr = s.schedule.year;
    const weekDates = getWeekDates(yr, cal.weekOffset);
    const wn = getISOWeekNumber(weekDates[0]), wk = `${yr}-W${String(wn).padStart(2,'0')}`;

    store.update(s => {
        if(!Array.isArray(s.schedule.lockedWeeks)) s.schedule.lockedWeeks=[];
        if(!s.schedule.lockedWeeks.includes(wk)) s.schedule.lockedWeeks.push(wk);
    });

    showSuccess(`🔒 Vecka ${wn} låst`);
    renderCalendar(container, ctx);
}

function handleUnlockWeek(store, ctx, container) {
    const cal = ctx._cal, s = store.getState(), yr = s.schedule.year;
    const weekDates = getWeekDates(yr, cal.weekOffset);
    const wn = getISOWeekNumber(weekDates[0]), wk = `${yr}-W${String(wn).padStart(2,'0')}`;

    store.update(s => {
        if(!Array.isArray(s.schedule.lockedWeeks)) return;
        s.schedule.lockedWeeks = s.schedule.lockedWeeks.filter(w => w !== wk);
    });

    showWarning(`🔓 Vecka ${wn} upplåst`);
    renderCalendar(container, ctx);
}

function handleGenerate(store, linkedTemplate, cal, container, ctx) {
    const s = store.getState(), weekDates = getWeekDates(s.schedule.year, cal.weekOffset);
    cal.generatePreview = generateWeekSchedule({
        weekDates,
        weekTemplate:linkedTemplate,
        groups:s.groups,
        shifts:s.shifts,
        shiftTemplates:s.shiftTemplates,
        groupShifts:s.groupShifts,
        people:(s.people||[]).filter(p=>p.isActive),
        absences:s.absences||[],
        existingEntries:{},
        demand:s.demand
    });
    renderCalendar(container, ctx);
}

function handleApplyGenerate(cal, store, container, ctx) {
    if (!cal.generatePreview) return;
    const { suggestions } = cal.generatePreview;

    const state = store.getState();
    const shifts = state.shifts || {};
    const groupShifts = state.groupShifts || {};
    const shiftTemplates = state.shiftTemplates || {};

    store.update(s => {
        suggestions.forEach(sug => {
            let resolvedShiftId = sug.shiftId || sug.shiftTemplateId;

            if (resolvedShiftId && !shifts[resolvedShiftId]) {
                const gsArr = Array.isArray(groupShifts[sug.groupId]) ? groupShifts[sug.groupId] : [];
                const st = shiftTemplates[resolvedShiftId];
                if (st && gsArr.length > 0) {
                    const timeMatch = gsArr.find(sid => {
                        const sh = shifts[sid];
                        return sh && sh.startTime === st.startTime && sh.endTime === st.endTime;
                    });
                    resolvedShiftId = timeMatch || gsArr[0];
                }
            }

            const day = ensureDay(s.schedule, getMonthIndex(sug.date), getDayIndex(sug.date));
            if(day.entries.some(e=>e.personId===sug.personId&&e.shiftId===resolvedShiftId&&e.groupId===sug.groupId)) return;

            day.entries.push({
                personId: sug.personId,
                shiftId: resolvedShiftId,
                groupId: sug.groupId,
                status: sug.status || 'A',
                startTime: sug.startTime,
                endTime: sug.endTime,
                breakStart: sug.breakStart,
                breakEnd: sug.breakEnd
            });
        });
    });

    showSuccess(`✓ ${suggestions.length} tillämpade`);
    cal.generatePreview = null;
    renderCalendar(container, ctx);
}

function handleFillVacancy(btn, cal, store, container, ctx) {
    const v=(store.getState().vacancies||[]).find(v=>v.id===btn.dataset.vacancyId);
    if(!v) return;
    cal.assignModal = { date:v.date, groupId:v.groupId, shiftId:v.shiftTemplateId };
    renderCalendar(container, ctx);
}

/* ============================================================
 * BLOCK 14 — DRAG & DROP
 * ============================================================ */
function setupDragAndDrop(container, store, ctx, isLocked) {
    if (isLocked) return;
    if (ctx._calDragAbort) ctx._calDragAbort.abort();
    ctx._calDragAbort = new AbortController();
    const signal = ctx._calDragAbort.signal;
    let dragData = null;

    container.addEventListener('dragstart', (e) => {
        const c = e.target.closest('[data-drag-person]'); if(!c) return;
        dragData = { personId:c.dataset.dragPerson, shiftId:c.dataset.dragShift, groupId:c.dataset.dragGroup, fromDate:c.dataset.dragDate };
        e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','drag');
        c.classList.add('cal-dragging'); setTimeout(()=>{c.style.opacity='0.4';},0);
    }, { signal });

    container.addEventListener('dragend', (e) => {
        const c = e.target.closest('[data-drag-person]'); if(c){c.classList.remove('cal-dragging');c.style.opacity='';}
        container.querySelectorAll('.cal-drop-target').forEach(el=>el.classList.remove('cal-drop-target')); dragData=null;
    }, { signal });

    container.addEventListener('dragover', (e) => {
        const dz = e.target.closest('[data-drop-zone]'); if(!dz||!dragData) return;
        e.preventDefault(); e.dataTransfer.dropEffect='move'; dz.classList.add('cal-drop-target');
    }, { signal });

    container.addEventListener('dragleave', (e) => {
        const dz = e.target.closest('[data-drop-zone]'); if(dz) dz.classList.remove('cal-drop-target');
    }, { signal });

    container.addEventListener('drop', (e) => {
        e.preventDefault(); const dz = e.target.closest('[data-drop-zone]'); if(!dz||!dragData) return;
        dz.classList.remove('cal-drop-target');

        const { personId, shiftId:fromShift, groupId:fromGroup, fromDate } = dragData;
        const toDate=dz.dataset.dropDate, toGroup=dz.dataset.dropGroup, toShift=dz.dataset.dropShift;

        if(toDate===fromDate && toGroup===fromGroup && toShift===fromShift){ dragData=null; return; }

        try {
            const ts = { ...(store.getState().shifts||{}), ...(store.getState().shiftTemplates||{}) }[toShift];
            store.update(s => {
                const fd = s.schedule.months?.[getMonthIndex(fromDate)]?.days?.[getDayIndex(fromDate)];
                if(fd?.entries){
                    fd.entries = fd.entries.filter(e=>!(e.personId===personId&&e.shiftId===fromShift&&e.groupId===fromGroup));
                }
                const td = ensureDay(s.schedule, getMonthIndex(toDate), getDayIndex(toDate));
                if(!td.entries.some(e=>e.personId===personId&&e.shiftId===toShift&&e.groupId===toGroup)){
                    td.entries.push({
                        personId,
                        shiftId:toShift,
                        groupId:toGroup,
                        status:'A',
                        startTime:ts?.startTime||null,
                        endTime:ts?.endTime||null,
                        breakStart:ts?.breakStart||null,
                        breakEnd:ts?.breakEnd||null
                    });
                }
            });
            showSuccess('✓ Pass flyttat');
            renderCalendar(container, ctx);
        } catch(err){
            console.error('❌ D&D error:',err);
            showWarning('❌ Kunde inte flytta');
        }
        dragData=null;
    }, { signal });
}

/* ============================================================
 * BLOCK 15 — DATE HELPERS
 * ============================================================ */
function getWeekDates(year, weekOffset) {
    const jan1=new Date(year,0,1), d1=jan1.getDay(), dtm=d1===0?-6:1-d1;
    const fm=new Date(year,0,1+dtm), ws=new Date(fm); ws.setDate(fm.getDate()+weekOffset*7);
    const dates=[]; for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);dates.push(d);} return dates;
}
function getISOWeekNumber(date) {
    const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())), dn=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()+4-dn); const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d-ys)/86400000)+1)/7);
}
function formatISO(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function formatDateShort(date){return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].toLowerCase().slice(0,3)}`;}
function formatDayMonth(date){return `${date.getDate()}/${date.getMonth()+1}`;}
function isDateToday(date){const n=new Date();return date.getFullYear()===n.getFullYear()&&date.getMonth()===n.getMonth()&&date.getDate()===n.getDate();}
function getMonthIndex(ds){return parseInt(ds.split('-')[1],10)-1;}
function getDayIndex(ds){return parseInt(ds.split('-')[2],10)-1;}
function isAbsenceOnDate(a,ds){
    if(!a||!ds) return false;
    if(a.pattern==='single') return a.date===ds;
    if(a.pattern==='range') return ds>=(a.startDate||'')&&ds<=(a.endDate||'9999-12-31');
    return false;
}

/* ============================================================
 * BLOCK 16 — STATUS / FORMAT / XSS HELPERS
 * ============================================================ */
function getStatusStyle(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.A;
}

function formatCurrency(amount) {
    if (!amount || !Number.isFinite(amount)) return '0 kr';
    return Math.round(amount).toLocaleString('sv-SE') + ' kr';
}

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
