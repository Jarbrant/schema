/*
 * AO-02B — PERSONAL: Personalsida v3 med grupper + färger (AUTOPATCH v1)
 * FIL: personal.js (HEL FIL)
 *
 * ÄNDRINGSLOGG (≤8)
 * 1) P0: Normaliserar grupper (stöd för array/map) → stabil iteration + lookup.
 * 2) P0: Säkerställer att state.people/state.meta finns (ingen crash vid update/render).
 * 3) P0: IDs normaliseras till string (editingId, person.id, groupId, checkbox values).
 * 4) P0: Skyddar render mot undefined/NaN (timlön toFixed crash) + robusta defaultvärden.
 * 5) P1: Escape av user-data i HTML (minskar XSS-risk i template-render).
 *
 * TESTNOTERINGAR (5–10)
 * - Lägg till person utan grupper → sparas, “Ingen grupp” visas.
 * - Lägg till person med 2 grupper → tags visas med rätt färg.
 * - Editera person → checkboxes pre-checkas korrekt även om gamla groupIds var number.
 * - Timlön tom/0 → validering stoppar med felmeddelande.
 * - Arkivera/Återaktivera → listorna uppdateras utan crash.
 *
 * RISK/EDGE CASES (≤5)
 * - Om store.update gör immutable klon och inte tillåter mutation: behöver justeras (men många stores tillåter mutation i updater-fn).
 * - Om gruppobjekt saknar color/textColor: fallback används.
 * - Om ni vill kräva minst 1 grupp: lägg som KRAV senare (nu tillåts tomt).
 */

