/*
 * AO-02F: SHIFTS — Lägg till & redigera grundpass
 * AUTOPATCH v1.5: Selector-escape, color-normalization, safe IDs
 * 
 * Ändringar:
 * 1) P0: CSS.escape() för selectors (inte escapeHtml)
 * 2) P0: isValidColor() case-insensitiv (fix toLowerCase-bug)
 * 3) P0: generateSafeId() för DOM-ids (whitelist [a-z0-9_-])
 * 4) P1: Normalisera färger i getColorOptions()
 */

import { validateShift, normalizeShift } from '../lib/shift-validator.js';

export function renderShiftsView(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const shifts = state.shifts || {};
    const shiftIds = Object.keys(shifts).sort();

    const html = `
        <div class="view-container shifts-container">
            <h2>⏰ Grundpass</h2>
            <p class="section-desc">
                Definiera de grundpass som dina grupper kan jobba. Du kan ange tider, pauser och kostnad.
            </p>

            <!-- Lägg till grundpass knapp -->
            <div class="shifts-header">
                <button id="btn-add-shift" class="btn btn-primary" type="button">
                    ➕ Lägg till grundpass
                </button>
            </div>

            <!-- Shift-kort -->
            <div class="shifts-grid">
                ${shiftIds.length === 0 
                    ? '<p class="empty-state">Inga grundpass definierade än. Lägg till ett för att börja.</p>'
                    : shiftIds.map((shiftId) => {
                        const shift = shifts[shiftId];
                        const safeId = generateSafeId(shiftId);  // P0: Safe ID
                        const timeRange = shift.startTime && shift.endTime 
                            ? `${shift.startTime}–${shift.endTime}`
                            : 'Flex';
                        const breakRange = shift.breakStart && shift.breakEnd
                            ? `${shift.breakStart}–${shift.breakEnd}`
                            : 'Ingen';

                        return `
                            <div class="shift-card">
                                <div class="shift-card-header" id="shift-header-${safeId}">
                                    <span class="shift-card-short">${escapeHtml(shift.shortName)}</span>
                                </div>
                                <div class="shift-card-body">
                                    <h3>${escapeHtml(shift.name)}</h3>
                                    <p class="shift-desc">${escapeHtml(shift.description || '')}</p>
                                    
                                    <div class="shift-details">
                                        <div class="detail-row">
                                            <span class="label">Tid:</span>
                                            <span class="value">${escapeHtml(timeRange)}</span>
                                        </div>
                                        <div class="detail-row">
                                            <span class="label">Paus:</span>
                                            <span class="value">${escapeHtml(breakRange)}</span>
                                        </div>
                                        ${shift.snittKostnad ? `
                                            <div class="detail-row">
                                                <span class="label">Snitt-kostnad:</span>
                                                <span class="value">${escapeHtml(String(shift.snittKostnad))} kr/tim</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="shift-card-footer">
                                    <button class="btn-shift-edit-full" data-shift="${escapeHtml(shiftId)}" type="button">
                                        ✏️ Redigera
                                    </button>
                                    <button class="btn-shift-delete-full" data-shift="${escapeHtml(shiftId)}" type="button">
                                        🗑️ Radera
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
            </div>

            <!-- Edit/Add modal -->
            <div id="shift-form-modal" class="shift-form-modal hidden">
                <div class="shift-form-modal-content">
                    <div class="shift-form-modal-header">
                        <h3 id="shift-form-title">Lägg till grundpass</h3>
                        <button class="btn-close-modal" id="btn-close-form-modal" type="button">✕</button>
                    </div>

                    <div class="shift-form-modal-body">
                        <form id="shift-form">
                            <!-- Färgväljare -->
                            <div class="form-group">
                                <label>Färg *</label>
                                <div class="color-picker">
                                    ${getColorOptions().map((color) => `
                                        <button 
                                            type="button" 
                                            class="color-option" 
                                            data-color="${escapeHtml(color)}" 
                                            title="${escapeHtml(color)}"
                                            aria-label="Välj färg ${escapeHtml(color)}"
                                        ></button>
                                    `).join('')}
                                </div>
                                <input type="hidden" id="shift-color" value="">
                            </div>

                            <!-- Benämning -->
                            <div class="form-group">
                                <label for="shift-name">Benämning *</label>
                                <input 
                                    type="text" 
                                    id="shift-name" 
                                    placeholder="Ex. Dag, Kväll, Natt"
                                    required
                                >
                            </div>

                            <!-- Kortnamn -->
                            <div class="form-group">
                                <label for="shift-shortname">Kortnamn *</label>
                                <input 
                                    type="text" 
                                    id="shift-shortname" 
                                    placeholder="Ex. D, K, N" 
                                    maxlength="3"
                                    required
                                >
                            </div>

                            <!-- Passbeskrivning -->
                            <div class="form-group">
                                <label for="shift-description">Passbeskrivning</label>
                                <textarea 
                                    id="shift-description" 
                                    placeholder="Ex. Dagtid 07:00–16:00 med lunch 12:00–13:00"
                                    rows="3"
                                ></textarea>
                            </div>

                            <!-- Tid -->
                            <div class="form-group form-group-inline">
                                <label>Tid *</label>
                                <div class="time-inputs">
                                    <input 
                                        type="time" 
                                        id="shift-start" 
                                        placeholder="Start"
                                        required
                                    >
                                    <span class="separator">–</span>
                                    <input 
                                        type="time" 
                                        id="shift-end" 
                                        placeholder="Slut"
                                        required
                                    >
                                </div>
                            </div>

                            <!-- Paus -->
                            <div class="form-group">
                                <label for="shift-break-type">Paustyp *</label>
                                <select id="shift-break-type" required>
                                    <option value="">Välj paustyp</option>
                                    <option value="auto">Automatisk (standard)</option>
                                    <option value="manual">Manuell</option>
                                    <option value="none">Ingen paus</option>
                                </select>
                            </div>

                            <!-- Manuell paus -->
                            <div id="manual-break-group" class="form-group form-group-inline hidden">
                                <label>Pausstart – Pausslut</label>
                                <div class="time-inputs">
                                    <input 
                                        type="time" 
                                        id="shift-break-start" 
                                        placeholder="Start"
                                    >
                                    <span class="separator">–</span>
                                    <input 
                                        type="time" 
                                        id="shift-break-end" 
                                        placeholder="Slut"
                                    >
                                </div>
                            </div>

                            <!-- Snitt-kostnad -->
                            <div class="form-group">
                                <label for="shift-cost">Snitt-kostnad (kr/tim)</label>
                                <input 
                                    type="number" 
                                    id="shift-cost" 
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                >
                            </div>

                            <div id="shift-form-error" class="form-error hidden"></div>

                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary">Spara pass</button>
                                <button type="button" id="btn-cancel-form" class="btn btn-secondary">Avbryt</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Modal overlay -->
            <div id="shift-form-overlay" class="shift-form-overlay hidden"></div>
        </div>
    `;

    container.innerHTML = html;

    /* ====================================================================
       EVENT LISTENERS
       ==================================================================== */

    const addShiftBtn = container.querySelector('#btn-add-shift');
    const editButtons = container.querySelectorAll('.btn-shift-edit-full');
    const deleteButtons = container.querySelectorAll('.btn-shift-delete-full');
    const colorOptions = container.querySelectorAll('.color-option');
    const breakTypeSelect = container.querySelector('#shift-break-type');
    const manualBreakGroup = container.querySelector('#manual-break-group');
    const formElement = container.querySelector('#shift-form');
    const cancelFormBtn = container.querySelector('#btn-cancel-form');
    const closeFormBtn = container.querySelector('#btn-close-form-modal');
    const overlay = container.querySelector('#shift-form-overlay');

    if (addShiftBtn) {
        addShiftBtn.addEventListener('click', () => {
            openShiftForm(container, null, store.getState());
        });
    }

    editButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const shiftId = btn.dataset.shift;
            openShiftForm(container, shiftId, store.getState());
        });
    });

    deleteButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const shiftId = btn.dataset.shift;
            handleDeleteShift(shiftId, store, container, ctx);
        });
    });

    colorOptions.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const color = btn.dataset.color;
            
            // P0: Validera färg mot whitelist (case-insensitive)
            if (!isValidColor(color)) {
                console.warn(`⚠️ Invalid color: ${color}`);
                return;
            }

            container.querySelector('#shift-color').value = color;
            container.querySelectorAll('.color-option').forEach((opt) => {
                opt.classList.remove('selected');
            });
            btn.classList.add('selected');
        });
    });

    if (breakTypeSelect) {
        breakTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'manual') {
                manualBreakGroup.classList.remove('hidden');
            } else {
                manualBreakGroup.classList.add('hidden');
            }
        });
    }

    if (formElement) {
        formElement.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveShift(store, container, ctx);
        });
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', () => {
            closeShiftForm(container);
        });
    }

    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', () => {
            closeShiftForm(container);
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            closeShiftForm(container);
        });
    }

    // P0: Sätt färg på kort-headers EFTER DOM är renderad (använd CSS.escape)
    shiftIds.forEach(shiftId => {
        const shift = store.getState().shifts[shiftId];
        const safeId = generateSafeId(shiftId);
        const header = container.querySelector(`#shift-header-${CSS.escape(safeId)}`);
        if (header && isValidColor(shift.color)) {
            header.style.backgroundColor = shift.color;
        }
    });
}

