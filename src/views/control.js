/*
 * AO-02C + AO-02D + AO-02E + AO-09: CONTROL: Grupp-filter, Pass, Behov, Schemaläggning (AUTOPATCH v1.2)
 * FIL: control.js (HEL FIL)
 *
 * ÄNDRINGSLOGG (≤8)
 * 1) P0: Slopar hårdkodad år-check (=2026) → använder state.schedule.year (fixar att kontrollen “saknas” när store default-år är dynamiskt).
 * 2) P0: XSS-safe rendering: ingen innerHTML med osanitiserade fel; escapeHtml används konsekvent (inkl. vacancies-listan).
 * 3) P0: Filter/persistens robust: safeParseJSON för sessionStorage; “Välj ingen”-text fixad; default = alla valda om inget sparat.
 * 4) P0: Scheduler save fix: sparar bara vald månad (index = selectedMonth-1) istället för att loopa alla månader och blanda.
 * 5) P0: Guardrails: om shifts/groupShifts/demand saknas → visar info och disable:ar save/generate (fail-closed istället för tyst fel).
 * 6) P1: handleSaveGroupShifts: validerar endast valda grupper (filter) om filter finns; annars alla grupper (mindre “false errors”).
 * 7) P1: handleSaveGroupDemands: fyller saknade grupper med 0-array och normaliserar input; max = 20 behålls.
 * 8) P2: Småbuggar: “Välja ingen” → “Välj ingen”; monthSelect value sparas som string men parseas säkert.
 *
 * BUGGSÖK (hittade & patchade)
 * - BUGG: renderControl blockerar om year != 2026 (krock med autopatchad store som kan skapa nuvarande år).
 * - BUGG: Scheduler save: loopar proposedState.schedule.months och skriver days in i alla months → kan skriva fel månad.
 * - BUGG: Vacancy list renderar osanitiserat datum/needed i HTML.
 * - BUGG: sessionStorage JSON.parse kan kasta och döda render.
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
    const scheduleYear = state?.schedule?.year;

    if (!state.schedule || typeof scheduleYear !== 'number') {
        container.innerHTML =
            '<div class="view-container"><h2>Kontroll</h2><p class="error-text">Schedule saknas. Kan inte visa kontroll.</p></div>';
        return;
    }

    /* Vald månad (1–12) */
    const selectedMonth = getSelectedMonth();

    /* Evaluer reglerna för aktuell månad */
    let rulesResult;
    try {
        rulesResult = evaluate(state, { year: scheduleYear, month: selectedMonth });
    } catch (err) {
        console.error('Regelkontroll-fel', err);
        rulesResult = { warnings: [], statsByPerson: {} };
    }

    const html = `
        <div class="view-container control-container">
            <h2>Kontroll & Schemaläggning</h2>

            <!-- Regel-varnings-banner -->
            ${renderRulesBanner(rulesResult)}

            <!-- AO-02E: Grupp-filter -->
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
    container.querySelectorAll('.group-filter-checkbox').forEach((cb) => {
        cb.addEventListener('change', () => {
            saveGroupFilterSelections(container);
            // Re-render inte här (dyrt). Bara spara.
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
            sessionStorage.setItem('AO22_selectedMonth', String(e.target.value));
            renderControl(container, ctx);
        });
    }
}

/* ========================================================================
   BLOCK 2: RULE WARNINGS BANNER
   ======================================================================== */

function renderRulesBanner(result) {
    const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
    const p0Count = warnings.filter((w) => w.level === 'P0').length;
    const p1Count = warnings.filter((w) => w.level === 'P1').length;

    if (p0Count === 0 && p1Count === 0) {
        return '<div class="rules-banner ok">✓ Inga regelbrott denna period</div>';
    }

    let banner = '<div class="rules-banner warning">';
    if (p0Count > 0) banner += `<span class="banner-item p0">P0: ${p0Count}</span>`;
    if (p1Count > 0) banner += `<span class="banner-item p1">P1: ${p1Count}</span>`;
    banner += '</div>';

    return banner;
}

/* ========================================================================
   BLOCK 3: AO-02E — GROUP FILTER
   ======================================================================== */

function renderGroupFilterSection(state) {
    const groups = state.groups || {};
    const groupIds = Object.keys(groups).sort();
    const savedFilters = loadGroupFiltersSafe();

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
                <button id="filter-select-all-btn" class="btn btn-sm btn-secondary" type="button">Välj alla</button>
                <button id="filter-select-none-btn" class="btn btn-sm btn-secondary" type="button">Välj ingen</button>
            </div>

            <div class="group-filter-checkboxes">
                ${groupIds
                    .map((groupId) => {
                        const group = groups[groupId];
                        const isChecked = savedFilters[groupId] !== false; // default true
                        const color = typeof group?.color === 'string' ? group.color : '#777';
                        const name = escapeHtml(group?.name ?? groupId);

                        return `
                            <label class="group-filter-checkbox-label">
                                <input
                                    type="checkbox"
                                    class="group-filter-checkbox"
                                    data-group="${escapeHtml(groupId)}"
                                    ${isChecked ? 'checked' : ''}
                                >
                                <span class="filter-color-dot" style="background: ${escapeHtml(color)}; border-color: ${escapeHtml(color)};"></span>
                                <span>${name}</span>
                            </label>
                        `;
                    })
                    .join('')}
            </div>
        </section>
    `;
}