export function renderPersonal(container, ctx) {
    const store = ctx?.store;

    if (!store || typeof store.getState !== 'function') {
        container.innerHTML =
            '<div class="view-container"><h2>Fel</h2><p>Store saknas eller är ogiltig.</p></div>';
        return;
    }

    const stateRaw = store.getState() || {};
    const state = ensureStateShape(stateRaw);

    // People
    const people = Array.isArray(state.people) ? state.people : [];
    // Groups: stöd för både array och map
    const { groupList, groupMap } = normalizeGroups(state.groups);

    const activePeople = people.filter((p) => !!p?.isActive).sort(sortByLastFirstSafe);
    const inactivePeople = people.filter((p) => !p?.isActive).sort(sortByLastFirstSafe);

    const editingIdRaw = sessionStorage.getItem('AO08_editingPersonId') || null;
    const editingId = editingIdRaw != null ? String(editingIdRaw) : null;
    const editingPerson = editingId ? people.find((p) => String(p?.id) === editingId) : null;

    // För checkbox-precheck: normalisera person.groups till string[]
    const editingGroups = normalizeIdList(editingPerson?.groups);

    const html = `
        <div class="view-container">
            <h2>Personal</h2>

            <section class="personal-form-section">
                <h3>${editingPerson ? 'Redigera person' : 'Lägg till ny person'}</h3>
                <form id="personal-form" class="personal-form">
                    <div class="form-group">
                        <label for="firstName">Förnamn:</label>
                        <input 
                            type="text" 
                            id="firstName" 
                            name="firstName" 
                            required
                            value="${escAttr(editingPerson?.firstName || '')}"
                            placeholder="Ex. Anna"
                        >
                    </div>

                    <div class="form-group">
                        <label for="lastName">Efternamn:</label>
                        <input 
                            type="text" 
                            id="lastName" 
                            name="lastName" 
                            required
                            value="${escAttr(editingPerson?.lastName || '')}"
                            placeholder="Ex. Svensson"
                        >
                    </div>

                    <div class="form-group">
                        <label for="hourlyWage">Timlön (kr/h):</label>
                        <input 
                            type="number" 
                            id="hourlyWage" 
                            name="hourlyWage" 
                            required
                            min="0"
                            step="0.01"
                            value="${escAttr(editingPerson?.hourlyWage ?? '')}"
                            placeholder="Ex. 180.50"
                        >
                    </div>

                    <div class="form-group">
                        <label for="employmentPct">Tjänstgöringsgrad (%):</label>
                        <input 
                            type="number" 
                            id="employmentPct" 
                            name="employmentPct" 
                            required
                            min="1"
                            max="100"
                            step="1"
                            value="${escAttr(editingPerson?.employmentPct ?? '100')}"
                            placeholder="Ex. 75"
                        >
                    </div>

                    <div class="form-group">
                        <label for="vacationDaysPerYear">Semesterdagar per år:</label>
                        <input 
                            type="number" 
                            id="vacationDaysPerYear" 
                            name="vacationDaysPerYear" 
                            required
                            min="0"
                            max="40"
                            step="1"
                            value="${escAttr(editingPerson?.vacationDaysPerYear ?? '25')}"
                            placeholder="Ex. 25"
                        >
                    </div>

                    <div class="form-group">
                        <label for="extraDaysStartBalance">Extra ledighet (start-saldo):</label>
                        <input 
                            type="number" 
                            id="extraDaysStartBalance" 
                            name="extraDaysStartBalance" 
                            required
                            min="0"
                            max="365"
                            step="1"
                            value="${escAttr(editingPerson?.extraDaysStartBalance ?? '0')}"
                            placeholder="Ex. 0"
                        >
                    </div>

                    <!-- AO-02B: Personalgrupper -->
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label>Arbetsgrupper (välj en eller flera):</label>
                        <div class="groups-checkboxes">
                            ${
                                groupList.length > 0
                                    ? groupList
                                          .map((group) => {
                                              const gid = String(group?.id ?? '');
                                              const isChecked = gid && editingGroups.includes(gid);
                                              const name = escHtml(group?.name ?? 'Okänd');
                                              const color = safeCssColor(group?.color, '#777');
                                              return `
                                        <label class="group-checkbox-label">
                                            <input 
                                                type="checkbox" 
                                                name="groups" 
                                                value="${escAttr(gid)}"
                                                class="group-checkbox"
                                                ${isChecked ? 'checked' : ''}
                                            >
                                            <span class="group-color-dot" style="background: ${color}; border-color: ${color};"></span>
                                            <span>${name}</span>
                                        </label>
                                    `;
                                          })
                                          .join('')
                                    : `<div class="muted2" style="padding:8px 0;">Inga grupper definierade ännu.</div>`
                            }
                        </div>
                    </div>

                    <div class="form-actions" style="grid-column: 1 / -1;">
                        <button type="submit" class="btn btn-primary">
                            ${editingPerson ? 'Uppdatera' : 'Lägg till'}
                        </button>
                        ${editingPerson ? '<button type="button" id="cancel-edit" class="btn btn-secondary">Avbryt</button>' : ''}
                    </div>

                    <div id="form-error" class="form-error hidden" style="grid-column: 1 / -1;"></div>
                </form>
            </section>

            <section class="personal-list-section">
                <h3>Aktiva (${activePeople.length})</h3>
                ${renderPersonTable(activePeople, 'active', groupMap)}
            </section>

            ${
                inactivePeople.length > 0
                    ? `
                <section class="personal-archive-section">
                    <h3>Arkiv — Inaktiva (${inactivePeople.length})</h3>
                    ${renderPersonTable(inactivePeople, 'inactive', groupMap)}
                </section>
            `
                    : ''
            }
        </div>
    `;

    container.innerHTML = html;

    const form = container.querySelector('#personal-form');
    const cancelBtn = container.querySelector('#cancel-edit');
    const formError = container.querySelector('#form-error');

    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit(form, formError, store, container, ctx);
    });

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            sessionStorage.removeItem('AO08_editingPersonId');
            renderPersonal(container, ctx);
        });
    }

    container.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', () => {
            const personId = btn.dataset.personId;
            handleDeletePerson(personId, store, container, ctx);
        });
    });

    container.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.addEventListener('click', () => {
            const personId = btn.dataset.personId;
            sessionStorage.setItem('AO08_editingPersonId', String(personId ?? ''));
            renderPersonal(container, ctx);
        });
    });

    container.querySelectorAll('.btn-reactivate').forEach((btn) => {
        btn.addEventListener('click', () => {
            const personId = btn.dataset.personId;
            handleReactivatePerson(personId, store, container, ctx);
        });
    });
}

