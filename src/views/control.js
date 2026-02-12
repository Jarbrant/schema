/*
 * AO-02C + AO-02D + AO-02E + AO-09: CONTROL: Grupp-filter, Pass, Behov, Schemaläggning
 * Organized in clearly marked blocks for easy maintenance
 */

import { evaluate } from '../rules.js';
import { generate } from '../scheduler/engine.js';

/* ========================================================================
   BLOCK 1: MAIN RENDER FUNCTION
   ======================================================================== */

export function renderControl(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();

    if (!state.schedule || state.schedule.year !== 2026) {
        container.innerHTML =
            '<div class="view-container"><h2>Kontroll</h2><p class="error-text">Schedule för 2026 saknas. Kan inte visa kontroll.</p></div>';
        return;
    }

    /* Evaluer reglerna för aktuell månad */
    let rulesResult;
    try {
        const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
        const selectedMonth = Math.max(1, Math.min(12, currentMonth));
        rulesResult = evaluate(state, { year: 2026, month: selectedMonth });
    } catch (err) {
        console.error('Regelkontroll-fel', err);
        rulesResult = { warnings: [], statsByPerson: {} };
    }

    const html = `
        <div class="view-container control-container">
            <h2>Kontroll & Schemaläggning</h2>

            <!-- Regel-varnings-banner -->
            ${renderRulesBanner(rulesResult)}

            <!-- AO-02E: Grupp-filter (nytt!) -->
            ${renderGroupFilterSection(state)}

            <!-- AO-02D: Grupp-pass-koppling -->
            ${renderGroupShiftsSection(state)}

            <!-- AO-02C: Grupp-baserat bemanningsbehov -->
            ${renderGroupDemandSection(state)}

            <!-- AO-09: Schemaläggnings-panel -->
            ${renderSchedulerSection(state)}

            <!-- Varnings-detaljer -->
            ${renderWarningsSection(rulesResult)}
        </div>
    `;

    container.innerHTML = html;

    /* ====================================================================
       EVENT LISTENERS - AO-02E (FILTER)
       ==================================================================== */
    const filterCheckboxes = container.querySelectorAll('.group-filter-checkbox');
    filterCheckboxes.forEach((cb) => {
        cb.addEventListener('change', () => {
            saveGroupFilterSelections(container);
        });
    });

    const filterSelectAllBtn = container.querySelector('#filter-select-all-btn');
    const filterSelectNoneBtn = container.querySelector('#filter-select-none-btn');
    if (filterSelectAllBtn) {
        filterSelectAllBtn.addEventListener('click', () => {
            container.querySelectorAll('.group-filter-checkbox').forEach((cb) => {
                cb.checked = true;
            });
            saveGroupFilterSelections(container);
        });
    }
    if (filterSelectNoneBtn) {
        filterSelectNoneBtn.addEventListener('click', () => {
            container.querySelectorAll('.group-filter-checkbox').forEach((cb) => {
                cb.checked = false;
            });
            saveGroupFilterSelections(container);
        });
    }

    /* ====================================================================
       EVENT LISTENERS - AO-02D (SHIFTS)
       ==================================================================== */
    const saveShiftsBtn = container.querySelector('#save-group-shifts-btn');
    if (saveShiftsBtn) {
        saveShiftsBtn.addEventListener('click', () => {
            handleSaveGroupShifts(store, container, ctx);
        });
    }

    /* ====================================================================
       EVENT LISTENERS - AO-02C (DEMAND)
       ==================================================================== */
    const saveDemandBtn = container.querySelector('#save-group-demands-btn');
    if (saveDemandBtn) {
        saveDemandBtn.addEventListener('click', () => {
            handleSaveGroupDemands(store, container, ctx);
        });
    }

    /* ====================================================================
       EVENT LISTENERS - AO-09 (SCHEDULER)
       ==================================================================== */
    const generateBtn = container.querySelector('#generate-schedule-btn');
    const monthSelect = container.querySelector('#scheduler-month');

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            handleGenerateSchedule(store, container, ctx);
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            sessionStorage.setItem('AO22_selectedMonth', e.target.value);
            renderControl(container, ctx);
        });
    }
}

