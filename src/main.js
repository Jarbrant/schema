/*
 * MAIN.JS — Entry point for Schema-Program
 * 
 * Denna fil startas från index.html:
 * <script type="module" src="src/main.js"></script>
 * 
 * Den initialiserar:
 * 1. App-state (store)
 * 2. Router
 * 3. UI-elements
 */

import { initRouter } from './router.js';
import { createStore } from './app.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialiserar Schema-Program...');
    
    // 1. Create app store (state management)
    const store = createStore({
        user: null,
        people: [],
        shifts: [],
        groups: [],
        passes: [],
        schedule: {
            year: new Date().getFullYear()
        },
        meta: {
            appVersion: '1.0.0',
            appName: 'Schema-Program'
        }
    });
    
    console.log('✓ Store skapad');
    
    // 2. Get DOM elements
    const appContainer = document.getElementById('app-container');
    const errorPanel = document.getElementById('error-panel');
    
    if (!appContainer) {
        console.error('❌ app-container saknas i index.html!');
        return;
    }
    
    console.log('✓ DOM-element hittade');
    
    // 3. Create app context (passar till alla views)
    const appCtx = {
        store: store,
        currentRoute: null,
        shiftTab: 'schedule',
        groupsTab: 'groups'
    };
    
    console.log('✓ App-context skapad');
    
    // 4. Initialize router
    console.log('🔄 Initialiserar router...');
    initRouter(appContainer, errorPanel, appCtx);
    
    console.log('✅ Schema-Program initialiserad!');
});
