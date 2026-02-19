/*
 * AO-08 — Control View (Dashboard) — v2.0 (RULES + FULL COST)
 * FIL: src/views/control.js
 *
 * v2.0:
 *   - Validerar state.rules via validateRules()
 *   - Visar semesterersättning, FORA, arbetsgivaravgift
 *   - Kollar minimilön mot kollektivavtal
 *   - Ny sektion: "💰 Total personalkostnad" (bruttolön + påslag)
 */

import {
    calcShiftHours,
    validateScheduleIntegrity,
    validateRules,
    calcFullPersonCost,
    checkMinimumWage,
} from '../modules/schedule-engine.js';

/* ── CONSTANTS ── */
const WEEKDAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTH_NAMES = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
const MAX_WEEK_OFFSET = 53;

/* ── MAIN RENDER ── */
export function renderControl(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = '<div class="ctrl-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>'; return; }

    try {
        const state = store.getState();
        if (!state.schedule || typeof state.schedule.year !== 'number') {
            container.innerHTML = '<div class="ctrl-error"><h2>❌ Fel</h2><p>Schedule saknas.</p></div>'; return;
        }

        const year = state.schedule.year;
        const groups = (typeof state.groups === 'object' && state.groups) || {};
        const shifts = (typeof state.shifts === 'object' && state.shifts) || {};
        const shiftTemplates = (typeof state.shiftTemplates === 'object' && state.shiftTemplates) || {};
        const groupShifts = (typeof state.groupShifts === 'object' && state.groupShifts) || {};
        const people = Array.isArray(state.people) ? state.people : [];
        const activePeople = people.filter(function(p) { return p.isActive; });
        const demand = state.demand || {};
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const vacancies = Array.isArray(state.vacancies) ? state.vacancies : [];
        const rules = Array.isArray(state.rules) ? state.rules : [];
        const settings = state.settings || {};

        /* ── View state ── */
        if (!ctx._ctrl) {
            ctx._ctrl = { weekOffset: calcCurrentWeekOffset(year), collapsed: {} };
        }
        var ctrl = ctx._ctrl;
        if (!ctrl.collapsed) ctrl.collapsed = {};

        var allShifts = Object.assign({}, shifts, shiftTemplates);
        var weekDates = getWeekDates(year, ctrl.weekOffset);
        var weekNum = getISOWeekNumber(weekDates[0]);

        /* ── Compute data ── */
        var integrityWarnings = validateScheduleIntegrity(state.schedule.months, people, absences);
        var weekIntegrityWarnings = integrityWarnings.filter(function(w) {
            return weekDates.some(function(d) { return formatISO(d) === w.date; });
        });

        /* v2.0: Regelvalidering */
        var ruleWarnings = validateRules({
            weekDates: weekDates,
            rules: rules,
            scheduleMonths: state.schedule.months,
            people: activePeople,
            shifts: shifts,
            shiftTemplates: shiftTemplates,
            groupShifts: groupShifts,
            groups: groups,
            settings: settings,
        });

        /* v2.0: Minimilönkontroll */
        var wageWarnings = checkMinimumWage(activePeople, settings);

        /* Slå ihop alla varningar */
        var allWarnings = weekIntegrityWarnings.concat(ruleWarnings, wageWarnings);
        var totalErrors = allWarnings.filter(function(w) { return w.severity === 'error'; }).length;
        var totalWarns = allWarnings.filter(function(w) { return w.severity === 'warning'; }).length;

        var weekStats = calcWeekStats(weekDates, state, groups, allShifts, activePeople, demand);
        var personStats = calcPersonStatsWithCost(weekDates, state, allShifts, activePeople, settings);
        var openVacancies = vacancies.filter(function(v) {
            return v.status !== 'filled' && weekDates.some(function(d) { return formatISO(d) === v.date; });
        });

        /* v2.0: Total kostnad inkl påslag */
        var totalFullCost = 0, totalGrossWage = 0, totalVacPay = 0, totalFora = 0, totalTax = 0;
        personStats.forEach(function(ps) {
            totalFullCost += ps.totalCost;
            totalGrossWage += ps.grossWage;
            totalVacPay += ps.vacationPay;
            totalFora += ps.fora;
            totalTax += ps.employerTax;
        });

        /* ── Render ── */
        container.innerHTML =
            '<div class="ctrl-container">' +
                renderTopBar(ctrl, weekNum, weekDates) +

                '<div class="ctrl-summary-row">' +
                    '<div class="ctrl-summary-card ' + (weekStats.totalHours > 0 ? 'info' : 'warn') + '">' +
                        '<span class="ctrl-summary-label">Timmar</span>' +
                        '<span class="ctrl-summary-value">' + weekStats.totalHours.toFixed(1) + '</span>' +
                        '<span class="ctrl-summary-sub">' + activePeople.length + ' aktiva</span>' +
                    '</div>' +
                    '<div class="ctrl-summary-card ' + (totalFullCost > 0 ? 'info' : 'warn') + '">' +
                        '<span class="ctrl-summary-label">Total kostnad</span>' +
                        '<span class="ctrl-summary-value">' + formatCurrency(totalFullCost) + '</span>' +
                        '<span class="ctrl-summary-sub">Bruttolön ' + formatCurrency(totalGrossWage) + '</span>' +
                    '</div>' +
                    '<div class="ctrl-summary-card ' + (totalErrors > 0 ? 'error' : totalWarns > 0 ? 'warn' : 'ok') + '">' +
                        '<span class="ctrl-summary-label">Regelbrott</span>' +
                        '<span class="ctrl-summary-value">' + (totalErrors + totalWarns) + '</span>' +
                        '<span class="ctrl-summary-sub">' + totalErrors + ' fel, ' + totalWarns + ' varningar</span>' +
                    '</div>' +
                    '<div class="ctrl-summary-card ' + (openVacancies.length > 0 ? 'warn' : 'ok') + '">' +
                        '<span class="ctrl-summary-label">Vakanser</span>' +
                        '<span class="ctrl-summary-value">' + openVacancies.length + '</span>' +
                        '<span class="ctrl-summary-sub">' + (openVacancies.length > 0 ? 'Ofyllda pass' : 'Alla fyllda') + '</span>' +
                    '</div>' +
                '</div>' +

                '<div class="ctrl-sections">' +
                    renderSection('issues', '⚠️ Regelkontroll', ctrl, totalErrors + totalWarns,
                        totalErrors > 0 ? 'error' : totalWarns > 0 ? 'warn' : 'ok',
                        renderIssues(allWarnings), false) +

                    renderSection('fullcost', '💰 Personalkostnad (inkl påslag)', ctrl, null, 'info',
                        renderFullCostSummary(totalGrossWage, totalVacPay, totalFora, totalTax, totalFullCost, settings), false) +

                    renderSection('demand', '📊 Bemanningsöversikt', ctrl, null, 'info',
                        renderDemandTable(weekDates, weekStats.demandByGroup, groups), false) +

                    renderSection('persons', '👥 Personstatistik', ctrl, activePeople.length, 'info',
                        renderPersonTable(personStats), true) +

                    renderSection('costs', '💵 Kostnad per grupp', ctrl, null, 'info',
                        renderCostTable(weekStats.costByGroup, groups, weekStats.totalCost), false) +

                    renderSection('vacancies', '📋 Vakanser', ctrl, openVacancies.length,
                        openVacancies.length > 0 ? 'warn' : 'ok',
                        renderVacancies(openVacancies, groups, allShifts), false) +
                '</div>' +
            '</div>';

        setupControlListeners(container, store, ctx);
    } catch (err) {
        console.error('❌ renderControl kraschade:', err);
        container.innerHTML = '<div class="ctrl-error"><h2>❌ Fel</h2><p>' + escapeHtml(String(err.message)) + '</p></div>';
    }
}