function saveGroupFilterSelections(container) {
    const checkboxes = container.querySelectorAll('.group-filter-checkbox');
    const filters = {};

    checkboxes.forEach((cb) => {
        const groupId = cb.dataset.group;
        filters[groupId] = !!cb.checked;
    });

    sessionStorage.setItem('AO02E_groupFilters', JSON.stringify(filters));
    console.log('✓ Grupp-filter sparade:', filters);
}

function getSelectedGroupIds(container) {
    const checkboxes = container.querySelectorAll('.group-filter-checkbox:checked');
    const groupIds = [];
    checkboxes.forEach((cb) => groupIds.push(cb.dataset.group));
    return groupIds;
}

function loadGroupFiltersSafe() {
    const raw = sessionStorage.getItem('AO02E_groupFilters');
    if (!raw) return {};
    const parsed = safeParseJSON(raw);
    if (!parsed.ok || typeof parsed.value !== 'object' || parsed.value === null) return {};
    return parsed.value;
}

/* ========================================================================
   BLOCK 4: AO-02D — GROUP SHIFTS (WORKING HOURS)
   ======================================================================== */

function renderGroupShiftsSection(state) {
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
                    ${shiftIds
                        .map((shiftId) => {
                            const shift = shifts[shiftId];
                            const timeRange =
                                shift?.startTime && shift?.endTime ? `${escapeHtml(shift.startTime)}–${escapeHtml(shift.endTime)}` : 'Flex (sätts per dag)';
                            const color = typeof shift?.color === 'string' ? shift.color : '#777';
                            const shortName = escapeHtml(shift?.shortName ?? '');
                            const name = escapeHtml(shift?.name ?? shiftId);

                            return `
                                <div class="shift-legend-item">
                                    <span class="shift-color-box" style="background: ${escapeHtml(color)};"></span>
                                    <strong>${shortName}</strong> = ${name} (${timeRange})
                                </div>
                            `;
                        })
                        .join('')}
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
                        ${groupIds
                            .map((groupId) => {
                                const group = groups[groupId];
                                const selectedShifts = Array.isArray(groupShifts[groupId]) ? groupShifts[groupId] : [];

                                const groupColor = typeof group?.color === 'string' ? group.color : '#777';
                                const groupName = escapeHtml(group?.name ?? groupId);

                                return `
                                    <tr>
                                        <td class="group-name-cell">
                                            <span class="group-color-dot" style="background: ${escapeHtml(groupColor)}; border-color: ${escapeHtml(groupColor)};"></span>
                                            <strong>${groupName}</strong>
                                        </td>
                                        ${shiftIds
                                            .map((shiftId) => {
                                                const shift = shifts[shiftId];
                                                const isSelected = selectedShifts.includes(shiftId);
                                                const shiftColor = typeof shift?.color === 'string' ? shift.color : '#777';
                                                const shortName = escapeHtml(shift?.shortName ?? '');

                                                return `
                                                    <td class="text-center shift-checkbox-cell">
                                                        <label class="shift-checkbox-label">
                                                            <input
                                                                type="checkbox"
                                                                class="shift-checkbox"
                                                                data-group="${escapeHtml(groupId)}"
                                                                data-shift="${escapeHtml(shiftId)}"
                                                                ${isSelected ? 'checked' : ''}
                                                            >
                                                            <span class="shift-checkbox-visual" style="background: ${escapeHtml(shiftColor)};"></span>
                                                            <span class="shift-checkbox-text">${shortName}</span>
                                                        </label>
                                                    </td>
                                                `;
                                            })
                                            .join('')}
                                    </tr>
                                `;
                            })
                            .join('')}
                    </tbody>
                </table>
            </div>

            <div class="group-shifts-actions">
                <button id="save-group-shifts-btn" class="btn btn-primary" type="button">
                    💾 Spara arbetstider
                </button>
                <div id="group-shifts-result" class="group-shifts-result hidden"></div>
            </div>
        </section>
    `;
}

function handleSaveGroupShifts(store, container, ctx) {
    try {
        const checkboxes = container.querySelectorAll('.shift-checkbox');
        const groupShifts = {};

        checkboxes.forEach((cb) => {
            const groupId = cb.dataset.group;
            const shiftId = cb.dataset.shift;

            if (!groupShifts[groupId]) groupShifts[groupId] = [];
            if (cb.checked) groupShifts[groupId].push(shiftId);
        });

        const state = store.getState();
        const groups = state.groups || {};
        const selectedGroupIds = getSelectedGroupIds(container);
        const validateGroupIds = selectedGroupIds.length > 0 ? selectedGroupIds : Object.keys(groups);

        const errors = [];
        validateGroupIds.forEach((groupId) => {
            const selected = groupShifts[groupId] || [];
            if (selected.length === 0) {
                const group = groups[groupId];
                errors.push(`${group?.name ?? groupId} måste ha minst ett pass`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Valideringfel:\n${errors.join('\n')}`);
        }

        store.update((s) => {
            s.groupShifts = groupShifts;
            s.meta.updatedAt = Date.now();
            return s;
        });

        const resultDiv = container.querySelector('#group-shifts-result');
        resultDiv.innerHTML = `
            <div class="result-box success">
                <h4>✓ Arbetstider sparade!</h4>
                <p>Grupp-pass-koppling uppdaterad.</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');

        setTimeout(() => resultDiv.classList.add('hidden'), 3000);
    } catch (err) {
        console.error('Spara-fel:', err);
        const resultDiv = container.querySelector('#group-shifts-result');
        if (!resultDiv) return;

        // XSS-safe: vi bygger HTML men escape:ar text och använder <br> explicit.
        const msg = escapeHtml(String(err.message || 'Okänt fel')).replace(/\n/g, '<br>');
        resultDiv.innerHTML = `
            <div class="result-box error">
                <h4>❌ Fel vid sparning</h4>
                <p>${msg}</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
    }
}

