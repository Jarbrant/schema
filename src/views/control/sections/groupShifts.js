/*
 * CONTROL SECTION — Grupp-skift
 *
 * Visar schemalagda skift för valda grupper.
 *
 * AUTOPATCH (P0) — Anpassad till store.js-modellen:
 * - state.groups är map/object -> Object.values
 * - state.schedule.months[].days[].entries[] är källan till skift (inte state.shifts array)
 * - people har firstName/lastName -> namn byggs
 * - gruppmedlemmar: grupp.members[] (id-lista)
 * - tidsfält i entry: start/end (samt ev breakStart/breakEnd)
 */

import { reportError } from '../../../diagnostics.js';

export function renderGroupShiftsSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) throw new Error('Store saknas i context');

        const state = store.getState();

        const groupsArr = objectValuesSafe(state.groups);
        const peopleArr = Array.isArray(state.people) ? state.people : [];
        const selectedGroups = Array.isArray(ctx?.selectedGroups) && ctx.selectedGroups.length
            ? ctx.selectedGroups.map(String)
            : groupsArr.map(g => String(g.id));

        // Bygg snabb lookup för person -> grupp
        const personIdToGroup = buildPersonGroupIndex(groupsArr);

        // Läs skift från schedule
        const scheduleShifts = extractShiftsFromSchedule(state.schedule);

        // Filtrera skift för valda grupper
        const filteredShifts = scheduleShifts.filter((shift) => {
            const gid = personIdToGroup[String(shift.personId)];
            return gid && selectedGroups.includes(gid);
        });

        const html = `
            <div class="section-header">
                <h2>📅 Grupp-skift</h2>
                <p>Schemalagda skift för valda grupper. Valideras mot HRF-regler.</p>
            </div>

            <div class="section-content">
                ${filteredShifts.length > 0 ? `
                    <div class="shifts-overview">
                        <div class="overview-stat">
                            <span class="stat-label">Totala skift:</span>
                            <span class="stat-value">${filteredShifts.length}</span>
                        </div>
                        <div class="overview-stat">
                            <span class="stat-label">Unika personal:</span>
                            <span class="stat-value">${new Set(filteredShifts.map(s => String(s.personId))).size}</span>
                        </div>
                    </div>

                    <div class="shifts-table-wrapper">
                        <table class="shifts-table">
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Tid</th>
                                    <th>Person</th>
                                    <th>Grupp</th>
                                    <th>Timmar</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredShifts.map(shift => {
                                    const person = peopleArr.find(p => String(p.id) === String(shift.personId));
                                    const personName = person
                                        ? `${String(person.firstName || '').trim()} ${String(person.lastName || '').trim()}`.trim()
                                        : (shift.personName || 'Okänd');

                                    const gid = personIdToGroup[String(shift.personId)];
                                    const group = groupsArr.find(g => String(g.id) === String(gid));
                                    const groupName = group?.name || '-';

                                    const hours = calculateHours(shift.startTime, shift.endTime);
                                    const isValid = validateShiftRules(shift);

                                    return `
                                        <tr>
                                            <td>${escapeHtml(shift.date)}</td>
                                            <td>${escapeHtml(shift.startTime)} - ${escapeHtml(shift.endTime)}</td>
                                            <td>${escapeHtml(personName || 'Okänd')}</td>
                                            <td>${escapeHtml(groupName)}</td>
                                            <td>${Number.isFinite(hours) ? hours.toFixed(1) : '-' }h</td>
                                            <td>
                                                <span class="status-badge ${isValid ? 'status-ok' : 'status-error'}">
                                                    ${isValid ? '✓ OK' : '⚠ Varning'}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        Inga schemalagda skift för valda grupper.
                    </div>
                `}
            </div>
        `;

        container.innerHTML = html;

    } catch (err) {
        console.error('❌ Fel i renderGroupShiftsSection:', err);
        // Om du vill: reportError(...) här, men jag håller minsta ändring i beteende.
        throw err;
    }
}

/* =========================
   Helpers
   ========================= */

function objectValuesSafe(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.values(obj).filter(Boolean);
}

function buildPersonGroupIndex(groupsArr) {
    const map = Object.create(null);
    groupsArr.forEach((g) => {
        const gid = String(g?.id ?? '');
        const members = Array.isArray(g?.members) ? g.members : [];
        members.forEach((pid) => {
            if (pid == null) return;
            map[String(pid)] = gid;
        });
    });
    return map;
}

// Plockar ut entries ur schedule.months[].days[]
function extractShiftsFromSchedule(schedule) {
    const out = [];
    if (!schedule || !Array.isArray(schedule.months)) return out;

    schedule.months.forEach((m) => {
        const monthNum = Number(m?.month);
        if (!Array.isArray(m?.days)) return;

        m.days.forEach((dayObj, idx) => {
            const dayNum = idx + 1;
            if (!Array.isArray(dayObj?.entries)) return;

            const date = makeDateStr(schedule?.year, monthNum, dayNum);

            dayObj.entries.forEach((e) => {
                if (!e) return;
                const personId = e.personId;
                const startTime = e.start || e.startTime || '';
                const endTime = e.end || e.endTime || '';
                if (!personId || !startTime || !endTime) return;

                out.push({
                    date,
                    personId: String(personId),
                    startTime: String(startTime),
                    endTime: String(endTime),
                    status: String(e.status || ''),
                    breakStart: e.breakStart ?? null,
                    breakEnd: e.breakEnd ?? null
                });
            });
        });
    });

    return out;
}

function makeDateStr(year, month, day) {
    const y = Number(year);
    if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
}

/**
 * Beräkna timmar mellan två tider (HH:MM)
 */
function calculateHours(startTime, endTime) {
    if (!startTime || !endTime) return NaN;

    const [startH, startM] = String(startTime).split(':').map(Number);
    const [endH, endM] = String(endTime).split(':').map(Number);

    if (![startH, startM, endH, endM].every(Number.isFinite)) return NaN;

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const diff = (endMinutes - startMinutes) / 60;
    return diff;
}

/**
 * Validera skift mot enkla regler (baseline)
 */
function validateShiftRules(shift) {
    const hours = calculateHours(shift.startTime, shift.endTime);
    return Number.isFinite(hours) && hours >= 4 && hours <= 12;
}

/**
 * XSS-safe escape (renderar bara text)
 */
function escapeHtml(value) {
    const s = String(value ?? '');
    return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
