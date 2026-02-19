/*
 * AO-09 — Summary View (Sammanställning) — v1.0
 * FIL: src/views/summary.js
 *
 * Månadssammanställning: timmar, kostnader, per person/grupp.
 */

import { calcShiftHours } from '../modules/schedule-engine.js';

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

        if (!ctx._sum) {
            const now = new Date();
            ctx._sum = { monthIndex: now.getFullYear() === year ? now.getMonth() : 0 };
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

        container.innerHTML = `
            <div class="sum-container">
                ${renderTopBar(sum, year)}
                ${renderCards(totalHours, totalCost, totalEntries, activePeople.length, daysInMonth)}
                <div class="sum-sections">
                    ${renderPersonSection(personList)}
                    ${renderGroupSection(groupList, groups)}
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
        <div></div>
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