function renderPersonTable(people, type, groupMap) {
    if (!Array.isArray(people) || people.length === 0) {
        return '<p class="empty-state">Ingen personal.</p>';
    }

    const rows = people
        .map((personRaw) => {
            const person = personRaw || {};
            const pid = String(person.id ?? '');

            const deleteBtn = `<button class="btn btn-sm btn-danger btn-delete" data-person-id="${escAttr(pid)}">Ta bort</button>`;
            const editBtn = `<button class="btn btn-sm btn-info btn-edit" data-person-id="${escAttr(pid)}">Redigera</button>`;
            const reactivateBtn = `<button class="btn btn-sm btn-success btn-reactivate" data-person-id="${escAttr(pid)}">Återaktivera</button>`;

            const actionBtn = type === 'active' ? `${editBtn} ${deleteBtn}` : reactivateBtn;

            // AO-02B: Visa grupper med färger
            const groupIds = normalizeIdList(person.groups);

            const groupTags =
                groupIds.length > 0
                    ? groupIds
                          .map((groupId) => {
                              const g = groupMap[groupId];
                              if (!g) return '';
                              const bg = safeCssColor(g.color, '#777');
                              const fg = safeCssColor(g.textColor, '#fff');
                              const name = escHtml(g.name ?? 'Okänd');
                              return `
                            <span class="group-tag" style="background: ${bg}; color: ${fg};">
                                ${name}
                            </span>
                        `;
                          })
                          .join('')
                    : '<span style="color: #888; font-style: italic;">Ingen grupp</span>';

            const fullName = `${escHtml(person.lastName ?? '')}, ${escHtml(person.firstName ?? '')}`.replace(/^,\s*/, '');
            const pct = safeInt(person.employmentPct, 0);
            const wage = safeNumber(person.hourlyWage, null); // null => visa "—" om saknas
            const wageText = wage == null ? '—' : `${wage.toFixed(2)} kr/h`;
            const vacation = safeInt(person.vacationDaysPerYear, 0);
            const extra = safeInt(person.extraDaysStartBalance, 0);

            return `
                <tr>
                    <td>${fullName || '—'}</td>
                    <td class="text-center">${pct}%</td>
                    <td class="text-right">${wageText}</td>
                    <td class="text-center">${vacation}</td>
                    <td class="text-center">${extra}</td>
                    <td class="groups-cell">${groupTags}</td>
                    <td class="text-center">${actionBtn}</td>
                </tr>
            `;
        })
        .join('');

    return `
        <table class="personal-table">
            <thead>
                <tr>
                    <th>Namn</th>
                    <th class="text-center">%</th>
                    <th class="text-right">Timlön</th>
                    <th class="text-center" title="Semesterdagar/år">Semester/år</th>
                    <th class="text-center" title="Extra ledighet start-saldo">Extra start</th>
                    <th>Grupper</th>
                    <th class="text-center">Åtgärder</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function handleFormSubmit(form, errorDiv, store, container, ctx) {
    try {
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }

        const firstName = (form.querySelector('#firstName')?.value || '').trim();
        const lastName = (form.querySelector('#lastName')?.value || '').trim();
        const hourlyWage = parseFloat(form.querySelector('#hourlyWage')?.value);
        const employmentPct = parseInt(form.querySelector('#employmentPct')?.value, 10);
        const vacationDaysPerYear = parseInt(form.querySelector('#vacationDaysPerYear')?.value, 10);
        const extraDaysStartBalance = parseInt(form.querySelector('#extraDaysStartBalance')?.value, 10);

        // AO-02B: Samla valda grupper (alltid string)
        const selectedGroups = Array.from(form.querySelectorAll('input[name="groups"]:checked'))
            .map((cb) => String(cb.value))
            .filter(Boolean);

        const errors = [];
        if (!firstName) errors.push('Förnamn måste fyllas i');
        if (!lastName) errors.push('Efternamn måste fyllas i');
        if (isNaN(hourlyWage) || hourlyWage <= 0) errors.push('Timlön måste vara ett positivt tal');
        if (isNaN(employmentPct) || employmentPct < 1 || employmentPct > 100) errors.push('Tjänstgöringsgrad måste vara 1–100%');
        if (isNaN(vacationDaysPerYear) || vacationDaysPerYear < 0 || vacationDaysPerYear > 40) errors.push('Semesterdagar måste vara 0–40');
        if (isNaN(extraDaysStartBalance) || extraDaysStartBalance < 0 || extraDaysStartBalance > 365) errors.push('Extra ledighet start-saldo måste vara 0–365');

        if (errors.length > 0) {
            if (errorDiv) {
                errorDiv.textContent = errors.join('; ');
                errorDiv.classList.remove('hidden');
            }
            return;
        }

        const editingIdRaw = sessionStorage.getItem('AO08_editingPersonId');
        const editingId = editingIdRaw != null ? String(editingIdRaw) : null;

        store.update((stateRaw) => {
            const state = ensureStateShape(stateRaw);

            if (!Array.isArray(state.people)) state.people = [];
            if (!state.meta || typeof state.meta !== 'object') state.meta = {};

            if (editingId) {
                const person = state.people.find((p) => String(p?.id) === editingId);
                if (person) {
                    person.firstName = firstName;
                    person.lastName = lastName;
                    person.hourlyWage = hourlyWage;
                    person.employmentPct = employmentPct;
                    person.vacationDaysPerYear = vacationDaysPerYear;
                    person.extraDaysStartBalance = extraDaysStartBalance;
                    // AO-02B: Spara grupper (string[])
                    person.groups = selectedGroups;
                }
            } else {
                const newPerson = {
                    id: generateId(), // string
                    firstName,
                    lastName,
                    hourlyWage,
                    employmentPct,
                    vacationDaysPerYear,
                    extraDaysStartBalance,
                    isActive: true,
                    groups: selectedGroups, // string[]
                    skills: {
                        KITCHEN: false,
                        PACK: false,
                        DISH: false,
                        SYSTEM: false,
                        ADMIN: false,
                    },
                };
                state.people.push(newPerson);
            }

            state.meta.updatedAt = Date.now();
            return state;
        });

        sessionStorage.removeItem('AO08_editingPersonId');
        form.reset();

        renderPersonal(container, ctx);
    } catch (err) {
        console.error('Form-fel', err);
        if (errorDiv) {
            errorDiv.textContent = `Fel: ${err?.message || 'Okänt fel'}`;
            errorDiv.classList.remove('hidden');
        }
    }
}

function handleDeletePerson(personId, store, container, ctx) {
    if (!confirm('Arkivera denna person? Datan raderas inte, bara göms.')) return;

    try {
        const pid = String(personId ?? '');
        store.update((stateRaw) => {
            const state = ensureStateShape(stateRaw);
            if (!Array.isArray(state.people)) state.people = [];
            if (!state.meta || typeof state.meta !== 'object') state.meta = {};

            const person = state.people.find((p) => String(p?.id) === pid);
            if (person) person.isActive = false;

            state.meta.updatedAt = Date.now();
            return state;
        });

        renderPersonal(container, ctx);
    } catch (err) {
        console.error('Arkiverings-fel', err);
        alert(`Fel vid arkivering: ${err?.message || 'Okänt fel'}`);
    }
}

function handleReactivatePerson(personId, store, container, ctx) {
    try {
        const pid = String(personId ?? '');
        store.update((stateRaw) => {
            const state = ensureStateShape(stateRaw);
            if (!Array.isArray(state.people)) state.people = [];
            if (!state.meta || typeof state.meta !== 'object') state.meta = {};

            const person = state.people.find((p) => String(p?.id) === pid);
            if (person) person.isActive = true;

            state.meta.updatedAt = Date.now();
            return state;
        });

        renderPersonal(container, ctx);
    } catch (err) {
        console.error('Återaktiverings-fel', err);
        alert(`Fel vid återaktivering: ${err?.message || 'Okänt fel'}`);
    }
}

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/* -------------------- Helpers (P0 robustness) -------------------- */

function ensureStateShape(state) {
    const s = state && typeof state === 'object' ? state : {};
    if (!Array.isArray(s.people)) s.people = [];
    if (!s.meta || typeof s.meta !== 'object') s.meta = {};
    // groups kan vara array/map/undefined — hanteras i normalizeGroups vid render
    return s;
}

function normalizeGroups(groups) {
    // Stöd: array [{id,name,color..}], map {id:group}, eller {"0":group...} etc.
    const list = [];
    const map = Object.create(null);

    if (Array.isArray(groups)) {
        for (const g of groups) {
            if (!g) continue;
            const id = String(g.id ?? '');
            if (!id) continue;
            const norm = normalizeGroup(g);
            list.push(norm);
            map[id] = norm;
        }
    } else if (groups && typeof groups === 'object') {
        // Kan vara map keyed by id, eller object med values
        const values = Object.values(groups);
        for (const g of values) {
            if (!g) continue;
            const id = String(g.id ?? '');
            if (!id) continue;
            const norm = normalizeGroup(g);
            list.push(norm);
            map[id] = norm;
        }
    }

    // Stabil sort på namn
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'sv'));

    return { groupList: list, groupMap: map };
}

function normalizeGroup(g) {
    const color = safeCssColor(g.color, '#777');
    const textColor = safeCssColor(g.textColor, '#fff');
    return {
        id: String(g.id ?? ''),
        name: String(g.name ?? 'Okänd'),
        color,
        textColor,
    };
}

function normalizeIdList(maybeList) {
    if (!Array.isArray(maybeList)) return [];
    return maybeList.map((x) => String(x)).filter(Boolean);
}

function safeNumber(v, fallback) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
}

function safeInt(v, fallback) {
    const n = typeof v === 'number' ? v : parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
}

function sortByLastFirstSafe(a, b) {
    const aLast = String(a?.lastName ?? '').toLowerCase();
    const bLast = String(b?.lastName ?? '').toLowerCase();
    if (aLast !== bLast) return aLast.localeCompare(bLast, 'sv');
    const aFirst = String(a?.firstName ?? '').toLowerCase();
    const bFirst = String(b?.firstName ?? '').toLowerCase();
    return aFirst.localeCompare(bFirst, 'sv');
}

function escHtml(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escAttr(str) {
    // samma som escHtml men extra säker för attribut (räcker här)
    return escHtml(str);
}

function safeCssColor(value, fallback) {
    const v = String(value ?? '').trim();
    // Enkla, säkra fall: hex (#RGB/#RRGGBB), rgb/rgba, hsl/hsla, eller css-variabel.
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return v;
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*(0(\.\d+)?|1(\.0+)?))?\s*\)$/.test(v)) return v;
    if (/^hsla?\(.*\)$/.test(v)) return v;
    if (/^var\(--[a-zA-Z0-9_-]+\)$/.test(v)) return v;
    return fallback;
}
