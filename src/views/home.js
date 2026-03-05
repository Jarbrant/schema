/*
 * S3-02 — HOME / DASHBOARD — Chef-dashboard med live-statistik
 * FIL: src/views/home.js
 *
 * Visar:
 *   - KPI-kort: aktiv personal, frånvarande idag, vakanser, regelbrott
 *   - Bemanningsstatus per grupp (heatmap-stil)
 *   - Perioder som slutar snart
 *   - Frånvaro denna vecka
 *   - Snabb-navigation till alla moduler
 *
 * Store shape (läser):
 *   state.people, state.absences, state.vacancies, state.groups,
 *   state.shifts, state.shiftTemplates, state.schedule, state.settings,
 *   state.demand, state.groupShifts
 *
 * Importerar INGET — helt fristående (undviker cirkulära deps).
 * Alla beräkningar görs lokalt med helpers i denna fil.
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const WEEKDAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const MONTH_NAMES = [
    'Januari','Februari','Mars','April','Maj','Juni',
    'Juli','Augusti','September','Oktober','November','December'
];

/* ============================================================
 * BLOCK 1 — MAIN RENDER
 * ============================================================ */
export function renderHome(container, ctx) {
    if (!container) return;

    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="dash-container"><h2>❌ Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    try {
        const state = store.getState();
        const today = new Date().toISOString().slice(0, 10);
        const todayDate = new Date();

        // --- Data extraction ---
        const people = Array.isArray(state.people) ? state.people : [];
        const activePeople = people.filter(p => p && p.isActive);
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const vacancies = Array.isArray(state.vacancies) ? state.vacancies : [];
        const groups = (typeof state.groups === 'object' && state.groups) || {};
        const shifts = (typeof state.shifts === 'object' && state.shifts) || {};
        const shiftTemplates = (typeof state.shiftTemplates === 'object' && state.shiftTemplates) || {};
        const demand = state.demand || {};
        const settings = state.settings || {};
        const schedule = state.schedule || {};
        const year = schedule.year || todayDate.getFullYear();
        const months = Array.isArray(schedule.months) ? schedule.months : [];

        // --- Calculations ---
        const absentToday = absences.filter(a => a.startDate <= today && a.endDate >= today);
        const absentThisWeek = getAbsencesThisWeek(absences, todayDate);
        const openVacancies = vacancies.filter(v => v.status !== 'filled' && v.date >= today);

        const weekDates = getCurrentWeekDates(todayDate);
        const weekNum = getISOWeekNumber(weekDates[0]);
        const groupStats = calcGroupBemanningStats(weekDates, state, groups, shifts, shiftTemplates, demand);

        // Period warnings
        const periodWarnings = calcPeriodWarnings(activePeople, settings, year);

        // Simple rule violation count (count entries with issues)
        const ruleViolationCount = countSimpleRuleViolations(weekDates, state, activePeople, shifts, shiftTemplates);

        // Total hours this week
        const weekHours = calcWeekTotalHours(weekDates, state, shifts, shiftTemplates);

        const versionValue = state.meta?.appVersion || '1.0.0';

        // --- Render ---
        container.innerHTML = `
            <div class="dash-container">
                <div class="dash-content">

                    <!-- HEADER -->
                    <div class="dash-header">
                        <div>
                            <h1>📊 Dashboard</h1>
                            <p class="dash-subtitle">Schema-Program v${escapeHtml(versionValue)} — HRF/Visita Gröna Riks — Vecka ${weekNum}</p>
                        </div>
                        <div class="dash-header-date">
                            ${formatDateLong(todayDate)}
                        </div>
                    </div>

                    <!-- KPI CARDS -->
                    <div class="dash-kpi-row">
                        <div class="dash-kpi-card">
                            <div class="dash-kpi-icon">👥</div>
                            <div class="dash-kpi-value">${activePeople.length}</div>
                            <div class="dash-kpi-label">Aktiv personal</div>
                        </div>
                        <div class="dash-kpi-card ${absentToday.length > 0 ? 'dash-kpi-warn' : ''}">
                            <div class="dash-kpi-icon">🔴</div>
                            <div class="dash-kpi-value">${absentToday.length}</div>
                            <div class="dash-kpi-label">Frånvarande idag</div>
                        </div>
                        <div class="dash-kpi-card ${openVacancies.length > 0 ? 'dash-kpi-warn' : ''}">
                            <div class="dash-kpi-icon">📋</div>
                            <div class="dash-kpi-value">${openVacancies.length}</div>
                            <div class="dash-kpi-label">Öppna vakanser</div>
                        </div>
                        <div class="dash-kpi-card ${ruleViolationCount > 0 ? 'dash-kpi-error' : ''}">
                            <div class="dash-kpi-icon">⚠️</div>
                            <div class="dash-kpi-value">${ruleViolationCount}</div>
                            <div class="dash-kpi-label">Regelvarningar</div>
                        </div>
                        <div class="dash-kpi-card">
                            <div class="dash-kpi-icon">⏰</div>
                            <div class="dash-kpi-value">${weekHours.toFixed(0)}</div>
                            <div class="dash-kpi-label">Timmar denna vecka</div>
                        </div>
                    </div>

                    <!-- TWO COLUMN LAYOUT -->
                    <div class="dash-grid-2col">

                        <!-- LEFT: Bemanning + Frånvaro -->
                        <div class="dash-column">

                            <!-- BEMANNING PER GRUPP -->
                            <div class="dash-card">
                                <h2>📊 Bemanningsstatus — Vecka ${weekNum}</h2>
                                ${renderGroupHeatmap(groupStats, groups)}
                            </div>

                            <!-- FRÅNVARO DENNA VECKA -->
                            <div class="dash-card">
                                <h2>📅 Frånvaro denna vecka (${absentThisWeek.length})</h2>
                                ${renderWeekAbsences(absentThisWeek, people)}
                            </div>

                        </div>

                        <!-- RIGHT: Period-varningar + Snabb-nav -->
                        <div class="dash-column">

                            <!-- PERIODER SOM SLUTAR SNART -->
                            <div class="dash-card">
                                <h2>⏳ Beräkningsperioder</h2>
                                ${renderPeriodWarnings(periodWarnings)}
                            </div>

                            <!-- SNABB-NAVIGATION -->
                            <div class="dash-card">
                                <h2>🔗 Snabb-navigation</h2>
                                <div class="dash-nav-grid">
                                    ${renderNavItem('#/calendar', '📅', 'Kalender', 'Redigera schema')}
                                    ${renderNavItem('#/personal', '👤', 'Personal', 'Hantera personaldata')}
                                    ${renderNavItem('#/groups', '👥', 'Grupper', 'Grupper & grundpass')}
                                    ${renderNavItem('#/week-templates', '📋', 'Veckomallar', 'Bemanningsbehov')}
                                    ${renderNavItem('#/control', '🔍', 'Kontroll', 'Regelöversikt')}
                                    ${renderNavItem('#/summary', '📊', 'Sammanfattning', 'Timsummering')}
                                    ${renderNavItem('#/absence', '📅', 'Frånvaro', 'Registrera frånvaro')}
                                    ${renderNavItem('#/rules', '⚖️', 'Regler', 'HRF-avtalsregler')}
                                    ${renderNavItem('#/shifts', '⏰', 'Grundpass', 'Passöversikt')}
                                    ${renderNavItem('#/export', '💾', 'Export', 'Backup & restore')}
                                    ${renderNavItem('#/help', '❓', 'Hjälp', 'Dokumentation')}
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        `;

    } catch (err) {
        console.error('❌ renderHome kraschade:', err);
        container.innerHTML = `
            <div class="dash-container">
                <h1>❌ Fel</h1>
                <p>Kunde inte visa dashboard: ${escapeHtml(String(err.message))}</p>
            </div>`;
    }
}

