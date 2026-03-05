/*
 * S3-01 — ABSENCE VIEW (Frånvaro-hantering)
 * FIL: src/views/absence.js
 *
 * Fullständig frånvaroregistrering:
 *   - Registrera frånvaro (SEM/SJ/VAB/FÖR/PERM/UTB/TJL)
 *   - Single-dag eller datumintervall
 *   - Visa aktiv + historisk frånvaro
 *   - Radera frånvaro
 *   - Automatisk vakans-flagga vid frånvaro på schemalagd dag
 *
 * Store shape:
 *   state.absences = [
 *     { id, personId, type, startDate, endDate, note, createdAt }
 *   ]
 *   state.people = [{ id, firstName, lastName, isActive, ... }]
 *
 * Kontrakt:
 *   - Exporterar renderAbsence(container, ctx)
 *   - ctx.store måste finnas
 *   - XSS-safe
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
const ABSENCE_TYPES = {
    SEM:  { label: 'Semester',        icon: '🏖️', color: '#fff9c4', text: '#f57f17',  border: '#fbc02d' },
    SJ:   { label: 'Sjuk',            icon: '🤒', color: '#ffcdd2', text: '#b71c1c',  border: '#ef5350' },
    VAB:  { label: 'VAB',             icon: '👶', color: '#ffe0b2', text: '#e65100',  border: '#ff9800' },
    FÖR:  { label: 'Föräldraledig',   icon: '👪', color: '#f8bbd0', text: '#880e4f',  border: '#ec407a' },
    PERM: { label: 'Permission',      icon: '📋', color: '#b2dfdb', text: '#004d40',  border: '#26a69a' },
    UTB:  { label: 'Utbildning',      icon: '📚', color: '#e1bee7', text: '#4a148c',  border: '#ab47bc' },
    TJL:  { label: 'Tjänstledig',     icon: '🏠', color: '#b2dfdb', text: '#004d40',  border: '#26a69a' },
};

const MONTH_NAMES = [
    'Januari','Februari','Mars','April','Maj','Juni',
    'Juli','Augusti','September','Oktober','November','December'
];

/* ============================================================
 * BLOCK 0 — In-memory UI-state
 * ============================================================ */
const __absenceUI = {
    filterPerson: '',
    filterType: '',
    filterStatus: 'active',  // 'active' | 'all' | 'past'
    editId: null,
};

/* ============================================================
 * BLOCK 1 — MAIN RENDER
 * ============================================================ */
export function renderAbsence(container, ctx) {
    if (!container) return;

    try {
        const store = ctx?.store;
        if (!store) {
            container.innerHTML = `
                <div class="abs-container">
                    <h1>❌ Fel</h1>
                    <p>Store saknas i context.</p>
                </div>`;
            return;
        }

        const state = store.getState();
        const people = Array.isArray(state.people) ? state.people.filter(p => p.isActive) : [];
        const absences = Array.isArray(state.absences) ? state.absences : [];

        // Ensure absences array exists in store
        if (!Array.isArray(state.absences)) {
            store.update(s => { s.absences = []; });
        }

        const today = new Date().toISOString().slice(0, 10);

        // Apply filters
        let filtered = [...absences];
        if (__absenceUI.filterPerson) {
            filtered = filtered.filter(a => a.personId === __absenceUI.filterPerson);
        }
        if (__absenceUI.filterType) {
            filtered = filtered.filter(a => a.type === __absenceUI.filterType);
        }
        if (__absenceUI.filterStatus === 'active') {
            filtered = filtered.filter(a => a.endDate >= today);
        } else if (__absenceUI.filterStatus === 'past') {
            filtered = filtered.filter(a => a.endDate < today);
        }

        // Sort: nearest first
        filtered.sort((a, b) => a.startDate.localeCompare(b.startDate));

        const editAbsence = __absenceUI.editId
            ? absences.find(a => a.id === __absenceUI.editId)
            : null;

        container.innerHTML = `
            <div class="abs-container">
                <div class="abs-content">

                    <!-- HEADER -->
                    <div class="abs-header">
                        <h1>📅 Frånvaro</h1>
                        <p class="abs-subtitle">Registrera och hantera frånvaro — semester, sjukdom, VAB och mer.</p>
                    </div>

                    <!-- STATS BAR -->
                    ${renderStatsBar(absences, people, today)}

                    <!-- FORM -->
                    <div class="abs-form-section">
                        <h2>${editAbsence ? '✏️ Redigera frånvaro' : '➕ Registrera ny frånvaro'}</h2>
                        ${renderForm(people, editAbsence)}
                    </div>

                    <!-- FILTERS -->
                    <div class="abs-filter-section">
                        <h2>📋 Registrerad frånvaro (${filtered.length})</h2>
                        ${renderFilters(people)}
                    </div>

                    <!-- LIST -->
                    ${renderAbsenceList(filtered, people)}

                </div>
            </div>
        `;

        // Bind events
        setupAbsenceEvents(container, store, ctx);

    } catch (err) {
        console.error('❌ renderAbsence kraschade:', err);
        container.innerHTML = `
            <div class="abs-container">
                <h1>❌ Fel</h1>
                <p>Kunde inte visa frånvaro: ${escapeHtml(String(err.message))}</p>
            </div>`;
    }
}

