/*
 * AO-09 — Summary View (Sammanställning) — v2.0
 * FIL: src/views/summary.js
 *
 * v1.0: Månadssammanställning: timmar, kostnader, per person/grupp.
 * v2.0: + Beräkningsperioder (AO-12) — timbalans per person/kvartal.
 */

import { calcShiftHours } from '../modules/schedule-engine.js';
import {
    getDefaultPeriods,
    getActivePeriod,
    calcAllPersonBalances,
    PERIOD_NAMES,
} from '../modules/calculation-periods.js';

/* ── CONSTANTS ── */
const MONTH_NAMES = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

/* ── MAIN RENDER ── */
export function renderSummary(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = `<div class="sum-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`; return; }

    try {
        const state = store.getState();
        if (!state.schedule || typeof state.schedule.year !== 'number') {
            container.innerHTML = `<div class="sum-error"><h2>❌ Fel</h2><p>Schedule saknas.</p></div>`; return;
        }

        const year = state.schedule.year;
        const groups = (typeof state.groups === 'object' && state.groups) || {};
        const shifts = (typeof state.shifts === 'object' && state.shifts) || {};
        const shiftTemplates = (typeof state.shiftTemplates === 'object' && state.shiftTemplates) || {};
        const allShifts = { ...shifts, ...shiftTemplates };
        const people = Array.isArray(state.people) ? state.people : [];
        const activePeople = people.filter(p => p.isActive);
        const months = Array.isArray(state.schedule.months) ? state.schedule.months : [];
        const settings = state.settings || {};

        if (!ctx._sum) {
            const now = new Date();
            ctx._sum = { monthIndex: now.getFullYear() === year ? now.getMonth() : 0, showBalances: true };
        }
        const sum = ctx._sum;

        /* Beräkna data för vald månad */
        const monthData = months[sum.monthIndex] || { days: [] };
        const days = Array.isArray(monthData.days) ? monthData.days : [];

        let totalHours = 0, totalCost = 0, totalEntries = 0;
        const personStats = {};
        const groupStats = {};

        days.forEach(day => {
            if (!Array.isArray(day.entries)) return;
            day.entries.forEach(entry => {
                if (entry.status !== 'A') return;
                const shift = allShifts[entry.shiftId];
                if (!shift) return;

                const h = calcShiftHours(shift, entry);
                totalHours += h;
                totalEntries++;

                const person = people.find(p => p.id === entry.personId);
                const wage = person?.hourlyWage || 0;
                const cost = h * wage;
                totalCost += cost;

                /* Per person */
                if (entry.personId) {
                    if (!personStats[entry.personId]) {
                        personStats[entry.personId] = { hours: 0, cost: 0, shifts: 0, person };
                    }
                    personStats[entry.personId].hours += h;
                    personStats[entry.personId].cost += cost;
                    personStats[entry.personId].shifts++;
                }

                /* Per grupp */
                if (entry.groupId) {
                    if (!groupStats[entry.groupId]) {
                        groupStats[entry.groupId] = { hours: 0, cost: 0, shifts: 0, group: groups[entry.groupId] };
                    }
                    groupStats[entry.groupId].hours += h;
                    groupStats[entry.groupId].cost += cost;
                    groupStats[entry.groupId].shifts++;
                }
            });
        });

        const personList = Object.values(personStats).sort((a, b) => b.hours - a.hours);
        const groupList = Object.values(groupStats).sort((a, b) => b.hours - a.hours);
        const daysInMonth = new Date(year, sum.monthIndex + 1, 0).getDate();

        /* AO-12: Beräkna timbalanser per person/period */
        const balances = calcAllPersonBalances(people, settings, months, shifts, shiftTemplates, year);

        /* Hitta aktiv period för vald månad */
        const midMonthDate = `${year}-${String(sum.monthIndex + 1).padStart(2, '0')}-15`;
        const periods = getDefaultPeriods(year);
        const activePeriod = getActivePeriod(midMonthDate, periods);

        container.innerHTML = `
            <div class="sum-container">
                ${renderTopBar(sum, year)}
                ${renderCards(totalHours, totalCost, totalEntries, activePeople.length, daysInMonth)}
                <div class="sum-sections">
                    ${renderPersonSection(personList)}
                    ${renderGroupSection(groupList, groups)}
                    ${renderBalanceSection(balances, activePeriod, sum.showBalances)}
                </div>
            </div>`;

        setupListeners(container, store, ctx);
    } catch (err) {
        console.error('❌ renderSummary kraschade:', err);
        container.innerHTML = `<div class="sum-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ── TOP BAR ── */
function renderTopBar(sum, year) {
    return `<div class="sum-topbar">
        <div></div>
        <div class="sum-topbar-center">
            <button class="btn btn-secondary" data-sum="prev-month">◀</button>
            <div class="sum-month-display">
                <strong>${MONTH_NAMES[sum.monthIndex]} ${year}</strong>
                <span class="sum-month-sub">Månad ${sum.monthIndex + 1} av 12</span>
            </div>
            <button class="btn btn-secondary" data-sum="next-month">▶</button>
        </div>
        <div>
            <button class="btn btn-secondary" data-sum="toggle-balances" style="font-size:0.85rem">
                ${sum.showBalances ? '📊 Dölj timbalans' : '📊 Visa timbalans'}
            </button>
        </div>
    </div>`;
}

/* ── SUMMARY CARDS ── */
function renderCards(totalHours, totalCost, totalEntries, activeCount, daysInMonth) {
    return `<div class="sum-cards-row">
        <div class="sum-card c-blue">
            <span class="sum-card-label">Totala timmar</span>
            <span class="sum-card-value">${totalHours.toFixed(1)}</span>
            <span class="sum-card-sub">tim denna månad</span>
        </div>
        <div class="sum-card c-green">
            <span class="sum-card-label">Total kostnad</span>
            <span class="sum-card-value">${formatCurrency(totalCost)}</span>
            <span class="sum-card-sub">lönekostnad</span>
        </div>
        <div class="sum-card c-orange">
            <span class="sum-card-label">Tilldelningar</span>
            <span class="sum-card-value">${totalEntries}</span>
            <span class="sum-card-sub">pass denna månad</span>
        </div>
        <div class="sum-card c-purple">
            <span class="sum-card-label">Aktiv personal</span>
            <span class="sum-card-value">${activeCount}</span>
            <span class="sum-card-sub">${daysInMonth} dagar i månaden</span>
        </div>
    </div>`;
}

/* ── PERSON SECTION ── */
function renderPersonSection(personList) {
    return `<div class="sum-section">
        <div class="sum-section-header"><h3>👤 Per person</h3></div>
        <div class="sum-section-body">
            ${!personList.length ? '<p class="sum-empty">Inga tilldelningar denna månad.</p>' : `
            <table class="sum-table">
                <thead><tr><th>Namn</th><th>Timmar</th><th>Pass</th><th>Kostnad</th></tr></thead>
                <tbody>${personList.map(ps => {
                    const p = ps.person;
                    const nm = p ? (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : (p.name || p.id)) : '—';
                    return `<tr>
                        <td><strong>${escapeHtml(nm)}</strong></td>
                        <td>${ps.hours.toFixed(1)}</td>
                        <td>${ps.shifts}</td>
                        <td>${formatCurrency(ps.cost)}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`}
        </div>
    </div>`;
}

/* ── GROUP SECTION ── */
function renderGroupSection(groupList, groups) {
    return `<div class="sum-section">
        <div class="sum-section-header"><h3>👥 Per grupp</h3></div>
        <div class="sum-section-body">
            ${!groupList.length ? '<p class="sum-empty">Inga tilldelningar denna månad.</p>' : `
            <table class="sum-table">
                <thead><tr><th>Grupp</th><th>Timmar</th><th>Pass</th><th>Kostnad</th></tr></thead>
                <tbody>${groupList.map(gs => {
                    const g = gs.group;
                    const nm = g ? g.name : '—';
                    const color = g?.color || '#777';
                    return `<tr>
                        <td><span class="sum-group-dot" style="background:${sanitizeColor(color)}"></span> <strong>${escapeHtml(nm)}</strong></td>
                        <td>${gs.hours.toFixed(1)}</td>
                        <td>${gs.shifts}</td>
                        <td>${formatCurrency(gs.cost)}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`}
        </div>
    </div>`;
}

/* ── AO-12: BALANCE SECTION (timbalans per person/period) ── */
function renderBalanceSection(balances, activePeriod, showBalances) {
    if (!showBalances) return '';

    const balanceList = [];
    balances.forEach((data, personId) => balanceList.push(data));

    /* Sortera: störst avvikelse först */
    balanceList.sort((a, b) => Math.abs(b.totalBalance) - Math.abs(a.totalBalance));

    /* Summering */
    const totalOver = balanceList.filter(b => b.totalBalance > 2).length;
    const totalUnder = balanceList.filter(b => b.totalBalance < -2).length;
    const totalOk = balanceList.length - totalOver - totalUnder;

    return `<div class="sum-section" style="grid-column: 1 / -1">
        <div class="sum-section-header">
            <h3>📊 Timbalans per beräkningsperiod (HRF)</h3>
            ${activePeriod ? `<span style="font-size:0.85rem;color:#666;margin-left:0.5rem">Aktiv period: <strong>${escapeHtml(activePeriod.name)}</strong></span>` : ''}
        </div>

        <div style="display:flex;gap:1rem;margin:0.75rem 0;flex-wrap:wrap">
            <span style="padding:0.3rem 0.75rem;border-radius:4px;font-size:0.85rem;background:#d4edda;color:#155724">✅ OK: ${totalOk}</span>
            <span style="padding:0.3rem 0.75rem;border-radius:4px;font-size:0.85rem;background:#fff3cd;color:#856404">⚠️ Övertid: ${totalOver}</span>
            <span style="padding:0.3rem 0.75rem;border-radius:4px;font-size:0.85rem;background:#f8d7da;color:#721c24">📉 Undertid: ${totalUnder}</span>
        </div>

        <div class="sum-section-body">
            ${!balanceList.length ? '<p class="sum-empty">Ingen aktiv personal.</p>' : `
            <table class="sum-table">
                <thead><tr>
                    <th>Namn</th>
                    <th>Tjänstg.</th>
                    <th>Mål (tim)</th>
                    <th>Schemalagt</th>
                    <th>Saldo</th>
                    <th>Snitt/v</th>
                    <th>Status</th>
                </tr></thead>
                <tbody>${balanceList.map(data => {
                    const p = data.person;
                    const nm = p ? (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : (p.name || p.id)) : '—';
                    const pct = p?.employmentPct || p?.degree || 100;

                    /* Visa aktiv period om den finns, annars totalt */
                    const periodData = activePeriod
                        ? data.periods.find(pb => pb.periodId === activePeriod.id)
                        : null;

                    const target = periodData ? periodData.targetHours : data.totalTarget;
                    const scheduled = periodData ? periodData.scheduledHours : data.totalScheduled;
                    const balance = periodData ? periodData.balanceHours : data.totalBalance;
                    const avg = periodData ? periodData.avgHoursPerWeek : 0;
                    const isOver = balance > 2;
                    const isUnder = balance < -2;

                    const balanceColor = isOver ? '#dc3545' : isUnder ? '#fd7e14' : '#28a745';
                    const balanceSign = balance > 0 ? '+' : '';
                    const statusIcon = isOver ? '⚠️ Övertid' : isUnder ? '📉 Under' : '✅ OK';

                    return `<tr>
                        <td><strong>${escapeHtml(nm)}</strong></td>
                        <td>${pct}%</td>
                        <td>${target.toFixed(1)}</td>
                        <td>${scheduled.toFixed(1)}</td>
                        <td style="color:${balanceColor};font-weight:700">${balanceSign}${balance.toFixed(1)}</td>
                        <td>${avg.toFixed(1)} h/v</td>
                        <td>${statusIcon}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>

            <div style="margin-top:0.75rem;padding:0.5rem;background:#f8f9fa;border-radius:4px;font-size:0.8rem;color:#666">
                <strong>HRF:</strong> Heltid = 40 tim/vecka. Saldo = schemalagt − mål.
                Positiv = övertid, negativ = undertid. Tolerans: ±2 tim.
                ${activePeriod ? `Visar period: ${escapeHtml(activePeriod.name)} (${escapeHtml(activePeriod.startDate)} – ${escapeHtml(activePeriod.endDate)})` : 'Visar helår.'}
            </div>`}
        </div>
    </div>`;
}

/* ── EVENT LISTENERS ── */
function setupListeners(container, store, ctx) {
    if (ctx._sumAbort) ctx._sumAbort.abort();
    ctx._sumAbort = new AbortController();
    const signal = ctx._sumAbort.signal;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sum]');
        if (!btn) return;
        const action = btn.dataset.sum;
        const sum = ctx._sum;

        if (action === 'prev-month') {
            sum.monthIndex = Math.max(0, sum.monthIndex - 1);
            renderSummary(container, ctx);
        } else if (action === 'next-month') {
            sum.monthIndex = Math.min(11, sum.monthIndex + 1);
            renderSummary(container, ctx);
        } else if (action === 'toggle-balances') {
            sum.showBalances = !sum.showBalances;
            renderSummary(container, ctx);
        }
    }, { signal });
}

/* ── HELPERS ── */
function formatCurrency(a) {
    if (!a || !Number.isFinite(a)) return '0 kr';
    return Math.round(a).toLocaleString('sv-SE') + ' kr';
}

const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|hsl\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)|hsla\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+\s*\)|[a-zA-Z]{1,20})$/;
function sanitizeColor(i) { if (typeof i !== 'string') return '#777'; const t = i.trim(); return SAFE_COLOR_RE.test(t) ? t : '#777'; }
function escapeHtml(s) { if (typeof s !== 'string') return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
