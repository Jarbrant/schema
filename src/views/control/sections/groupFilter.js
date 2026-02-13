/*
 * CONTROL SECTION — Grupp-filter
 * 
 * Låter användaren välja vilka grupper som ska visas.
 */

import { reportError } from '../../../diagnostics.js';

export function renderGroupFilterSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas i context');
        }

        const state = store.getState();
        const groups = state.groups || [];
        const selectedGroups = ctx?.selectedGroups || [];

        const html = `
            <div class="section-header">
                <h2>🔍 Grupp-filter</h2>
                <p>Välj vilka grupper du vill arbeta med. Dessa val påverkar schemaläggninga och visningen.</p>
            </div>

            <div class="section-content">
                <div class="filter-buttons">
                    <button class="filter-btn filter-all" data-action="select-all">
                        Välj alla
                    </button>
                    <button class="filter-btn filter-none" data-action="select-none">
                        Välj ingen
                    </button>
                </div>

                ${groups.length > 0 ? `
                    <div class="group-filter-list">
                        ${groups.map(group => `
                            <div class="filter-item">
                                <input 
                                    type="checkbox" 
                                    id="group-${group.id}" 
                                    class="group-checkbox"
                                    data-group-id="${group.id}"
                                    ${selectedGroups.includes(group.id) ? 'checked' : ''}
                                >
                                <label for="group-${group.id}">
                                    <span class="group-name">${group.name}</span>
                                    <span class="group-count">${group.members?.length || 0} personer</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        Inga grupper skapade ännu. Gå till <a href="#/groups">Grupper</a> för att skapa en.
                    </div>
                `}
            </div>
        `;

        container.innerHTML = html;

        // Setup event listeners
        setupGroupFilterListeners(container, ctx);

    } catch (err) {
        console.error('❌ Fel i renderGroupFilterSection:', err);
        throw err;
    }
}

/**
 * Setup event listeners för grupp-filtret
 */
function setupGroupFilterListeners(container, ctx) {
    try {
        // Checkboxes
        const checkboxes = container.querySelectorAll('.group-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const groupId = e.target.dataset.groupId;
                const isChecked = e.target.checked;

                // Uppdatera context
                ctx.selectedGroups = ctx.selectedGroups || [];
                if (isChecked && !ctx.selectedGroups.includes(groupId)) {
                    ctx.selectedGroups.push(groupId);
                } else if (!isChecked) {
                    ctx.selectedGroups = ctx.selectedGroups.filter(id => id !== groupId);
                }

                console.log('✓ Grupp-filter uppdaterat:', ctx.selectedGroups);
            });
        });

        // Select All button
        const selectAllBtn = container.querySelector('[data-action="select-all"]');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const state = ctx?.store?.getState();
                const groups = state?.groups || [];
                ctx.selectedGroups = groups.map(g => g.id);
                
                checkboxes.forEach(cb => cb.checked = true);
                console.log('✓ Alla grupper valda');
            });
        }

        // Select None button
        const selectNoneBtn = container.querySelector('[data-action="select-none"]');
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => {
                ctx.selectedGroups = [];
                checkboxes.forEach(cb => cb.checked = false);
                console.log('✓ Ingen grupp vald');
            });
        }

    } catch (err) {
        console.error('❌ Fel vid setup av grupp-filter listeners:', err);
        throw err;
    }
}