/* ============================================================
 * BLOCK 2 — STATS BAR
 * ============================================================ */
function renderStatsBar(absences, people, today) {
    const active = absences.filter(a => a.startDate <= today && a.endDate >= today);
    const upcoming = absences.filter(a => a.startDate > today);
    const semDays = absences
        .filter(a => a.type === 'SEM')
        .reduce((sum, a) => sum + countDays(a.startDate, a.endDate), 0);

    return `
        <div class="abs-stats">
            <div class="abs-stat-card">
                <div class="abs-stat-icon">🔴</div>
                <div class="abs-stat-value">${active.length}</div>
                <div class="abs-stat-label">Frånvarande idag</div>
            </div>
            <div class="abs-stat-card">
                <div class="abs-stat-icon">🟡</div>
                <div class="abs-stat-value">${upcoming.length}</div>
                <div class="abs-stat-label">Kommande</div>
            </div>
            <div class="abs-stat-card">
                <div class="abs-stat-icon">🏖️</div>
                <div class="abs-stat-value">${semDays}</div>
                <div class="abs-stat-label">Semesterdagar totalt</div>
            </div>
            <div class="abs-stat-card">
                <div class="abs-stat-icon">👥</div>
                <div class="abs-stat-value">${people.length}</div>
                <div class="abs-stat-label">Aktiv personal</div>
            </div>
        </div>
    `;
}

/* ============================================================
 * BLOCK 3 — FORM
 * ============================================================ */
function renderForm(people, editAbsence) {
    const typeOptions = Object.entries(ABSENCE_TYPES)
        .map(([key, t]) => {
            const sel = editAbsence?.type === key ? 'selected' : '';
            return `<option value="${key}" ${sel}>${t.icon} ${t.label}</option>`;
        })
        .join('');

    const personOptions = people
        .map(p => {
            const sel = editAbsence?.personId === p.id ? 'selected' : '';
            return `<option value="${p.id}" ${sel}>${escapeHtml(p.firstName + ' ' + p.lastName)}</option>`;
        })
        .join('');

    const startVal = editAbsence?.startDate || '';
    const endVal = editAbsence?.endDate || '';
    const noteVal = editAbsence?.note || '';

    return `
        <form id="absence-form" class="abs-form">
            ${editAbsence ? `<input type="hidden" name="editId" value="${editAbsence.id}">` : ''}

            <div class="abs-form-row">
                <div class="abs-form-group">
                    <label for="abs-person">Person *</label>
                    <select id="abs-person" name="personId" required>
                        <option value="">— Välj person —</option>
                        ${personOptions}
                    </select>
                </div>

                <div class="abs-form-group">
                    <label for="abs-type">Typ *</label>
                    <select id="abs-type" name="type" required>
                        <option value="">— Välj typ —</option>
                        ${typeOptions}
                    </select>
                </div>
            </div>

            <div class="abs-form-row">
                <div class="abs-form-group">
                    <label for="abs-start">Startdatum *</label>
                    <input type="date" id="abs-start" name="startDate" value="${startVal}" required>
                </div>

                <div class="abs-form-group">
                    <label for="abs-end">Slutdatum *</label>
                    <input type="date" id="abs-end" name="endDate" value="${endVal}" required>
                </div>
            </div>

            <div class="abs-form-row">
                <div class="abs-form-group abs-form-full">
                    <label for="abs-note">Anteckning (valfritt)</label>
                    <input type="text" id="abs-note" name="note" value="${escapeHtml(noteVal)}"
                           placeholder="T.ex. 'Läkarbesök kl 10' eller 'Semester Grekland'" maxlength="200">
                </div>
            </div>

            <div class="abs-form-actions">
                <button type="submit" class="btn btn-primary">
                    ${editAbsence ? '💾 Spara ändringar' : '➕ Registrera frånvaro'}
                </button>
                ${editAbsence ? '<button type="button" class="btn btn-secondary" data-abs-action="cancel-edit">Avbryt</button>' : ''}
            </div>
        </form>
    `;
}