/* ============================================================
 * BLOCK 2 — GROUP HEATMAP (bemanning per grupp per dag)
 * ============================================================ */
function renderGroupHeatmap(groupStats, groups) {
    const gids = Object.keys(groupStats);
    if (gids.length === 0) {
        return '<p class="dash-empty">Inga grupper definierade. <a href="#/groups">Skapa grupper →</a></p>';
    }

    const headerCells = WEEKDAY_NAMES.map(d => `<th>${d}</th>`).join('');

    const rows = gids.map(gid => {
        const g = groups[gid];
        const gName = g ? g.name : gid;
        const gColor = sanitizeColor(g ? g.color : null);
        const days = groupStats[gid];

        let totalAssigned = 0, totalNeeded = 0;
        const dayCells = days.map(d => {
            totalAssigned += d.assigned;
            totalNeeded += d.needed;

            let cellClass = 'dash-heat-zero';
            if (d.needed > 0) {
                const ratio = d.assigned / d.needed;
                if (ratio >= 1) cellClass = 'dash-heat-ok';
                else if (ratio >= 0.5) cellClass = 'dash-heat-warn';
                else cellClass = 'dash-heat-bad';
            }
            return `<td><span class="dash-heat-cell ${cellClass}">${d.assigned}/${d.needed}</span></td>`;
        }).join('');

        const totalRatio = totalNeeded > 0 ? totalAssigned / totalNeeded : 1;
        const totalClass = totalRatio >= 1 ? 'dash-heat-ok' : totalRatio >= 0.7 ? 'dash-heat-warn' : 'dash-heat-bad';

        return `<tr>
            <td style="white-space:nowrap;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${gColor};margin-right:0.4rem;vertical-align:middle;"></span>
                <strong>${escapeHtml(gName)}</strong>
            </td>
            ${dayCells}
            <td><span class="dash-heat-cell ${totalClass}"><strong>${totalAssigned}/${totalNeeded}</strong></span></td>
        </tr>`;
    }).join('');

    return `
        <div class="dash-table-wrap">
            <table class="dash-heatmap-table">
                <thead><tr><th>Grupp</th>${headerCells}<th>Totalt</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/* ============================================================
 * BLOCK 3 — FRÅNVARO DENNA VECKA
 * ============================================================ */
function renderWeekAbsences(absences, people) {
    if (absences.length === 0) {
        return '<p class="dash-empty">✅ Ingen frånvaro registrerad denna vecka.</p>';
    }

    const ABSENCE_TYPES = {
        SEM: { icon: '🏖️', label: 'Semester' },
        SJ:  { icon: '🤒', label: 'Sjuk' },
        VAB: { icon: '👶', label: 'VAB' },
        FÖR: { icon: '👪', label: 'Föräldraledig' },
        PERM:{ icon: '📋', label: 'Permission' },
        UTB: { icon: '📚', label: 'Utbildning' },
        TJL: { icon: '🏠', label: 'Tjänstledig' },
    };

    return absences.map(a => {
        const person = people.find(p => p.id === a.personId);
        const name = person ? `${person.firstName} ${person.lastName}` : '(Okänd)';
        const type = ABSENCE_TYPES[a.type] || { icon: '❓', label: a.type };

        return `
            <div class="dash-absence-row">
                <span class="dash-absence-icon">${type.icon}</span>
                <strong>${escapeHtml(name)}</strong>
                <span class="dash-absence-type">${escapeHtml(type.label)}</span>
                <span class="dash-absence-dates">${formatDateShort(new Date(a.startDate))} — ${formatDateShort(new Date(a.endDate))}</span>
            </div>
        `;
    }).join('');
}

/* ============================================================
 * BLOCK 4 — PERIOD WARNINGS
 * ============================================================ */
function renderPeriodWarnings(warnings) {
    if (warnings.length === 0) {
        return '<p class="dash-empty">✅ Inga beräkningsperioder slutar snart.</p>';
    }

    return warnings.map(w => {
        const urgencyClass = w.daysLeft <= 14 ? 'dash-period-urgent' : w.daysLeft <= 30 ? 'dash-period-soon' : 'dash-period-ok';
        return `
            <div class="dash-period-row ${urgencyClass}">
                <div class="dash-period-info">
                    <strong>${escapeHtml(w.personName)}</strong>
                    <span class="dash-period-pct">${w.employmentPct}%</span>
                </div>
                <div class="dash-period-meta">
                    <span>📅 Period slutar: ${formatDateShort(new Date(w.endDate))}</span>
                    <span class="dash-period-days">${w.daysLeft} dagar kvar</span>
                </div>
                <div class="dash-period-bar">
                    <div class="dash-period-bar-fill" style="width: ${Math.min(100, w.progressPct)}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

/* ============================================================
 * BLOCK 5 — NAV ITEM
 * ============================================================ */
function renderNavItem(href, icon, title, desc) {
    return `
        <a href="${href}" class="dash-nav-item">
            <span class="dash-nav-icon">${icon}</span>
            <span class="dash-nav-title">${escapeHtml(title)}</span>
            <span class="dash-nav-desc">${escapeHtml(desc)}</span>
        </a>
    `;
}

/* ============================================================
 * BLOCK 6 — DATA CALCULATIONS
 * ============================================================ */

function getCurrentWeekDates(today) {
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function getAbsencesThisWeek(absences, today) {
    const weekDates = getCurrentWeekDates(today);
    const weekStart = formatISO(weekDates[0]);
    const weekEnd = formatISO(weekDates[6]);

    return absences.filter(a =>
        a.startDate <= weekEnd && a.endDate >= weekStart
    );
}

function calcGroupBemanningStats(weekDates, state, groups, shifts, shiftTemplates, demand) {
    const allShifts = Object.assign({}, shifts, shiftTemplates);
    const groupDemands = (demand && demand.groupDemands) ? demand.groupDemands : {};
    const gids = Object.keys(groups).filter(g => g !== 'SYSTEM_ADMIN');
    const result = {};

    gids.forEach(gid => {
        result[gid] = [];

        weekDates.forEach(date => {
            const ds = formatISO(date);
            const mi = parseInt(ds.split('-')[1], 10) - 1;
            const di = parseInt(ds.split('-')[2], 10) - 1;
            let dayData = null;
            if (state.schedule && state.schedule.months && state.schedule.months[mi] && state.schedule.months[mi].days) {
                dayData = state.schedule.months[mi].days[di];
            }
            const entries = (dayData && dayData.entries)
                ? dayData.entries.filter(e => e.groupId === gid && e.status === 'A' && e.personId)
                : [];

            const dow = date.getDay();
            const dIdx = dow === 0 ? 6 : dow - 1;
            const needed = Array.isArray(groupDemands[gid]) ? (groupDemands[gid][dIdx] || 0) : 0;

            result[gid].push({ assigned: entries.length, needed: needed });
        });
    });

    return result;
}

function calcWeekTotalHours(weekDates, state, shifts, shiftTemplates) {
    const allShifts = Object.assign({}, shifts, shiftTemplates);
    let total = 0;

    weekDates.forEach(date => {
        const ds = formatISO(date);
        const mi = parseInt(ds.split('-')[1], 10) - 1;
        const di = parseInt(ds.split('-')[2], 10) - 1;
        let dayData = null;
        if (state.schedule && state.schedule.months && state.schedule.months[mi] && state.schedule.months[mi].days) {
            dayData = state.schedule.months[mi].days[di];
        }
        if (!dayData || !Array.isArray(dayData.entries)) return;

        dayData.entries.forEach(e => {
            if (e.status !== 'A' || !e.personId) return;
            const shift = allShifts[e.shiftId];
            if (!shift || !shift.startTime || !shift.endTime) return;
            total += calcSimpleHours(shift.startTime, shift.endTime, shift.breakStart, shift.breakEnd);
        });
    });

    return total;
}

function calcSimpleHours(startTime, endTime, breakStart, breakEnd) {
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    let workMin = endMin > startMin ? endMin - startMin : (1440 - startMin) + endMin;

    if (breakStart && breakEnd) {
        const bStart = parseTimeToMinutes(breakStart);
        const bEnd = parseTimeToMinutes(breakEnd);
        const breakMin = bEnd > bStart ? bEnd - bStart : 0;
        workMin -= breakMin;
    }

    return Math.max(0, workMin / 60);
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function countSimpleRuleViolations(weekDates, state, people, shifts, shiftTemplates) {
    // Simple heuristic: count people working >10h or <11h rest
    const allShifts = Object.assign({}, shifts, shiftTemplates);
    let violations = 0;

    people.forEach(person => {
        let prevEnd = null;

        weekDates.forEach(date => {
            const ds = formatISO(date);
            const mi = parseInt(ds.split('-')[1], 10) - 1;
            const di = parseInt(ds.split('-')[2], 10) - 1;
            let dayData = null;
            if (state.schedule && state.schedule.months && state.schedule.months[mi] && state.schedule.months[mi].days) {
                dayData = state.schedule.months[mi].days[di];
            }
            if (!dayData || !Array.isArray(dayData.entries)) { prevEnd = null; return; }

            const personEntries = dayData.entries.filter(e => e.personId === person.id && e.status === 'A');
            if (personEntries.length === 0) { prevEnd = null; return; }

            let dayHours = 0;
            let earliestStart = 1440, latestEnd = 0;

            personEntries.forEach(e => {
                const shift = allShifts[e.shiftId];
                if (!shift || !shift.startTime || !shift.endTime) return;
                const h = calcSimpleHours(shift.startTime, shift.endTime, shift.breakStart, shift.breakEnd);
                dayHours += h;

                const s = parseTimeToMinutes(shift.startTime);
                const en = parseTimeToMinutes(shift.endTime);
                if (s < earliestStart) earliestStart = s;
                if (en > latestEnd) latestEnd = en;
            });

            // Max 10h per day
            if (dayHours > 10) violations++;

            // 11h rest between days
            if (prevEnd !== null && earliestStart < 1440) {
                const restMinutes = earliestStart + (1440 - prevEnd);
                if (restMinutes < 660 && restMinutes >= 0) violations++;
            }

            prevEnd = latestEnd;
        });
    });

    return violations;
}

function calcPeriodWarnings(people, settings, year) {
    const today = new Date();
    const todayISO = formatISO(today);
    const warnings = [];

    const periodLengthWeeks = settings.calculationPeriodWeeks || 26;
    const periodStartMonth = settings.calculationPeriodStartMonth || 1; // January

    // Generate periods for the year
    const periods = [];
    let pStart = new Date(year, periodStartMonth - 1, 1);
    for (let i = 0; i < 4; i++) {
        const pEnd = new Date(pStart);
        pEnd.setDate(pEnd.getDate() + periodLengthWeeks * 7 - 1);
        if (pStart.getFullYear() <= year + 1) {
            periods.push({
                start: formatISO(pStart),
                end: formatISO(pEnd),
            });
        }
        pStart = new Date(pEnd);
        pStart.setDate(pStart.getDate() + 1);
    }

    // Find current period
    const currentPeriod = periods.find(p => p.start <= todayISO && p.end >= todayISO);
    if (!currentPeriod) return warnings;

    const endDate = new Date(currentPeriod.end);
    const daysLeft = Math.max(0, Math.floor((endDate - today) / (1000 * 60 * 60 * 24)));
    const totalDays = periodLengthWeeks * 7;
    const elapsed = totalDays - daysLeft;
    const progressPct = Math.round((elapsed / totalDays) * 100);

    // Only warn if < 60 days left
    if (daysLeft > 60) return warnings;

    people.filter(p => p.isActive).forEach(person => {
        const name = (person.firstName && person.lastName)
            ? `${person.firstName} ${person.lastName}`
            : (person.name || person.id);
        const pct = person.employmentPct || person.degree || 100;

        warnings.push({
            personName: name,
            employmentPct: pct,
            endDate: currentPeriod.end,
            daysLeft: daysLeft,
            progressPct: progressPct,
        });
    });

    // Sort: most urgent first
    warnings.sort((a, b) => a.daysLeft - b.daysLeft);
    return warnings;
}

/* ============================================================
 * BLOCK 7 — DATE/FORMAT HELPERS
 * ============================================================ */
function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatISO(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

function formatDateShort(date) {
    return date.getDate() + ' ' + MONTH_NAMES[date.getMonth()]?.slice(0, 3).toLowerCase();
}

function formatDateLong(date) {
    return `${WEEKDAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function sanitizeColor(color) {
    if (!color || typeof color !== 'string') return '#777';
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
    if (/^[a-zA-Z]+$/.test(color)) return color;
    return '#777';
}