/* ========================================================================
   BLOCK 5: AO-02C — GROUP STAFFING DEMAND
   ======================================================================== */

function renderGroupDemandSection(state) {
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
                            const weekdayDemands = Array.isArray(groupDemands[groupId]) ? groupDemands[groupId] : [0, 0, 0, 0, 0, 0, 0];

                            const groupColor = typeof group?.color === 'string' ? group.color : '#777';
                            const groupName = escapeHtml(group?.name ?? groupId);

                            return `
                                <tr>
                                    <td class="group-name-cell">
                                        <span class="group-color-dot" style="background: ${escapeHtml(groupColor)}; border-color: ${escapeHtml(groupColor)};"></span>
                                        <strong>${groupName}</strong>
                                    </td>
                                    ${dayNames
                                        .map((_, dayIdx) => `
                                            <td class="text-center">
                                                <input
                                                    type="number"
                                                    class="demand-input"
                                                    data-group="${escapeHtml(groupId)}"
                                                    data-day="${dayIdx}"
                                                    min="0"
                                                    max="20"
                                                    value="${Number.isFinite(Number(weekdayDemands[dayIdx])) ? Number(weekdayDemands[dayIdx]) : 0}"
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
                <button id="save-group-demands-btn" class="btn btn-primary" type="button">
                    💾 Spara behov
                </button>
                <div id="group-demands-result" class="group-demands-result hidden"></div>
            </div>
        </section>
    `;
}

function handleSaveGroupDemands(store, container, ctx) {
    try {
        const inputs = container.querySelectorAll('.demand-input');
        const groupDemands = {};

        inputs.forEach((input) => {
            const groupId = input.dataset.group;
            const dayIdx = parseInt(input.dataset.day, 10);
            const value = toIntSafe(input.value, 0);

            if (!groupDemands[groupId]) groupDemands[groupId] = [0, 0, 0, 0, 0, 0, 0];

            if (value < 0 || value > 20) {
                throw new Error(`Behov för grupp måste vara 0–20, fick ${value}`);
            }

            groupDemands[groupId][dayIdx] = value;
        });

        // Fyll grupper utan inputs (om UI ändras senare)
        const stateNow = store.getState();
        const groups = stateNow.groups || {};
        Object.keys(groups).forEach((gid) => {
            if (!groupDemands[gid]) groupDemands[gid] = [0, 0, 0, 0, 0, 0, 0];
        });

        let hasAnyDemand = false;
        Object.values(groupDemands).forEach((weekdays) => {
            if (Array.isArray(weekdays) && weekdays.some((val) => val > 0)) hasAnyDemand = true;
        });

        if (!hasAnyDemand) {
            throw new Error('Du måste sätta minst något bemanningsbehov');
        }

        store.update((state) => {
            if (!state.demand) state.demand = {};
            state.demand.groupDemands = groupDemands;
            state.meta.updatedAt = Date.now();
            return state;
        });

        const resultDiv = container.querySelector('#group-demands-result');
        resultDiv.innerHTML = `
            <div class="result-box success">
                <h4>✓ Bemanningsbehov sparade!</h4>
                <p>Grupp-behov uppdaterade för alla veckodagar.</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');

        setTimeout(() => resultDiv.classList.add('hidden'), 3000);
    } catch (err) {
        console.error('Spara-fel:', err);
        const resultDiv = container.querySelector('#group-demands-result');
        if (!resultDiv) return;

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
    const selectedMonth = getSelectedMonth();

    const monthNames = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
    ];

    const people = Array.isArray(state.people) ? state.people : [];
    const activePeople = people.filter((p) => p && p.isActive).length;

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
                            ${monthNames
                                .map((name, idx) => `
                                    <option value="${idx + 1}" ${idx + 1 === selectedMonth ? 'selected' : ''}>
                                        ${name}
                                    </option>
                                `)
                                .join('')}
                        </select>
                    </div>

                    <div class="scheduler-actions">
                        <button id="generate-schedule-btn" class="btn btn-primary" type="button">
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

