/*
 * AO-10 — Rules View (Arbetstidsregler) v2.0
 * FIL: src/views/rules.js
 *
 * CRUD för arbetstidsregler + FULLSTÄNDIG REGELÖVERSIKT
 *
 * v2.0 ÄNDRINGAR:
 *   - Nya regeltyper: maxDaysPerWeek, weeklyRest36h, weekendRotation, availabilityCheck,
 *     absenceCheck, startDateCheck, redDayHandling, periodTarget, substituteLastPriority
 *   - DEFAULT_RULES utökad med ALLA regler som schemamotorn ska ta hänsyn till
 *   - Ny sektion "Systemregler" som alltid visas (ej redigerbara, alltid aktiva)
 *   - Regelkort visar källa (ATL/EU/HRF/Intern)
 *
 * Regeltyper:
 *   ARBETSTID:
 *     maxHoursWeek       Max timmar per vecka
 *     maxHoursDay        Max timmar per dag
 *     maxDaysPerWeek     Max arbetsdagar per vecka
 *     periodTarget       Periodmål (beräkningsperiod 16/26v)
 *
 *   VILA:
 *     minRestBetween     Min vila mellan pass (11h dygnsvila)
 *     maxConsecutive     Max dagar i rad
 *     weeklyRest36h      36h sammanhängande veckovila
 *     weekendRotation    Helg-rotation (varannan helg ledig)
 *
 *   BEMANNING:
 *     minStaffPerShift   Min bemanning per pass
 *     availabilityCheck  Tillgänglighetskontroll (person.availability)
 *     absenceCheck       Frånvarokontroll (SEM/SJ/VAB etc)
 *     startDateCheck     Startdatumkontroll
 *
 *   KOSTNAD:
 *     obTillagg          OB-tillägg (kväll/natt/helg)
 *     redDayHandling     Röd dag — OB + rotation
 *
 *   PRIORITERING:
 *     substituteLastPriority  Vikarier schemaläggas sist
 *
 *   ÖVRIGT:
 *     custom             Egen regel (fritext)
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
    /* ARBETSTID */
    maxHoursWeek:           { icon: '⏱️', label: 'Max timmar/vecka',           category: 'time',     color: 'rules-type-time' },
    maxHoursDay:            { icon: '📅', label: 'Max timmar/dag',             category: 'time',     color: 'rules-type-time' },
    maxDaysPerWeek:         { icon: '🗓️', label: 'Max dagar/vecka',            category: 'time',     color: 'rules-type-time' },
    periodTarget:           { icon: '📊', label: 'Periodmål',                  category: 'time',     color: 'rules-type-time' },

    /* VILA */
    minRestBetween:         { icon: '��', label: 'Min vila mellan pass',       category: 'rest',     color: 'rules-type-rest' },
    maxConsecutive:         { icon: '📆', label: 'Max dagar i rad',            category: 'rest',     color: 'rules-type-rest' },
    weeklyRest36h:          { icon: '🛏️', label: '36h veckovila',              category: 'rest',     color: 'rules-type-rest' },
    weekendRotation:        { icon: '🔄', label: 'Helg-rotation',              category: 'rest',     color: 'rules-type-rest' },

    /* BEMANNING */
    minStaffPerShift:       { icon: '👥', label: 'Min bemanning/pass',         category: 'staff',    color: 'rules-type-staff' },
    availabilityCheck:      { icon: '✅', label: 'Tillgänglighet',             category: 'staff',    color: 'rules-type-staff' },
    absenceCheck:           { icon: '🚫', label: 'Frånvarokontroll',           category: 'staff',    color: 'rules-type-staff' },
    startDateCheck:         { icon: '📋', label: 'Startdatum',                 category: 'staff',    color: 'rules-type-staff' },

    /* KOSTNAD */
    obTillagg:              { icon: '💰', label: 'OB-tillägg',                 category: 'cost',     color: 'rules-type-cost' },
    redDayHandling:         { icon: '🔴', label: 'Röd dag — OB + rotation',   category: 'cost',     color: 'rules-type-cost' },

    /* PRIORITERING */
    substituteLastPriority: { icon: '🔽', label: 'Vikarier sist',             category: 'priority', color: 'rules-type-priority' },

    /* ÖVRIGT */
    custom:                 { icon: '📝', label: 'Egen regel',                 category: 'custom',   color: 'rules-type-custom' },
};