/* ── TOP BAR ── */
function renderTopBar(ctrl, weekNum, weekDates) {
    return '<div class="ctrl-topbar">' +
        '<div style="font-size:1.1rem;font-weight:700;color:#333;">✓ Kontroll</div>' +
        '<div class="ctrl-topbar-center">' +
            '<button class="btn btn-secondary" data-ctrl="prev-week">◀</button>' +
            '<div class="ctrl-week-display">' +
                '<strong>Vecka ' + weekNum + '</strong>' +
                '<span class="ctrl-week-range">' + formatDateShort(weekDates[0]) + ' – ' + formatDateShort(weekDates[6]) + '</span>' +
            '</div>' +
            '<button class="btn btn-secondary" data-ctrl="next-week">▶</button>' +
            '<button class="btn btn-secondary btn-sm" data-ctrl="today">Idag</button>' +
        '</div>' +
        '<div></div>' +
    '</div>';
}

/* ── SECTION WRAPPER ── */
function renderSection(id, title, ctrl, badgeCount, badgeType, bodyHtml, fullWidth) {
    var isCollapsed = !!ctrl.collapsed[id];
    var badgeStr = '';
    if (badgeCount !== null && badgeCount !== undefined) {
        badgeStr = '<span class="ctrl-section-badge ctrl-badge-' + badgeType + '">' + badgeCount + '</span>';
    }
    return '<div class="ctrl-section' + (fullWidth ? ' full-width' : '') + '">' +
        '<div class="ctrl-section-header" data-ctrl="toggle-section" data-section-id="' + id + '">' +
            '<h3>' + title + '</h3>' +
            '<div style="display:flex;align-items:center;gap:0.5rem;">' +
                badgeStr +
                '<span class="ctrl-section-toggle">' + (isCollapsed ? '▶' : '▼') + '</span>' +
            '</div>' +
        '</div>' +
        (!isCollapsed ? '<div class="ctrl-section-body">' + bodyHtml + '</div>' : '') +
    '</div>';
}

