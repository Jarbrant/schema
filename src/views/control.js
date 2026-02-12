/*
 * AO-09 + AO-22: CONTROL: Kontroll & Schemaläggning
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

            <!-- AO-09: Schemaläggnings-panel -->
            ${renderSchedulerSection(state)}

            <!-- Varnings-detaljer -->
            ${renderWarningsSection(rulesResult)}
        </div>
    `;

    container.innerHTML = html;

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
 * AO-09: Rendera schemaläggnings-panel
 */
function renderSchedulerSection(state) {
    const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
    const selectedMonth = Math.max(1, Math.min(12, currentMonth));

    const monthNames = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
    ];

    return `
        <section class="scheduler-section">
            <h3>🤖 Föreslå schema</h3>
            <p class="section-desc">
                Generera ett schemaförslag baserat på bemanningsbehov per veckodag.
            </p>

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

                <div class="need-inputs">
                    <h4>Bemanningsbehov per veckodag (antal A):</h4>
                    <div class="need-grid">
                        ${['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
                            .map((day, idx) => `
                            <div class="need-input-group">
                                <label for="need-${idx}">${day}:</label>
                                <input 
                                    type="number" 
                                    id="need-${idx}" 
                                    class="need-input"
                                    min="0"
                                    max="20"
                                    value="${idx < 5 ? '6' : '4'}"
                                    placeholder="0"
                                >
                            </div>
                        `).join('')}
                    </div>
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
        </section>
    `;
}

/**
 * AO-09: Hantera schemagenering
 */
function handleGenerateSchedule(store, container, ctx) {
    try {
        const currentMonth = parseInt(sessionStorage.getItem('AO22_selectedMonth') || String(new Date().getMonth() + 1), 10);
        const selectedMonth = Math.max(1, Math.min(12, currentMonth));

        // Samla behov från inputs
        const needByWeekday = [];
        for (let i = 0; i < 7; i++) {
            const input = container.querySelector(`#need-${i}`);
            const value = parseInt(input.value, 10) || 0;
            needByWeekday.push(value);
        }

        console.log('🔄 Genererar schema för månad', selectedMonth, 'med behov:', needByWeekday);

        if (!confirm('Är du säker? Detta ersätter all A-status för vald månad.')) {
            return;
        }

        const state = store.getState();
        const result = generate(state, {
            year: 2026,
            month: selectedMonth,
            needByWeekday,
        });

        console.log('✓ Schema genererat:', result);

        // Spara förslaget
        store.update((s) => {
            // Kopiera över entries från proposedState
            result.proposedState.schedule.months.forEach((proposedMonth, idx) => {
                s.schedule.months[idx].days = proposedMonth.days;
            });
            s.meta.updatedAt = Date.now();
            return s;
        });

        // Visa resultat
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
                    <ul>${result.notes.map((note) => `<li>${note}</li>`).join('')}</ul>
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

        // Uppdatera regler-banner
        setTimeout(() => {
            renderControl(container, ctx);
        }, 500);

    } catch (err) {
        console.error('Schemagenerings-fel', err);
        const resultDiv = container.querySelector('#scheduler-result');
        resultDiv.innerHTML = `
            <div class="result-box error">
                <h4>❌ Fel vid generering</h4>
                <p>${err.message}</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
    }
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
                            <span class="warning-code">${w.code}</span>
                            <span class="warning-text">${w.message}</span>
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
                            <span class="warning-code">${w.code}</span>
                            <span class="warning-text">${w.message}</span>
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