function handleGenerateSchedule(store, container, ctx) {
    const resultDiv = container.querySelector('#scheduler-result');

    try {
        const selectedMonth = getSelectedMonth();
        const selectedGroupIds = getSelectedGroupIds(container);

        if (selectedGroupIds.length === 0) {
            throw new Error('Du måste välja minst en grupp i filtret för att generera schema');
        }

        const state = store.getState();
        const scheduleYear = state?.schedule?.year;
        if (typeof scheduleYear !== 'number') {
            throw new Error('Schedule.year saknas — kan inte generera schema');
        }

        console.log('🔄 Genererar schema för', scheduleYear, 'månad', selectedMonth, 'grupper:', selectedGroupIds);

        if (!confirm('Är du säker? Detta ersätter all A-status för vald månad i de valda grupperna.')) {
            return;
        }

        let result;
        try {
            result = generate(state, {
                year: scheduleYear,
                month: selectedMonth,
                needByWeekday: [6, 6, 6, 6, 6, 4, 4], // fallback
                selectedGroupIds,
            });
        } catch (genErr) {
            console.error('❌ Generering misslyckades:', genErr);
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="result-box error">
                        <h4>❌ Fel vid generering</h4>
                        <p>${escapeHtml(genErr.message)}</p>
                        <p style="margin-top: 1rem; font-size: 0.9rem; color: #999;">
                            ℹ️ Originalschemat är oförändrat. Åtgärda problemet och försök igen.
                        </p>
                    </div>
                `;
                resultDiv.classList.remove('hidden');
            }
            return;
        }

        console.log('✓ Schema genererat:', result);

        // XSS-safe vacancies list
        const vacancies = Array.isArray(result?.vacancies) ? result.vacancies : [];
        const vacancyList =
            vacancies.length > 0
                ? `<ul>${vacancies
                      .map((v) => `<li>${escapeHtml(String(v?.date ?? 'okänt datum'))}: ${escapeHtml(String(v?.needed ?? '?'))} behövs</li>`)
                      .join('')}</ul>`
                : '<p>Ingen vakans — schemat är fullbokat!</p>';

        const notes = Array.isArray(result?.notes) ? result.notes : [];
        const summary = result?.summary || {};

        const html = `
            <div class="result-box success">
                <h4>✓ Schema genererat!</h4>
                <div class="result-summary">
                    <p><strong>Fyllda slots:</strong> ${escapeHtml(String(summary.filledSlots ?? '?'))} / ${escapeHtml(String(summary.totalSlots ?? '?'))}</p>
                    <p><strong>Vakanser:</strong> ${escapeHtml(String(summary.vacancyCount ?? vacancies.length))}</p>
                    ${summary.hasP0Warnings ? '<p style="color: #d32f2f;">⚠️ P0-varningar detekterade</p>' : '<p style="color: #4caf50;">✓ Inga P0-varningar</p>'}
                </div>
                <div class="result-notes">
                    <h5>Anteckningar:</h5>
                    <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
                </div>
                ${vacancies.length > 0 ? `
                    <div class="result-vacancies">
                        <h5>Vakanser:</h5>
                        ${vacancyList}
                    </div>
                ` : ''}
            </div>
        `;

        if (resultDiv) {
            resultDiv.innerHTML = html;
            resultDiv.classList.remove('hidden');
        }

        // P0: Spara endast vald månad (inte alla)
        store.update((s) => {
            const mIdx = selectedMonth - 1;

            if (!s.schedule || !Array.isArray(s.schedule.months) || !s.schedule.months[mIdx]) {
                throw new Error('Schedule saknar vald månad — kan inte spara');
            }

            const proposedMonths = result?.proposedState?.schedule?.months;
            if (!Array.isArray(proposedMonths) || !proposedMonths[mIdx] || !Array.isArray(proposedMonths[mIdx].days)) {
                throw new Error('Generatorn returnerade ingen giltig proposedState för vald månad');
            }

            s.schedule.months[mIdx].days = proposedMonths[mIdx].days;
            s.meta.updatedAt = Date.now();
            return s;
        });

        console.log('✓ Schema sparat i store (endast vald månad)');

        setTimeout(() => {
            renderControl(container, ctx);
        }, 300);
    } catch (err) {
        console.error('Oväntad fel:', err);
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="result-box error">
                    <h4>❌ Oväntad fel</h4>
                    <p>${escapeHtml(err.message)}</p>
                </div>
            `;
            resultDiv.classList.remove('hidden');
        }
    }
}

