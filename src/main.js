/*
 * MAIN.JS — Entry point for Schema-Program
 * 
 * Denna fil startas från index.html:
 * <script type="module" src="src/main.js"></script>
 */

import { initRouter } from './router.js';
import { createStore } from './app.js';
import { diagnostics } from './diagnostics.js';

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
                renderDiagnosticError(errorPanel, report);
            }
        });
        
        // 2. Create app store (state management)
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
        
        // 3. Get DOM elements
        const appContainer = document.getElementById('app-container');
        const errorPanel = document.getElementById('error-panel');
        
        if (!appContainer) {
            console.error('❌ app-container saknas i index.html!');
            return;
        }
        
        console.log('✓ DOM-element hittade');
        
        // 4. Create app context (passar till alla views)
        const appCtx = {
            store: store,
            currentRoute: null,
            shiftTab: 'schedule',
            groupsTab: 'groups',
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
            renderDiagnosticError(errorPanel, report);
        }
    }
});

/**
 * Render diagnostic error säkert i error-panel
 */
function renderDiagnosticError(container, report) {
    const publicMsg = report.getPublicMessage();
    const debugMsg = report.getDebugMessage();
    
    const html = `
        <div class="error-panel-content">
            <div class="error-header">
                <span class="error-icon">⚠️</span>
                <h3>Ett fel uppstod</h3>
            </div>
            
            <div class="error-details">
                <div class="error-code">
                    <strong>Kod:</strong> ${publicMsg.code}
                </div>
                <div class="error-where">
                    <strong>Modul:</strong> ${publicMsg.where}
                </div>
                <div class="error-message">
                    <strong>Meddelande:</strong> ${publicMsg.message}
                </div>
                <div class="error-hint">
                    💡 ${publicMsg.hint}
                </div>
                
                ${debugMsg ? `
                    <details class="error-debug">
                        <summary>🔍 Debug-info</summary>
                        <pre>${JSON.stringify(debugMsg, null, 2)}</pre>
                    </details>
                ` : ''}
            </div>
            
            <div class="error-actions">
                <button onclick="window.location.reload()" class="btn btn-primary">
                    🔄 Ladda om sidan
                </button>
                <button onclick="window.location.hash = '#/home'" class="btn btn-secondary">
                    🏠 Gå till Hem
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
}
