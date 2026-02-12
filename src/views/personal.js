/*
 * AO-08 — PERSONAL: Personalsida v2 med kompetens
 */

export function renderPersonal(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const people = state.people || [];

    const activePeople = people.filter((p) => p.isActive).sort(sortByLastFirst);
    const inactivePeople = people.filter((p) => !p.isActive).sort(sortByLastFirst);

    const editingId = sessionStorage.getItem('AO08_editingPersonId') || null;
    const editingPerson = editingId ? people.find((p) => p.id === editingId) : null;

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
                            value="${editingPerson?.firstName || ''}"
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
                            value="${editingPerson?.lastName || ''}"
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
                            value="${editingPerson?.hourlyWage || ''}"
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
                            value="${editingPerson?.employmentPct || '100'}"
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
                            value="${editingPerson?.vacationDaysPerYear || '25'}"
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
                            value="${editingPerson?.extraDaysStartBalance || '0'}"
                            placeholder="Ex. 0"
                        >
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            ${editingPerson ? 'Uppdatera' : 'Lägg till'}
                        </button>
                        ${editingPerson ? '<button type="button" id="cancel-edit" class="btn btn-secondary">Avbryt</button>' : ''}
                    </div>

                    <div id="form-error" class="form-error hidden"></div>
                </form>
            </section>

            <section class="personal-list-section">
                <h3>Aktiva (${activePeople.length})</h3>
                ${renderPersonTable(activePeople, 'active')}
            </section>

            ${
                inactivePeople.length > 0
                    ? `
                <section class="personal-archive-section">
                    <h3>Arkiv — Inaktiva (${inactivePeople.length})</h3>
                    ${renderPersonTable(inactivePeople, 'inactive')}
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
            sessionStorage.setItem('AO08_editingPersonId', personId);
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

function renderPersonTable(people, type) {
    if (people.length === 0) {
        return '<p class="empty-state">Ingen personal.</p>';
    }

    const rows = people
        .map((person) => {
            const deleteBtn = `<button class="btn btn-sm btn-danger btn-delete" data-person-id="${person.id}">Ta bort</button>`;
            const editBtn = `<button class="btn btn-sm btn-info btn-edit" data-person-id="${person.id}">Redigera</button>`;
            const reactivateBtn = `<button class="btn btn-sm btn-success btn-reactivate" data-person-id="${person.id}">Återaktivera</button>`;

            const actionBtn = type === 'active' ? `${editBtn} ${deleteBtn}` : reactivateBtn;

            return `
                <tr>
                    <td>${person.lastName}, ${person.firstName}</td>
                    <td class="text-center">${person.employmentPct}%</td>
                    <td class="text-right">${person.hourlyWage.toFixed(2)} kr/h</td>
                    <td class="text-center">${person.vacationDaysPerYear}</td>
                    <td class="text-center">${person.extraDaysStartBalance}</td>
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
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';

        const firstName = form.querySelector('#firstName').value.trim();
        const lastName = form.querySelector('#lastName').value.trim();
        const hourlyWage = parseFloat(form.querySelector('#hourlyWage').value);
        const employmentPct = parseInt(form.querySelector('#employmentPct').value, 10);
        const vacationDaysPerYear = parseInt(form.querySelector('#vacationDaysPerYear').value, 10);
        const extraDaysStartBalance = parseInt(form.querySelector('#extraDaysStartBalance').value, 10);

        const errors = [];
        if (!firstName || firstName.length === 0) {
            errors.push('Förnamn måste fyllas i');
        }
        if (!lastName || lastName.length === 0) {
            errors.push('Efternamn måste fyllas i');
        }
        if (isNaN(hourlyWage) || hourlyWage <= 0) {
            errors.push('Timlön måste vara ett positivt tal');
        }
        if (isNaN(employmentPct) || employmentPct < 1 || employmentPct > 100) {
            errors.push('Tjänstgöringsgrad måste vara 1–100%');
        }
        if (isNaN(vacationDaysPerYear) || vacationDaysPerYear < 0 || vacationDaysPerYear > 40) {
            errors.push('Semesterdagar måste vara 0–40');
        }
        if (isNaN(extraDaysStartBalance) || extraDaysStartBalance < 0 || extraDaysStartBalance > 365) {
            errors.push('Extra ledighet start-saldo måste vara 0–365');
        }

        if (errors.length > 0) {
            errorDiv.textContent = errors.join('; ');
            errorDiv.classList.remove('hidden');
            return;
        }

        const editingId = sessionStorage.getItem('AO08_editingPersonId');

        store.update((state) => {
            if (editingId) {
                const person = state.people.find((p) => p.id === editingId);
                if (person) {
                    person.firstName = firstName;
                    person.lastName = lastName;
                    person.hourlyWage = hourlyWage;
                    person.employmentPct = employmentPct;
                    person.vacationDaysPerYear = vacationDaysPerYear;
                    person.extraDaysStartBalance = extraDaysStartBalance;
                }
            } else {
                const newPerson = {
                    id: generateId(),
                    firstName,
                    lastName,
                    hourlyWage,
                    employmentPct,
                    vacationDaysPerYear,
                    extraDaysStartBalance,
                    isActive: true,
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
        errorDiv.textContent = `Fel: ${err.message}`;
        errorDiv.classList.remove('hidden');
    }
}

function handleDeletePerson(personId, store, container, ctx) {
    if (!confirm('Arkivera denna person? Datan raderas inte, bara göms.')) {
        return;
    }

    try {
        store.update((state) => {
            const person = state.people.find((p) => p.id === personId);
            if (person) {
                person.isActive = false;
            }
            state.meta.updatedAt = Date.now();
            return state;
        });

        renderPersonal(container, ctx);
    } catch (err) {
        console.error('Arkiverings-fel', err);
        alert(`Fel vid arkivering: ${err.message}`);
    }
}

function handleReactivatePerson(personId, store, container, ctx) {
    try {
        store.update((state) => {
            const person = state.people.find((p) => p.id === personId);
            if (person) {
                person.isActive = true;
            }
            state.meta.updatedAt = Date.now();
            return state;
        });

        renderPersonal(container, ctx);
    } catch (err) {
        console.error('Återaktiverings-fel', err);
        alert(`Fel vid återaktivering: ${err.message}`);
    }
}

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sortByLastFirst(a, b) {
    const aLast = a.lastName.toLowerCase();
    const bLast = b.lastName.toLowerCase();
    if (aLast !== bLast) {
        return aLast.localeCompare(bLast);
    }
    return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
}