const CATEGORY_LABELS = {
    time:     '⏱️ Arbetstid',
    rest:     '😴 Vila & Rotation',
    staff:    '👥 Bemanning & Tillgänglighet',
    cost:     '💰 Kostnad & OB',
    priority: '🔽 Prioritering',
    custom:   '📝 Övrigt',
};

const DEFAULT_RULES = [
    /* ── ARBETSTID ── */
    {
        id: 'r-max-week', type: 'maxHoursWeek', name: 'Max 40 tim/vecka', value: 40, unit: 'timmar',
        description: 'Heltidsanställd max 40 timmar per vecka enligt kollektivavtal. Justeras automatiskt efter sysselsättningsgrad (t.ex. 75% = max 30 tim).',
        source: 'ATL §5 + HRF-avtal', severity: 'P0', isActive: true
    },
    {
        id: 'r-max-day', type: 'maxHoursDay', name: 'Max 10 tim/dag', value: 10, unit: 'timmar',
        description: 'Ingen ska arbeta mer än 10 timmar per arbetsdag.',
        source: 'ATL §8', severity: 'P0', isActive: true
    },
    {
        id: 'r-max-days-week', type: 'maxDaysPerWeek', name: 'Max 5 arbetsdagar/vecka', value: 5, unit: 'dagar',
        description: 'Max antal arbetsdagar per vecka. Styrs av person.workdaysPerWeek (default 5). Blockerar schemaläggning om gränsen nåtts.',
        source: 'ATL §5', severity: 'P0', isActive: true
    },
    {
        id: 'r-period-target', type: 'periodTarget', name: 'Periodmål (beräkningsperiod)', value: null, unit: '',
        description: 'Beräkningsperiod enligt HRF: 26 veckor (heltid) / 16 veckor (deltid). När periodmålet nåtts blockeras personen från fler pass.',
        source: 'HRF-avtal', severity: 'P0', isActive: true
    },

    /* ── VILA ── */
    {
        id: 'r-min-rest', type: 'minRestBetween', name: 'Min 11 tim dygnsvila', value: 11, unit: 'timmar',
        description: 'Minst 11 timmars sammanhängande vila mellan arbetspass. EU:s arbetstidsdirektiv 2003/88/EG.',
        source: 'ATL §13 + EU 2003/88/EG', severity: 'P0', isActive: true
    },
    {
        id: 'r-max-cons', type: 'maxConsecutive', name: 'Max 6 dagar i rad', value: 6, unit: 'dagar',
        description: 'Max 6 arbetsdagar i följd innan minst 1 ledig dag. Garanterar veckovila.',
        source: 'ATL §14', severity: 'P0', isActive: true
    },
    {
        id: 'r-weekly-rest', type: 'weeklyRest36h', name: '36h sammanhängande veckovila', value: 36, unit: 'timmar',
        description: 'Minst 36 timmars sammanhängande vila per 7-dagarsperiod. Ska om möjligt infalla på helg.',
        source: 'ATL §14', severity: 'P0', isActive: true
    },
    {
        id: 'r-weekend-rotation', type: 'weekendRotation', name: 'Helg-rotation (varannan helg)', value: 2, unit: 'veckor',
        description: 'Ingen ska jobba helg (lör/sön) mer än varannan vecka. Personen som jobbade förra helgen nedprioriteras kraftigt (-3000 priority). Jobbar helg 2 av senaste 4 veckor → -1500.',
        source: 'HRF-avtal + Intern policy', severity: 'P1', isActive: true
    },

    /* ── BEMANNING ── */
    {
        id: 'r-min-staff', type: 'minStaffPerShift', name: 'Min 2 per pass', value: 2, unit: 'personer',
        description: 'Minst 2 personer per aktivt pass. Genererar varning om bemanningen understiger gränsen.',
        source: 'Intern policy', severity: 'P1', isActive: false
    },
    {
        id: 'r-availability', type: 'availabilityCheck', name: 'Tillgänglighetskontroll', value: null, unit: '',
        description: 'Kontrollerar person.availability[0-6] (Mån-Sön). Om personen inte är tillgänglig en viss veckodag blockeras schemaläggning den dagen. Systemregel — alltid aktiv.',
        source: 'Systemregel', severity: 'P0', isActive: true, isSystem: true
    },
    {
        id: 'r-absence', type: 'absenceCheck', name: 'Frånvarokontroll', value: null, unit: '',
        description: 'Kontrollerar frånvaro: semester (SEM), sjuk (SJ), vård av barn (VAB), föräldraledig (FÖR), tjänstledig (TJL), permission (PERM), utbildning (UTB). Blockerar schemaläggning om frånvaro finns.',
        source: 'Systemregel', severity: 'P0', isActive: true, isSystem: true
    },
    {
        id: 'r-start-date', type: 'startDateCheck', name: 'Startdatumkontroll', value: null, unit: '',
        description: 'Person med startdatum i framtiden blockeras från schemaläggning innan det datumet.',
        source: 'Systemregel', severity: 'P0', isActive: true, isSystem: true
    },

    /* ── KOSTNAD ── */
    {
        id: 'r-red-day', type: 'redDayHandling', name: 'Röd dag — OB + rättvis rotation', value: null, unit: '',
        description: 'Arbete på röda dagar ger OB-tillägg enligt kollektivavtal. Röda dagar fördelas rättvist mellan personal (rotation). Person som jobbat röd dag nyligen nedprioriteras (-200).',
        source: 'HRF-avtal', severity: 'P1', isActive: true
    },

    /* ── PRIORITERING ── */
    {
        id: 'r-substitute-last', type: 'substituteLastPriority', name: 'Vikarier schemaläggas sist', value: null, unit: '',
        description: 'Person med employmentType = "substitute" (vikarie) får -200 penalty och schemaläggas därmed efter tillsvidareanställda.',
        source: 'Intern policy', severity: 'P1', isActive: true
    },
];

