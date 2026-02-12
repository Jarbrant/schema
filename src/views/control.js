/*
 * AO-22 — CONTROL: Komplett kontroll-vy med regelöversikt, extra-ledighet, planering + bemanningsbehov
 */

import { evaluate, evaluateYear } from '../rules.js';
import { planExtraDays } from '../scheduler/extraPlanner.js';
import { generate } from '../scheduler/engine.js';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const SKILLS = ['KITCHEN', 'PACK', 'DISH', 'SYSTEM', 'ADMIN'];

export function renderControl(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const viewMode = sessionStorage.getItem('AO22_viewMode') || 'month';

    if (!state.schedule || state.schedule.year !== 2026) {
        container.innerHTML =
            '<div class="view-container"><h2>Kontroll</h2><p class="error-text">Schedule för 2026 saknas. Kan inte visa regelvyn.</p></div>';
        return;
    }

    let result;
    try {
        if (viewMode === 'year') {
            result = evaluateYear(state, { year: 2026 });
        } else {
            const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
            const selectedMonth = Math.max(1, Math.min(12, currentMonth));
            result = evaluate(state, { year: 2026, month: selectedMonth });
        }
    } catch (err) {
        console.error('Regelfel', err);
        container.innerHTML = `
            <div class="view-container">
                <h2>Kontroll</h2>
                <p class="error-text">Regelberäkning misslyckades: ${err.message}</p>
            </div>
        `;
        return;
    }

    const html = `
        <div class="view-container control-container">
            <h2>Kontroll — Regelöversikt, Extra-ledighet & Schemaläggning</h2>

            <!-- View-väljare -->
            <div class="control-view-selector">
                <button class="btn btn-toggle ${viewMode === 'month' ? 'active' : ''}" data-mode="month">
                    Denna månad
                </button>
                <button class="btn btn-toggle ${viewMode === 'year' ? 'active' : ''}" data-mode="year">
                    Hela året
                </button>
            </div>

            ${
                viewMode === 'month'
                    ? `
                <div class="control-month-selector">
                    <label for="control-month">Månad:</label>
                    <select id="control-month" class="month-select">
                        ${MONTH_NAMES.map((name, idx) => `
                            <option value="${idx + 1}" ${idx + 1 === (result.month || 1) ? 'selected' : ''}>
                                ${name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `
                    : ''
            }

            <!-- Regel-varnings-banner -->
            ${renderRulesBanner(result)}

            <!-- Extra-ledighet-sektion -->
            ${renderExtraLedigheterSection(result)}

            <!-- AO-22: Kompetens-sektion -->
            ${renderCompetenceSection(state)}

            <!-- AO-22: Bemanningsbehov-sektion -->
            ${renderDemandSection(state)}

            <!-- AO-22: Kökskärna-sektion -->
            ${renderKitchenCoreSection(state)}

            <!-- AO-22: Rollbaserad schemaläggning -->
            ${viewMode === 'month' ? renderRoleBasedSchedulerPanel(state, result.month) : ''}

            <!-- Personstatistik -->
            ${renderPersonStats(result)}

            <!-- Varningar -->
            ${renderWarnings(result)}
        </div>
    `;

    container.innerHTML = html;

    // Event listeners
    const viewButtons = container.querySelectorAll('.btn-toggle');
    viewButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            sessionStorage.setItem('AO22_viewMode', mode);
            renderControl(container, ctx);
        });
    });

    const monthSelect = container.querySelector('#control-month');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            sessionStorage.setItem('AO22_selectedMonth', e.target.value);
            renderControl(container, ctx);
        });
    }

    // Kompetens-listeners
    container.querySelectorAll('.skill-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            handleSkillChange(checkbox, store, container, ctx);
        });
    });

    // Bemanningsbehov-listeners
    container.querySelectorAll('.demand-input').forEach((input) => {
        input.addEventListener('change', () => {
            handleDemandChange(input, store, container, ctx);
        });
    });

    const resetDemandBtn = container.querySelector('#reset-demand-btn');
    if (resetDemandBtn) {
        resetDemandBtn.addEventListener('click', () => {
            handleResetDemand(store, container, ctx);
        });
    }

    // Kökskärna-listeners
    container.querySelectorAll('.core-person-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            handleCorePersonChange(checkbox, store, container, ctx);
        });
    });

    const minCoreInput = container.querySelector('#min-core-input');
    if (minCoreInput) {
        minCoreInput.addEventListener('change', () => {
            handleMinCoreChange(parseInt(minCoreInput.value, 10), store, container, ctx);
        });
    }

    // Rollbaserad schemaläggning
    const previewRoleBtn = container.querySelector('#preview-role-schedule-btn');
    if (previewRoleBtn) {
        previewRoleBtn.addEventListener('click', () => {
            handleRoleSchedulePreview(state, result.month, store, container, ctx);
        });
    }
}

function renderRulesBanner(result) {
    const p0Count = result.warnings.filter((w) => w.level === 'P0').length;
    const p1Count = result.warnings.filter((w) => w.level === 'P1').length;

    return `
        <div class="rules-banner ${p0Count === 0 && p1Count === 0 ? 'ok' : 'warning'}">
            ${
                p0Count === 0 && p1Count === 0
                    ? '✓ Inga regelbrott denna period'
                    : `${p0Count > 0 ? `<span class="banner-item p0">P0: ${p0Count}</span>` : ''} ${
                          p1Count > 0 ? `<span class="banner-item p1">P1: ${p1Count}</span>` : ''
                      }`
            }
        </div>
    `;
}

function renderExtraLedigheterSection(result) {
    const people = Object.values(result.statsByPerson)
        .filter((p) => p)
        .sort((a, b) => a.lastName.localeCompare(b.lastName));

    if (people.length === 0) {
        return '<p class="empty-state">Ingen personal att analysera.</p>';
    }

    const rows = people
        .map((stats) => {
            const hasNegativeSaldo = stats.extraBalanceDays < 0;
            const hasUnplanned = stats.earnedExtraDays > stats.extraTakenDays && stats.extraBalanceDays > 0;
            const warningIcon = hasNegativeSaldo ? '⚠️' : hasUnplanned ? '⏳' : '✓';

            return `
            <tr class="${hasNegativeSaldo ? 'error-row' : hasUnplanned ? 'warning-row' : 'ok-row'}">
                <td class="col-name">${stats.lastName}, ${stats.firstName}</td>
                <td class="col-center">${stats.extraStartBalanceDays}</td>
                <td class="col-center">${stats.extraEarnedDays}</td>
                <td class="col-center">${stats.extraTakenDays}</td>
                <td class="col-center ${hasNegativeSaldo ? 'negative' : hasUnplanned ? 'pending' : 'ok'}">${
                stats.extraBalanceDays > 0 ? '+' : ''
            }${stats.extraBalanceDays}</td>
                <td class="col-center ${hasUnplanned ? 'warning' : ''}">${stats.extraToPlanDays}</td>
                <td class="col-center">${warningIcon}</td>
            </tr>
        `;
        })
        .join('');

    return `
        <div class="extra-ledighet-section">
            <h3>🎯 Extra ledighet — Saldo</h3>
            <p class="section-desc">
                Intjänade extra dagar från arbete på röda dagar måste schemaläggas som X-dagar.
            </p>
            <div class="extra-table-wrapper">
                <table class="extra-ledighet-table">
                    <thead>
                        <tr>
                            <th>Namn</th>
                            <th title="Start-saldo">Start</th>
                            <th title="Intjänad röd dag">Intj</th>
                            <th title="Uttag X">Uttag</th>
                            <th title="Totalsaldo">Saldo</th>
                            <th title="Kvar att planera">Kvar</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderCompetenceSection(state) {
    const activePeople = (state.people || []).filter((p) => p.isActive).sort((a, b) => a.lastName.localeCompare(b.lastName));

    if (activePeople.length === 0) {
        return '<p class="empty-state">Ingen aktiv personal.</p>';
    }

    const rows = activePeople
        .map((person) => {
            const skills = person.skills || {};
            const skillCheckboxes = SKILLS.map(
                (skill) =>
                    `
                <label class="skill-checkbox-label">
                    <input 
                        type="checkbox" 
                        class="skill-checkbox"
                        data-person-id="${person.id}"
                        data-skill="${skill}"
                        ${skills[skill] ? 'checked' : ''}
                    >
                    <span>${skill}</span>
                </label>
            `
            ).join('');

            return `
            <tr>
                <td class="col-name">${person.lastName}, ${person.firstName}</td>
                <td class="col-skills">${skillCheckboxes}</td>
            </tr>
        `;
        })
        .join('');

    return `
        <section class="competence-section">
            <h3>👥 Kompetens (per person)</h3>
            <p class="section-desc">Markera vilka roller varje person kan utföra.</p>
            <div class="competence-table-wrapper">
                <table class="competence-table">
                    <thead>
                        <tr>
                            <th>Namn</th>
                            <th colspan="${SKILLS.length}">Roller</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderDemandSection(state) {
    const demand = state.demand || { weekdayTemplate: [] };
    const template = demand.weekdayTemplate || [];

    if (template.length === 0) {
        return '<p class="empty-state">Inget bemanningsbehov konfigurerat.</p>';
    }

    const rows = template
        .map((day, dayIndex) => {
            const inputs = SKILLS.map(
                (skill) =>
                    `
                <td class="col-demand">
                    <input 
                        type="number" 
                        class="demand-input"
                        data-weekday="${dayIndex}"
                        data-skill="${skill}"
                        value="${day[skill] || 0}"
                        min="0"
                        max="20"
                    >
                </td>
            `
            ).join('');

            return `
            <tr>
                <td class="col-weekday"><strong>${WEEKDAY_NAMES[dayIndex]}</strong></td>
                ${inputs}
            </tr>
        `;
        })
        .join('');

    return `
        <section class="demand-section">
            <h3>📅 Bemanningsbehov (per veckodag)</h3>
            <p class="section-desc">Ange antal personer behövda per roll och veckodag.</p>
            <div class="demand-table-wrapper">
                <table class="demand-table">
                    <thead>
                        <tr>
                            <th>Dag</th>
                            ${SKILLS.map((skill) => `<th>${skill}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <div class="demand-actions">
                <button id="reset-demand-btn" class="btn btn-secondary">🔄 Återställ standard</button>
            </div>
        </section>
    `;
}

function renderKitchenCoreSection(state) {
    const activePeople = (state.people || []).filter((p) => p.isActive).sort((a, b) => a.lastName.localeCompare(b.lastName));
    const kitchenCore = state.kitchenCore || { enabled: true, corePersonIds: [], minCorePerDay: 1 };

    if (activePeople.length === 0) {
        return '<p class="empty-state">Ingen aktiv personal.</p>';
    }

    const checkboxes = activePeople
        .map((person) => {
            const isCore = kitchenCore.corePersonIds.includes(person.id);
            return `
            <label class="core-person-checkbox-label">
                <input 
                    type="checkbox" 
                    class="core-person-checkbox"
                    data-person-id="${person.id}"
                    ${isCore ? 'checked' : ''}
                >
                <span>${person.lastName}, ${person.firstName}</span>
            </label>
        `;
        })
        .join('');

    return `
        <section class="kitchen-core-section">
            <h3>🔑 Kökskärna</h3>
            <p class="section-desc">Välj vilka personer som ingår i kökskärnan och sätt minimum per dag.</p>
            <div class="core-persons-list">
                ${checkboxes}
            </div>
            <div class="core-min-input-group">
                <label for="min-core-input">Minst N från kärna per dag:</label>
                <input 
                    type="number" 
                    id="min-core-input"
                    value="${kitchenCore.minCorePerDay}"
                    min="0"
                    max="10"
                >
            </div>
        </section>
    `;
}

function renderRoleBasedSchedulerPanel(state, selectedMonth) {
    return `
        <div class="role-scheduler-panel">
            <h3>��� Föreslå schema — Rollbaserat läge</h3>
            <p class="section-desc">
                Systemet schemalägger personal enligt bemanningsbehov per roll (KITCHEN/PACK/DISK/SYSTEM/ADMIN)
                och respekterar kökskärnakravet.
            </p>

            <div class="planner-actions">
                <button id="preview-role-schedule-btn" class="btn btn-secondary">
                    👁️ Förhandsgranska schema
                </button>
            </div>

            <div id="role-schedule-preview" class="role-schedule-preview hidden"></div>
            <div id="role-schedule-error" class="role-schedule-error hidden"></div>
        </div>
    `;
}

function handleRoleSchedulePreview(state, month, store, container, ctx) {
    try {
        const result = generate(state, {
            year: 2026,
            month,
            mode: 'preview',
        });

        showRoleSchedulePreview(container, result);
    } catch (err) {
        console.error('Preview-fel', err);
        showRoleScheduleError(container, err.message);
    }
}

function showRoleSchedulePreview(container, result) {
    const previewDiv = container.querySelector('#role-schedule-preview');
    const errorDiv = container.querySelector('#role-schedule-error');

    if (!previewDiv) return;

    errorDiv.classList.add('hidden');
    previewDiv.classList.remove('hidden');

    const vacanciesByDate = {};
    result.vacancies.forEach((v) => {
        if (!vacanciesByDate[v.date]) {
            vacanciesByDate[v.date] = [];
        }
        vacanciesByDate[v.date].push(`${v.role} (${v.count})`);
    });

    let vacancyHtml = '';
    if (Object.keys(vacanciesByDate).length > 0) {
        vacancyHtml = `
            <div class="vacancy-list">
                <h4>⚠️ Vakanser per roll:</h4>
                <ul>
                    ${Object.entries(vacanciesByDate)
                        .map(
                            ([date, roles]) =>
                                `<li><strong>${date}</strong>: ${roles.join(', ')}</li>`
                        )
                        .join('')}
                </ul>
            </div>
        `;
    }

    previewDiv.innerHTML = `
        <div class="result-box info">
            <h4>📋 Förhandsvisning av rollbaserat schema</h4>
            <p>${result.notes}</p>
            <div class="fill-rate-indicator">
                <span class="label">Behov uppfyllt:</span>
                <span class="value" style="color: ${result.fillRate >= 80 ? '#4caf50' : result.fillRate >= 50 ? '#f57c00' : '#f44336'};">
                    ${result.fillRate}%
                </span>
            </div>
            ${vacancyHtml}
            <div class="planner-action-buttons">
                <button id="apply-role-schedule-btn" class="btn btn-primary">✓ Applicera schema</button>
            </div>
        </div>
    `;

    const applyBtn = previewDiv.querySelector('#apply-role-schedule-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (!confirm('Applicera rollbaserat schema? Detta kan inte ångras enkelt.')) {
                return;
            }

            try {
                const applyResult = generate(state, {
                    year: 2026,
                    month: result.month,
                    mode: 'apply',
                });

                store.importState(JSON.stringify(applyResult.proposedState));

                previewDiv.innerHTML = `
                    <div class="result-box success">
                        <h4>✓ Rollbaserat schema applicerat!</h4>
                        <p>${applyResult.notes}</p>
                        <p style="margin-top: 1rem; font-style: italic;">Navigerar till kalendern...</p>
                    </div>
                `;

                setTimeout(() => {
                    sessionStorage.setItem('AO16_selectedMonth', String(result.month));
                    window.location.hash = '#/calendar';
                }, 2000);
            } catch (err) {
                console.error('Apply-fel', err);
                showRoleScheduleError(container, err.message);
            }
        });
    }
}

function showRoleScheduleError(container, errorMsg) {
    const errorDiv = container.querySelector('#role-schedule-error');
    const previewDiv = container.querySelector('#role-schedule-preview');

    if (!errorDiv) return;

    previewDiv.classList.add('hidden');
    errorDiv.classList.remove('hidden');

    errorDiv.innerHTML = `
        <div class="result-box error">
            <h4>❌ Schemaläggningsfel</h4>
            <p>${escapeHtml(errorMsg)}</p>
        </div>
    `;
}

function handleSkillChange(checkbox, store, container, ctx) {
    try {
        const personId = checkbox.dataset.personId;
        const skill = checkbox.dataset.skill;
        const isChecked = checkbox.checked;

        store.update((state) => {
            const person = state.people.find((p) => p.id === personId);
            if (person) {
                if (!person.skills) {
                    person.skills = {};
                }
                person.skills[skill] = isChecked;
            }
            state.meta.updatedAt = Date.now();
            return state;
        });
    } catch (err) {
        console.error('Skill-ändringsfel', err);
        alert(`Fel: ${err.message}`);
    }
}

function handleDemandChange(input, store, container, ctx) {
    try {
        const weekday = parseInt(input.dataset.weekday, 10);
        const skill = input.dataset.skill;
        const value = parseInt(input.value, 10);

        if (isNaN(value) || value < 0 || value > 50) {
            alert('Bemanningsbehov måste vara mellan 0 och 50');
            input.value = 0;
            return;
        }

        store.update((state) => {
            if (!state.demand) {
                state.demand = { weekdayTemplate: [] };
            }
            if (!state.demand.weekdayTemplate[weekday]) {
                state.demand.weekdayTemplate[weekday] = {};
            }
            state.demand.weekdayTemplate[weekday][skill] = value;
            state.meta.updatedAt = Date.now();
            return state;
        });
    } catch (err) {
        console.error('Demand-ändringsfel', err);
        alert(`Fel: ${err.message}`);
    }
}

function handleResetDemand(store, container, ctx) {
    if (!confirm('Återställa bemanningsbehov till standard?')) {
        return;
    }

    try {
        const DEFAULT_DEMAND = {
            weekdayTemplate: [
                { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 1, notes: '' },
                { KITCHEN: 4, PACK: 6, DISH: 2, SYSTEM: 1, ADMIN: 1, notes: '' },
                { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 1, notes: '' },
                { KITCHEN: 4, PACK: 4, DISH: 2, SYSTEM: 0, ADMIN: 1, notes: '' },
                { KITCHEN: 4, PACK: 4, DISH: 1, SYSTEM: 0, ADMIN: 1, notes: '' },
                { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 0, notes: '' },
                { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 0, notes: '' },
            ],
        };

        store.update((state) => {
            state.demand = DEFAULT_DEMAND;
            state.meta.updatedAt = Date.now();
            return state;
        });

        renderControl(container, ctx);
    } catch (err) {
        console.error('Reset-fel', err);
        alert(`Fel: ${err.message}`);
    }
}

function handleCorePersonChange(checkbox, store, container, ctx) {
    try {
        const personId = checkbox.dataset.personId;
        const isChecked = checkbox.checked;

        store.update((state) => {
            if (!state.kitchenCore) {
                state.kitchenCore = { enabled: true, corePersonIds: [], minCorePerDay: 1 };
            }

            if (isChecked) {
                if (!state.kitchenCore.corePersonIds.includes(personId)) {
                    state.kitchenCore.corePersonIds.push(personId);
                }
            } else {
                state.kitchenCore.corePersonIds = state.kitchenCore.corePersonIds.filter((id) => id !== personId);
            }

            state.meta.updatedAt = Date.now();
            return state;
        });
    } catch (err) {
        console.error('Kökskärna-ändringsfel', err);
        alert(`Fel: ${err.message}`);
    }
}

function handleMinCoreChange(value, store, container, ctx) {
    try {
        if (isNaN(value) || value < 0 || value > 10) {
            alert('Minst N från kärna måste vara 0–10');
            return;
        }

        store.update((state) => {
            if (!state.kitchenCore) {
                state.kitchenCore = { enabled: true, corePersonIds: [], minCorePerDay: 1 };
            }
            state.kitchenCore.minCorePerDay = value;
            state.meta.updatedAt = Date.now();
            return state;
        });
    } catch (err) {
        console.error('Min-core-ändringsfel', err);
        alert(`Fel: ${err.message}`);
    }
}

function renderPersonStats(result) {
    const people = Object.values(result.statsByPerson).sort((a, b) => a.lastName.localeCompare(b.lastName));

    if (people.length === 0) {
        return '<p class="empty-state">Ingen personal att analysera.</p>';
    }

    const rows = people
        .map((stats) => {
            const breachTotal = stats.rest11hBreaches + stats.max10hBreaches + stats.rest36hBreaches;

            return `
            <tr class="${breachTotal > 0 ? 'has-issues' : ''}">
                <td class="col-name">${stats.lastName}, ${stats.firstName}</td>
                <td class="col-number">${stats.workedDays}</td>
                <td class="col-number">${stats.redDaysWorked}</td>
                <td class="col-number highlight">${stats.earnedExtraDays}</td>
                <td class="col-number">${stats.maxStreak}</td>
                <td class="col-number ${stats.rest11hBreaches > 0 ? 'breach' : ''}">${stats.rest11hBreaches}</td>
                <td class="col-number ${stats.max10hBreaches > 0 ? 'breach' : ''}">${stats.max10hBreaches}</td>
                <td class="col-number ${stats.rest36hBreaches > 0 ? 'breach' : ''}">${stats.rest36hBreaches}</td>
            </tr>
        `;
        })
        .join('');

    return `
        <div class="control-stats-section">
            <h3>Personstatistik</h3>
            <div class="control-table-wrapper">
                <table class="control-stats-table">
                    <thead>
                        <tr>
                            <th>Namn</th>
                            <th title="Arbetsdagar (A)">Arbetad</th>
                            <th title="A på röd dag">Röd A</th>
                            <th title="Intjänad extra">Extra</th>
                            <th title="Max A-i-rad">Streak</th>
                            <th title="Dygnsvila < 11h">Dvila</th>
                            <th title="Arbetstid > 10h">10h</th>
                            <th title="Veckovila < 36h">Vvila</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderWarnings(result) {
    if (result.warnings.length === 0) {
        return '<div class="control-warnings-section"><h3>Varningar</h3><p class="empty-state">Inga varningar!</p></div>';
    }

    const byLevel = {
        P0: result.warnings.filter((w) => w.level === 'P0'),
        P1: result.warnings.filter((w) => w.level === 'P1'),
    };

    let warningsHtml = '<div class="control-warnings-section"><h3>Varningar</h3>';

    if (byLevel.P0.length > 0) {
        warningsHtml += '<div class="warnings-group p0">';
        warningsHtml += `<h4>P0 (Brott mot regler, ${byLevel.P0.length})</h4>`;
        warningsHtml += '<ul class="warnings-list">';
        byLevel.P0.forEach((w) => {
            warningsHtml += `
                <li class="warning-item p0">
                    <span class="warning-code">${w.code}</span>
                    <span class="warning-text">${w.message}</span>
                    <span class="warning-date">${w.dateFrom}</span>
                </li>
            `;
        });
        warningsHtml += '</ul></div>';
    }

    if (byLevel.P1.length > 0) {
        warningsHtml += '<div class="warnings-group p1">';
        warningsHtml += `<h4>P1 (Observera, ${byLevel.P1.length})</h4>`;
        warningsHtml += '<ul class="warnings-list">';
        byLevel.P1.forEach((w) => {
            warningsHtml += `
                <li class="warning-item p1">
                    <span class="warning-code">${w.code}</span>
                    <span class="warning-text">${w.message}</span>
                    <span class="warning-date">${w.dateFrom}</span>
                </li>
            `;
        });
        warningsHtml += '</ul></div>';
    }

    warningsHtml += '</div>';
    return warningsHtml;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}
