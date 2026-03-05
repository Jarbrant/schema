/*
 * S3-07 — X-DAGAR — Planerings-UI för X-dagar (mertidsledighet)
 * FIL: src/views/xdays.js
 *
 * HRF/Visita-avtal: Anställda som arbetar på helger/storhelger tjänar in
 * X-dagar (kompensationsledighet). Denna vy visar:
 *   - Intjänade X-dagar per person
 *   - Förbrukade X-dagar
 *   - Kvarvarande saldo
 *   - Möjlighet att planera/boka X-dagar framåt
 *
 * Store shape:
 *   state.people[].xDaysEarned (number)
 *   state.people[].xDaysUsed (number)
 *   state.absences[] (med type='XDAG')
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const MONTH_NAMES = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
];

/* ============================================================
 * BLOCK 1 — MAIN RENDER
 * ============================================================ */
export function renderXdays(container, ctx) {
    if (!container) return;

    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="xdays-container"><h2>❌ Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    try {
        const state = store.getState();
        const people = (Array.isArray(state.people) ? state.people : []).filter(p => p.isActive);
        const absences = Array.isArray(state.absences) ? state.absences : [];
        const today = new Date().toISOString().slice(0, 10);
        const year = state.schedule?.year || new Date().getFullYear();

        // Beräkna X-dagar per person
        const xdaysData = people.map(p => {
            const earned = typeof p.xDaysEarned === 'number' ? p.xDaysEarned : 0;
            const usedFromPerson = typeof p.xDaysUsed === 'number' ? p.xDaysUsed : 0;

            // Räkna även XDAG-frånvaro
            const xdayAbsences = absences.filter(a =>
                a.personId === p.id && a.type === 'XDAG'
            );

            let absenceDays = 0;
            xdayAbsences.forEach(a => {
                if (a.pattern === 'single') {
                    absenceDays += 1;
                } else if (a.pattern === 'range' && a.startDate && a.endDate) {
                    const start = new Date(a.startDate);
                    const end = new Date(a.endDate);
                    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                    absenceDays += Math.max(0, diff);
                }
            });

            const totalUsed = usedFromPerson + absenceDays;
            const remaining = earned - totalUsed;

            // Planerade (framtida) X-dagar
            const planned = xdayAbsences.filter(a => {
                const d = a.date || a.startDate || '';
                return d >= today;
            });

            return {
                person: p,
                name: p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : (p.name || p.id),
                earned,
                used: totalUsed,
                remaining,
                planned,
                absences: xdayAbsences,
                status: remaining > 3 ? 'good' : remaining > 0 ? 'warning' : remaining === 0 ? 'zero' : 'negative',
            };
        }).sort((a, b) => a.remaining - b.remaining); // Visa de med minst kvar först

        const totalEarned = xdaysData.reduce((s, x) => s + x.earned, 0);
        const totalUsed = xdaysData.reduce((s, x) => s + x.used, 0);
        const totalRemaining = xdaysData.reduce((s, x) => s + x.remaining, 0);

        container.innerHTML = `
            <div class="xdays-container">
                <div class="xdays-header">
                    <h2>📅 X-dagar — Kompensationsledighet ${year}</h2>
                    <p class="xdays-subtitle">Planera och följ upp X-dagar enligt HRF/Visita-avtalet</p>
                </div>

                <!-- KPI-kort -->
                <div class="xdays-kpi-row">
                    <div class="xdays-kpi">
                        <span class="xdays-kpi-value">${totalEarned}</span>
                        <span class="xdays-kpi-label">Intjänade</span>
                    </div>
                    <div class="xdays-kpi">
                        <span class="xdays-kpi-value">${totalUsed}</span>
                        <span class="xdays-kpi-label">Förbrukade</span>
                    </div>
                    <div class="xdays-kpi ${totalRemaining < 0 ? 'xdays-kpi-danger' : ''}">
                        <span class="xdays-kpi-value">${totalRemaining}</span>
                        <span class="xdays-kpi-label">Kvar totalt</span>
                    </div>
                    <div class="xdays-kpi">
                        <span class="xdays-kpi-value">${people.length}</span>
                        <span class="xdays-kpi-label">Aktiv personal</span>
                    </div>
                </div>

                <!-- Registrera X-dag -->
                <div class="xdays-form-panel">
                    <h3>➕ Boka X-dag</h3>
                    <div class="xdays-form-row">
                        <div class="xdays-form-field">
                            <label for="xday-person">Person</label>
                            <select id="xday-person">
                                <option value="">— Välj person —</option>
                                ${people.map(p => {
                                    const nm = p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : (p.name || p.id);
                                    return `<option value="${escapeHtml(p.id)}">${escapeHtml(nm)}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="xdays-form-field">
                            <label for="xday-date">Datum</label>
                            <input type="date" id="xday-date" value="${today}" />
                        </div>
                        <div class="xdays-form-field">
                            <label for="xday-end-date">Slutdatum (valfritt)</label>
                            <input type="date" id="xday-end-date" />
                        </div>
                        <div class="xdays-form-field xdays-form-btn-field">
                            <button class="btn btn-primary" data-xday="book">📅 Boka X-dag</button>
                        </div>
                    </div>
                </div>

                <!-- Tabell -->
                <div class="xdays-table-wrap">
                    <table class="xdays-table">
                        <thead>
                            <tr>
                                <th>Person</th>
                                <th>Grupp</th>
                                <th>Tjänstgrad</th>
                                <th>Intjänade</th>
                                <th>Förbrukade</th>
                                <th>Kvar</th>
                                <th>Planerade</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${xdaysData.map(x => `
                                <tr class="xdays-row-${x.status}">
                                    <td><strong>${escapeHtml(x.name)}</strong></td>
                                    <td>${escapeHtml((x.person.groups || x.person.groupIds || []).join(', '))}</td>
                                    <td>${x.person.employmentPct || 0}%</td>
                                    <td>${x.earned}</td>
                                    <td>${x.used}</td>
                                    <td class="xdays-remaining-${x.status}"><strong>${x.remaining}</strong></td>
                                    <td>${x.planned.length > 0 ? x.planned.length + ' st' : '—'}</td>
                                    <td>${renderStatusBadge(x.status)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                ${xdaysData.length === 0 ? '<p class="xdays-empty">Ingen aktiv personal att visa.</p>' : ''}

                <!-- Info-ruta -->
                <div class="xdays-info">
                    <h4>ℹ️ Om X-dagar (HRF/Visita)</h4>
                    <ul>
                        <li>X-dagar intjänas vid arbete på storhelger (julafton, nyårsafton, m.fl.)</li>
                        <li>Varje intjänad X-dag ger rätt till en kompensationsledig dag</li>
                        <li>X-dagar ska i första hand förläggas som sammanhängande ledighet</li>
                        <li>Ej uttagna X-dagar kan överföras men bör tas ut inom rimlig tid</li>
                    </ul>
                </div>
            </div>
        `;

        setupXdayListeners(container, store, ctx);

    } catch (err) {
        console.error('❌ renderXdays kraschade:', err);
        container.innerHTML = `<div class="xdays-container"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ============================================================
 * BLOCK 2 — STATUS BADGE
 * ============================================================ */
function renderStatusBadge(status) {
    switch (status) {
        case 'good': return '<span class="xdays-badge xdays-badge-good">✅ OK</span>';
        case 'warning': return '<span class="xdays-badge xdays-badge-warning">⚠️ Snart slut</span>';
        case 'zero': return '<span class="xdays-badge xdays-badge-zero">0️⃣ Slut</span>';
        case 'negative': return '<span class="xdays-badge xdays-badge-negative">🔴 Övertrasserat</span>';
        default: return '';
    }
}

/* ============================================================
 * BLOCK 3 — EVENT LISTENERS
 * ============================================================ */
function setupXdayListeners(container, store, ctx) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-xday]');
        if (!btn) return;
        const action = btn.dataset.xday;

        if (action === 'book') {
            handleBookXday(store, ctx, container);
        }
    });
}

function handleBookXday(store, ctx, container) {
    const personId = document.getElementById('xday-person')?.value;
    const startDate = document.getElementById('xday-date')?.value;
    const endDate = document.getElementById('xday-end-date')?.value;

    if (!personId) {
        alert('⚠️ Välj en person');
        return;
    }
    if (!startDate) {
        alert('⚠️ Välj ett datum');
        return;
    }

    const absenceEntry = {
        id: 'XDAG_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        personId,
        type: 'XDAG',
        pattern: endDate ? 'range' : 'single',
        date: startDate,
        startDate: startDate,
        endDate: endDate || startDate,
        note: 'X-dag (kompensationsledighet)',
        createdAt: new Date().toISOString(),
    };

    store.update(s => {
        if (!Array.isArray(s.absences)) s.absences = [];
        s.absences.push(absenceEntry);
    });

    // Hämta personnamn
    const state = store.getState();
    const person = (state.people || []).find(p => p.id === personId);
    const name = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : personId;

    const days = endDate
        ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
        : 1;

    alert(`✅ X-dag bokad!\n${name}: ${startDate}${endDate && endDate !== startDate ? ' → ' + endDate : ''} (${days} dag${days > 1 ? 'ar' : ''})`);

    // Re-render
    renderXdays(container, ctx);
}

/* ============================================================
 * BLOCK 4 — XSS HELPER
 * ============================================================ */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
