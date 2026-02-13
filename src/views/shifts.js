/*
 * AO-02F: SHIFTS — Lägg till & redigera grundpass
 * FINAL v1.7: Fail-closed policies, unified error handling, testable
 * 
 * Ändringar:
 * 1) P0: Fail-closed ID-policy (isValidShiftId)
 * 2) P0: Fail-closed färg-policy (getColorOrDefault)
 * 3) P1: Enhetlig error-hantering (showError)
 * 4) P1: Exporterbara testbara funktioner
 */

import { validateShift, normalizeShift } from '../lib/shift-validator.js';
import { 
    createShiftCard, 
    createDetailRow, 
    getColorOrDefault,
    normalizeColor,
    isValidColor,
    isValidShiftId,
    generateShiftId,
    getColorOptions 
} from '../lib/shift-utils.js';
import { showError, hideError } from '../lib/error-handler.js';

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

            <div class="shifts-header">
                <button id="btn-add-shift" class="btn btn-primary" type="button">
                    ➕ Lägg till grundpass
                </button>
            </div>

            <div class="shifts-grid" id="shifts-grid"></div>

            <div id="shift-form-modal" class="shift-form-modal hidden">
                <div class="shift-form-modal-content">
                    <div class="shift-form-modal-header">
                        <h3 id="shift-form-title">Lägg till grundpass</h3>
                        <button class="btn-close-modal" id="btn-close-form-modal" type="button">✕</button>
                    </div>

                    <div class="shift-form-modal-body">
                        <form id="shift-form">
                            <div class="form-group">
                                <label>Färg *</label>
                                <div class="color-picker" id="color-picker"></div>
                                <input type="hidden" id="shift-color" value="">
                            </div>

                            <div class="form-group">
                                <label for="shift-name">Benämning *</label>
                                <input type="text" id="shift-name" placeholder="Ex. Dag, Kväll, Natt" required>
                            </div>

                            <div class="form-group">
                                <label for="shift-shortname">Kortnamn *</label>
                                <input type="text" id="shift-shortname" placeholder="Ex. D, K, N" maxlength="3" required>
                            </div>

                            <div class="form-group">
                                <label for="shift-description">Passbeskrivning</label>
                                <textarea id="shift-description" placeholder="Ex. Dagtid 07:00–16:00 med lunch 12:00–13:00" rows="3"></textarea>
                            </div>

                            <div class="form-group form-group-inline">
                                <label>Tid *</label>
                                <div class="time-inputs">
                                    <input type="time" id="shift-start" required>
                                    <span class="separator">–</span>
                                    <input type="time" id="shift-end" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="shift-break-type">Paustyp *</label>
                                <select id="shift-break-type" required>
                                    <option value="">Välj paustyp</option>
                                    <option value="auto">Automatisk (standard)</option>
                                    <option value="manual">Manuell</option>
                                    <option value="none">Ingen paus</option>
                                </select>
                            </div>

                            <div id="manual-break-group" class="form-group form-group-inline hidden">
                                <label>Pausstart – Pausslut</label>
                                <div class="time-inputs">
                                    <input type="time" id="shift-break-start">
                                    <span class="separator">–</span>
                                    <input type="time" id="shift-break-end">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="shift-cost">Snitt-kostnad (kr/tim)</label>
                                <input type="number" id="shift-cost" placeholder="0" min="0" step="0.01">
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

            <div id="shift-form-overlay" class="shift-form-overlay hidden"></div>
        </div>
    `;

    container.innerHTML = html;

    renderColorPicker(container);
    renderShiftCards(container, shiftIds, shifts);

    /* EVENT LISTENERS */
    const addShiftBtn = container.querySelector('#btn-add-shift');
    const breakTypeSelect = container.querySelector('#shift-break-type');
    const formElement = container.querySelector('#shift-form');
    const cancelFormBtn = container.querySelector('#btn-cancel-form');
    const closeFormBtn = container.querySelector('#btn-close-form-modal');
    const overlay = container.querySelector('#shift-form-overlay');

    if (addShiftBtn) {
        addShiftBtn.addEventListener('click', () => {
            openShiftForm(container, null, store.getState());
        });
    }

    // Event delegation
    container.addEventListener('click', (e) => {
        if (e.target.closest('.btn-shift-edit-full')) {
            const shiftId = e.target.closest('.btn-shift-edit-full').dataset.shiftId;
            openShiftForm(container, shiftId, store.getState());
        }

        if (e.target.closest('.btn-shift-delete-full')) {
            const shiftId = e.target.closest('.btn-shift-delete-full').dataset.shiftId;
            handleDeleteShift(shiftId, store, container, ctx);
        }

        if (e.target.closest('.color-option')) {
            const btn = e.target.closest('.color-option');
            const color = btn.dataset.color;

            if (!isValidColor(color)) {
                console.warn(`⚠️ Invalid color: ${color}`);
                return;
            }

            container.querySelector('#shift-color').value = color;
            container.querySelectorAll('.color-option').forEach((opt) => {
                opt.classList.remove('selected');
            });
            btn.classList.add('selected');
        }
    });

    if (breakTypeSelect) {
        breakTypeSelect.addEventListener('change', (e) => {
            const manualBreakGroup = container.querySelector('#manual-break-group');
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
}

function renderColorPicker(container) {
    const pickerDiv = container.querySelector('#color-picker');
    pickerDiv.innerHTML = '';

    getColorOptions().forEach((color) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-option';
        btn.dataset.color = color;
        btn.title = color;
        btn.setAttribute('aria-label', `Välj färg ${color}`);
        btn.style.backgroundColor = color;
        pickerDiv.appendChild(btn);
    });
}

function renderShiftCards(container, shiftIds, shifts) {
    const grid = container.querySelector('#shifts-grid');
    grid.innerHTML = '';

    if (shiftIds.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Inga grundpass definierade än. Lägg till ett för att börja.';
        grid.appendChild(empty);
        return;
    }

    shiftIds.forEach((shiftId) => {
        const shift = shifts[shiftId];
        const card = createShiftCard(shiftId, shift);
        grid.appendChild(card);
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

    const normalizedColor = shift ? getColorOrDefault(shift.color) : '#667EEA';
    container.querySelector('#shift-color').value = normalizedColor;
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

    container.querySelectorAll('.color-option').forEach((opt) => {
        if (opt.dataset.color.toUpperCase() === normalizedColor.toUpperCase()) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });

    const manualBreakGroup = container.querySelector('#manual-break-group');
    if (shift?.breakStart && shift?.breakEnd) {
        manualBreakGroup.classList.remove('hidden');
    } else {
        manualBreakGroup.classList.add('hidden');
    }

    form.dataset.shiftId = shiftId || '';

    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

function closeShiftForm(container) {
    const modal = container.querySelector('#shift-form-modal');
    const overlay = container.querySelector('#shift-form-overlay');
    const form = container.querySelector('#shift-form');
    const errorDiv = container.querySelector('#shift-form-error');

    modal.classList.add('hidden');
    overlay.classList.add('hidden');
    form.reset();
    form.dataset.shiftId = '';
    container.querySelector('#manual-break-group').classList.add('hidden');
    hideError(errorDiv);
}

function handleSaveShift(store, container, ctx) {
    try {
        const form = container.querySelector('#shift-form');
        const shiftId = form.dataset.shiftId;
        const errorDiv = container.querySelector('#shift-form-error');

        const formData = {
            name: container.querySelector('#shift-name').value.trim(),
            shortName: container.querySelector('#shift-shortname').value.trim().toUpperCase(),
            description: container.querySelector('#shift-description').value.trim(),
            color: container.querySelector('#shift-color').value.toUpperCase(),
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

        // P0: Strikt färg-validering vid save
        if (!isValidColor(formData.color)) {
            showError(errorDiv, `Färgen är inte giltig. Välj en från paletten.`);
            return;
        }

        const errors = validateShift(formData);
        if (errors.length > 0) {
            showError(errorDiv, errors.join('; '));
            return;
        }

        const normalizedShift = normalizeShift(formData, shiftId);

        store.update((state) => {
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
        showError(errorDiv, `Fel vid sparning: ${err.message}`);
    }
}

function handleDeleteShift(shiftId, store, container, ctx) {
    const state = store.getState();
    const shift = state.shifts?.[shiftId];

    if (!confirm(`Radera pass "${shift?.name}"?`)) return;

    try {
        // P0: Fail-closed — kontrollera ID innan delete
        if (!isValidShiftId(shiftId)) {
            console.error(`⚠️ Försök att radera med ogiltigt ID: ${shiftId}`);
            return;
        }

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
        // P3: Enhetlig error-hantering (kunde visa snackbar här istället)
        alert(`Fel vid radering: ${err.message}`);
    }
}

function toIntOrFloat(v, fallback = 0) {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
}