/* ========================================================================
   BLOCK 7: WARNINGS SECTION
   ======================================================================== */

function renderWarningsSection(result) {
    const warnings = Array.isArray(result?.warnings) ? result.warnings : [];

    if (warnings.length === 0) return '';

    const p0Warnings = warnings.filter((w) => w.level === 'P0');
    const p1Warnings = warnings.filter((w) => w.level === 'P1');

    let html = '<div class="control-warnings-section">';

    if (p0Warnings.length > 0) {
        html += `
            <div class="warnings-group p0">
                <h4>🚫 P0-varningar (kritiska)</h4>
                <ul class="warnings-list">
                    ${p0Warnings
                        .slice(0, 10)
                        .map((w) => `
                            <li class="warning-item p0">
                                <span class="warning-code">${escapeHtml(w.code)}</span>
                                <span class="warning-text">${escapeHtml(w.message)}</span>
                            </li>
                        `)
                        .join('')}
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
                    ${p1Warnings
                        .slice(0, 10)
                        .map((w) => `
                            <li class="warning-item p1">
                                <span class="warning-code">${escapeHtml(w.code)}</span>
                                <span class="warning-text">${escapeHtml(w.message)}</span>
                            </li>
                        `)
                        .join('')}
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

function safeParseJSON(str) {
    try {
        return { ok: true, value: JSON.parse(str) };
    } catch (e) {
        return { ok: false, error: e?.message || 'Okänt JSON-fel' };
    }
}

function toIntSafe(v, fallback = 0) {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
}

function getSelectedMonth() {
    const raw = sessionStorage.getItem('AO22_selectedMonth');
    const parsed = raw ? toIntSafe(raw, new Date().getMonth() + 1) : new Date().getMonth() + 1;
    return Math.max(1, Math.min(12, parsed));
}