/* ── MAIN RENDER ── */
export function renderRules(container, ctx) {
    if (!container) return;
    const store = ctx?.store;
    if (!store) { container.innerHTML = `<div class="rules-error"><h2>❌ Fel</h2><p>Store saknas.</p></div>`; return; }

    try {
        const state = store.getState();

        /* Initiera rules i store om de inte finns, eller migrera gamla regler */
        if (!Array.isArray(state.rules)) {
            store.update(s => { s.rules = [...DEFAULT_RULES]; });
        } else {
            // Migrera: lägg till nya default-regler som saknas
            const existingIds = new Set(state.rules.map(r => r.id));
            const missing = DEFAULT_RULES.filter(d => !existingIds.has(d.id));
            if (missing.length > 0) {
                store.update(s => {
                    missing.forEach(r => s.rules.push({ ...r }));
                });
            }
        }

        const rules = store.getState().rules || [];

        if (!ctx._rules) {
            ctx._rules = { modal: null, showCategory: null };
        }
        const rv = ctx._rules;

        const activeCount = rules.filter(r => r.isActive).length;
        const inactiveCount = rules.filter(r => !r.isActive).length;
        const systemCount = rules.filter(r => r.isSystem).length;

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
                    <div class="rules-stat-card s-system">
                        <span class="rules-stat-label">Systemregler</span>
                        <span class="rules-stat-value">${systemCount}</span>
                    </div>
                </div>

                <!-- INFO BOX -->
                <div class="rules-info-box">
                    <strong>ℹ️ Så fungerar reglerna:</strong>
                    <ul>
                        <li><span class="rules-severity-badge p0">P0</span> <strong>Blockerar</strong> — personen kan INTE schemaläggas om regeln bryts</li>
                        <li><span class="rules-severity-badge p1">P1</span> <strong>Nedprioriterar</strong> — personen KAN schemaläggas men får lägre prioritet</li>
                        <li><span class="rules-severity-badge system">System</span> Systemregler är alltid aktiva och kan inte inaktiveras</li>
                    </ul>
                </div>

                <!-- RULES LIST (grouped by category) -->
                ${rules.length === 0 ? renderEmpty() : renderGroupedRulesList(rules)}

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

/* ── GROUPED RULES LIST ── */
function renderGroupedRulesList(rules) {
    // Group by category
    const groups = {};
    rules.forEach(rule => {
        const rt = RULE_TYPES[rule.type] || RULE_TYPES.custom;
        const cat = rt.category || 'custom';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(rule);
    });

    // Sort categories in display order
    const categoryOrder = ['time', 'rest', 'staff', 'cost', 'priority', 'custom'];

    return categoryOrder
        .filter(cat => groups[cat] && groups[cat].length > 0)
        .map(cat => {
            const catRules = groups[cat].sort((a, b) => {
                // System first, then active, then by name
                if (a.isSystem && !b.isSystem) return -1;
                if (!a.isSystem && b.isSystem) return 1;
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                return (a.name || '').localeCompare(b.name || '', 'sv');
            });

            return `
                <div class="rules-category-group">
                    <h3 class="rules-category-title">${CATEGORY_LABELS[cat] || cat}</h3>
                    <div class="rules-list">${catRules.map(rule => renderRuleCard(rule)).join('')}</div>
                </div>`;
        })
        .join('');
}

/* ── SINGLE RULE CARD ── */
function renderRuleCard(rule) {
    const rt = RULE_TYPES[rule.type] || RULE_TYPES.custom;
    const isSystem = rule.isSystem === true;
    const severityClass = rule.severity === 'P0' ? 'p0' : rule.severity === 'P1' ? 'p1' : '';

    return `<div class="rules-card ${rule.isActive ? '' : 'inactive'} ${isSystem ? 'system' : ''}">
        <div class="rules-card-header">
            <div class="rules-card-left">
                <span class="rules-card-icon">${rt.icon}</span>
                <span class="rules-card-title">${escapeHtml(rule.name)}</span>
                <span class="rules-card-type ${rt.color}">${escapeHtml(rt.label)}</span>
                ${rule.severity ? `<span class="rules-severity-badge ${severityClass}">${escapeHtml(rule.severity)}</span>` : ''}
            </div>
            <div class="rules-card-actions">
                ${isSystem ? `<span class="rules-system-badge" title="Systemregel — alltid aktiv">🔒 System</span>` : `
                    <button class="btn btn-secondary btn-sm" data-rules="toggle-active" data-rule-id="${escapeHtml(rule.id)}"
                            title="${rule.isActive ? 'Inaktivera' : 'Aktivera'}">
                        ${rule.isActive ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn btn-secondary btn-sm" data-rules="open-edit" data-rule-id="${escapeHtml(rule.id)}" title="Redigera">✏️</button>
                    <button class="btn btn-danger btn-sm" data-rules="delete" data-rule-id="${escapeHtml(rule.id)}" title="Ta bort">🗑️</button>
                `}
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
                ${rule.source ? `
                    <div class="rules-param">
                        <span class="rules-param-label">Källa:</span>
                        <span class="rules-param-value">${escapeHtml(rule.source)}</span>
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
                ${isSystem ? 'System (alltid aktiv)' : rule.isActive ? 'Aktiv' : 'Inaktiv'}
            </span>
            <span>ID: ${escapeHtml(rule.id)}</span>
        </div>
    </div>`;
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
    const source = rule?.source || '';
    const severity = rule?.severity || 'P0';
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
                    <div class="rules-form-grid">
                        <div class="rules-form-row">
                            <label>Allvarlighetsgrad</label>
                            <select id="rule-severity">
                                <option value="P0" ${severity === 'P0' ? 'selected' : ''}>🔴 P0 — Blockerar</option>
                                <option value="P1" ${severity === 'P1' ? 'selected' : ''}>🟡 P1 — Nedprioriterar</option>
                            </select>
                        </div>
                        <div class="rules-form-row">
                            <label>Källa / Lagstöd</label>
                            <input type="text" id="rule-source" value="${escapeHtml(source)}" placeholder="ATL §14 / HRF-avtal / Intern" />
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
                const ruleId = btn.dataset.ruleId;
                const state = store.getState();
                const rule = (state.rules || []).find(r => r.id === ruleId);
                if (rule?.isSystem) { alert('Systemregler kan inte redigeras.'); return; }
                rv.modal = { mode: 'edit', ruleId };
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
                const state = store.getState();
                const rule = (state.rules || []).find(r => r.id === ruleId);
                if (rule?.isSystem) { alert('Systemregler kan inte inaktiveras.'); return; }
                store.update(s => {
                    if (!Array.isArray(s.rules)) return;
                    const r = s.rules.find(r => r.id === ruleId);
                    if (r) r.isActive = !r.isActive;
                });
                renderRules(container, ctx);

            } else if (action === 'delete') {
                const ruleId = btn.dataset.ruleId;
                const state = store.getState();
                const rule = (state.rules || []).find(r => r.id === ruleId);
                if (!rule) return;
                if (rule.isSystem) { alert('Systemregler kan inte tas bort.'); return; }
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
    const source = document.getElementById('rule-source')?.value?.trim() || '';
    const severity = document.getElementById('rule-severity')?.value || 'P0';
    const appliesTo = document.getElementById('rule-applies')?.value?.trim() || 'Alla';
    const penalty = document.getElementById('rule-penalty')?.value?.trim() || '';
    const isActive = document.getElementById('rule-active')?.checked ?? true;

    return { name, type, value, unit, description, source, severity, appliesTo, penalty, isActive };
}

/* ── XSS ── */
function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
