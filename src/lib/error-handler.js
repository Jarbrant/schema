/*
 * AO-02F: ERROR HANDLER
 * Enhetlig felhantering för shifts-vyn
 */

/**
 * Visa error i error-div
 * @param {HTMLElement} errorDiv
 * @param {string} message
 * @param {number} autoHideMs - autohide efter N ms (eller 0 för persistent)
 */
export function showError(errorDiv, message, autoHideMs = 0) {
    if (!errorDiv) return;

    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    if (autoHideMs > 0) {
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, autoHideMs);
    }
}

/**
 * Dölj error-div
 */
export function hideError(errorDiv) {
    if (!errorDiv) return;
    errorDiv.classList.add('hidden');
}

/**
 * Hämta eller skapa error-div
 */
export function getOrCreateErrorDiv(container, errorId = 'shift-form-error') {
    let errorDiv = container.querySelector(`#${errorId}`);
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'form-error hidden';
        container.appendChild(errorDiv);
    }
    return errorDiv;
}
