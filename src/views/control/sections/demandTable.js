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

        // Build HTML safely
        const headerDiv = document.createElement('div');
        headerDiv.className = 'section-header';

        const h2 = document.createElement('h2');
        h2.textContent = '👥 Bemanningsbehov';

        const p = document.createElement('p');
        p.textContent = 'Definiera hur många personer som behövs per grupp och pass.';

        headerDiv.appendChild(h2);
        headerDiv.appendChild(p);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'section-content';

        if (groups.length > 0 && passes.length > 0) {
            // Build table
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'demand-table-wrapper';

            const table = document.createElement('table');
            table.className = 'demand-table';

            // Table head
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');

            const th = document.createElement('th');
            th.textContent = 'Grupp';
            tr.appendChild(th);

            passes.forEach(pass => {
                const passHeader = document.createElement('th');
                passHeader.textContent = pass.name || 'Pass';
                tr.appendChild(passHeader);
            });

            thead.appendChild(tr);
            table.appendChild(thead);

            // Table body
            const tbody = document.createElement('tbody');

            groups.forEach(group => {
                const bodyRow = document.createElement('tr');

                const groupCell = document.createElement('td');
                groupCell.className = 'demand-group-name';
                groupCell.textContent = group.name || 'Grupp';
                bodyRow.appendChild(groupCell);

                passes.forEach(pass => {
                    const demandKey = `${group.id}_${pass.id}`;
                    const currentDemand = demands.find(d => d.key === demandKey);
                    const value = currentDemand?.count || 0;

                    const demandCell = document.createElement('td');

                    const input = document.createElement('input');
                    input.type = 'number';
                    input.className = 'demand-input';
                    input.dataset.groupId = group.id;
                    input.dataset.passId = pass.id;
                    input.dataset.demandKey = demandKey;
                    input.value = value;
                    input.min = '0';
                    input.max = '99';

                    demandCell.appendChild(input);
                    bodyRow.appendChild(demandCell);
                });

                tbody.appendChild(bodyRow);
            });

            table.appendChild(tbody);
            tableWrapper.appendChild(table);
            contentDiv.appendChild(tableWrapper);

            // Action buttons
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'demand-actions';

            const saveBtn = document.createElement('button');
            saveBtn.id = 'demand-save-btn';
            saveBtn.className = 'btn btn-primary';
            saveBtn.textContent = '💾 Spara bemanningsbehov';

            const resetBtn = document.createElement('button');
            resetBtn.id = 'demand-reset-btn';
            resetBtn.className = 'btn btn-secondary';
            resetBtn.textContent = '🔄 Återställ';

            actionsDiv.appendChild(saveBtn);
            actionsDiv.appendChild(resetBtn);
            contentDiv.appendChild(actionsDiv);

            // Status div
            const statusDiv = document.createElement('div');
            statusDiv.id = 'demand-status';
            statusDiv.className = 'demand-status';
            contentDiv.appendChild(statusDiv);

        } else {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';
            emptyDiv.textContent = 'Inga grupper eller grundpass skapade ännu. Gå till Grupper för att skapa dem.';
            contentDiv.appendChild(emptyDiv);
        }

        container.appendChild(headerDiv);
        container.appendChild(contentDiv);

        // Setup listeners
        setupDemandListeners(container, ctx);

    } catch (err) {
        console.error('❌ Fel i renderDemandTableSection:', err);
        throw err;
    }
}

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

function saveDemands(container, ctx, statusDiv) {
    try {
        console.log('💾 Sparar bemanningsbehov...');

        const inputs = container.querySelectorAll('.demand-input');
        const newDemands = [];

        inputs.forEach(input => {
            const groupId = input.dataset.groupId;
            const passId = input.dataset.passId;
            const demandKey = input.dataset.demandKey;
            const count = parseInt(input.value, 10) || 0;

            if (count < 0 || count > 99) {
                throw new Error(`Ogiltigt värde för ${demandKey}: ${count}`);
            }

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
        showSuccess('✓ Bemanningsbehov sparade');

        if (statusDiv) {
            while (statusDiv.firstChild) {
                statusDiv.removeChild(statusDiv.firstChild);
            }

            const msg = document.createElement('div');
            msg.className = 'status-message status-success';
            msg.textContent = `✓ ${newDemands.length} bemanningsbehov sparade`;

            statusDiv.appendChild(msg);

            setTimeout(() => {
                while (statusDiv.firstChild) {
                    statusDiv.removeChild(statusDiv.firstChild);
                }
            }, 3000);
        }

    } catch (err) {
        console.error('❌ Fel vid sparning av bemanningsbehov:', err);

        reportError(
            'DEMAND_SAVE_ERROR',
            'CONTROL_SECTION',
            'control/sections/demandTable.js',
            `Ett fel uppstod vid sparning: ${err.message}`
        );

        showWarning('⚠️ Kunde inte spara bemanningsbehov');

        if (statusDiv) {
            while (statusDiv.firstChild) {
                statusDiv.removeChild(statusDiv.firstChild);
            }

            const msg = document.createElement('div');
            msg.className = 'status-message status-error';
            msg.textContent = '⚠️ Ett fel uppstod vid sparning';

            statusDiv.appendChild(msg);

            setTimeout(() => {
                while (statusDiv.firstChild) {
                    statusDiv.removeChild(statusDiv.firstChild);
                }
            }, 5000);
        }
    }
}

function resetDemands(container, ctx) {
    try {
        console.log('🔄 Återställer bemanningsbehov...');

        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas');
        }

        const state = store.getState();
        const demands = state.demands || [];

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
        console.error('❌ Fel vid återställning:', err);
        showWarning('⚠️ Kunde inte återställa bemanningsbehov');
    }
}
