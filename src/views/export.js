/*
 * AO-11 — Export/Import View — v1.0
 * FIL: src/views/export.js
 *
 * Export JSON, Import JSON, Clipboard, Print-ready.
 */

import { showSuccess, showWarning } from '../ui.js';

/* ── MAIN RENDER ── */
export function renderExport(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = `<div class="exp-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`; return; }

    try {
        const state = store.getState();

        if (!ctx._exp) {
            ctx._exp = { importPreview: null, status: null };
        }
        const exp = ctx._exp;

        const people = Array.isArray(state.people) ? state.people : [];
        const groups = (typeof state.groups === 'object' && state.groups) || {};
        const shifts = (typeof state.shifts === 'object' && state.shifts) || {};
        const shiftTemplates = (typeof state.shiftTemplates === 'object' && state.shiftTemplates) || {};
        const rules = Array.isArray(state.rules) ? state.rules : [];
        const absences = Array.isArray(state.absences) ? state.absences : [];

        const dataSize = estimateSize(state);

        container.innerHTML = `
            <div class="exp-container">
                <div class="exp-topbar">
                    <h2>💾 Export / Import</h2>
                </div>

                <div class="exp-sections">
                    <!-- EXPORT SECTION -->
                    <div class="exp-section">
                        <div class="exp-section-header">
                            <span class="exp-section-icon">📤</span>
                            <h3>Exportera data</h3>
                        </div>
                        <div class="exp-section-body">
                            <p class="exp-section-desc">Exportera hela schemat som JSON-fil. Inkluderar personal, grupper, pass, schema och regler.</p>
                            <div class="exp-data-size">
                                <div class="exp-size-item">
                                    <span class="exp-size-label">Personal</span>
                                    <span class="exp-size-value">${people.length}</span>
                                </div>
                                <div class="exp-size-item">
                                    <span class="exp-size-label">Grupper</span>
                                    <span class="exp-size-value">${Object.keys(groups).length}</span>
                                </div>
                                <div class="exp-size-item">
                                    <span class="exp-size-label">Pass</span>
                                    <span class="exp-size-value">${Object.keys(shifts).length + Object.keys(shiftTemplates).length}</span>
                                </div>
                                <div class="exp-size-item">
                                    <span class="exp-size-label">Regler</span>
                                    <span class="exp-size-value">${rules.length}</span>
                                </div>
                                <div class="exp-size-item">
                                    <span class="exp-size-label">Storlek</span>
                                    <span class="exp-size-value">${dataSize}</span>
                                </div>
                            </div>
                            <div class="exp-btn-row">
                                <button class="btn btn-primary" data-exp="download-json">📥 Ladda ner JSON</button>
                                <button class="btn btn-secondary" data-exp="copy-clipboard">📋 Kopiera till urklipp</button>
                            </div>
                            ${exp.status ? `<div class="exp-status ${exp.status.type}">${escapeHtml(exp.status.message)}</div>` : ''}
                        </div>
                    </div>

                    <!-- IMPORT SECTION -->
                    <div class="exp-section">
                        <div class="exp-section-header">
                            <span class="exp-section-icon">📥</span>
                            <h3>Importera data</h3>
                        </div>
                        <div class="exp-section-body">
                            <p class="exp-section-desc">Importera schema från en JSON-fil. <strong>Varning:</strong> detta ersätter all befintlig data!</p>
                            <div class="exp-drop-zone" id="exp-drop-zone">
                                <div class="exp-drop-icon">📁</div>
                                <p class="exp-drop-text">Dra och släpp JSON-fil här</p>
                                <p class="exp-drop-sub">eller klicka för att välja fil</p>
                                <input type="file" accept=".json,application/json" class="exp-file-input" id="exp-file-input" />
                            </div>
                            ${exp.importPreview ? renderImportPreview(exp.importPreview) : ''}
                        </div>
                    </div>

                    <!-- PRINT SECTION -->
                    <div class="exp-section full-width">
                        <div class="exp-section-header">
                            <span class="exp-section-icon">🖨️</span>
                            <h3>Skriv ut</h3>
                        </div>
                        <div class="exp-section-body">
                            <p class="exp-section-desc">Skriv ut en sammanfattning av schemat. Använd webbläsarens utskriftsfunktion.</p>
                            <div class="exp-btn-row">
                                <button class="btn btn-secondary" data-exp="print">🖨️ Skriv ut sidan</button>
                                <button class="btn btn-secondary" data-exp="preview-data">👁️ Visa rådata</button>
                            </div>
                            ${exp.showRawData ? `<div class="exp-print-section">${escapeHtml(JSON.stringify(state, null, 2).slice(0, 5000))}${JSON.stringify(state).length > 5000 ? '\n\n... (trunkerat)' : ''}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;

        setupExportListeners(container, store, ctx);
    } catch (err) {
        console.error('❌ renderExport kraschade:', err);
        container.innerHTML = `<div class="exp-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ── IMPORT PREVIEW ── */
function renderImportPreview(preview) {
    return `<div class="exp-import-preview">
        <div class="exp-import-header">
            <h4>✅ Fil inläst: ${escapeHtml(preview.fileName || 'schema.json')}</h4>
        </div>
        <div class="exp-import-stats">
            ${preview.people !== undefined ? `<div class="exp-import-stat"><strong>${preview.people}</strong> personal</div>` : ''}
            ${preview.groups !== undefined ? `<div class="exp-import-stat"><strong>${preview.groups}</strong> grupper</div>` : ''}
            ${preview.shifts !== undefined ? `<div class="exp-import-stat"><strong>${preview.shifts}</strong> pass</div>` : ''}
            ${preview.rules !== undefined ? `<div class="exp-import-stat"><strong>${preview.rules}</strong> regler</div>` : ''}
            ${preview.hasSchedule ? `<div class="exp-import-stat">📅 Schema inkluderat</div>` : ''}
        </div>
        <div class="exp-import-actions">
            <button class="btn btn-primary" data-exp="apply-import">⚡ Importera (ersätt allt)</button>
            <button class="btn btn-secondary" data-exp="cancel-import">✕ Avbryt</button>
        </div>
    </div>`;
}

/* ── EVENT LISTENERS ── */
function setupExportListeners(container, store, ctx) {
    if (ctx._expAbort) ctx._expAbort.abort();
    ctx._expAbort = new AbortController();
    const signal = ctx._expAbort.signal;

    /* Button clicks */
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-exp]');
        if (!btn) return;
        const action = btn.dataset.exp;
        const exp = ctx._exp;

        try {
            if (action === 'download-json') {
                downloadJSON(store.getState());
                exp.status = { type: 'success', message: '✅ JSON-fil nedladdad!' };
                renderExport(container, ctx);

            } else if (action === 'copy-clipboard') {
                const json = JSON.stringify(store.getState(), null, 2);
                navigator.clipboard.writeText(json).then(() => {
                    exp.status = { type: 'success', message: '✅ Data kopierad till urklipp!' };
                    renderExport(container, ctx);
                }).catch(() => {
                    exp.status = { type: 'error', message: '❌ Kunde inte kopiera. Försök med "Ladda ner" istället.' };
                    renderExport(container, ctx);
                });

            } else if (action === 'print') {
                window.print();

            } else if (action === 'preview-data') {
                exp.showRawData = !exp.showRawData;
                renderExport(container, ctx);

            } else if (action === 'apply-import') {
                if (!exp.importPreview?.data) return;
                if (!confirm('⚠️ Detta ersätter ALL befintlig data. Fortsätt?')) return;
                const importData = exp.importPreview.data;
                store.update(s => {
                    Object.keys(importData).forEach(key => {
                        s[key] = importData[key];
                    });
                });
                exp.importPreview = null;
                exp.status = { type: 'success', message: '✅ Data importerad!' };
                showSuccess('✅ Data importerad!');
                renderExport(container, ctx);

            } else if (action === 'cancel-import') {
                exp.importPreview = null;
                renderExport(container, ctx);
            }
        } catch (err) {
            console.error('❌ Export error:', err);
            exp.status = { type: 'error', message: `❌ ${err.message}` };
            renderExport(container, ctx);
        }
    }, { signal });

    /* File input */
    const fileInput = container.querySelector('#exp-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) handleFileImport(file, ctx, container);
        }, { signal });
    }

    /* Drag & drop */
    const dropZone = container.querySelector('#exp-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        }, { signal });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        }, { signal });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFileImport(file, ctx, container);
        }, { signal });
    }
}

/* ── FILE IMPORT HANDLER ── */
function handleFileImport(file, ctx, container) {
    const exp = ctx._exp;

    if (!file.name.endsWith('.json')) {
        exp.status = { type: 'error', message: '❌ Bara JSON-filer stöds.' };
        renderExport(container, ctx);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            exp.importPreview = {
                fileName: file.name,
                data,
                people: Array.isArray(data.people) ? data.people.length : undefined,
                groups: typeof data.groups === 'object' ? Object.keys(data.groups).length : undefined,
                shifts: typeof data.shifts === 'object' ? Object.keys(data.shifts).length : undefined,
                rules: Array.isArray(data.rules) ? data.rules.length : undefined,
                hasSchedule: !!data.schedule,
            };
            exp.status = null;
            renderExport(container, ctx);
        } catch (err) {
            exp.status = { type: 'error', message: '❌ Ogiltig JSON-fil: ' + err.message };
            renderExport(container, ctx);
        }
    };
    reader.onerror = () => {
        exp.status = { type: 'error', message: '❌ Kunde inte läsa filen.' };
        renderExport(container, ctx);
    };
    reader.readAsText(file);
}

/* ── DOWNLOAD JSON ── */
function downloadJSON(state) {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ── ESTIMATE SIZE ── */
function estimateSize(state) {
    const bytes = new Blob([JSON.stringify(state)]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── XSS ── */
function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