/* ========================================================================
   BLOCK 2: RULE WARNINGS BANNER
   ======================================================================== */

function renderRulesBanner(result) {
    const p0Count = result.warnings.filter((w) => w.level === 'P0').length;
    const p1Count = result.warnings.filter((w) => w.level === 'P1').length;

    if (p0Count === 0 && p1Count === 0) {
        return '<div class="rules-banner ok">✓ Inga regelbrott denna period</div>';
    }

    let banner = '<div class="rules-banner warning">';
    if (p0Count > 0) {
        banner += `<span class="banner-item p0">P0: ${p0Count}</span>`;
    }
    if (p1Count > 0) {
        banner += `<span class="banner-item p1">P1: ${p1Count}</span>`;
    }
    banner += '</div>';

    return banner;
}

/* ========================================================================
   BLOCK 3: AO-02E — GROUP FILTER
   ======================================================================== */

function renderGroupFilterSection(state) {
    /* AO-02E: Hämta grupper och sparade val */
    const groups = state.groups || {};
    const groupIds = Object.keys(groups).sort();
    const savedFilters = JSON.parse(sessionStorage.getItem('AO02E_groupFilters') || '{}');

    if (groupIds.length === 0) {
        return `
            <div class="alert alert-info">
                <h4>ℹ️ Inga grupper definierade</h4>
                <p>Lägg till personalgrupper först.</p>
            </div>
        `;
    }

    return `
        <section class="group-filter-section">
            <h3>🔍 Grupp-filter</h3>
            <p class="section-desc">
                Välj vilka grupper du vill arbeta med. Dessa val påverkar både visning och schemagenering.
            </p>

            <div class="filter-controls">
                <button id="filter-select-all-btn" class="btn btn-sm btn-secondary">Välj alla</button>
                <button id="filter-select-none-btn" class="btn btn-sm btn-secondary">Välja ingen</button>
            </div>

            <div class="group-filter-checkboxes">
                ${groupIds.map((groupId) => {
                    const group = groups[groupId];
                    const isChecked = savedFilters[groupId] !== false; // Default true
                    return `
                        <label class="group-filter-checkbox-label">
                            <input 
                                type="checkbox" 
                                class="group-filter-checkbox" 
                                data-group="${groupId}"
                                ${isChecked ? 'checked' : ''}
                            >
                            <span class="filter-color-dot" style="background: ${group.color}; border-color: ${group.color};"></span>
                            <span>${group.name}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

/**
 * AO-02E: Spara filter-val i sessionStorage
 */
function saveGroupFilterSelections(container) {
    const checkboxes = container.querySelectorAll('.group-filter-checkbox');
    const filters = {};

    checkboxes.forEach((cb) => {
        const groupId = cb.dataset.group;
        filters[groupId] = cb.checked;
    });

    sessionStorage.setItem('AO02E_groupFilters', JSON.stringify(filters));
    console.log('✓ Grupp-filter sparade:', filters);
}

/**
 * AO-02E: Hämta valda grupper från filter
 */
function getSelectedGroupIds(container) {
    const checkboxes = container.querySelectorAll('.group-filter-checkbox:checked');
    const groupIds = [];
    checkboxes.forEach((cb) => {
        groupIds.push(cb.dataset.group);
    });
    return groupIds;
}

/* ========================================================================
   BLOCK 4: AO-02D — GROUP SHIFTS (WORKING HOURS)
   ======================================================================== */

function renderGroupShiftsSection(state) {
    /* AO-02D: Hämta grupper, pass och kopplingen */
    const groups = state.groups || {};
    const shifts = state.shifts || {};
    const groupShifts = state.groupShifts || {};

    const groupIds = Object.keys(groups).sort();
    const shiftIds = Object.keys(shifts).sort();

    if (groupIds.length === 0 || shiftIds.length === 0) {
        return `
            <div class="alert alert-info">
                <h4>ℹ️ Pass eller grupper saknas</h4>
                <p>Systemet behöver både grupper och pass för att kunna ange arbetstider.</p>
            </div>
        `;
    }

    return `
        <section class="group-shifts-section">
            <h3>⏰ Arbetstider per grupp (Pass)</h3>
            <p class="section-desc">
                Välj vilka pass varje grupp kan jobba. Du kan sedan välja specifikt pass när du planerar.
            </p>

            <div class="shifts-legend">
                <h4>Tillgängliga pass:</h4>
                <div class="shifts-legend-grid">
                    ${shiftIds.map((shiftId) => {
                        const shift = shifts[shiftId];
                        const timeRange = shift.startTime && shift.endTime 
                            ? `${shift.startTime}–${shift.endTime}`
                            : 'Flex (sätts per dag)';
                        return `
                            <div class="shift-legend-item">
                                <span class="shift-color-box" style="background: ${shift.color};"></span>
                                <strong>${shift.shortName}</strong> = ${shift.name} (${timeRange})
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="group-shifts-table-wrapper">
                <table class="group-shifts-table">
                    <thead>
                        <tr>
                            <th>Grupp</th>
                            <th colspan="${shiftIds.length}" class="text-center">Pass (bocka de som gruppen kan jobba)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupIds.map((groupId) => {
                            const group = groups[groupId];
                            const selectedShifts = groupShifts[groupId] || [];

                            return `
                                <tr>
                                    <td class="group-name-cell">
                                        <span class="group-color-dot" style="background: ${group.color}; border-color: ${group.color};"></span>
                                        <strong>${group.name}</strong>
                                    </td>
                                    ${shiftIds.map((shiftId) => {
                                        const shift = shifts[shiftId];
                                        const isSelected = selectedShifts.includes(shiftId);
                                        return `
                                            <td class="text-center shift-checkbox-cell">
                                                <label class="shift-checkbox-label">
                                                    <input 
                                                        type="checkbox" 
                                                        class="shift-checkbox" 
                                                        data-group="${groupId}" 
                                                        data-shift="${shiftId}"
                                                        ${isSelected ? 'checked' : ''}
                                                    >
                                                    <span class="shift-checkbox-visual" style="background: ${shift.color};"></span>
                                                    <span class="shift-checkbox-text">${shift.shortName}</span>
                                                </label>
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <div class="group-shifts-actions">
                <button id="save-group-shifts-btn" class="btn btn-primary">
                    💾 Spara arbetstider
                </button>
                <div id="group-shifts-result" class="group-shifts-result hidden"></div>
            </div>
        </section>
    `;
}

/**
 * AO-02D: Spara grupp-pass-koppling
 */
function handleSaveGroupShifts(store, container, ctx) {
    try {
        /* AO-02D: Samla checkboxar */
        const checkboxes = container.querySelectorAll('.shift-checkbox');
        const groupShifts = {};

        checkboxes.forEach((cb) => {
            const groupId = cb.dataset.group;
            const shiftId = cb.dataset.shift;

            if (!groupShifts[groupId]) {
                groupShifts[groupId] = [];
            }

            if (cb.checked) {
                groupShifts[groupId].push(shiftId);
            }
        });

        /* AO-02D: Validera att varje grupp har minst ett pass */
        const state = store.getState();
        const groups = state.groups || {};
        const errors = [];

        Object.keys(groups).forEach((groupId) => {
            const selectedShifts = groupShifts[groupId] || [];
            if (selectedShifts.length === 0) {
                const group = groups[groupId];
                errors.push(`${group.name} måste ha minst ett pass`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Valideringfel:\n${errors.join('\n')}`);
        }

        /* AO-02D: Spara till store */
        store.update((s) => {
            s.groupShifts = groupShifts;
            s.meta.updatedAt = Date.now();
            return s;
        });

        /* AO-02D: Visa success */
        const resultDiv = container.querySelector('#group-shifts-result');
        resultDiv.innerHTML = `
            <div class="result-box success">
                <h4>✓ Arbetstider sparade!</h4>
                <p>Grupp-pass-koppling uppdaterad.</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');

        setTimeout(() => {
            resultDiv.classList.add('hidden');
        }, 3000);

    } catch (err) {
        console.error('Spara-fel:', err);
        const resultDiv = container.querySelector('#group-shifts-result');
        resultDiv.innerHTML = `
            <div class="result-box error">
                <h4>❌ Fel vid sparning</h4>
                <p>${escapeHtml(err.message.replace(/\n/g, '<br>'))}</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
    }
}

