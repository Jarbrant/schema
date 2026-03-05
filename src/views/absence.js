/*
 * SPRINT 1 — ABSENCE VIEW (Frånvaro)
 * FIL: src/views/absence.js
 *
 * Registrera och hantera frånvaro: SEM, SJ, VAB, FÖR, PERM, UTB.
 * Stöd för mönster: single (en dag), range (period), recurring (upprepande).
 *
 * Kontrakt:
 *   - Exporterar renderAbsence(container, ctx)
 *   - Läser/skriver state.absences[] via ctx.store
 *   - XSS-safe (textContent + escapeHtml)
 */

/* ── CONSTANTS ── */

const ABSENCE_TYPES = [
    { code: 'SEM',  label: 'Semester',          color: '#e67e22' },
    { code: 'SJ',   label: 'Sjukdom',           color: '#e74c3c' },
    { code: 'VAB',  label: 'VAB',               color: '#9b59b6' },
    { code: 'FÖR',  label: 'Föräldraledighet',  color: '#3498db' },
    { code: 'PERM', label: 'Tjänstledighet',     color: '#7f8c8d' },
    { code: 'UTB',  label: 'Utbildning',         color: '#1abc9c' },
];

const PATTERNS = [
    { code: 'single',    label: 'Enskild dag' },
    { code: 'range',     label: 'Period (sammanhängande)' },
    { code: 'recurring', label: 'Upprepande mönster' },
];

const DAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

/* ── MAIN RENDER ── */

