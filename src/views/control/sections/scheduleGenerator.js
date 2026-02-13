/*
 * CONTROL SECTION — Schemagenerator
 * 
 * Genererar automatiskt schema baserat på:
 * - Läge: Månad eller Period
 * - Bemanningsbehov
 * - Gruppinställningar
 */

import { generateSchedule, MONTHS, getAvailableYears } from '../../../scheduler.js';
import { showSuccess, showWarning } from '../../../ui.js';
import { reportError } from '../../../diagnostics.js';

export function renderScheduleGeneratorSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas i context');
        }

        const state = store.getState();
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const years = getAvailableYears(currentYear);

        const html = `
            <div class="section-header">
                <h2>⚙️ Schemagenerator</h2>
                <p>Generera automatisk schema baserat på bemanningsbehov och grupper.</p>
            </div>

            <div class="section-content">
                <!-- Mode Selection -->
                <div class="generator-mode-selector">
                    <label>
                        <input type="radio" name="generator-mode" value="month" checked>
                        📅 Månad
                    </label>
                    <label>
                        <input type="radio" name="generator-mode" value="period">
                        📍 Period (Från–Till)
                    </label>
                </div>

                <!-- Mode: Month -->
                <div id="mode-month" class="generator-mode-content">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="gen-month-year">År</label>
                            <select id="gen-month-year" class="generator-input" data-field="year">
                                ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="gen-month-month">Månad</label>
                            <select id="gen-month-month" class="generator-input" data-field="month">
                                ${MONTHS.map(m => `<option value="${m.value}" ${m.value === currentMonth ? 'selected' : ''}>${m.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Mode: Period -->
                <div id="mode-period" class="generator-mode-content" style="display: none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="gen-period-from">Från datum</label>
                            <input 
                                type="date" 
                                id="gen-period-from" 
                                class="generator-input" 
                                data-field="fromDate"
                            >
                        </div>
                        <div class="form-group">
                            <label for="gen-period-to">Till datum</label>
                            <input 
                                type="date" 
                                id="gen-period-to" 
                                class="generator-input" 
                                data-field="toDate"
                            >
                        </div>
                    </div>
                    <div class="form-group">
                        <small class="form-hint">Max 93 dagar per period</small>
                    </div>
                </div>

                <!-- Validation Message -->
                <div id="gen-validation" class="gen-validation"></div>

                <!-- Generate Button -->
                <div class="generator-actions">
                    <button id="gen-generate-btn" class="btn btn-primary">
                        ⚙️ Föreslå schema
                    </button>
                    <button id="gen-clear-btn" class="btn btn-secondary">
                        🗑️ Rensa förslag
                    </button>
                </div>

                <!-- Result -->
                <div id="gen-result" class="gen-result"></div>
            </div>
        `;

        container.innerHTML = html;

        // Setup event listeners
        setupGeneratorListeners(container, ctx);

    } catch (err) {
        console.error('❌ Fel i renderScheduleGeneratorSection:', err);
        throw err;
    }
}

/**
 * Setup event listeners för schemagenerator
 */
function setupGeneratorListeners(container, ctx) {
    try {
        const modeRadios = container.querySelectorAll('input[name="generator-mode"]');
        const modeMonth = container.querySelector('#mode-month');
        const modePeriod = container.querySelector('#mode-period');
        const generateBtn = container.querySelector('#gen-generate-btn');
        const clearBtn = container.querySelector('#gen-clear-btn');
        const validationDiv = container.querySelector('#gen-validation');
        const inputs = container.querySelectorAll('.generator-input');

        // Mode switching
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const mode = e.target.value;
                modeMonth.style.display = mode === 'month' ? 'block' : 'none';
                modePeriod.style.display = mode === 'period' ? 'block' : 'none';
                validationDiv.innerHTML = '';
                console.log(`✓ Generator mode ändrad till: ${mode}`);
            });
        });

        // Input validation on change
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                validateInputs(container);
            });
        });

        // Generate button
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                generateSchemaClick(container, ctx, validationDiv);
            });
        }

        // Clear button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                clearGenerationResult(container);
            });
        }

    } catch (err) {
        console.error('❌ Fel vid setup av generator listeners:', err);
        throw err;
    }
}

/**
 * Validera inputs och uppdatera UI
 */
function validateInputs(container) {
    try {
        const mode = container.querySelector('input[name="generator-mode"]:checked').value;
        const generateBtn = container.querySelector('#gen-generate-btn');
        const validationDiv = container.querySelector('#gen-validation');

        let isValid = true;
        let errorMsg = '';

        if (mode === 'period') {
            const fromInput = container.querySelector('#gen-period-from');
            const toInput = container.querySelector('#gen-period-to');
            const fromDate = fromInput?.value;
            const toDate = toInput?.value;

            if (fromDate && toDate) {
                const from = new Date(fromDate);
                const to = new Date(toDate);
                const daysDiff = Math.ceil((to - from) / (1000 * 60 * 60 * 24));

                if (to < from) {
                    isValid = false;
                    errorMsg = '❌ Till-datum måste vara efter från-datum';
                } else if (daysDiff > 93) {
                    isValid = false;
                    errorMsg = `❌ Period kan max vara 93 dagar (du valde ${daysDiff} dagar)`;
                }
            }
        }

        // Uppdatera knapp-state
        if (generateBtn) {
            generateBtn.disabled = !isValid;
            generateBtn.style.opacity = isValid ? '1' : '0.5';
            generateBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }

        // Visa validerings-meddelande
        if (errorMsg) {
            validationDiv.innerHTML = `<div class="validation-error">${errorMsg}</div>`;
        } else {
            validationDiv.innerHTML = '';
        }

    } catch (err) {
        console.error('❌ Fel vid validering:', err);
    }
}

/**
 * Generera schema (klick på knapp)
 */
function generateSchemaClick(container, ctx, validationDiv) {
    try {
        console.log('⚙️ Genererar schema...');

        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas');
        }

        const state = store.getState();
        const mode = container.querySelector('input[name="generator-mode"]:checked').value;

        let params = {
            mode,
            groups: state.groups || [],
            passes: state.passes || [],
            demands: state.demands || [],
            people: state.people || []
        };

        if (mode === 'month') {
            params.year = parseInt(container.querySelector('#gen-month-year').value, 10);
            params.month = parseInt(container.querySelector('#gen-month-month').value, 10);
        } else {
            params.fromDate = container.querySelector('#gen-period-from').value;
            params.toDate = container.querySelector('#gen-period-to').value;
        }

        // Generera schema
        const result = generateSchedule(params);

        if (result.success) {
            console.log('✓ Schema genererat:', result.shifts.length, 'skift');
            
            // Spara genererade shifts till state (som förslag, inte permanent ännu)
            store.setState({
                ...state,
                generatedShifts: result.shifts,
                lastGenerationParams: params
            });

            showSuccess(result.message);

            // Visa resultat
            displayGenerationResult(container, result);

        } else {
            console.error('❌ Schemagenerering misslyckades:', result.errors);
            showWarning(result.errors[0] || 'Schemagenerering misslyckades');
            
            validationDiv.innerHTML = `
                <div class="validation-error">
                    ❌ ${result.errors[0] || 'Ett okänt fel uppstod'}
                </div>
            `;
        }

    } catch (err) {
        console.error('❌ Kritiskt fel vid schemagenerering:', err);
        reportError(
            'SCHEDULE_GENERATION_CRITICAL_ERROR',
            'SCHEDULE_GENERATOR_SECTION',
            'control/sections/scheduleGenerator.js',
            err.message || 'Schemagenerering misslyckades'
        );
        showWarning('⚠️ Ett kritiskt fel uppstod vid schemagenerering');
    }
}

/**
 * Visa genererings-resultat
 */
function displayGenerationResult(container, result) {
    const resultDiv = container.querySelector('#gen-result');
    
    const html = `
        <div class="gen-result-box">
            <div class="result-header">
                <h3>✓ Schema genererat</h3>
                <p>${result.message}</p>
            </div>
            <div class="result-body">
                <p>Det genererade schemat är sparat som förslag.</p>
                <p><strong>Nästa steg:</strong> Granska schemat i Shifts-sektionen innan du bekräftar.</p>
            </div>
        </div>
    `;

    resultDiv.innerHTML = html;
}

/**
 * Rensa genererings-resultat
 */
function clearGenerationResult(container) {
    try {
        const store = ctx?.store;
        if (store) {
            const state = store.getState();
            store.setState({
                ...state,
                generatedShifts: [],
                lastGenerationParams: null
            });
        }

        const resultDiv = container.querySelector('#gen-result');
        resultDiv.innerHTML = '';
        
        showSuccess('✓ Genererade förslag rensade');
    } catch (err) {
        console.error('❌ Fel vid rensning:', err);
    }
}
