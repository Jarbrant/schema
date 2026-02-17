/*
 * CONTROL SECTION — Bemanningsbehov (AO-05 PATCHAD)
 *
 * Renderar tabell: grupper (rader) × grundpass (kolumner) → antal per dag.
 *
 * AO-05 FIX:
 *   - state.groups är Object/Map → Object.values()
 *   - state.passes FINNS INTE → heter state.shifts (Object/Map)
 *   - state.demands FINNS INTE → heter state.demand.groupDemands (Object/Map)
 *   - Spara till state.demand.groupDemands istället för state.demands
 *
 * Store-shape:
 *   state.groups       = { [id]: { id, name, color, textColor } }
 *   state.shifts       = { [id]: { id, name, shortName, ... } }
 *   state.groupShifts  = { [groupId]: [shiftId, ...] }
 *   state.demand       = { groupDemands: { [groupId]: [7 numbers] }, weekdayTemplate: [...] }
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

        // AO-05: Object/Map → Array för iteration
        const groups = Object.values(state.groups || {});
        const shifts = Object.values(state.shifts || {});
        const groupDemands = state.demand?.groupDemands || {};

        // Build HTML safely
        const headerDiv = document.createElement('div');
        headerDiv.className = 'section-header';

        const h2 = document.createElement('h2');
        h2.textContent = '👥 Bemanningsbehov per veckodag';

        const p = document.createElement('p');
        p.textContent = 'Definiera hur många personer som behövs per grupp och veckodag (mån–sön).';

        headerDiv.appendChild(h2);
        headerDiv.appendChild(p);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'section-content';

        if (groups.length > 0) {
            const weekdays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

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

            weekdays.forEach(day => {
                const dayHeader = document.createElement('th');
                dayHeader.textContent = day;
                tr.appendChild(dayHeader);
            });

            thead.appendChild(tr);
            table.appendChild(thead);

            // Table body — en rad per grupp, 7 kolumner (mån–sön)
            const tbody = document.createElement('tbody');

            groups.forEach(group => {
                const bodyRow = document.createElement('tr');

                const groupCell = document.createElement('td');
                groupCell.className = 'demand-group-name';

                // Visa färg-badge + namn
                const badge = document.createElement('span');
                badge.className = 'color-badge';
                badge.style.background = group.color || '#777';
                groupCell.appendChild(badge);

                const nameSpan = document.createElement('span');
                nameSpan.textContent = ' ' + (group.name || 'Grupp');
                groupCell.appendChild(nameSpan);

                bodyRow.appendChild(groupCell);

                // 7 dagar (mån–sön)
                const demands = Array.isArray(groupDemands[group.id])
                    ? groupDemands[group.id]
                    : [0, 0, 0, 0, 0, 0, 0];

                for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                    const demandCell = document.createElement('td');

                    const input = document.createElement('input');
                    input.type = 'number';
                    input.className = 'demand-input';
                    input.dataset.groupId = group.id;
                    input.dataset.dayIndex = dayIdx;
                    input.value = demands[dayIdx] || 0;
                    input.min = '0';
                    input.max = '50';

                    demandCell.appendChild(input);
                    bodyRow.appendChild(demandCell);
                }

                tbody.appendChild(bodyRow);
            });

            table.appendChild(tbody);
            tableWrapper.appendChild(table);
            contentDiv.appendChild(tableWrapper);

            // Grundpass-info
            if (shifts.length > 0) {
                const shiftInfo = document.createElement('div');
                shiftInfo.className = 'demand-shift-info';
                shiftInfo.innerHTML = `
                    <p style="color:#999; font-size:0.85rem; margin-top:0.5rem;">
                        💡 Registrerade grundpass: ${shifts.map(s => s.name).join(', ')}
                    </p>
                `;
                contentDiv.appendChild(shiftInfo);
            }

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
            emptyDiv.textContent = 'Inga grupper skapade ännu. Gå till Grupper för att skapa dem.';
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

/**
 * AO-05: Spara till state.demand.groupDemands (Object/Map)
 * Shape: { [groupId]: [antal_mån, antal_tis, ..., antal_sön] }
 */
function saveDemands(container, ctx, statusDiv) {
    try {
        console.log('💾 Sparar bemanningsbehov...');

        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas');
        }

        const inputs = container.querySelectorAll('.demand-input');

        // Bygg groupDemands-map
        const newGroupDemands = {};

        inputs.forEach(input => {
            const groupId = input.dataset.groupId;
            const dayIndex = parseInt(input.dataset.dayIndex, 10);
            const count = parseInt(input.value, 10) || 0;

            if (count < 0 || count > 50) {
                throw new Error(`Ogiltigt värde för ${groupId} dag ${dayIndex}: ${count}`);
            }

            if (!newGroupDemands[groupId]) {
                newGroupDemands[groupId] = [0, 0, 0, 0, 0, 0, 0];
            }
            newGroupDemands[groupId][dayIndex] = count;
        });

        // AO-05: Spara till rätt plats i store
        store.update((s) => {
            if (!s.demand || typeof s.demand !== 'object') {
                s.demand = { groupDemands: {}, weekdayTemplate: [] };
            }
            // Merga in — behåll grupper som inte är i tabellen
            Object.keys(newGroupDemands).forEach(gid => {
                s.demand.groupDemands[gid] = newGroupDemands[gid];
            });
        });

        const savedCount = Object.keys(newGroupDemands).length;
        console.log(`✓ Bemanningsbehov sparade för ${savedCount} grupper`);
        showSuccess(`✓ Bemanningsbehov sparade för ${savedCount} grupper`);

        if (statusDiv) {
            while (statusDiv.firstChild) statusDiv.removeChild(statusDiv.firstChild);

            const msg = document.createElement('div');
            msg.className = 'status-message status-success';
            msg.textContent = `✓ Bemanningsbehov sparade för ${savedCount} grupper`;
            statusDiv.appendChild(msg);

            setTimeout(() => {
                while (statusDiv.firstChild) statusDiv.removeChild(statusDiv.firstChild);
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
            while (statusDiv.firstChild) statusDiv.removeChild(statusDiv.firstChild);

            const msg = document.createElement('div');
            msg.className = 'status-message status-error';
            msg.textContent = '⚠️ Ett fel uppstod vid sparning';
            statusDiv.appendChild(msg);

            setTimeout(() => {
                while (statusDiv.firstChild) statusDiv.removeChild(statusDiv.firstChild);
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
        const groupDemands = state.demand?.groupDemands || {};

        const inputs = container.querySelectorAll('.demand-input');
        inputs.forEach(input => {
            const groupId = input.dataset.groupId;
            const dayIndex = parseInt(input.dataset.dayIndex, 10);
            const demands = Array.isArray(groupDemands[groupId])
                ? groupDemands[groupId]
                : [0, 0, 0, 0, 0, 0, 0];
            input.value = demands[dayIndex] || 0;
        });

        console.log('✓ Bemanningsbehov återställda');
        showSuccess('✓ Bemanningsbehov återställda');

    } catch (err) {
        console.error('❌ Fel vid återställning:', err);
        showWarning('⚠️ Kunde inte återställa bemanningsbehov');
    }
}