export function renderAbsence(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const people = (Array.isArray(state.people) ? state.people : []).filter(p => p && p.isActive);
    const absences = Array.isArray(state.absences) ? state.absences : [];

    container.innerHTML = `
        <div class="view-container absence-container">
            <div class="absence-header">
                <h1>📋 Frånvaro</h1>
                <p class="absence-subtitle">Registrera semester, sjukdom, VAB, föräldraledighet m.m.</p>
            </div>

            <!-- ══════ FORMULÄR ══════ -->
            <div class="absence-form-card">
                <h2>➕ Registrera frånvaro</h2>
                <form id="absence-form" class="absence-form">

                    <div class="absence-form-row">
                        <label for="abs-person">Person</label>
                        <select id="abs-person" name="personId" required>
                            <option value="">— Välj person —</option>
                            ${people.map(p => `<option value="${esc(p.id)}">${esc(p.firstName || '')} ${esc(p.lastName || p.name || '')}</option>`).join('')}
                        </select>
                    </div>

                    <div class="absence-form-row">
                        <label for="abs-type">Typ</label>
                        <select id="abs-type" name="type" required>
                            ${ABSENCE_TYPES.map(t => `<option value="${esc(t.code)}">${esc(t.label)} (${esc(t.code)})</option>`).join('')}
                        </select>
                    </div>

                    <div class="absence-form-row">
                        <label for="abs-pattern">Mönster</label>
                        <select id="abs-pattern" name="pattern" required>
                            ${PATTERNS.map(p => `<option value="${esc(p.code)}">${esc(p.label)}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Single -->
                    <div class="absence-form-row abs-field-single">
                        <label for="abs-date">Datum</label>
                        <input type="date" id="abs-date" name="date">
                    </div>

                    <!-- Range + Recurring -->
                    <div class="absence-form-row abs-field-range" style="display:none">
                        <label for="abs-start">Startdatum</label>
                        <input type="date" id="abs-start" name="startDate">
                    </div>
                    <div class="absence-form-row abs-field-range" style="display:none">
                        <label for="abs-end">Slutdatum</label>
                        <input type="date" id="abs-end" name="endDate">
                    </div>

                    <!-- Recurring days -->
                    <div class="absence-form-row abs-field-recurring" style="display:none">
                        <label>Veckodagar</label>
                        <div class="absence-day-checks">
                            ${DAY_NAMES.map((d, i) => `
                                <label class="absence-day-check">
                                    <input type="checkbox" name="days" value="${i}"> ${esc(d)}
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="absence-form-row">
                        <label for="abs-note">Anteckning (valfri)</label>
                        <input type="text" id="abs-note" name="note" placeholder="T.ex. Sommarsemester">
                    </div>

                    <button type="submit" class="btn btn-primary">💾 Spara frånvaro</button>
                </form>
            </div>

            <!-- ══════ LISTA ══════ -->
            <div class="absence-list-card">
                <h2>📅 Registrerad frånvaro (${absences.length})</h2>
                ${absences.length === 0
                    ? '<p class="absence-empty">Ingen frånvaro registrerad ännu.</p>'
                    : renderAbsenceList(absences, people)
                }
            </div>
        </div>
    `;

    setupAbsenceListeners(container, store, ctx);
}

/* ── RENDER LIST ── */

function renderAbsenceList(absences, people) {
    const sorted = [...absences].sort((a, b) => {
        const da = a.date || a.startDate || '';
        const db = b.date || b.startDate || '';
        return da.localeCompare(db);
    });

    return `<div class="absence-list">${sorted.map(abs => {
        const person = people.find(p => p.id === abs.personId);
        const personName = person
            ? `${person.firstName || ''} ${person.lastName || person.name || ''}`.trim()
            : '(okänd)';
        const typeInfo = ABSENCE_TYPES.find(t => t.code === abs.type) || { label: abs.type, color: '#999' };
        const dateStr = formatAbsenceDates(abs);

        return `
            <div class="absence-item" style="border-left: 4px solid ${typeInfo.color}">
                <div class="absence-item-top">
                    <span class="absence-item-badge" style="background:${typeInfo.color}">${esc(abs.type)}</span>
                    <strong>${esc(personName)}</strong>
                    <span class="absence-item-date">${esc(dateStr)}</span>
                </div>
                ${abs.note ? `<div class="absence-item-note">${esc(abs.note)}</div>` : ''}
                <button class="btn btn-sm btn-danger absence-delete" data-abs-id="${esc(abs.id)}" title="Radera">🗑️ Radera</button>
            </div>`;
    }).join('')}</div>`;
}

function formatAbsenceDates(abs) {
    if (abs.pattern === 'single') return abs.date || '—';
    if (abs.pattern === 'range') return `${abs.startDate || '?'} → ${abs.endDate || '?'}`;
    if (abs.pattern === 'recurring') {
        const dayList = Array.isArray(abs.days) ? abs.days.map(d => DAY_NAMES[d] || '?').join(', ') : '';
        return `${abs.startDate || '?'} → ${abs.endDate || '?'} (${dayList})`;
    }
    return '—';
}

/* ── EVENT LISTENERS ── */

function setupAbsenceListeners(container, store, ctx) {
    const form = container.querySelector('#absence-form');
    const patternSelect = container.querySelector('#abs-pattern');

    // Toggle fields based on pattern
    if (patternSelect) {
        patternSelect.addEventListener('change', () => {
            const val = patternSelect.value;
            container.querySelectorAll('.abs-field-single').forEach(el => el.style.display = val === 'single' ? '' : 'none');
            container.querySelectorAll('.abs-field-range').forEach(el => el.style.display = (val === 'range' || val === 'recurring') ? '' : 'none');
            container.querySelectorAll('.abs-field-recurring').forEach(el => el.style.display = val === 'recurring' ? '' : 'none');
        });
        // Init
        patternSelect.dispatchEvent(new Event('change'));
    }

    // Submit
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const pattern = fd.get('pattern');
            const personId = fd.get('personId');

            if (!personId) { alert('Välj en person!'); return; }

            // Collect checked days for recurring
            const days = pattern === 'recurring'
                ? [...form.querySelectorAll('input[name="days"]:checked')].map(cb => Number(cb.value))
                : null;

            if (pattern === 'single' && !fd.get('date')) { alert('Ange datum!'); return; }
            if ((pattern === 'range' || pattern === 'recurring') && (!fd.get('startDate') || !fd.get('endDate'))) {
                alert('Ange start- och slutdatum!'); return;
            }
            if (pattern === 'recurring' && (!days || days.length === 0)) {
                alert('Välj minst en veckodag!'); return;
            }

            const newAbs = {
                id: 'abs-' + crypto.randomUUID(),
                personId,
                type: fd.get('type'),
                pattern,
                date: pattern === 'single' ? fd.get('date') : null,
                startDate: pattern !== 'single' ? fd.get('startDate') : null,
                endDate: pattern !== 'single' ? fd.get('endDate') : null,
                days,
                note: fd.get('note') || '',
            };

            const state = store.getState();
            const absences = Array.isArray(state.absences) ? [...state.absences] : [];
            absences.push(newAbs);

            store.setState({ ...state, absences });
            renderAbsence(container, ctx);
        });
    }

    // Delete
    container.querySelectorAll('.absence-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const absId = btn.dataset.absId;
            if (!confirm('Radera denna frånvaro?')) return;

            const state = store.getState();
            const absences = (Array.isArray(state.absences) ? state.absences : []).filter(a => a.id !== absId);

            store.setState({ ...state, absences });
            renderAbsence(container, ctx);
        });
    });
}

/* ── HELPERS ── */

function esc(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