/* ── ISSUES (alla regelbrott) ── */
function renderIssues(warnings) {
    if (!warnings.length) return '<p class="ctrl-empty">✅ Inga regelbrott hittade denna vecka.</p>';

    var integrity = [];
    var ruleEngineW = [];
    var wageW = [];

    warnings.forEach(function(w) {
        if (w.type === 'minimumWage') { wageW.push(w); }
        else if (w.ruleId) { ruleEngineW.push(w); }
        else { integrity.push(w); }
    });

    var html = '';
    if (integrity.length) {
        html += '<div class="ctrl-issue-group"><div class="ctrl-issue-group-title">🔍 Schemaintegritet (' + integrity.length + ')</div>';
        html += renderIssueList(integrity) + '</div>';
    }
    if (ruleEngineW.length) {
        html += '<div class="ctrl-issue-group"><div class="ctrl-issue-group-title">⚖️ Arbetstidsregler (' + ruleEngineW.length + ')</div>';
        html += renderIssueList(ruleEngineW) + '</div>';
    }
    if (wageW.length) {
        html += '<div class="ctrl-issue-group"><div class="ctrl-issue-group-title">💰 Lön & avtal (' + wageW.length + ')</div>';
        html += renderIssueList(wageW) + '</div>';
    }
    return html;
}

