/*
 * AO-10 — Rules View (Arbetstidsregler)
 * FIL: src/views/rules.js
 *
 * CRUD för arbetstidsregler:
 *   1. Lista alla regler med kort (aktiv/inaktiv)
 *   2. Skapa ny regel via modal
 *   3. Redigera befintlig regel
 *   4. Ta bort regel
 *   5. Toggle aktiv/inaktiv
 *
 * Regeltyper:
 *   - maxHoursWeek     Max timmar per vecka
 *   - maxHoursDay      Max timmar per dag
 *   - minRestBetween   Min vila mellan pass (timmar)
 *   - maxConsecutive   Max dagar i rad
 *   - minStaffPerShift Min bemanning per pass
 *   - obTillagg        OB-tillägg (kväll/natt/helg)
 *   - custom           Egen regel (fritext)
 *
 * Reglerna sparas i state.rules = []
 *
 * Kontrakt:
 *   - ctx.store måste finnas
 *   - Exporterar renderRules(container, ctx)
 *   - XSS-safe
 */

/* ── CONSTANTS ── */
const RULE_TYPES = {
    maxHoursWeek:    { icon: '⏱️', label: 'Max timmar/vecka',     category: 'time',  color: 'rules-type-time' },
    maxHoursDay:     { icon: '📅', label: 'Max timmar/dag',       category: 'time',  color: 'rules-type-time' },
    minRestBetween:  { icon: '😴', label: 'Min vila mellan pass', category: 'rest',  color: 'rules-type-rest' },
    maxConsecutive:  { icon: '📆', label: 'Max dagar i rad',      category: 'rest',  color: 'rules-type-rest' },
    minStaffPerShift:{ icon: '👥', label: 'Min bemanning/pass',   category: 'staff', color: 'rules-type-staff' },
    obTillagg:       { icon: '💰', label: 'OB-tillägg',           category: 'cost',  color: 'rules-type-cost' },
    custom:          { icon: '📝', label: 'Egen regel',           category: 'custom',color: 'rules-type-custom' },
};

const DEFAULT_RULES = [
    { id: 'r-max-week',  type: 'maxHoursWeek',    name: 'Max 40 tim/vecka',       value: 40,  unit: 'timmar', description: 'Heltidsanställd max 40 timmar per vecka enligt kollektivavtal.', isActive: true },
    { id: 'r-max-day',   type: 'maxHoursDay',     name: 'Max 10 tim/dag',         value: 10,  unit: 'timmar', description: 'Ingen ska arbeta mer än 10 timmar per arbetsdag.',               isActive: true },
    { id: 'r-min-rest',  type: 'minRestBetween',  name: 'Min 11 tim vila',        value: 11,  unit: 'timmar', description: 'Minst 11 timmars sammanhängande vila mellan arbetspass (EU-direktiv).', isActive: true },
    { id: 'r-max-cons',  type: 'maxConsecutive',   name: 'Max 6 dagar i rad',     value: 6,   unit: 'dagar',  description: 'Max 6 arbetsdagar i följd innan ledighet.',                     isActive: true },
    { id: 'r-min-staff', type: 'minStaffPerShift', name: 'Min 2 per pass',        value: 2,   unit: 'personer', description: 'Minst 2 personer per aktivt pass.',                          isActive: false },
];

