/*
 * AO-08 — Control View (Dashboard)
 * FIL: src/views/control.js
 *
 * Dashboard som visar schemaläggningens hälsa:
 *   1. Sammanfattningskort (timmar, kostnader, varningar, vakanser)
 *   2. Regelkontroll (dubbelbokning, frånvarokonflikter, ghost entries)
 *   3. Bemanningsöversikt (behov vs tilldelat per grupp/dag)
 *   4. Personstatistik (timmar, dagar, avvikelse från tjänstegrad)
 *   5. Kostnad per grupp
 *   6. Vakansöversikt
 *
 * Kontrakt:
 *   - ctx.store måste finnas
 *   - Exporterar renderControl(container, ctx)
 *   - XSS-safe: escapeHtml + sanitizeColor
 */

import {
    calcShiftHours,
    calcDayCost,
    getDaySummary,
    getPersonWorkload,
    validateScheduleIntegrity,
} from '../modules/schedule-engine.js';

/* ── CONSTANTS ── */
const WEEKDAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTH_NAMES = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
const MAX_WEEK_OFFSET = 53;

/* ── MAIN RENDER ── */
export function renderControl(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = `<div class="ctrl-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`; return; }

    try {
        const state = store.getState();
        if (!state.schedule || typeof state.schedule.year !== 'number') {
            container.innerHTML = `<div class="ctrl-error"><h2>❌ Fel</h2><p>Schedule saknas.</p></div>`; return;
        }

        const year = state.schedule.year;
        const groups = (typeof state.groups === 'object' && state.groups) || {};
        const shifts = (typeof state.shifts === 'object' && state.shifts) || {};
        const shiftTemplates = (typeof state.shiftTemplates === 'object' && state.shiftTemplates) || {};
        const groupShifts = (typeof state.groupShifts === 'object' && state.groupShifts) || {};
        const people = Array.isArray(state.people) ? state.people : [];
        const activePeople = people.filter(p => p.isActive);
        const demand = state.demand || {};
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const vacancies = Array.isArray(state.vacancies) ? state.vacancies : [];

        /* ── View state ── */
        if (!ctx._ctrl) {
            ctx._ctrl = {
                weekOffset: calcCurrentWeekOffset(year),
                viewMode: 'week',   // 'week' | 'month'
                collapsed: {},
            };
        }
        const ctrl = ctx._ctrl;
        if (!ctrl.collapsed) ctrl.collapsed = {};

        const allShifts = { ...shifts, ...shiftTemplates };
        const weekDates = getWeekDates(year, ctrl.weekOffset);
        const weekNum = getISOWeekNumber(weekDates[0]);

        /* ── Compute data ── */
        const warnings = validateScheduleIntegrity(state.schedule.months, people, absences);
        const weekWarnings = warnings.filter(w => weekDates.some(d => formatISO(d) === w.date));

        const weekStats = calcWeekStats(weekDates, state, groups, allShifts, activePeople, demand, absences);
        const personStats = calcPersonStats(weekDates, state, allShifts, activePeople);
        const openVacancies = vacancies.filter(v => v.status !== 'filled' && weekDates.some(d => formatISO(d) === v.date));

        const totalErrors = weekWarnings.filter(w => w.severity === 'error').length;
        const totalWarns = weekWarnings.filter(w => w.severity === 'warning').length;

        /* ── Render ── */
        container.innerHTML = `
            <div class="ctrl-container">
                ${renderTopBar(ctrl, weekNum, weekDates)}

                <!-- SUMMARY CARDS -->
                <div class="ctrl-summary-row">
                    <div class="ctrl-summary-card ${weekStats.totalHours > 0 ? 'info' : 'warn'}">
                        <span class="ctrl-summary-label">Timmar denna vecka</span>
                        <span class="ctrl-summary-value">${weekStats.totalHours.toFixed(1)}</span>
                        <span class="ctrl-summary-sub">${activePeople.length} aktiva personer</span>
                    </div>
                    <div class="ctrl-summary-card ${weekStats.totalCost > 0 ? 'info' : 'warn'}">
                        <span class="ctrl-summary-label">Kostnad denna vecka</span>
                        <span class="ctrl-summary-value">${formatCurrency(weekStats.totalCost)}</span>
                        <span class="ctrl-summary-sub">${Object.keys(groups).filter(g=>g!=='SYSTEM_ADMIN').length} grupper</span>
                    </div>
                    <div class="ctrl-summary-card ${totalErrors > 0 ? 'error' : totalWarns > 0 ? 'warn' : 'ok'}">
                        <span class="ctrl-summary-label">Regelbrott</span>
                        <span class="ctrl-summary-value">${totalErrors + totalWarns}</span>
                        <span class="ctrl-summary-sub">${totalErrors} fel, ${totalWarns} varningar</span>
                    </div>
                    <div class="ctrl-summary-card ${openVacancies.length > 0 ? 'warn' : 'ok'}">
                        <span class="ctrl-summary-label">Vakanser</span>
                        <span class="ctrl-summary-value">${openVacancies.length}</span>
                        <span class="ctrl-summary-sub">${openVacancies.length > 0 ? 'Ofyllda pass' : 'Alla pass fyllda'}</span>
                    </div>
                </div>

                <!-- SECTIONS -->
                <div class="ctrl-sections">
                    <!-- Regelkontroll -->
                    ${renderSection('issues', '⚠️ Regelkontroll', ctrl, totalErrors + totalWarns,
                        totalErrors > 0 ? 'error' : totalWarns > 0 ? 'warn' : 'ok',
                        () => renderIssues(weekWarnings))}

                    <!-- Bemanningsöversikt -->
                    ${renderSection('demand', '📊 Bemanningsöversikt', ctrl, null, 'info',
                        () => renderDemandTable(weekDates, weekStats.demandByGroup, groups))}

                    <!-- Personstatistik -->
                    ${renderSection('persons', '👥 Personstatistik', ctrl, activePeople.length, 'info',
                        () => renderPersonTable(personStats, groups), true)}

                    <!-- Kostnader per grupp -->
                    ${renderSection('costs', '💰 Kostnader', ctrl, null, 'info',
                        () => renderCostTable(weekStats.costByGroup, groups, weekStats.totalCost))}

                    <!-- Vakanser -->
                    ${renderSection('vacancies', '📋 Vakanser', ctrl, openVacancies.length,
                        openVacancies.length > 0 ? 'warn' : 'ok',
                        () => renderVacancies(openVacancies, groups, allShifts))}
                </div>
            </div>`;

        setupControlListeners(container, store, ctx);
    } catch (err) {
        console.error('❌ renderControl kraschade:', err);
        container.innerHTML = `<div class="ctrl-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ── TOP BAR ── */
function renderTopBar(ctrl, weekNum, weekDates) {
    return `<div class="ctrl-topbar">
        <div style="font-size:1.1rem;font-weight:700;color:#333;">✓ Kontroll</div>
        <div class="ctrl-topbar-center">
            <button class="btn btn-secondary" data-ctrl="prev-week">◀</button>
            <div class="ctrl-week-display">
                <strong>Vecka ${weekNum}</strong>
                <span class="ctrl-week-range">${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}</span>
            </div>
            <button class="btn btn-secondary" data-ctrl="next-week">▶</button>
            <button class="btn btn-secondary btn-sm" data-ctrl="today">Idag</button>
        </div>
        <div></div>
    </div>`;
}

/* ── SECTION WRAPPER ── */
function renderSection(id, title, ctrl, badgeCount, badgeType, renderBody, fullWidth) {
    const isCollapsed = !!ctrl.collapsed[id];
    return `<div class="ctrl-section ${fullWidth ? 'full-width' : ''}">
        <div class="ctrl-section-header" data-ctrl="toggle-section" data-section-id="${id}">
            <h3>${title}</h3>
            <div style="display:flex;align-items:center;gap:0.5rem;">
                ${badgeCount !== null && badgeCount !== undefined
                    ? `<span class="ctrl-section-badge ctrl-badge-${badgeType}">${badgeCount}</span>` : ''}
                <span class="ctrl-section-toggle">${isCollapsed ? '▶' : '▼'}</span>
            </div>
        </div>
        ${!isCollapsed ? `<div class="ctrl-section-body">${renderBody()}</div>` : ''}
    </div>`;
}

/* ── ISSUES (regelkontroll) ── */
function renderIssues(warnings) {
    if (!warnings.length) return '<p class="ctrl-empty">✅ Inga regelbrott hittade denna vecka.</p>';

    const sorted = [...warnings].sort((a, b) => {
        if (a.severity === 'error' && b.severity !== 'error') return -1;
        if (a.severity !== 'error' && b.severity === 'error') return 1;
        return (a.date || '').localeCompare(b.date || '');
    });

    return sorted.map(w => `
        <div class="ctrl-issue">
            <span class="ctrl-issue-icon">${w.severity === 'error' ? '❌' : '⚠️'}</span>
            <div class="ctrl-issue-body">
                <div class="ctrl-issue-msg">${escapeHtml(w.message)}</div>
                <div class="ctrl-issue-meta">${escapeHtml(w.date || '')} · ${escapeHtml(w.type || '')}</div>
            </div>
        </div>
    `).join('');
}

/* ── DEMAND TABLE (bemanningsöversikt) ── */
function renderDemandTable(weekDates, demandByGroup, groups) {
    const gids = Object.keys(demandByGroup);
    if (!gids.length) return '<p class="ctrl-empty">Ingen bemanningsdata.</p>';

    return `<table class="ctrl-demand-table">
        <thead><tr>
            <th>Grupp</th>
            ${WEEKDAY_NAMES.map(d => `<th>${d}</th>`).join('')}
            <th>Totalt</th>
        </tr></thead>
        <tbody>
        ${gids.map(gid => {
            const g = groups[gid];
            const days = demandByGroup[gid];
            let totalAssigned = 0, totalNeeded = 0;
            return `<tr>
                <td style="white-space:nowrap;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sanitizeColor(g?.color)};margin-right:0.3rem;vertical-align:middle;"></span>
                    ${escapeHtml(g?.name || gid)}
                </td>
                ${days.map(d => {
                    totalAssigned += d.assigned;
                    totalNeeded += d.needed;
                    const cls = d.needed === 0 ? 'zero' : d.assigned >= d.needed ? 'ok' : 'under';
                    return `<td><span class="ctrl-demand-cell ctrl-demand-${cls}">${d.assigned}/${d.needed}</span></td>`;
                }).join('')}
                <td><span class="ctrl-demand-cell ${totalAssigned >= totalNeeded ? 'ctrl-demand-ok' : 'ctrl-demand-under'}">${totalAssigned}/${totalNeeded}</span></td>
            </tr>`;
        }).join('')}
        </tbody>
    </table>`;
}

/* ── PERSON TABLE ── */
function renderPersonTable(personStats, groups) {
    if (!personStats.length) return '<p class="ctrl-empty">Inga aktiva personer.</p>';

    const sorted = [...personStats].sort((a, b) => (b.hours || 0) - (a.hours || 0));

    return `<table class="ctrl-person-table">
        <thead><tr>
            <th>Namn</th><th>Grupp</th><th>Dagar</th><th>Timmar</th><th>Tjänstegrad</th><th>Belastning</th>
        </tr></thead>
        <tbody>
        ${sorted.map(ps => {
            const maxHours = (ps.employmentPct / 100) * 40; // 40h = heltid per vecka
            const pct = maxHours > 0 ? Math.round((ps.hours / maxHours) * 100) : 0;
            const barColor = pct > 110 ? '#f44336' : pct > 90 ? '#ff9800' : pct > 0 ? '#4caf50' : '#ddd';
            const barWidth = Math.min(100, pct);

            return `<tr>
                <td><strong>${escapeHtml(ps.name)}</strong></td>
                <td>${escapeHtml(ps.groupName)}</td>
                <td>${ps.days}</td>
                <td>${ps.hours.toFixed(1)}</td>
                <td>${ps.employmentPct}%</td>
                <td>
                    <div class="ctrl-hours-bar">
                        <div class="ctrl-hours-track">
                            <div class="ctrl-hours-fill" style="width:${barWidth}%;background:${barColor};"></div>
                        </div>
                        <span class="ctrl-hours-pct">${pct}%</span>
                    </div>
                </td>
            </tr>`;
        }).join('')}
        </tbody>
    </table>`;
}

/* ── COST TABLE ── */
function renderCostTable(costByGroup, groups, totalCost) {
    const gids = Object.keys(costByGroup);
    if (!gids.length) return '<p class="ctrl-empty">Ingen kostnadsdata.</p>';

    return `<table class="ctrl-cost-table">
        <thead><tr><th>Grupp</th><th>Timmar</th><th>Kostnad</th></tr></thead>
        <tbody>
        ${gids.map(gid => {
            const g = groups[gid];
            const c = costByGroup[gid];
            return `<tr>
                <td>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sanitizeColor(g?.color)};margin-right:0.3rem;vertical-align:middle;"></span>
                    ${escapeHtml(g?.name || gid)}
                </td>
                <td>${c.hours.toFixed(1)} tim</td>
                <td>${formatCurrency(c.cost)}</td>
            </tr>`;
        }).join('')}
        <tr>
            <td>Totalt</td>
            <td>${gids.reduce((s, gid) => s + costByGroup[gid].hours, 0).toFixed(1)} tim</td>
            <td>${formatCurrency(totalCost)}</td>
        </tr>
        </tbody>
    </table>`;
}

/* ── VACANCIES ── */
function renderVacancies(vacancies, groups, allShifts) {
    if (!vacancies.length) return '<p class="ctrl-empty">✅ Inga öppna vakanser denna vecka.</p>';

    return vacancies.map(v => {
        const g = groups[v.groupId];
        const s = allShifts[v.shiftTemplateId];
        const timeStr = s?.startTime && s?.endTime ? `${s.startTime}–${s.endTime}` : 'Flex';
        return `<div class="ctrl-issue">
            <span class="ctrl-issue-icon">📋</span>
            <div class="ctrl-issue-body">
                <div class="ctrl-issue-msg">
                    <span style="font-weight:600;">${escapeHtml(g?.name || v.groupId)}</span> —
                    ${escapeHtml(s?.name || v.shiftTemplateId)} (${escapeHtml(timeStr)})
                </div>
                <div class="ctrl-issue-meta">${escapeHtml(v.date)}</div>
            </div>
        </div>`;
    }).join('');
}

/* ══════════════════════════════════════════════════════════
 * DATA CALCULATIONS
 * ══════════════════════════════════════════════════════════ */
function calcWeekStats(weekDates, state, groups, allShifts, people, demand, absences) {
    let totalHours = 0, totalCost = 0;
    const costByGroup = {};
    const demandByGroup = {};
    const groupDemands = demand?.groupDemands || {};

    const gids = Object.keys(groups).filter(g => g !== 'SYSTEM_ADMIN');

    gids.forEach(gid => {
        costByGroup[gid] = { hours: 0, cost: 0 };
        demandByGroup[gid] = [];

        weekDates.forEach((date, dayIdx) => {
            const dateStr = formatISO(date);
            const monthIdx = getMonthIndex(dateStr);
            const dayIndex = getDayIndex(dateStr);
            const dayData = state.schedule?.months?.[monthIdx]?.days?.[dayIndex];
            const entries = (dayData?.entries || []).filter(e => e.groupId === gid);

            let dayHours = 0, dayCost = 0;
            let assigned = 0;

            entries.forEach(e => {
                if (e.status !== 'A' || !e.personId) return;
                assigned++;
                const shift = allShifts[e.shiftId];
                if (!shift) return;
                const h = calcShiftHours(shift, e);
                dayHours += h;
                const person = people.find(p => p.id === e.personId);
                dayCost += h * (person?.hourlyWage || 0);
            });

            costByGroup[gid].hours += dayHours;
            costByGroup[gid].cost += dayCost;
            totalHours += dayHours;
            totalCost += dayCost;

            // Demand
            const dayOfWeek = date.getDay(); // 0=sön
            const demandIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // mån=0
            const needed = Array.isArray(groupDemands[gid]) ? (groupDemands[gid][demandIdx] || 0) : 0;
            demandByGroup[gid].push({ assigned, needed });
        });
    });

    return { totalHours, totalCost, costByGroup, demandByGroup };
}

function calcPersonStats(weekDates, state, allShifts, people) {
    return people.map(person => {
        let days = 0, hours = 0;
        const groups = person.groups || person.groupIds || [];
        const groupName = groups.length > 0 ? groups.join(', ') : '—';

        weekDates.forEach(date => {
            const dateStr = formatISO(date);
            const dayData = state.schedule?.months?.[getMonthIndex(dateStr)]?.days?.[getDayIndex(dateStr)];
            if (!dayData || !Array.isArray(dayData.entries)) return;

            const personEntries = dayData.entries.filter(e => e.personId === person.id && e.status === 'A');
            if (personEntries.length > 0) {
                days++;
                personEntries.forEach(e => {
                    const shift = allShifts[e.shiftId];
                    if (shift) hours += calcShiftHours(shift, e);
                });
            }
        });

        const name = person.firstName && person.lastName
            ? `${person.firstName} ${person.lastName}` : (person.name || person.id);

        return {
            id: person.id,
            name,
            groupName,
            days,
            hours,
            employmentPct: person.employmentPct || 100,
        };
    });
}

/* ══════════════════════════════════════════════════════════
 * EVENT LISTENERS
 * ══════════════════════════════════════════════════════════ */
function setupControlListeners(container, store, ctx) {
    if (ctx._ctrlAbort) ctx._ctrlAbort.abort();
    ctx._ctrlAbort = new AbortController();
    const signal = ctx._ctrlAbort.signal;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ctrl]');
        if (!btn) return;
        const action = btn.dataset.ctrl;
        const ctrl = ctx._ctrl;

        try {
            if (action === 'prev-week') {
                ctrl.weekOffset = Math.max(0, ctrl.weekOffset - 1);
                renderControl(container, ctx);
            } else if (action === 'next-week') {
                ctrl.weekOffset = Math.min(MAX_WEEK_OFFSET, ctrl.weekOffset + 1);
                renderControl(container, ctx);
            } else if (action === 'today') {
                ctrl.weekOffset = calcCurrentWeekOffset(store.getState().schedule.year);
                renderControl(container, ctx);
            } else if (action === 'toggle-section') {
                const id = btn.dataset.sectionId;
                if (id) ctrl.collapsed[id] = !ctrl.collapsed[id];
                renderControl(container, ctx);
            }
        } catch (err) {
            console.error('❌ Control error:', err);
        }
    }, { signal });
}

/* ── DATE HELPERS ── */
function calcCurrentWeekOffset(year) {
    const now = new Date();
    const jan1 = new Date(year, 0, 1), d1 = jan1.getDay(), dtm = d1 === 0 ? -6 : 1 - d1;
    const firstMonday = new Date(year, 0, 1 + dtm);
    const diffDays = Math.floor((now.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, Math.min(MAX_WEEK_OFFSET, Math.floor(diffDays / 7)));
}

function getWeekDates(year, weekOffset) {
    const jan1 = new Date(year, 0, 1), d1 = jan1.getDay(), dtm = d1 === 0 ? -6 : 1 - d1;
    const fm = new Date(year, 0, 1 + dtm), ws = new Date(fm);
    ws.setDate(fm.getDate() + weekOffset * 7);
    const dates = [];
    for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(ws.getDate() + i); dates.push(d); }
    return dates;
}

function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())), dn = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dn);
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - ys) / 86400000) + 1) / 7);
}

function formatISO(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDateShort(date) { return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].toLowerCase().slice(0, 3)}`; }
function getMonthIndex(ds) { return parseInt(ds.split('-')[1], 10) - 1; }
function getDayIndex(ds) { return parseInt(ds.split('-')[2], 10) - 1; }
function formatCurrency(a) { if (!a || !Number.isFinite(a)) return '0 kr'; return Math.round(a).toLocaleString('sv-SE') + ' kr'; }

/* ── XSS ── */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|hsl\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)|hsla\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+\s*\)|[a-zA-Z]{1,20})$/;
function sanitizeColor(i) { if (typeof i !== 'string') return '#777'; const t = i.trim(); return SAFE_COLOR_RE.test(t) ? t : '#777'; }
function escapeHtml(s) { if (typeof s !== 'string') return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