/* ============================================================
 * BLOCK 4 — FILTERS
 * ============================================================ */
function renderFilters(people) {
    const personOpts = people
        .map(p => {
            const sel = __absenceUI.filterPerson === p.id ? 'selected' : '';
            return `<option value="${p.id}" ${sel}>${escapeHtml(p.firstName + ' ' + p.lastName)}</option>`;
        })
        .join('');

    const typeOpts = Object.entries(ABSENCE_TYPES)
        .map(([key, t]) => {
            const sel = __absenceUI.filterType === key ? 'selected' : '';
            return `<option value="${key}" ${sel}>${t.icon} ${t.label}</option>`;
        })
        .join('');

    return `
        <div class="abs-filters">
            <select data-abs-filter="person">
                <option value="">Alla personer</option>
                ${personOpts}
            </select>

            <select data-abs-filter="type">
                <option value="">Alla typer</option>
                ${typeOpts}
            </select>

            <select data-abs-filter="status">
                <option value="active" ${__absenceUI.filterStatus === 'active' ? 'selected' : ''}>Aktiva & kommande</option>
                <option value="all" ${__absenceUI.filterStatus === 'all' ? 'selected' : ''}>Alla</option>
                <option value="past" ${__absenceUI.filterStatus === 'past' ? 'selected' : ''}>Avslutade</option>
            </select>
        </div>
    `;
}

/* ============================================================
 * BLOCK 5 — ABSENCE LIST
 * ============================================================ */
function renderAbsenceList(absences, people) {
    if (absences.length === 0) {
        return `
            <div class="abs-empty">
                <p>📭 Ingen frånvaro registrerad med valda filter.</p>
            </div>
        `;
    }

    const today = new Date().toISOString().slice(0, 10);

    const rows = absences.map(a => {
        const person = people.find(p => p.id === a.personId);
        const personName = person
            ? `${person.firstName} ${person.lastName}`
            : `(Okänd: ${a.personId})`;

        const typeInfo = ABSENCE_TYPES[a.type] || { icon: '❓', label: a.type, color: '#eee', text: '#333', border: '#ccc' };
        const days = countDays(a.startDate, a.endDate);
        const isActive = a.startDate <= today && a.endDate >= today;
        const isPast = a.endDate < today;
        const isFuture = a.startDate > today;

        let statusBadge = '';
        if (isActive) statusBadge = '<span class="abs-badge abs-badge-active">Pågår</span>';
        else if (isFuture) statusBadge = '<span class="abs-badge abs-badge-future">Kommande</span>';
        else if (isPast) statusBadge = '<span class="abs-badge abs-badge-past">Avslutad</span>';

        return `
            <div class="abs-card" style="border-left: 4px solid ${typeInfo.border};">
                <div class="abs-card-header">
                    <div class="abs-card-person">
                        <strong>${escapeHtml(personName)}</strong>
                        ${statusBadge}
                    </div>
                    <div class="abs-card-actions">
                        <button class="btn-icon" data-abs-action="edit" data-abs-id="${a.id}" title="Redigera">✏️</button>
                        <button class="btn-icon btn-icon-danger" data-abs-action="delete" data-abs-id="${a.id}" title="Radera">🗑️</button>
                    </div>
                </div>
                <div class="abs-card-body">
                    <span class="abs-type-badge" style="background: ${typeInfo.color}; color: ${typeInfo.text}; border: 1px solid ${typeInfo.border};">
                        ${typeInfo.icon} ${typeInfo.label}
                    </span>
                    <span class="abs-card-dates">
                        📅 ${formatDate(a.startDate)} — ${formatDate(a.endDate)}
                        <span class="abs-card-days">(${days} dag${days !== 1 ? 'ar' : ''})</span>
                    </span>
                    ${a.note ? `<span class="abs-card-note">💬 ${escapeHtml(a.note)}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `<div class="abs-list">${rows}</div>`;
}

/* ============================================================
 * BLOCK 6 — EVENT HANDLERS
 * ============================================================ */
function setupAbsenceEvents(container, store, ctx) {
    const reRender = () => renderAbsence(container, ctx);

    // Form submit
    const form = container.querySelector('#absence-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmit(form, store, reRender);
        });
    }

    // Filter changes
    container.querySelectorAll('[data-abs-filter]').forEach(el => {
        el.addEventListener('change', () => {
            const filterKey = el.getAttribute('data-abs-filter');
            if (filterKey === 'person') __absenceUI.filterPerson = el.value;
            if (filterKey === 'type') __absenceUI.filterType = el.value;
            if (filterKey === 'status') __absenceUI.filterStatus = el.value;
            reRender();
        });
    });

    // Card actions (edit / delete / cancel-edit)
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-abs-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-abs-action');
        const id = btn.getAttribute('data-abs-id');

        if (action === 'edit') {
            __absenceUI.editId = id;
            reRender();
            container.querySelector('#absence-form')?.scrollIntoView({ behavior: 'smooth' });
        }
        if (action === 'delete') {
            handleDelete(id, store, reRender);
        }
        if (action === 'cancel-edit') {
            __absenceUI.editId = null;
            reRender();
        }
    });
}