function renderIssueList(warnings) {
    var sorted = warnings.slice().sort(function(a, b) {
        if (a.severity === 'error' && b.severity !== 'error') return -1;
        if (a.severity !== 'error' && b.severity === 'error') return 1;
        return (a.date || '').localeCompare(b.date || '');
    });
    return sorted.map(function(w) {
        return '<div class="ctrl-issue">' +
            '<span class="ctrl-issue-icon">' + (w.severity === 'error' ? '❌' : '⚠️') + '</span>' +
            '<div class="ctrl-issue-body">' +
                '<div class="ctrl-issue-msg">' + escapeHtml(w.message) + '</div>' +
                '<div class="ctrl-issue-meta">' +
                    (w.date ? escapeHtml(w.date) + ' · ' : '') +
                    (w.ruleName ? escapeHtml(w.ruleName) : escapeHtml(w.type || '')) +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

/* ── FULL COST SUMMARY ── */
function renderFullCostSummary(grossWage, vacPay, fora, tax, total, settings) {
    var vacRate = ((settings.defaultVacationPayRate != null ? settings.defaultVacationPayRate : 0.12) * 100).toFixed(1);
    var foraRate = ((settings.defaultForaRate != null ? settings.defaultForaRate : 0.043) * 100).toFixed(1);
    var taxRate = ((settings.defaultEmployerTaxRate != null ? settings.defaultEmployerTaxRate : 0.3142) * 100).toFixed(1);

    return '<div class="ctrl-cost-breakdown">' +
        '<table class="ctrl-cost-table">' +
            '<thead><tr><th>Kostnadspost</th><th>Sats</th><th>Belopp</th></tr></thead>' +
            '<tbody>' +
                '<tr><td><strong>Bruttolön</strong></td><td>—</td><td><strong>' + formatCurrency(grossWage) + '</strong></td></tr>' +
                '<tr><td>🏖️ Semesterersättning</td><td>' + vacRate + '%</td><td>+ ' + formatCurrency(vacPay) + '</td></tr>' +
                '<tr><td>🏛️ FORA (tjänstepension + försäkring)</td><td>' + foraRate + '%</td><td>+ ' + formatCurrency(fora) + '</td></tr>' +
                '<tr><td>💵 Arbetsgivaravgift</td><td>' + taxRate + '%</td><td>+ ' + formatCurrency(tax) + '</td></tr>' +
                '<tr style="border-top:2px solid #333;font-weight:700;">' +
                    '<td>📊 TOTAL PERSONALKOSTNAD</td><td></td><td style="color:#d32f2f;font-size:1.1rem;">' + formatCurrency(total) + '</td>' +
                '</tr>' +
            '</tbody>' +
        '</table>' +
        '<div style="margin-top:0.5rem;font-size:0.8rem;color:#888;">' +
            '💡 Beräknat på schemalagda timmar denna vecka. Satserna kan justeras i Inställningar eller per person.' +
        '</div>' +
    '</div>';
}

/* ── DEMAND TABLE ── */
function renderDemandTable(weekDates, demandByGroup, groups) {
    var gids = Object.keys(demandByGroup);
    if (!gids.length) return '<p class="ctrl-empty">Ingen bemanningsdata.</p>';
    var headerCells = WEEKDAY_NAMES.map(function(d) { return '<th>' + d + '</th>'; }).join('');
    var rows = gids.map(function(gid) {
        var g = groups[gid];
        var days = demandByGroup[gid];
        var tA = 0, tN = 0;
        var dayCells = days.map(function(d) {
            tA += d.assigned;
            tN += d.needed;
            var cls = d.needed === 0 ? 'zero' : d.assigned >= d.needed ? 'ok' : 'under';
            return '<td><span class="ctrl-demand-cell ctrl-demand-' + cls + '">' + d.assigned + '/' + d.needed + '</span></td>';
        }).join('');
        return '<tr>' +
            '<td style="white-space:nowrap;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + sanitizeColor(g ? g.color : null) + ';margin-right:0.3rem;vertical-align:middle;"></span>' + escapeHtml(g ? g.name : gid) + '</td>' +
            dayCells +
            '<td><span class="ctrl-demand-cell ' + (tA >= tN ? 'ctrl-demand-ok' : 'ctrl-demand-under') + '">' + tA + '/' + tN + '</span></td>' +
        '</tr>';
    }).join('');
    return '<table class="ctrl-demand-table"><thead><tr><th>Grupp</th>' + headerCells + '<th>Totalt</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

/* ── PERSON TABLE ── */
function renderPersonTable(personStats) {
    if (!personStats.length) return '<p class="ctrl-empty">Inga aktiva personer.</p>';
    var sorted = personStats.slice().sort(function(a, b) { return (b.totalCost || 0) - (a.totalCost || 0); });
    var rows = sorted.map(function(ps) {
        var maxH = (ps.employmentPct / 100) * 40;
        var pct = maxH > 0 ? Math.round((ps.hours / maxH) * 100) : 0;
        var barColor = pct > 110 ? '#f44336' : pct > 90 ? '#ff9800' : pct > 0 ? '#4caf50' : '#ddd';
        var barW = Math.min(100, pct);
        return '<tr>' +
            '<td><strong>' + escapeHtml(ps.name) + '</strong></td>' +
            '<td>' + escapeHtml(ps.groupName) + '</td>' +
            '<td>' + ps.days + '</td>' +
            '<td>' + ps.hours.toFixed(1) + '</td>' +
            '<td>' + formatCurrency(ps.grossWage) + '</td>' +
            '<td><strong>' + formatCurrency(ps.totalCost) + '</strong></td>' +
            '<td><div class="ctrl-hours-bar"><div class="ctrl-hours-track"><div class="ctrl-hours-fill" style="width:' + barW + '%;background:' + barColor + ';"></div></div><span class="ctrl-hours-pct">' + pct + '%</span></div></td>' +
        '</tr>';
    }).join('');
    return '<table class="ctrl-person-table"><thead><tr><th>Namn</th><th>Grupp</th><th>Dagar</th><th>Timmar</th><th>Bruttolön</th><th>Total kostnad</th><th>Belastning</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

/* ── COST TABLE ── */
function renderCostTable(costByGroup, groups, totalCost) {
    var gids = Object.keys(costByGroup);
    if (!gids.length) return '<p class="ctrl-empty">Ingen kostnadsdata.</p>';
    var totalH = 0;
    var rows = gids.map(function(gid) {
        var g = groups[gid];
        var c = costByGroup[gid];
        totalH += c.hours;
        return '<tr>' +
            '<td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + sanitizeColor(g ? g.color : null) + ';margin-right:0.3rem;vertical-align:middle;"></span>' + escapeHtml(g ? g.name : gid) + '</td>' +
            '<td>' + c.hours.toFixed(1) + ' tim</td>' +
            '<td>' + formatCurrency(c.cost) + '</td>' +
        '</tr>';
    }).join('');
    rows += '<tr><td>Totalt</td><td>' + totalH.toFixed(1) + ' tim</td><td>' + formatCurrency(totalCost) + '</td></tr>';
    return '<table class="ctrl-cost-table"><thead><tr><th>Grupp</th><th>Timmar</th><th>Bruttolön</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

/* ── VACANCIES ── */
function renderVacancies(vacancies, groups, allShifts) {
    if (!vacancies.length) return '<p class="ctrl-empty">✅ Inga öppna vakanser denna vecka.</p>';
    return vacancies.map(function(v) {
        var g = groups[v.groupId];
        var s = allShifts[v.shiftTemplateId];
        var ts = (s && s.startTime && s.endTime) ? s.startTime + '–' + s.endTime : 'Flex';
        return '<div class="ctrl-issue">' +
            '<span class="ctrl-issue-icon">📋</span>' +
            '<div class="ctrl-issue-body">' +
                '<div class="ctrl-issue-msg"><span style="font-weight:600;">' + escapeHtml(g ? g.name : v.groupId) + '</span> — ' + escapeHtml(s ? s.name : v.shiftTemplateId) + ' (' + escapeHtml(ts) + ')</div>' +
                '<div class="ctrl-issue-meta">' + escapeHtml(v.date) + '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

/* ══════════════════════════════════════════════════════════
 * DATA CALCULATIONS
 * ══════════════════════════════════════════════════════════ */
function calcWeekStats(weekDates, state, groups, allShifts, people, demand) {
    var totalHours = 0, totalCost = 0;
    var costByGroup = {};
    var demandByGroup = {};
    var groupDemands = (demand && demand.groupDemands) ? demand.groupDemands : {};
    var gids = Object.keys(groups).filter(function(g) { return g !== 'SYSTEM_ADMIN'; });

    gids.forEach(function(gid) {
        costByGroup[gid] = { hours: 0, cost: 0 };
        demandByGroup[gid] = [];

        weekDates.forEach(function(date) {
            var ds = formatISO(date);
            var mi = getMonthIndex(ds), di = getDayIndex(ds);
            var dayData = null;
            if (state.schedule && state.schedule.months && state.schedule.months[mi] && state.schedule.months[mi].days) {
                dayData = state.schedule.months[mi].days[di];
            }
            var entries = (dayData && dayData.entries) ? dayData.entries.filter(function(e) { return e.groupId === gid; }) : [];
            var dH = 0, dC = 0, assigned = 0;

            entries.forEach(function(e) {
                if (e.status !== 'A' || !e.personId) return;
                assigned++;
                var shift = allShifts[e.shiftId];
                if (!shift) return;
                var h = calcShiftHours(shift, e);
                dH += h;
                var p = people.find(function(pp) { return pp.id === e.personId; });
                dC += h * ((p && p.hourlyWage) ? p.hourlyWage : 0);
            });

            costByGroup[gid].hours += dH;
            costByGroup[gid].cost += dC;
            totalHours += dH;
            totalCost += dC;

            var dow = date.getDay();
            var dIdx = dow === 0 ? 6 : dow - 1;
            var needed = Array.isArray(groupDemands[gid]) ? (groupDemands[gid][dIdx] || 0) : 0;
            demandByGroup[gid].push({ assigned: assigned, needed: needed });
        });
    });

    return { totalHours: totalHours, totalCost: totalCost, costByGroup: costByGroup, demandByGroup: demandByGroup };
}

/* v2.0: Personstatistik med full kostnad */
function calcPersonStatsWithCost(weekDates, state, allShifts, people, settings) {
    return people.map(function(person) {
        var days = 0, hours = 0;
        var pGroups = person.groups || person.groupIds || [];
        var groupName = pGroups.length > 0 ? pGroups.join(', ') : '—';

        weekDates.forEach(function(date) {
            var ds = formatISO(date);
            var mi = getMonthIndex(ds), di = getDayIndex(ds);
            var dayData = null;
            if (state.schedule && state.schedule.months && state.schedule.months[mi] && state.schedule.months[mi].days) {
                dayData = state.schedule.months[mi].days[di];
            }
            if (!dayData || !Array.isArray(dayData.entries)) return;
            var pe = dayData.entries.filter(function(e) { return e.personId === person.id && e.status === 'A'; });
            if (pe.length > 0) {
                days++;
                pe.forEach(function(e) {
                    var shift = allShifts[e.shiftId];
                    if (shift) hours += calcShiftHours(shift, e);
                });
            }
        });

        var name = (person.firstName && person.lastName) ? person.firstName + ' ' + person.lastName : (person.name || person.id);
        var costData = calcFullPersonCost(person, hours, settings);

        return {
            id: person.id,
            name: name,
            groupName: groupName,
            days: days,
            hours: hours,
            employmentPct: person.employmentPct || 100,
            grossWage: costData.grossWage,
            vacationPay: costData.vacationPay,
            fora: costData.fora,
            employerTax: costData.employerTax,
            totalCost: costData.totalCost,
        };
    });
}

/* ══════════════════════════════════════════════════════════
 * EVENT LISTENERS
 * ══════════════════════════════════════════════════════════ */
function setupControlListeners(container, store, ctx) {
    if (ctx._ctrlAbort) ctx._ctrlAbort.abort();
    ctx._ctrlAbort = new AbortController();
    var signal = ctx._ctrlAbort.signal;

    container.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-ctrl]');
        if (!btn) return;
        var action = btn.dataset.ctrl;
        var ctrl = ctx._ctrl;

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
                var id = btn.dataset.sectionId;
                if (id) ctrl.collapsed[id] = !ctrl.collapsed[id];
                renderControl(container, ctx);
            }
        } catch (err) {
            console.error('❌ Control error:', err);
        }
    }, { signal: signal });
}

/* ══════════════════════════════════════════════════════════
 * DATE HELPERS
 * ══════════════════════════════════════════════════════════ */
function calcCurrentWeekOffset(year) {
    var now = new Date();
    var jan1 = new Date(year, 0, 1);
    var d1 = jan1.getDay();
    var dtm = d1 === 0 ? -6 : 1 - d1;
    var firstMonday = new Date(year, 0, 1 + dtm);
    var diffDays = Math.floor((now.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(0, Math.min(MAX_WEEK_OFFSET, Math.floor(diffDays / 7)));
}

function getWeekDates(year, weekOffset) {
    var jan1 = new Date(year, 0, 1);
    var d1 = jan1.getDay();
    var dtm = d1 === 0 ? -6 : 1 - d1;
    var firstMonday = new Date(year, 0, 1 + dtm);
    var weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + weekOffset * 7);
    var dates = [];
    for (var i = 0; i < 7; i++) {
        var d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function getISOWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatISO(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function formatDateShort(date) {
    var months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return date.getDate() + ' ' + months[date.getMonth()];
}

function getMonthIndex(ds) { return parseInt(ds.split('-')[1], 10) - 1; }
function getDayIndex(ds) { return parseInt(ds.split('-')[2], 10) - 1; }

/* ── FORMAT HELPERS ── */
function formatCurrency(amount) {
    if (!amount || !Number.isFinite(amount)) return '0 kr';
    return Math.round(amount).toLocaleString('sv-SE') + ' kr';
}

/* ── XSS HELPERS ── */
var SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|hsl\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)|hsla\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+\s*\)|[a-zA-Z]{1,20})$/;

function sanitizeColor(input) {
    if (typeof input !== 'string') return '#777';
    var trimmed = input.trim();
    return SAFE_COLOR_RE.test(trimmed) ? trimmed : '#777';
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