/* ========================================================================
   BLOCK 5: AO-02C — GROUP STAFFING DEMAND
   ======================================================================== */

function renderGroupDemandSection(state) {
    /* AO-02C: Hämta grupper och nuvarande behov */
    const groups = state.groups || {};
    const demand = state.demand || {};
    const groupDemands = demand.groupDemands || {};

    const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
    const groupIds = Object.keys(groups).sort();

    if (groupIds.length === 0) {
        return `
            <div class="alert alert-info">
                <h4>ℹ️ Inga grupper definierade</h4>
                <p>Lägg till personalgrupper först för att kunna sätta bemanningsbehov.</p>
            </div>
        `;
    }

    /* AO-02C: Bygg grupp-behov-tabell */
    const tableHtml = `
        <div class="group-demand-table-wrapper">
            <table class="group-demand-table">
                <thead>
                    <tr>
                        <th>Grupp</th>
                        ${dayNames.map((day) => `<th class="text-center">${day}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${groupIds
                        .map((groupId) => {
                            const group = groups[groupId];
                            const weekdayDemands = groupDemands[groupId] || [0, 0, 0, 0, 0, 0, 0];

                            return `
                                <tr>
                                    <td class="group-name-cell">
                                        <span class="group-color-dot" style="background: ${group.color}; border-color: ${group.color};"></span>
                                        <strong>${group.name}</strong>
                                    </td>
                                    ${dayNames
                                        .map((day, dayIdx) => `
                                        <td class="text-center">
                                            <input 
                                                type="number" 
                                                class="demand-input" 
                                                data-group="${groupId}" 
                                                data-day="${dayIdx}" 
                                                min="0" 
                                                max="20" 
                                                value="${weekdayDemands[dayIdx] || 0}"
                                                placeholder="0"
                                            >
                                        </td>
                                    `)
                                        .join('')}
                                </tr>
                            `;
                        })
                        .join('')}
                </tbody>
            </table>
        </div>
    `;

    return `
        <section class="group-demand-section">
            <h3>📊 Bemanningsbehov per grupp & veckodag</h3>
            <p class="section-desc">
                Ange hur många personer från varje grupp som behövs per veckodag.
            </p>

            ${tableHtml}

            <div class="group-demand-actions">
                <button id="save-group-demands-btn" class="btn btn-primary">
                    💾 Spara behov
                </button>
                <div id="group-demands-result" class="group-demands-result hidden"></div>
            </div>
        </section>
    `;
}

/**
 * AO-02C: Spara grupp-behov
 */
function handleSaveGroupDemands(store, container, ctx) {
    try {
        /* AO-02C: Samla värden från alla inputs */
        const inputs = container.querySelectorAll('.demand-input');
        const groupDemands = {};

        inputs.forEach((input) => {
            const groupId = input.dataset.group;
            const dayIdx = parseInt(input.dataset.day, 10);
            const value = parseInt(input.value, 10) || 0;

            if (!groupDemands[groupId]) {
                groupDemands[groupId] = [0, 0, 0, 0, 0, 0, 0];
            }

            if (value < 0 || value > 20) {
                throw new Error(`Behov för grupp måste vara 0–20, fick ${value}`);
            }

            groupDemands[groupId][dayIdx] = value;
        });

        /* AO-02C: Validera att minst något behov är satt */
        let hasAnyDemand = false;
        Object.values(groupDemands).forEach((weekdays) => {
            if (weekdays.some((val) => val > 0)) {
                hasAnyDemand = true;
            }
        });

        if (!hasAnyDemand) {
            throw new Error('Du måste sätta minst något bemanningsbehov');
        }

        /* AO-02C: Spara till store */
        store.update((state) => {
            if (!state.demand) {
                state.demand = {};
            }
            state.demand.groupDemands = groupDemands;
            state.meta.updatedAt = Date.now();
            return state;
        });

        /* AO-02C: Visa successmeddelande */
        const resultDiv = container.querySelector('#group-demands-result');
        resultDiv.innerHTML = `
            <div class="result-box success">
                <h4>✓ Bemanningsbehov sparade!</h4>
                <p>Grupp-behov uppdaterade för alla veckodagar.</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');

        setTimeout(() => {
            resultDiv.classList.add('hidden');
        }, 3000);

    } catch (err) {
        console.error('Spara-fel:', err);
        const resultDiv = container.querySelector('#group-demands-result');
        resultDiv.innerHTML = `
            <div class="result-box error">
                <h4>❌ Fel vid sparning</h4>
                <p>${escapeHtml(err.message)}</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
    }
}

/* ========================================================================
   BLOCK 6: AO-09 — SCHEDULER (SCHEMA GENERATION)
   ======================================================================== */

function renderSchedulerSection(state) {
    const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
    const selectedMonth = Math.max(1, Math.min(12, currentMonth));

    const monthNames = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
    ];

    const activePeople = state.people.filter((p) => p.isActive).length;

    return `
        <section class="scheduler-section">
            <h3>🤖 Föreslå schema</h3>
            <p class="section-desc">
                Generera ett schemaförslag baserat på bemanningsbehov för de valda grupperna.
                <br>
                <strong>Aktiv personal:</strong> ${activePeople} personer
            </p>

            ${activePeople === 0 ? `
                <div class="alert alert-error">
                    <h4>❌ Ingen aktiv personal</h4>
                    <p>Lägg till minst 1 person i <strong>"Personal"</strong>-vyn innan du genererar schema.</p>
                </div>
            ` : `
                <div class="scheduler-form">
                    <div class="form-group">
                        <label for="scheduler-month">Välj månad:</label>
                        <select id="scheduler-month" class="month-select">
                            ${monthNames.map((name, idx) => `
                                <option value="${idx + 1}" ${idx + 1 === selectedMonth ? 'selected' : ''}>
                                    ${name}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="scheduler-actions">
                        <button id="generate-schedule-btn" class="btn btn-primary">
                            ✨ Föreslå schema
                        </button>
                        <p class="warning-text">
                            ⚠️ Detta kommer att ersätta all A-status för vald månad i valda grupper.
                        </p>
                    </div>

                    <div id="scheduler-result" class="scheduler-result hidden"></div>
                </div>
            `}
        </section>
    `;
}

/**
 * AO-09 + AO-02E: Hantera schemagenering med grupp-filter
 */
function handleGenerateSchedule(store, container, ctx) {
    try {
        const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
        const selectedMonth = Math.max(1, Math.min(12, currentMonth));

        /* AO-02E: Hämta valda grupper från filter */
        const selectedGroupIds = getSelectedGroupIds(container);

        if (selectedGroupIds.length === 0) {
            throw new Error('Du måste välja minst en grupp i filtret för att generera schema');
        }

        console.log('🔄 Genererar schema för månad', selectedMonth, 'grupper:', selectedGroupIds);

        if (!confirm('Är du säker? Detta ersätter all A-status för vald månad i de valda grupperna.')) {
            return;
        }

        const state = store.getState();

        /* AO-02E: Skicka valda grupper till generator */
        let result;
        try {
            result = generate(state, {
                year: 2026,
                month: selectedMonth,
                needByWeekday: [6, 6, 6, 6, 6, 4, 4], // Fallback
                selectedGroupIds, // ← NYT! (AO-02E)
            });
        } catch (genErr) {
            console.error('❌ Generering misslyckades:', genErr);

            const resultDiv = container.querySelector('#scheduler-result');
            resultDiv.innerHTML = `
                <div class="result-box error">
                    <h4>❌ Fel vid generering</h4>
                    <p>${escapeHtml(genErr.message)}</p>
                    <p style="margin-top: 1rem; font-size: 0.9rem; color: #999;">
                        ℹ️ Originalschemat är oförändrat. Försök åtgärda problemet och försök igen.
                    </p>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            return;
        }

        console.log('✓ Schema genererat:', result);

        /* FIRST: Visa resultat */
        const resultDiv = container.querySelector('#scheduler-result');
        const vacancyList = result.vacancies.length > 0
            ? `<ul>${result.vacancies.map((v) => `<li>${v.date}: ${v.needed} behövs</li>`).join('')}</ul>`
            : '<p>Ingen vakans — schemat är fullbokat!</p>';

        const html = `
            <div class="result-box success">
                <h4>✓ Schema genererat!</h4>
                <div class="result-summary">
                    <p><strong>Fyllda slots:</strong> ${result.summary.filledSlots} / ${result.summary.totalSlots}</p>
                    <p><strong>Vakanser:</strong> ${result.summary.vacancyCount}</p>
                    ${result.summary.hasP0Warnings ? '<p style="color: #d32f2f;">⚠️ P0-varningar detekterade</p>' : '<p style="color: #4caf50;">✓ Inga P0-varningar</p>'}
                </div>
                <div class="result-notes">
                    <h5>Anteckningar:</h5>
                    <ul>${result.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
                </div>
                ${result.vacancies.length > 0 ? `
                    <div class="result-vacancies">
                        <h5>Vakanser:</h5>
                        ${vacancyList}
                    </div>
                ` : ''}
            </div>
        `;

        resultDiv.innerHTML = html;
        resultDiv.classList.remove('hidden');

        /* SECOND: Spara till store */
        store.update((s) => {
            result.proposedState.schedule.months.forEach((proposedMonth, idx) => {
                s.schedule.months[idx].days = proposedMonth.days;
            });
            s.meta.updatedAt = Date.now();
            return s;
        });

        console.log('✓ Schema sparat i store');

        /* Uppdatera regler-banner */
        setTimeout(() => {
            renderControl(container, ctx);
        }, 500);

    } catch (err) {
        console.error('Oväntad fel:', err);
        const resultDiv = container.querySelector('#scheduler-result');
        resultDiv.innerHTML = `
            <div class="result-box error">
                <h4>❌ Oväntad fel</h4>
                <p>${escapeHtml(err.message)}</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
    }
}

/* ========================================================================
   BLOCK 7: WARNINGS SECTION
   ======================================================================== */

function renderWarningsSection(result) {
    const warnings = result.warnings || [];

    if (warnings.length === 0) {
        return '';
    }

    const p0Warnings = warnings.filter((w) => w.level === 'P0');
    const p1Warnings = warnings.filter((w) => w.level === 'P1');

    let html = '<div class="control-warnings-section">';

    if (p0Warnings.length > 0) {
        html += `
            <div class="warnings-group p0">
                <h4>🚫 P0-varningar (kritiska)</h4>
                <ul class="warnings-list">
                    ${p0Warnings.slice(0, 10).map((w) => `
                        <li class="warning-item p0">
                            <span class="warning-code">${escapeHtml(w.code)}</span>
                            <span class="warning-text">${escapeHtml(w.message)}</span>
                        </li>
                    `).join('')}
                </ul>
                ${p0Warnings.length > 10 ? `<p style="font-size: 0.9rem; color: #999;">+${p0Warnings.length - 10} till...</p>` : ''}
            </div>
        `;
    }

    if (p1Warnings.length > 0) {
        html += `
            <div class="warnings-group p1">
                <h4>⚠️ P1-varningar (varningar)</h4>
                <ul class="warnings-list">
                    ${p1Warnings.slice(0, 10).map((w) => `
                        <li class="warning-item p1">
                            <span class="warning-code">${escapeHtml(w.code)}</span>
                            <span class="warning-text">${escapeHtml(w.message)}</span>
                        </li>
                    `).join('')}
                </ul>
                ${p1Warnings.length > 10 ? `<p style="font-size: 0.9rem; color: #999;">+${p1Warnings.length - 10} till...</p>` : ''}
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/* ========================================================================
   BLOCK 8: UTILITY FUNCTIONS
   ======================================================================== */

/**
 * Escape HTML för säkerhet
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