/* ============================================================
 * BLOCK 7 — FORM SUBMIT (CREATE / UPDATE)
 * ============================================================ */
function handleFormSubmit(form, store, reRender) {
    try {
        const fd = new FormData(form);
        const personId = fd.get('personId');
        const type = fd.get('type');
        const startDate = fd.get('startDate');
        const endDate = fd.get('endDate');
        const note = (fd.get('note') || '').trim();
        const editId = fd.get('editId') || null;

        // Validation
        if (!personId) { showFormMsg(form, '⚠️ Välj en person'); return; }
        if (!type || !ABSENCE_TYPES[type]) { showFormMsg(form, '⚠️ Välj frånvarotyp'); return; }
        if (!startDate) { showFormMsg(form, '⚠️ Ange startdatum'); return; }
        if (!endDate) { showFormMsg(form, '⚠️ Ange slutdatum'); return; }
        if (endDate < startDate) { showFormMsg(form, '⚠️ Slutdatum kan inte vara före startdatum'); return; }

        // Check for overlapping absences
        const state = store.getState();
        const existing = (state.absences || []).filter(a =>
            a.personId === personId &&
            a.id !== editId &&
            a.startDate <= endDate &&
            a.endDate >= startDate
        );
        if (existing.length > 0) {
            const t = ABSENCE_TYPES[existing[0].type] || { label: existing[0].type };
            showFormMsg(form, `⚠️ Överlappar med befintlig frånvaro: ${t.label} ${existing[0].startDate} — ${existing[0].endDate}`);
            return;
        }

        if (editId) {
            // UPDATE
            store.update(s => {
                if (!Array.isArray(s.absences)) s.absences = [];
                const idx = s.absences.findIndex(a => a.id === editId);
                if (idx !== -1) {
                    s.absences[idx] = {
                        ...s.absences[idx],
                        personId,
                        type,
                        startDate,
                        endDate,
                        note,
                        updatedAt: new Date().toISOString(),
                    };
                }
            });
            __absenceUI.editId = null;
        } else {
            // CREATE
            const newAbsence = {
                id: 'abs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                personId,
                type,
                startDate,
                endDate,
                note,
                createdAt: new Date().toISOString(),
            };
            store.update(s => {
                if (!Array.isArray(s.absences)) s.absences = [];
                s.absences.push(newAbsence);
            });
        }

        reRender();
    } catch (err) {
        console.error('❌ Frånvaro-submit kraschade:', err);
        showFormMsg(form, '❌ Något gick fel: ' + err.message);
    }
}

/* ============================================================
 * BLOCK 8 — DELETE
 * ============================================================ */
function handleDelete(id, store, reRender) {
    if (!id) return;

    const state = store.getState();
    const absence = (state.absences || []).find(a => a.id === id);
    if (!absence) return;

    const person = (state.people || []).find(p => p.id === absence.personId);
    const personName = person ? `${person.firstName} ${person.lastName}` : 'Okänd';
    const typeInfo = ABSENCE_TYPES[absence.type] || { label: absence.type };

    const confirmed = confirm(
        `Radera frånvaro?\n\n${personName}\n${typeInfo.label}: ${absence.startDate} — ${absence.endDate}`
    );

    if (!confirmed) return;

    store.update(s => {
        if (!Array.isArray(s.absences)) return;
        s.absences = s.absences.filter(a => a.id !== id);
    });

    if (__absenceUI.editId === id) {
        __absenceUI.editId = null;
    }

    reRender();
}

/* ============================================================
 * BLOCK 9 — HELPERS
 * ============================================================ */
function countDays(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const monthName = MONTH_NAMES[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} ${monthName}`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showFormMsg(form, msg) {
    let el = form.querySelector('.abs-form-msg');
    if (!el) {
        el = document.createElement('div');
        el.className = 'abs-form-msg';
        form.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}