function openShiftForm(container, shiftId, state) {
    const shifts = state.shifts || {};
    const shift = shiftId ? shifts[shiftId] : null;

    const modal = container.querySelector('#shift-form-modal');
    const overlay = container.querySelector('#shift-form-overlay');
    const form = container.querySelector('#shift-form');
    const title = container.querySelector('#shift-form-title');

    title.textContent = shift ? `Redigera pass: ${shift.name}` : 'Lägg till grundpass';

    // Fyll formulär
    container.querySelector('#shift-color').value = shift?.color || '#667EEA';  // Normalized
    container.querySelector('#shift-name').value = shift?.name || '';
    container.querySelector('#shift-shortname').value = shift?.shortName || '';
    container.querySelector('#shift-description').value = shift?.description || '';
    container.querySelector('#shift-start').value = shift?.startTime || '07:00';
    container.querySelector('#shift-end').value = shift?.endTime || '16:00';
    container.querySelector('#shift-break-type').value = 
        shift?.breakStart && shift?.breakEnd ? 'manual' : 'auto';
    container.querySelector('#shift-break-start').value = shift?.breakStart || '12:00';
    container.querySelector('#shift-break-end').value = shift?.breakEnd || '13:00';
    container.querySelector('#shift-cost').value = shift?.snittKostnad || '';

    // Sätt färg som vald (case-insensitive)
    const defaultColor = (shift?.color || '#667EEA').toUpperCase();
    container.querySelectorAll('.color-option').forEach((opt) => {
        if (opt.dataset.color.toUpperCase() === defaultColor) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });

    // Visa/göm manuell paus
    if (shift?.breakStart && shift?.breakEnd) {
        container.querySelector('#manual-break-group').classList.remove('hidden');
    } else {
        container.querySelector('#manual-break-group').classList.add('hidden');
    }

    // Spara shift ID för senare
    form.dataset.shiftId = shiftId || '';

    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

function closeShiftForm(container) {
    const modal = container.querySelector('#shift-form-modal');
    const overlay = container.querySelector('#shift-form-overlay');
    const form = container.querySelector('#shift-form');

    modal.classList.add('hidden');
    overlay.classList.add('hidden');
    form.reset();
    form.dataset.shiftId = '';
    container.querySelector('#manual-break-group').classList.add('hidden');
}

function handleSaveShift(store, container, ctx) {
    try {
        const form = container.querySelector('#shift-form');
        const shiftId = form.dataset.shiftId;
        const errorDiv = container.querySelector('#shift-form-error');

        // Samla form-data
        const formData = {
            name: container.querySelector('#shift-name').value.trim(),
            shortName: container.querySelector('#shift-shortname').value.trim().toUpperCase(),
            description: container.querySelector('#shift-description').value.trim(),
            color: container.querySelector('#shift-color').value.toUpperCase(),  // P0: Normalize
            startTime: container.querySelector('#shift-start').value,
            endTime: container.querySelector('#shift-end').value,
            breakType: container.querySelector('#shift-break-type').value,
            breakStart: container.querySelector('#shift-break-type').value === 'manual' 
                ? container.querySelector('#shift-break-start').value 
                : null,
            breakEnd: container.querySelector('#shift-break-type').value === 'manual' 
                ? container.querySelector('#shift-break-end').value 
                : null,
            snittKostnad: toIntOrFloat(container.querySelector('#shift-cost').value, 0),
        };

        // P1: Validera (ren funktion)
        const errors = validateShift(formData);
        if (errors.length > 0) {
            errorDiv.textContent = errors.join('; ');
            errorDiv.classList.remove('hidden');
            return;
        }

        // P1: Normalisera (ren funktion)
        const normalizedShift = normalizeShift(formData, shiftId);

        // P0: Defensiv state-update (immutable)
        store.update((state) => {
            // Säkerställ shifts & meta existerar
            const shifts = { ...(state.shifts || {}) };
            const meta = { ...(state.meta || {}), updatedAt: Date.now() };

            shifts[normalizedShift.id] = normalizedShift;

            return { ...state, shifts, meta };
        });

        closeShiftForm(container);
        console.log(`✓ Pass sparade: ${normalizedShift.name}`);
        renderShiftsView(container, ctx);
    } catch (err) {
        console.error('Sparfel:', err);
        const errorDiv = container.querySelector('#shift-form-error');
        errorDiv.textContent = `Fel: ${err.message}`;
        errorDiv.classList.remove('hidden');
    }
}

function handleDeleteShift(shiftId, store, container, ctx) {
    const state = store.getState();
    const shift = state.shifts?.[shiftId];

    if (!confirm(`Radera pass "${shift?.name}"?`)) return;

    try {
        // P0: Defensiv state-update
        store.update((state) => {
            const shifts = { ...(state.shifts || {}) };
            delete shifts[shiftId];

            return {
                ...state,
                shifts,
                meta: { ...(state.meta || {}), updatedAt: Date.now() }
            };
        });

        console.log(`✓ Pass raderat: ${shift.name}`);
        renderShiftsView(container, ctx);
    } catch (err) {
        console.error('Radera-fel:', err);
        alert(`Fel: ${err.message}`);
    }
}

/* ========================================================================
   UTILITY FUNCTIONS
   ======================================================================== */

/**
 * P1: Normalisera färger till UPPERCASE för konsistens
 */
function getColorOptions() {
    return [
        '#FFD93D', '#FF8C42', '#6C5CE7', '#0984E3',
        '#00B894', '#A29BFE', '#FDCB6E', '#6C7A89',
        '#E17055', '#D63031', '#FD79A8', '#B71C1C',
    ];
}

/**
 * P0 SECURITY: Whitelist-validering av färg (case-insensitive)
 * Förhindrar CSS-injektion via shift.color
 */
function isValidColor(color) {
    const validColors = getColorOptions().map(c => c.toUpperCase());
    const normalizedColor = String(color).toUpperCase();
    return validColors.includes(normalizedColor);
}

/**
 * P0 SECURITY: Skapa säkert DOM-ID från user-data
 * Ersätter alla icke-alphanumeriska tecken med "-"
 * 
 * @param {string} id - Original ID
 * @returns {string} Safe ID (endast [a-z0-9_-])
 */
function generateSafeId(id) {
    return String(id)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
}

function generateShiftId() {
    return `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function toIntOrFloat(v, fallback = 0) {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
}
