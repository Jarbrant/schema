/*
 * MAIN.JS — Entry point for Schema-Program
 * 
 * Denna fil startas från index.html:
 * <script type="module" src="src/main.js"></script>
 * 
 * Initialiserar:
 * 1. Diagnostics (global error handling)
 * 2. Store (state management)
 * 3. Router (navigation)
 * 4. App context
 */

import { initRouter } from './router.js';
import { createStore } from './app.js';
import { diagnostics } from './diagnostics.js';
import { renderError } from './ui.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialiserar Schema-Program...');
    
    try {
        // 1. Initialize diagnostics (setup global error hooks)
        console.log('✓ Diagnostics-system initialiserat');
        
        // Subscribe to error reports and show in error panel
        diagnostics.subscribe((report) => {
            const errorPanel = document.getElementById('error-panel');
            if (errorPanel) {
                renderError(errorPanel, report);
            }
        });
        
        // 2. Create app store (state management)
        const store = createStore({
            user: null,
            isLoggedIn: false,
            people: [],
            shifts: [],
            groups: [],
            passes: [],
            demands: [],  // NY: Bemanningsbehov
            schedule: {
                year: new Date().getFullYear(),
                startDate: null,
                endDate: null
            },
            meta: {
                appVersion: '1.0.0',
                appName: 'Schema-Program'
            }
        });
        
        console.log('✓ Store skapad');
        
        // 3. Get DOM elements
        const appContainer = document.getElementById('app-container');
        const errorPanel = document.getElementById('error-panel');
        
        if (!appContainer) {
            console.error('❌ app-container saknas i index.html!');
            throw new Error('app-container element not found');
        }
        
        if (!errorPanel) {
            console.warn('⚠️ error-panel saknas i index.html (valfritt)');
        }
        
        console.log('✓ DOM-element hittade');
        
        // 4. Create app context (passar till alla views)
        const appCtx = {
            store: store,
            currentRoute: null,
            shiftTab: 'schedule',
            groupsTab: 'groups',
            selectedGroups: [],  // För grupp-filterering
            diagnostics: diagnostics
        };
        
        console.log('✓ App-context skapad');
        
        // 5. Initialize router
        console.log('🔄 Initialiserar router...');
        initRouter(appContainer, errorPanel, appCtx);
        
        console.log('✅ Schema-Program initialiserad!');
        console.log('💡 Tips: Lägg till ?debug=1 i URL:en för debug-läge');
        
    } catch (err) {
        console.error('❌ KRITISKT FEL vid app-initialisering:', err);
        
        const report = diagnostics.report({
            code: 'APP_INITIALIZATION_FAILED',
            where: 'MAIN.JS',
            fileHint: 'src/main.js',
            detailsSafe: 'Appen kunde inte startas. Försök ladda om sidan.'
        });
        
        const errorPanel = document.getElementById('error-panel');
        if (errorPanel) {
            renderError(errorPanel, report);
        } else {
            // Fallback om error-panel inte finns
            console.error('FALLBACK: Error-panel saknas. Visar error i console endast.');
        }
    }
});
