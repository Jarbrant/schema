/*
 * AO-02C + AO-09: CONTROL: Kontroll & Grupp-baserat bemanningsbehov
 * /* AO-02C */ marks group demand UI changes
 */

import { evaluate } from '../rules.js';
import { generate } from '../scheduler/engine.js';

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

            <!-- AO-02C: Grupp-baserat bemanningsbehov (nytt!) -->
            ${renderGroupDemandSection(state)}

            <!-- AO-09: Schemaläggnings-panel -->
            ${renderSchedulerSection(state)}

            <!-- Varnings-detaljer -->
            ${renderWarningsSection(rulesResult)}
        </div>
    `;

    container.innerHTML = html;

    /* AO-02C: Event listeners för grupp-behov */
    const saveDemandBtn = container.querySelector('#save-group-demands-btn');
    if (saveDemandBtn) {
        saveDemandBtn.addEventListener('click', () => {
            handleSaveGroupDemands(store, container, ctx);
        });
    }

    // AO-09 Event listeners
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

/**
 * Rendera regel-varnings-banner
 */
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

/**
 * AO-02C: Rendera grupp-baserat bemanningsbehov
 */
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

        // Dölj efter 3 sekunder
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

/**
 * AO-09: Rendera schemaläggnings-panel
 */
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
                Generera ett schemaförslag baserat på bemanningsbehov per veckodag.
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
                            ⚠️ Detta kommer att ersätta all A-status för vald månad.
                        </p>
                    </div>

                    <div id="scheduler-result" class="scheduler-result hidden"></div>
                </div>
            `}
        </section>
    `;
}

/**
 * AO-09: Hantera schemagenering med FAIL-CLOSED
 */
function handleGenerateSchedule(store, container, ctx) {
    try {
        const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
        const selectedMonth = Math.max(1, Math.min(12, currentMonth));

        console.log('🔄 Genererar schema för månad', selectedMonth);

        if (!confirm('Är du säker? Detta ersätter all A-status för vald månad. Originaldata kan inte återställas.')) {
            return;
        }

        const state = store.getState();

        // AO-02A: Försöka generera INNAN något ändras
        let result;
        try {
            result = generate(state, {
                year: 2026,
                month: selectedMonth,
                needByWeekday: [6, 6, 6, 6, 6, 4, 4], // Fallback (kommer från grupp-behov senare)
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

        // FIRST: Visa resultat
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

        // SECOND: Spara till store (EFTER validering passerad)
        store.update((s) => {
            result.proposedState.schedule.months.forEach((proposedMonth, idx) => {
                s.schedule.months[idx].days = proposedMonth.days;
            });
            s.meta.updatedAt = Date.now();
            return s;
        });

        console.log('✓ Schema sparat i store');

        // Uppdatera regler-banner
        setTimeout(() => {
            renderControl(container, ctx);
        }, 500);

    } catch (err) {
        console.error('Oväntad fel i handleGenerateSchedule:', err);
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

/**
 * Rendera varnings-detaljer
 */
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
