/*
 * UI.JS — Shared UI Utilities
 */

import { diagnostics } from './diagnostics.js';

/**
 * Render error (kompatibel med både Error och DiagnosticReport)
 */
export function renderError(container, errorOrReport) {
    if (!container) return;

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
}

/**
 * Show success message
 */
export function showSuccess(message, duration = 3000) {
    const div = document.createElement('div');
    div.className = 'alert alert-success';
    div.textContent = '✓ ' + message;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    
    document.body.appendChild(div);
    setTimeout(() => div.remove(), duration);
}

/**
 * Show warning message
 */
export function showWarning(message, duration = 5000) {
    const div = document.createElement('div');
    div.className = 'alert alert-warning';
    div.textContent = '⚠️ ' + message;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    
    document.body.appendChild(div);
    setTimeout(() => div.remove(), duration);
}
