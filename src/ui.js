/*
 * UI.JS — Shared UI Utilities
 * 
 * Funktioner för rendering av UI-komponenter:
 * - renderError: Visa felmeddelanden säkert
 * - renderNavbar: Visa navigeringsfältet
 * - showSuccess/showWarning: Toast-meddelanden
 */

import { diagnostics } from './diagnostics.js';

/**
 * Render navbar/topbar med alla routes
 */
export function renderNavbar(container) {
    try {
        const html = `
            <div class="navbar-content">
                <div class="navbar-brand">
                    <h2>📅 Schema-Program</h2>
                </div>
                <nav class="navbar-menu">
                    <a href="#/home" class="nav-link">🏠 Hem</a>
                    <a href="#/shifts" class="nav-link">📋 Skift</a>
                    <a href="#/groups" class="nav-link">👥 Grupper</a>
                    <a href="#/personal" class="nav-link">👤 Personal</a>
                    <a href="#/calendar" class="nav-link">📅 Kalender</a>
                    <a href="#/control" class="nav-link">✓ Kontroll</a>
                    <a href="#/summary" class="nav-link">📊 Sammanfattning</a>
                    <a href="#/rules" class="nav-link">⚖️ Regler</a>
                    <a href="#/export" class="nav-link">💾 Export</a>
                </nav>
                <div class="navbar-actions">
                    <button onclick="window.location.hash = '#/login'" class="btn-logout">
                        🚪 Logga ut
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        console.log('✓ Navbar renderad');

    } catch (err) {
        console.error('❌ Fel vid renderNavbar:', err);
        throw err;
    }
}

/**
 * Render error säkert (kompatibel med både Error och DiagnosticReport)
 * 
 * @param {HTMLElement} container - Error-panel container
 * @param {Error|DiagnosticReport} errorOrReport - Error eller DiagnosticReport-objekt
 */
export function renderError(container, errorOrReport) {
    if (!container) {
        console.error('❌ Error-container saknas');
        return;
    }

    try {
        // Konvertera Error till DiagnosticReport om nödvändigt
        let report;
        
        if (errorOrReport instanceof Error) {
            report = diagnostics.report({
                code: 'RENDER_ERROR',
                where: 'UI_UTILITY',
                fileHint: 'src/ui.js',
                detailsSafe: errorOrReport.message || 'Ett fel uppstod under rendering'
            });
        } else {
            report = errorOrReport;
        }

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
        console.log('✓ Error-panel renderad');

    } catch (err) {
        console.error('❌ KRITISKT: Error-panel render failed:', err);
        // Fallback: Visa simpel text-error
        if (container) {
            container.innerHTML = `
                <div style="padding: 2rem; background: #ffe8e8; border: 2px solid #d63031; border-radius: 8px; color: #721c24;">
                    <h3>⚠️ Ett kritiskt fel uppstod</h3>
                    <p>Systemet kunde inte visa en detaljerad felbeskrivning.</p>
                    <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        🔄 Ladda om sidan
                    </button>
                </div>
            `;
            container.style.display = 'block';
        }
    }
}

/**
 * Visa success-meddelande (toast)
 * 
 * @param {string} message - Meddelande att visa
 * @param {number} duration - Varaktighet i ms (default 3000)
 */
export function showSuccess(message, duration = 3000) {
    const div = document.createElement('div');
    div.className = 'alert alert-success';
    div.textContent = '✓ ' + message;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    div.style.animation = 'slideIn 0.3s ease';
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => div.remove(), 300);
    }, duration);
}

/**
 * Visa warning-meddelande (toast)
 * 
 * @param {string} message - Meddelande att visa
 * @param {number} duration - Varaktighet i ms (default 5000)
 */
export function showWarning(message, duration = 5000) {
    const div = document.createElement('div');
    div.className = 'alert alert-warning';
    div.textContent = '⚠️ ' + message;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    div.style.animation = 'slideIn 0.3s ease';
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => div.remove(), 300);
    }, duration);
}

/**
 * Visa info-meddelande (toast)
 * 
 * @param {string} message - Meddelande att visa
 * @param {number} duration - Varaktighet i ms (default 4000)
 */
export function showInfo(message, duration = 4000) {
    const div = document.createElement('div');
    div.className = 'alert alert-info';
    div.textContent = 'ℹ️ ' + message;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    div.style.animation = 'slideIn 0.3s ease';
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => div.remove(), 300);
    }, duration);
}

/**
 * Visa confirm-dialog
 * 
 * @param {string} message - Meddelande
 * @returns {Promise<boolean>} true om bekräftad, false om avbruten
 */
export function showConfirm(message) {
    return new Promise((resolve) => {
        const div = document.createElement('div');
        div.className = 'confirm-overlay';
        div.innerHTML = `
            <div class="confirm-dialog">
                <h3>Bekräftelse</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.confirm-overlay').dataset.result = 'cancel'; this.closest('.confirm-overlay').remove();">
                        Avbryt
                    </button>
                    <button class="btn btn-primary" onclick="this.closest('.confirm-overlay').dataset.result = 'ok'; this.closest('.confirm-overlay').remove();">
                        OK
                    </button>
                </div>
            </div>
        `;
        
        div.addEventListener('remove', () => {
            resolve(div.dataset.result === 'ok');
        });
        
        document.body.appendChild(div);
    });
}
