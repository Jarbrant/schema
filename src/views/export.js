/*
 * AO-12 — EXPORT: Export/Import (enkel version för nu)
 */

import { isLoggedIn } from './login.js';

export function renderExport(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const loggedIn = isLoggedIn();

    if (!loggedIn) {
        container.innerHTML = `
            <div class="view-container">
                <h2>Export/Import</h2>
                <div class="auth-wall">
                    <h3>🔒 Åtkomst nekad</h3>
                    <p>Du måste logga in för att använda Export/Import.</p>
                </div>
            </div>
        `;
        return;
    }

    const exportJson = store.exportState();
    const lines = exportJson.split('\n').length;

    const html = `
        <div class="view-container">
            <h2>Export/Import</h2>
            <div style="background: #e8f5e9; padding: 1.5rem; border-radius: 4px; margin-bottom: 2rem;">
                <h3 style="margin-top: 0;">📥 Exportera schemat</h3>
                <button id="export-copy-btn" class="btn btn-primary" style="margin-bottom: 1rem;">📋 Kopiera till urklipp</button>
                <button id="export-download-btn" class="btn btn-secondary">⬇️ Ladda ner .json-fil</button>
                
                <details style="margin-top: 1.5rem;">
                    <summary style="cursor: pointer; font-weight: 600;">Visa JSON (${lines} rader)</summary>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.75rem; margin-top: 0.5rem;">${escapeHtml(exportJson)}</pre>
                </details>
            </div>

            <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 4px;">
                <h3 style="margin-top: 0;">📤 Importera schemat</h3>
                <p style="color: #666;">Denna funktion är under utveckling (AO-12+).</p>
            </div>
        </div>
    `;

    container.innerHTML = html;

    const copyBtn = container.querySelector('#export-copy-btn');
    const downloadBtn = container.querySelector('#export-download-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(exportJson).then(() => {
                alert('✓ Kopierat till urklipp!');
            }).catch(() => {
                alert('Kunde inte kopiera. Försök manuellt.');
            });
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const blob = new Blob([exportJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schema-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}
