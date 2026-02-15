/*
 * AO-02 — CONTROL PAGE (UPPDATERAD för AO-05)
 * 
 * Container-sida som komponerar flera sektioner.
 * Registrerar modul-healthcheck via Diagnostics.
 * 
 * Sektioner:
 * 1. Grupp-filter
 * 2. Grupp-skift
 * 3. Bemanningsbehov
 * 4. Schemagenerator
 * 
 * FAS 3.2: Kostnadswidget tillagd
 */

import { reportError, diagnostics } from '../diagnostics.js';
import { calculateTotalMonthlyCost, calculateCostPerGroup, formatCurrency } from '../lib/cost-utils.js';

// Import sections
import { renderGroupFilterSection } from './control/sections/groupFilter.js';
import { renderGroupShiftsSection } from './control/sections/groupShifts.js';
import { renderDemandTableSection } from './control/sections/demandTable.js';
import { renderScheduleGeneratorSection } from './control/sections/scheduleGenerator.js';

export function renderControl(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const currentTab = ctx?.controlTab || 'control';
    
    // Calculate costs for active people
    const activePeople = (state.people || []).filter(p => p.isActive);
    const totalCosts = calculateTotalMonthlyCost(activePeople);

    const html = `
        <div class="control-container">
            <div class="control-content">
                <h1>Kontroll & Schemaläggning</h1>
                <p class="control-tagline">
                    Validera schema, hantera bemanningsbehov och generera automatiska scheman
                </p>

                <!-- Status Row with Cost Widget -->
                <div class="control-status">
                    <div class="status-item">
                        <span class="status-label">Schemalägd personal:</span>
                        <span class="status-value">${state.shifts?.length || 0}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Grupper:</span>
                        <span class="status-value">${state.groups?.length || 0}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Grundpass:</span>
                        <span class="status-value">${state.passes?.length || 0}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Bemanningsbehov:</span>
                        <span class="status-value">${state.demands?.length || 0}</span>
                    </div>
                    <div class="status-item cost-widget">
                        <span class="status-label">💰 Total Månadskostnad:</span>
                        <span class="status-value cost-value">${formatCurrency(totalCosts.totalCost)}</span>
                        <span class="cost-breakdown">
                            Lön: ${formatCurrency(totalCosts.totalSalary)} + 
                            Arb.avg: ${formatCurrency(totalCosts.totalEmployerTax)}
                        </span>
                    </div>
                </div>

                <!-- Tab Navigation -->
                <div class="control-tabs">
                    <button class="control-tab ${currentTab === 'control' ? 'active' : ''}" data-tab="control">
                        ✓ Kontroll
                    </button>
                    <button class="control-tab ${currentTab === 'scheduling' ? 'active' : ''}" data-tab="scheduling">
                        📅 Schemaläggning
                    </button>
                </div>

                <!-- TAB 1: KONTROLL -->
                ${currentTab === 'control' ? `
                    <div class="control-sections">
                        <!-- Group Filter Section -->
                        <div id="section-group-filter" class="control-section"></div>

                        <!-- Group Shifts Section -->
                        <div id="section-group-shifts" class="control-section"></div>
                    </div>
                ` : ''}

                <!-- TAB 2: SCHEMALÄGGNING -->
                ${currentTab === 'scheduling' ? `
                    <div class="control-sections">
                        <!-- Demand Table Section -->
                        <div id="section-demand-table" class="control-section"></div>

                        <!-- Schedule Generator Section -->
                        <div id="section-schedule-generator" class="control-section"></div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Setup tab switching
    setupTabListeners(container, ctx);

    // Render sections based on active tab
    renderAllSections(container, ctx, currentTab);
}

/**
 * Setup tab switching listeners
 */
function setupTabListeners(container, ctx) {
    const tabs = container.querySelectorAll('.control-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update context
            ctx.controlTab = tabName;
            
            // Re-render the view
            renderControl(container, ctx);
        });
    });
}

/**
 * Render alla sektioner med error-handling + healthcheck
 */
function renderAllSections(container, ctx, currentTab) {
    // Define sections for each tab
    const controlSections = [
        {
            id: 'section-group-filter',
            name: 'Grupp-filter',
            moduleId: 'control.groupFilter',
            render: renderGroupFilterSection,
            file: 'groupFilter.js'
        },
        {
            id: 'section-group-shifts',
            name: 'Grupp-skift',
            moduleId: 'control.groupShifts',
            render: renderGroupShiftsSection,
            file: 'groupShifts.js'
        }
    ];

    const schedulingSections = [
        {
            id: 'section-demand-table',
            name: 'Bemanningsbehov',
            moduleId: 'control.demandTable',
            render: renderDemandTableSection,
            file: 'demandTable.js'
        },
        {
            id: 'section-schedule-generator',
            name: 'Schemagenerator',
            moduleId: 'control.scheduleGenerator',
            render: renderScheduleGeneratorSection,
            file: 'scheduleGenerator.js'
        }
    ];

    // Select sections based on current tab
    const sections = currentTab === 'control' ? controlSections : schedulingSections;

    sections.forEach(section => {
        const sectionContainer = container.querySelector(`#${section.id}`);
        if (!sectionContainer) {
            console.error(`❌ Sektion-container saknas: ${section.id}`);
            return;
        }

        try {
            // Register module start (healthcheck)
            diagnostics.moduleStart(
                section.moduleId,
                `src/views/control/sections/${section.file}`
            );

            console.log(`🔄 Renderar sektion: ${section.name}`);
            section.render(sectionContainer, ctx);

            // Mark module as OK (healthcheck)
            diagnostics.moduleOk(section.moduleId);

        } catch (err) {
            console.error(`❌ Fel i sektion ${section.name}:`, err);

            // Mark module as failed (healthcheck)
            diagnostics.moduleFail(section.moduleId, err);
            
            // Rapportera via Diagnostics
            reportError(
                `CONTROL_SECTION_ERROR_${section.name.toUpperCase()}`,
                'CONTROL_PAGE',
                `control/sections/${section.file}`,
                `Ett fel uppstod i ${section.name}-sektionen: ${err.message || 'Okänt fel'}`
            );

            // Visa error i sektionen
            sectionContainer.innerHTML = `
                <div class="section-error">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">
                        <strong>Fel i modul:</strong> ${section.name}<br>
                        <small>${err.message || 'Ett okänt fel uppstod'}</small>
                    </div>
                </div>
            `;
        }
    });
}