/* ── MAIN RENDER ── */
export function renderRules(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = `<div class="rules-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`; return; }

    try {
        const state = store.getState();

        /* Initiera rules i store om de inte finns */
        if (!Array.isArray(state.rules)) {
            store.update(s => { s.rules = [...DEFAULT_RULES]; });
        }

        const rules = store.getState().rules || [];

        if (!ctx._rules) {
            ctx._rules = { modal: null }; // modal: null | { mode: 'create' } | { mode: 'edit', ruleId: '...' }
        }
        const rv = ctx._rules;

        const activeCount = rules.filter(r => r.isActive).length;
        const inactiveCount = rules.filter(r => !r.isActive).length;

        container.innerHTML = `
            <div class="rules-container">
                <!-- TOP BAR -->
                <div class="rules-topbar">
                    <h2>⚖️ Arbetstidsregler</h2>
                    <div class="rules-topbar-right">
                        <button class="btn btn-primary btn-sm" data-rules="open-create">+ Ny regel</button>
                    </div>
                </div>

                <!-- STATS -->
                <div class="rules-stats">
                    <div class="rules-stat-card s-total">
                        <span class="rules-stat-label">Totalt</span>
                        <span class="rules-stat-value">${rules.length}</span>
                    </div>
                    <div class="rules-stat-card s-active">
                        <span class="rules-stat-label">Aktiva</span>
                        <span class="rules-stat-value">${activeCount}</span>
                    </div>
                    <div class="rules-stat-card s-inactive">
                        <span class="rules-stat-label">Inaktiva</span>
                        <span class="rules-stat-value">${inactiveCount}</span>
                    </div>
                </div>

                <!-- RULES LIST -->
                ${rules.length === 0 ? renderEmpty() : renderRulesList(rules)}

                <!-- MODAL -->
                ${rv.modal ? renderModal(rv.modal, rules) : ''}
            </div>`;

        setupRulesListeners(container, store, ctx);
    } catch (err) {
        console.error('❌ renderRules kraschade:', err);
        container.innerHTML = `<div class="rules-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ── EMPTY STATE ── */
function renderEmpty() {
    return `<div class="rules-empty">
        <div class="rules-empty-icon">⚖️</div>
        <h3>Inga regler definierade</h3>
        <p>Skapa arbetstidsregler som schemat ska följa. Reglerna kontrolleras i Kontroll-vyn.</p>
        <button class="btn btn-primary" data-rules="open-create">+ Skapa första regeln</button>
    </div>`;
}

/* ── RULES LIST ── */
function renderRulesList(rules) {
    const sorted = [...rules].sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return (a.name || '').localeCompare(b.name || '', 'sv');
    });

    return `<div class="rules-list">${sorted.map(rule => {
        const rt = RULE_TYPES[rule.type] || RULE_TYPES.custom;
        return `<div class="rules-card ${rule.isActive ? '' : 'inactive'}">
            <div class="rules-card-header">
                <div class="rules-card-left">
                    <span class="rules-card-icon">${rt.icon}</span>
                    <span class="rules-card-title">${escapeHtml(rule.name)}</span>
                    <span class="rules-card-type ${rt.color}">${escapeHtml(rt.label)}</span>
                </div>
                <div class="rules-card-actions">
                    <button class="btn btn-secondary btn-sm" data-rules="toggle-active" data-rule-id="${escapeHtml(rule.id)}"
                            title="${rule.isActive ? 'Inaktivera' : 'Aktivera'}">
                        ${rule.isActive ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn btn-secondary btn-sm" data-rules="open-edit" data-rule-id="${escapeHtml(rule.id)}" title="Redigera">✏️</button>
                    <button class="btn btn-danger btn-sm" data-rules="delete" data-rule-id="${escapeHtml(rule.id)}" title="Ta bort">🗑️</button>
                </div>
            </div>
            <div class="rules-card-body">
                ${rule.description ? `<div class="rules-card-desc">${escapeHtml(rule.description)}</div>` : ''}
                <div class="rules-card-params">
                    ${rule.value !== undefined && rule.value !== null ? `
                        <div class="rules-param">
                            <span class="rules-param-label">Värde:</span>
                            <span class="rules-param-value">${escapeHtml(String(rule.value))} ${escapeHtml(rule.unit || '')}</span>
                        </div>` : ''}
                    ${rule.appliesTo ? `
                        <div class="rules-param">
                            <span class="rules-param-label">Gäller:</span>
                            <span class="rules-param-value">${escapeHtml(rule.appliesTo)}</span>
                        </div>` : ''}
                    ${rule.penalty ? `
                        <div class="rules-param">
                            <span class="rules-param-label">Konsekvens:</span>
                            <span class="rules-param-value">${escapeHtml(rule.penalty)}</span>
                        </div>` : ''}
                </div>
            </div>
            <div class="rules-card-footer">
                <span class="rules-active-badge">
                    <span class="rules-active-dot ${rule.isActive ? 'on' : 'off'}"></span>
                    ${rule.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
                <span>ID: ${escapeHtml(rule.id)}</span>
            </div>
        </div>`;
    }).join('')}</div>`;
}

/* ── MODAL (create / edit) ── */
function renderModal(modal, rules) {
    const isEdit = modal.mode === 'edit';
    const rule = isEdit ? rules.find(r => r.id === modal.ruleId) : null;

    const name = rule?.name || '';
    const type = rule?.type || 'maxHoursWeek';
    const value = rule?.value ?? '';
    const unit = rule?.unit || '';
    const description = rule?.description || '';
    const appliesTo = rule?.appliesTo || 'Alla';
    const penalty = rule?.penalty || '';
    const isActive = rule?.isActive ?? true;

    const typeOptions = Object.entries(RULE_TYPES).map(([key, rt]) =>
        `<option value="${key}" ${type === key ? 'selected' : ''}>${rt.icon} ${escapeHtml(rt.label)}</option>`
    ).join('');

    return `<div class="rules-modal-overlay" data-rules-overlay>
        <div class="rules-modal" data-rules-modal-inner>
            <div class="rules-modal-header">
                <h3>${isEdit ? '✏️ Redigera regel' : '➕ Ny regel'}</h3>
                <button class="rules-modal-close" data-rules="close-modal" type="button">×</button>
            </div>
            <div class="rules-modal-body">
                <div class="rules-form">
                    <div class="rules-form-row">
                        <label>Namn *</label>
                        <input type="text" id="rule-name" value="${escapeHtml(name)}" placeholder="T.ex. Max 40 tim/vecka" />
                    </div>
                    <div class="rules-form-row">
                        <label>Regeltyp</label>
                        <select id="rule-type">${typeOptions}</select>
                    </div>
                    <div class="rules-form-grid">
                        <div class="rules-form-row">
                            <label>Värde</label>
                            <input type="number" id="rule-value" value="${escapeHtml(String(value))}" placeholder="40" step="any" />
                        </div>
                        <div class="rules-form-row">
                            <label>Enhet</label>
                            <input type="text" id="rule-unit" value="${escapeHtml(unit)}" placeholder="timmar / dagar / personer" />
                        </div>
                    </div>
                    <div class="rules-form-row">
                        <label>Beskrivning</label>
                        <textarea id="rule-desc" placeholder="Frivillig beskrivning av regeln...">${escapeHtml(description)}</textarea>
                    </div>
                    <div class="rules-form-grid">
                        <div class="rules-form-row">
                            <label>Gäller för</label>
                            <input type="text" id="rule-applies" value="${escapeHtml(appliesTo)}" placeholder="Alla / Grupp X / Vikarier" />
                        </div>
                        <div class="rules-form-row">
                            <label>Konsekvens vid brott</label>
                            <input type="text" id="rule-penalty" value="${escapeHtml(penalty)}" placeholder="Varning / Blockera / OB %" />
                        </div>
                    </div>
                    <div class="rules-form-row">
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                            <input type="checkbox" id="rule-active" ${isActive ? 'checked' : ''} />
                            Aktiv
                        </label>
                    </div>
                    <div class="rules-form-actions">
                        <button class="btn btn-secondary" data-rules="close-modal">Avbryt</button>
                        <button class="btn btn-primary" data-rules="${isEdit ? 'save-edit' : 'save-create'}">
                            💾 ${isEdit ? 'Spara ändringar' : 'Skapa regel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════
 * EVENT LISTENERS
 * ══════════════════════════════════════════════════════════ */
function setupRulesListeners(container, store, ctx) {
    if (ctx._rulesAbort) ctx._rulesAbort.abort();
    ctx._rulesAbort = new AbortController();
    const signal = ctx._rulesAbort.signal;

    container.addEventListener('click', (e) => {
        const rv = ctx._rules;

        /* Overlay-klick stänger modal */
        const overlay = e.target.closest('[data-rules-overlay]');
        if (overlay && !e.target.closest('[data-rules-modal-inner]') && !e.target.closest('[data-rules]')) {
            rv.modal = null;
            renderRules(container, ctx);
            return;
        }

        const btn = e.target.closest('[data-rules]');
        if (!btn) return;
        const action = btn.dataset.rules;

        try {
            if (action === 'open-create') {
                rv.modal = { mode: 'create' };
                renderRules(container, ctx);

            } else if (action === 'open-edit') {
                rv.modal = { mode: 'edit', ruleId: btn.dataset.ruleId };
                renderRules(container, ctx);

            } else if (action === 'close-modal') {
                rv.modal = null;
                renderRules(container, ctx);

            } else if (action === 'save-create') {
                const data = readForm();
                if (!data.name) { alert('Namn krävs'); return; }
                const newId = 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
                store.update(s => {
                    if (!Array.isArray(s.rules)) s.rules = [];
                    s.rules.push({ id: newId, ...data });
                });
                rv.modal = null;
                renderRules(container, ctx);

            } else if (action === 'save-edit') {
                const data = readForm();
                if (!data.name) { alert('Namn krävs'); return; }
                const ruleId = rv.modal?.ruleId;
                if (!ruleId) return;
                store.update(s => {
                    if (!Array.isArray(s.rules)) return;
                    const idx = s.rules.findIndex(r => r.id === ruleId);
                    if (idx === -1) return;
                    s.rules[idx] = { ...s.rules[idx], ...data };
                });
                rv.modal = null;
                renderRules(container, ctx);

            } else if (action === 'toggle-active') {
                const ruleId = btn.dataset.ruleId;
                store.update(s => {
                    if (!Array.isArray(s.rules)) return;
                    const rule = s.rules.find(r => r.id === ruleId);
                    if (rule) rule.isActive = !rule.isActive;
                });
                renderRules(container, ctx);

            } else if (action === 'delete') {
                const ruleId = btn.dataset.ruleId;
                const state = store.getState();
                const rule = (state.rules || []).find(r => r.id === ruleId);
                if (!rule) return;
                if (!confirm(`Ta bort regeln "${rule.name}"?`)) return;
                store.update(s => {
                    if (!Array.isArray(s.rules)) return;
                    s.rules = s.rules.filter(r => r.id !== ruleId);
                });
                renderRules(container, ctx);
            }
        } catch (err) {
            console.error('❌ Rules error:', err);
        }
    }, { signal });
}

/* ── Read form values ── */
function readForm() {
    const name = document.getElementById('rule-name')?.value?.trim() || '';
    const type = document.getElementById('rule-type')?.value || 'custom';
    const rawValue = document.getElementById('rule-value')?.value;
    const value = rawValue !== '' && rawValue !== undefined ? parseFloat(rawValue) : null;
    const unit = document.getElementById('rule-unit')?.value?.trim() || '';
    const description = document.getElementById('rule-desc')?.value?.trim() || '';
    const appliesTo = document.getElementById('rule-applies')?.value?.trim() || 'Alla';
    const penalty = document.getElementById('rule-penalty')?.value?.trim() || '';
    const isActive = document.getElementById('rule-active')?.checked ?? true;

    return { name, type, value, unit, description, appliesTo, penalty, isActive };
}

/* ── XSS ── */
function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
