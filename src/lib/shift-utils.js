/*
 * AO-02F: SHIFT UTILITIES
 * Exporterbara, testbara funktioner för shifts
 */

const COLOR_OPTIONS = [
    '#FFD93D', '#FF8C42', '#6C5CE7', '#0984E3',
    '#00B894', '#A29BFE', '#FDCB6E', '#6C7A89',
    '#E17055', '#D63031', '#FD79A8', '#B71C1C',
];

/**
 * Validera shift ID enligt genererings-mönster
 * @param {string} id
 * @returns {boolean}
 */
export function isValidShiftId(id) {
    // Mönster: shift-<timestamp>-<9 random chars>
    return /^shift-\d{13}-[a-z0-9]{9}$/.test(String(id));
}

/**
 * Normalisera färg till UPPERCASE
 * @param {string} color
 * @returns {string}
 */
export function normalizeColor(color) {
    if (!color) return '#667EEA';
    return String(color).toUpperCase();
}

/**
 * Validera färg mot whitelist (case-insensitive)
 * @param {string} color
 * @returns {boolean}
 */
export function isValidColor(color) {
    const normalizedColor = normalizeColor(color);
    return COLOR_OPTIONS.map(c => c.toUpperCase()).includes(normalizedColor);
}

/**
 * Få färg eller fallback om invalid
 * @param {string} color
 * @returns {string}
 */
export function getColorOrDefault(color) {
    return isValidColor(color) ? normalizeColor(color) : '#667EEA';
}

/**
 * P1: Skapa detail-rad för shift-kort (testbar)
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
export function createDetailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'detail-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'value';
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

/**
 * P1: Skapa shift-kort (testbar, DOM-safe)
 * @param {string} shiftId
 * @param {Object} shift
 * @returns {HTMLElement}
 */
export function createShiftCard(shiftId, shift) {
    const card = document.createElement('div');
    card.className = 'shift-card';

    // P0: Fail-closed — kontrollera ID
    if (!isValidShiftId(shiftId)) {
        const corrupt = document.createElement('div');
        corrupt.className = 'shift-card-corrupt';
        corrupt.textContent = `⚠️ Korrupt pass-ID: ${String(shiftId).substring(0, 20)}...`;
        card.appendChild(corrupt);
        return card;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'shift-card-header';
    header.style.backgroundColor = getColorOrDefault(shift.color);  // P0: Fail-closed färg
    const shortName = document.createElement('span');
    shortName.className = 'shift-card-short';
    shortName.textContent = shift.shortName;
    header.appendChild(shortName);

    // Body
    const body = document.createElement('div');
    body.className = 'shift-card-body';

    const title = document.createElement('h3');
    title.textContent = shift.name;
    body.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'shift-desc';
    desc.textContent = shift.description || '';
    body.appendChild(desc);

    // Details
    const details = document.createElement('div');
    details.className = 'shift-details';

    const timeRange = shift.startTime && shift.endTime 
        ? `${shift.startTime}–${shift.endTime}`
        : 'Flex';
    details.appendChild(createDetailRow('Tid:', timeRange));

    const breakRange = shift.breakStart && shift.breakEnd
        ? `${shift.breakStart}–${shift.breakEnd}`
        : 'Ingen';
    details.appendChild(createDetailRow('Paus:', breakRange));

    if (shift.snittKostnad) {
        details.appendChild(createDetailRow('Snitt-kostnad:', `${shift.snittKostnad} kr/tim`));
    }

    body.appendChild(details);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'shift-card-footer';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-shift-edit-full';
    editBtn.type = 'button';
    editBtn.textContent = '✏️ Redigera';
    editBtn.dataset.shiftId = shiftId;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-shift-delete-full';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️ Radera';
    deleteBtn.dataset.shiftId = shiftId;

    footer.appendChild(editBtn);
    footer.appendChild(deleteBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
}

/**
 * Få alla färger (exporterad för tests)
 */
export function getColorOptions() {
    return COLOR_OPTIONS;
}

/**
 * Generera säkert shift-ID
 */
export function generateShiftId() {
    return `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
