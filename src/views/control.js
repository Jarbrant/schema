/*
 * AO-02 — CONTROL PAGE
 * 
 * Container-sida som komponerar flera sektioner.
 * Varje sektion är modulär och kan failas oberoende.
 * 
 * Sektioner:
 * 1. Grupp-filter
 * 2. Grupp-skift
 * 3. Bemanningsbehov
 * 4. Schemagenerator (NY - AO-04)
 */

import { reportError } from '../diagnostics.js';

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

    const html = `
        <div class="control-container">
            <div class="control-content">
                <h1>Kontroll & Schemaläggning</h1>
                <p class="control-tagline">
                    Validera schema, hantera bemanningsbehov och generera automatiska scheman
                </p>

                <!-- Status Row -->
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
                </div>

                <!-- Sections Container -->
                <div class="control-sections">
                    <!-- Group Filter Section -->
                    <div id="section-group-filter" class="control-section"></div>

                    <!-- Group Shifts Section -->
                    <div id="section-group-shifts" class="control-section"></div>

                    <!-- Demand Table Section -->
                    <div id="section-demand-table" class="control-section"></div>

                    <!-- Schedule Generator Section (NY) -->
                    <div id="section-schedule-generator" class="control-section"></div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Render all sections with error handling
    renderAllSections(container, ctx);
}

/**
 * Render alla sektioner med error-handling
 */
function renderAllSections(container, ctx) {
    const sections = [
        {
            id: 'section-group-filter',
            name: 'Grupp-filter',
            render: renderGroupFilterSection,
            file: 'groupFilter.js'
        },
        {
            id: 'section-group-shifts',
            name: 'Grupp-skift',
            render: renderGroupShiftsSection,
            file: 'groupShifts.js'
        },
        {
            id: 'section-demand-table',
            name: 'Bemanningsbehov',
            render: renderDemandTableSection,
            file: 'demandTable.js'
        },
        {
            id: 'section-schedule-generator',
            name: 'Schemagenerator',
            render: renderScheduleGeneratorSection,
            file: 'scheduleGenerator.js'
        }
    ];

    sections.forEach(section => {
        const sectionContainer = container.querySelector(`#${section.id}`);
        if (!sectionContainer) {
            console.error(`❌ Sektion-container saknas: ${section.id}`);
            return;
        }

        try {
            console.log(`🔄 Renderar sektion: ${section.name}`);
            section.render(sectionContainer, ctx);
        } catch (err) {
            console.error(`❌ Fel i sektion ${section.name}:`, err);
            
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
