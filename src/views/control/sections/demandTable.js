/*
 * CONTROL SECTION — Bemanningsbehov
 * 
 * Renderar tabell över bemanningsbehov per grupp/pass.
 * Isolerad modul med egen spara-logik.
 */

import { reportError } from '../../../diagnostics.js';
import { showSuccess, showWarning } from '../../../ui.js';

export function renderDemandTableSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas i context');
        }

        const state = store.getState();
        const groups = state.groups || [];
        const passes = state.passes || [];
        const demands = state.demands || [];

        const html = `
            <div class="section-header">
                <h2>👥 Bemanningsbehov</h2>
                <p>Definiera hur många personer som behövs per grupp och pass.</p>
            </div>

            <div class="section-content">
                ${groups.length > 0 && passes.length > 0 ? `
                    <div class="demand-table-wrapper">
                        <table class="demand-table">
                            <thead>
                                <tr>
                                    <th>Grupp</th>
                                    ${passes.map(pass => `<th>${pass.name}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${groups.map(group => `
                                    <tr>
                                        <td class="demand-group-name">${group.name}</td>
                                        ${passes.map(pass => {
                                            const demandKey = \`\${group.id}_\${pass.id}\`;
                                            const currentDemand = demands.find(d => d.key === demandKey);
                                            const value = currentDemand?.count || 0;
                                            
                                            return \`
                                                <td>
                                                    <input 
                                                        type="number" 
                                                        class="demand-input" 
                                                        data-group-id="\${group.id}"
                                                        data-pass-id="\${pass.id}"
                                                        data-demand-key="\${demandKey}"
                                                        value="\${value}"
                                                        min="0"
                                                        max="99"
                                                    >
                                                </td>
                                            \`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="demand-actions">
                        <button id="demand-save-btn" class="btn btn-primary">
                            💾 Spara bemanningsbehov
                        </button>
                        <button id="demand-reset-btn" class="btn btn-secondary">
                            🔄 Återställ
                        </button>
                    </div>

                    <div id="demand-status" class="demand-status"></div>
                ` : `
                    <div class="empty-state">
                        ${groups.length === 0 ? 'Inga grupper skapade ännu.' : ''}
                        ${passes.length === 0 ? 'Inga grundpass skapade ännu.' : ''}
                        <br>
                        Gå till <a href="#/groups">Grupper</a> för att skapa grupper och grundpass.
                    </div>
                `}
            </div>
        `;

        container.innerHTML = html;

        // Setup event listeners
        setupDemandListeners(container, ctx);

    } catch (err) {
        console.error('❌ Fel i renderDemandTableSection:', err);
        throw err;
    }
}

/**
 * Setup event listeners för bemanningsbehov
 */
function setupDemandListeners(container, ctx) {
    try {
        const saveBtn = container.querySelector('#demand-save-btn');
        const resetBtn = container.querySelector('#demand-reset-btn');
        const statusDiv = container.querySelector('#demand-status');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                saveDemands(container, ctx, statusDiv);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                resetDemands(container, ctx);
            });
        }

    } catch (err) {
        console.error('❌ Fel vid setup av demand listeners:', err);
        throw err;
    }
}

/**
 * Spara bemanningsbehov till store
 */
function saveDemands(container, ctx, statusDiv) {
    try {
        console.log('💾 Sparar bemanningsbehov...');

        const inputs = container.querySelectorAll('.demand-input');
        const newDemands = [];

        // Samla alla demand-värden
        inputs.forEach(input => {
            const groupId = input.dataset.groupId;
            const passId = input.dataset.passId;
            const demandKey = input.dataset.demandKey;
            const count = parseInt(input.value, 10) || 0;

            // Validera värde
            if (count < 0 || count > 99) {
                throw new Error(`Ogiltigt värde för ${demandKey}: ${count}`);
            }

            // Lägg till demand endast om count > 0
            if (count > 0) {
                newDemands.push({
                    key: demandKey,
                    groupId: groupId,
                    passId: passId,
                    count: count,
                    lastUpdated: new Date().toISOString()
                });
            }
        });

        // Uppdatera store
        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas');
        }

        const state = store.getState();
        store.setState({
            ...state,
            demands: newDemands
        });

        console.log('✓ Bemanningsbehov sparade:', newDemands);

        // Visa success-meddelande
        showSuccess('✓ Bemanningsbehov sparade');

        // Visa status (kort, utan data)
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="status-message status-success">
                    ✓ ${newDemands.length} bemanningsbehov sparade
                </div>
            `;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        }

    } catch (err) {
        console.error('❌ Fel vid sparning av bemanningsbehov:', err);

        // Rapportera via Diagnostics (säker feltext)
        reportError(
            'DEMAND_SAVE_ERROR',
            'CONTROL_SECTION',
            'control/sections/demandTable.js',
            `Ett fel uppstod vid sparning av bemanningsbehov: ${err.message || 'Okänt fel'}`
        );

        // Visa error-meddelande
        showWarning('⚠️ Kunde inte spara bemanningsbehov');

        // Visa status
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="status-message status-error">
                    ⚠️ Ett fel uppstod vid sparning
                </div>
            `;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 5000);
        }
    }
}

/**
 * Återställ alla demand-värden
 */
function resetDemands(container, ctx) {
    try {
        console.log('🔄 Återställer bemanningsbehov...');

        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas');
        }

        const state = store.getState();
        const demands = state.demands || [];

        // Återställ alla input-värden
        const inputs = container.querySelectorAll('.demand-input');
        inputs.forEach(input => {
            const demandKey = input.dataset.demandKey;
            const currentDemand = demands.find(d => d.key === demandKey);
            const value = currentDemand?.count || 0;
            input.value = value;
        });

        console.log('✓ Bemanningsbehov återställda');
        showSuccess('✓ Bemanningsbehov återställda');

    } catch (err) {
        console.error('❌ Fel vid återställning av bemanningsbehov:', err);
        showWarning('⚠️ Kunde inte återställa bemanningsbehov');
    }
}
