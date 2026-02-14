/*
 * MAIN.JS — Entry point for Schema-Program
 * 
 * Denna fil startas från index.html:
 * <script type="module" src="src/main.js"></script>
 * 
 * Initialiserar:
 * 1. Diagnostics (global error handling)
 * 2. Store (state management with localStorage)
 * 3. Router (navigation)
 * 4. App context
 * 
 * State structure:
 * - Authentication: user, isLoggedIn
 * - Data: people, shifts, groups, passes, demands, generatedShifts
 * - Schedule: year, startDate, endDate
 * - Metadata: appVersion, appName
 */

import { initRouter } from './router.js';
import { getStore } from './store.js';  // Use Store with localStorage support
import { diagnostics } from './diagnostics.js';
import { renderError } from './ui.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialiserar Schema-Program...');
    
    try {
        // 1. Initialize diagnostics (setup global error hooks)
        diagnostics.init();
        console.log('✓ Diagnostics-system initialiserat');
        
        // Subscribe to error reports and show in error panel
        diagnostics.subscribe((report) => {
            const errorPanel = document.getElementById('error-panel');
            if (errorPanel) {
                renderError(errorPanel, report);
            }
        });
        
        // 2. Get store instance (with localStorage support)
        const store = getStore();
        
        console.log('✓ Store skapad');
        console.log('✓ Initial state:', store.getState());
        
        // 3. Get DOM elements
        const appContainer = document.getElementById('app-container');
        const errorPanel = document.getElementById('error-panel');
        
        if (!appContainer) {
            console.error('❌ app-container saknas i index.html!');
            throw new Error('app-container element not found');
        }
        
        if (!errorPanel) {
            console.warn('⚠️ error-panel saknas i index.html (valfritt element)');
        }
        
        console.log('✓ DOM-element hittade');
        
        // 4. Create app context (passar till alla views & modules)
        const appCtx = {
            // Store reference
            store: store,
            
            // Routing
            currentRoute: null,
            
            // View-specific tabs/modes
            shiftTab: 'schedule',        // 'schedule' eller 'validation'
            groupsTab: 'groups',         // 'groups' eller 'passes'
            controlTab: 'control',       // 'control' eller 'scheduling'
            
            // Filtering
            selectedGroups: [],          // För grupp-filterering i Control
            
            // Diagnostics reference
            diagnostics: diagnostics
        };
        
        console.log('✓ App-context skapad');
        
        // 5. Initialize router
        console.log('🔄 Initialiserar router...');
        initRouter(appContainer, errorPanel, appCtx);
        
        console.log('✓ Router initialiserad');
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
            console.error('Error details:', report.getPublicMessage());
        }
    }
});
