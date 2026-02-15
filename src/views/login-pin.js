/* ============================================================
 * FIL: src/views/login-pin.js
 * NAMN: PIN-LOGIN.JS — PIN-based Login View
 *
 * AUTOPATCH (utan att ta bort funktioner):
 * - Behåller sessionStorage (schema_user) som extra info.
 * - MEN: Router-kontrakt gäller: auth = store.getState().isLoggedIn
 * - Därför: exporterar inte längre isLoggedIn() som “sanning” för routing.
 *   (Funktionen finns kvar internt som hjälp om du vill visa status, men
 *    routern ska inte importera den.)
 *
 * OBS: Den här filen ritar UI direkt i container och fungerar utan store,
 * men om ctx.store finns så uppdateras store för att routern ska släppa in.
 * ============================================================ */

import { showSuccess, showWarning } from '../ui.js';
import { reportError } from '../diagnostics.js';

/* ============================================================
 * BLOCK 1 — Intern hjälp: läsa session (extra info, ej routing-sanning)
 * ============================================================ */
// NOTE: Behålls för kompatibilitet/debug, men ska inte styra routing.
// INLINE: Om JSON är trasig -> fail-closed = “ej inloggad”.
function readSessionUser() {
    try {
        if (typeof window === 'undefined') return null;
        const raw = sessionStorage.getItem('schema_user');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (err) {
        console.warn('⚠️ sessionStorage schema_user kunde inte läsas:', err);
        return null;
    }
}

/* ============================================================
 * BLOCK 2 — Export: renderLogin (view)
 * ============================================================ */
export function renderLogin(container, ctx) {
    try {
        /* ---------- BLOCK 2.1 — Guards ---------- */
        if (!container) throw new Error('Container element missing');

        // Clear any previous content (safe)
        while (container.firstChild) container.removeChild(container.firstChild);

        /* ---------- BLOCK 2.2 — DOM: Wrapper + Card ---------- */
        const loginPage = document.createElement('div');
        loginPage.className = 'login-page';

        const loginContainer = document.createElement('div');
        loginContainer.className = 'login-container';

        const loginCard = document.createElement('div');
        loginCard.className = 'login-card pin-login-card';

        /* ---------- BLOCK 2.3 — Header ---------- */
        const title = document.createElement('h1');
        title.textContent = '📅 Schema-Program';

        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Ange PIN-kod';

        /* ---------- BLOCK 2.4 — PIN display (4 dots) ---------- */
        const pinDisplay = document.createElement('div');
        pinDisplay.className = 'pin-display';
        pinDisplay.id = 'pin-display';

        for (let i = 0; i < 4; i++) {
            const dot = document.createElement('div');
            dot.className = 'pin-dot';
            dot.id = `pin-dot-${i}`;
            pinDisplay.appendChild(dot);
        }

        /* ---------- BLOCK 2.5 — Hidden input (stores pin) ---------- */
        const pinInput = document.createElement('input');
        pinInput.type = 'password';
        pinInput.id = 'pin-input';
        pinInput.style.position = 'absolute';
        pinInput.style.left = '-9999px';
        pinInput.maxLength = 4;
        pinInput.pattern = '[0-9]{4}';

        /* ---------- BLOCK 2.6 — PIN pad (buttons) ---------- */
        const pinPad = document.createElement('div');
        pinPad.className = 'pin-pad';

        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pin-button';
            btn.textContent = String(i);
            btn.dataset.value = String(i);
            pinPad.appendChild(btn);
        }

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'pin-button pin-button-clear';
        clearBtn.textContent = '⌫';
        clearBtn.title = 'Radera';

        const zeroBtn = document.createElement('button');
        zeroBtn.type = 'button';
        zeroBtn.className = 'pin-button';
        zeroBtn.textContent = '0';
        zeroBtn.dataset.value = '0';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'pin-button pin-button-submit';
        submitBtn.textContent = '✓';
        submitBtn.title = 'Logga in';
        submitBtn.disabled = true;

        pinPad.appendChild(clearBtn);
        pinPad.appendChild(zeroBtn);
        pinPad.appendChild(submitBtn);

        /* ---------- BLOCK 2.7 — Status + Demo-info + Footer ---------- */
        const statusDiv = document.createElement('div');
        statusDiv.className = 'login-status';
        statusDiv.id = 'login-status';
        statusDiv.style.display = 'none';

        const demoInfo = document.createElement('div');
        demoInfo.className = 'alert alert-info';
        demoInfo.style.marginTop = '1rem';

        const demoTitle = document.createElement('strong');
        demoTitle.textContent = 'Demo PIN-kod:';

        const demoParagraph = document.createElement('p');
        demoParagraph.style.margin = '0.5rem 0 0 0';
        demoParagraph.textContent = '1234';

        demoInfo.appendChild(demoTitle);
        demoInfo.appendChild(demoParagraph);

        const footer = document.createElement('div');
        footer.className = 'login-footer';

        const footerText = document.createElement('p');
        footerText.className = 'footer-text';
        footerText.textContent = '© 2026 Schema-Program. All rights reserved.';

        footer.appendChild(footerText);

        /* ---------- BLOCK 2.8 — Assemble ---------- */
        loginCard.appendChild(title);
        loginCard.appendChild(subtitle);
        loginCard.appendChild(pinDisplay);
        loginCard.appendChild(pinInput);
        loginCard.appendChild(pinPad);
        loginCard.appendChild(statusDiv);
        loginCard.appendChild(demoInfo);
        loginCard.appendChild(footer);

        loginContainer.appendChild(loginCard);
        loginPage.appendChild(loginContainer);
        container.appendChild(loginPage);

        console.log('✓ PIN login rendered');

        /* ---------- BLOCK 2.9 — Activate listeners ---------- */
        setupPinListeners(pinInput, pinDisplay, pinPad, submitBtn, statusDiv, ctx);
    } catch (err) {
        console.error('❌ Error rendering PIN login:', err);
        reportError(
            'PIN_LOGIN_RENDER_ERROR',
            'PIN_LOGIN_VIEW',
            'src/views/login-pin.js',
            'PIN-inloggningssidan kunde inte renderas'
        );
        renderErrorFallback(container);
    }
}

/* ============================================================
 * BLOCK 3 — PIN listeners (UI events)
 * ============================================================ */
function setupPinListeners(pinInput, pinDisplay, pinPad, submitBtn, statusDiv, ctx) {
    try {
        let currentPin = '';

        // UPDATE: uppdaterar prickarna + submit enabled
        function updateDisplay() {
            for (let i = 0; i < 4; i++) {
                const dot = document.getElementById(`pin-dot-${i}`);
                if (!dot) continue;

                if (i < currentPin.length) dot.classList.add('filled');
                else dot.classList.remove('filled');
            }
            submitBtn.disabled = currentPin.length !== 4;
        }

        function addDigit(digit) {
            if (currentPin.length >= 4) return;
            currentPin += digit;
            pinInput.value = currentPin;
            updateDisplay();

            // Auto-submit på 4 siffror (behåller funktion)
            if (currentPin.length === 4) {
                setTimeout(() => handlePinSubmit(currentPin, statusDiv, ctx), 200);
            }
        }

        function clearDigit() {
            if (currentPin.length === 0) return;
            currentPin = currentPin.slice(0, -1);
            pinInput.value = currentPin;
            updateDisplay();
            statusDiv.style.display = 'none';
        }

        function resetPin() {
            currentPin = '';
            pinInput.value = '';
            updateDisplay();
        }

        // Buttons 0–9
        const numberButtons = pinPad.querySelectorAll('.pin-button[data-value]');
        numberButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                if (value) addDigit(value);
            });
        });

        // Clear
        const clearBtn = pinPad.querySelector('.pin-button-clear');
        if (clearBtn) clearBtn.addEventListener('click', clearDigit);

        // Submit
        submitBtn.addEventListener('click', () => {
            if (currentPin.length === 4) handlePinSubmit(currentPin, statusDiv, ctx);
        });

        // Keyboard input
        document.addEventListener('keydown', (e) => {
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                addDigit(e.key);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                clearDigit();
            } else if (e.key === 'Enter' && currentPin.length === 4) {
                e.preventDefault();
                handlePinSubmit(currentPin, statusDiv, ctx);
            }
        });

        // Keep feature: expose reset for after failed login
        pinPad.dataset.resetPin = 'true';
        window._resetPin = resetPin;

        console.log('✓ PIN listeners setup');
    } catch (err) {
        console.error('❌ Error setting up PIN listeners:', err);
        reportError(
            'PIN_LISTENER_SETUP_ERROR',
            'PIN_LOGIN_VIEW',
            'src/views/login-pin.js',
            'PIN-tangentbordet kunde inte initialiseras'
        );
    }
}

/* ============================================================
 * BLOCK 4 — PIN submit (validation + “login”)
 * ============================================================ */
function handlePinSubmit(pin, statusDiv, ctx) {
    try {
        // Fail-closed validation
        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            showWarning('⚠️ PIN måste vara exakt 4 siffror');
            displayStatus(statusDiv, 'error', 'Ogiltig PIN-kod');
            if (window._resetPin) window._resetPin();
            return;
        }

        displayStatus(statusDiv, 'info', '🔄 Verifierar PIN...');

        // Simulated validation (behåller funktion)
        setTimeout(() => {
            try {
                const isValid = pin === '1234';

                if (isValid) {
                    console.log('✓ PIN login successful');

                    // FEATURE KEPT: sessionStorage “schema_user” (extra info)
                    try {
                        const loginData = {
                            isLoggedIn: true,
                            username: 'demo',
                            loginTime: new Date().toISOString(),
                            loginMethod: 'PIN'
                        };
                        sessionStorage.setItem('schema_user', JSON.stringify(loginData));
                    } catch (storageErr) {
                        console.warn('⚠️ sessionStorage not available:', storageErr);
                    }

                    // CONTRACT: store är routing-sanningen → uppdatera store säkert
                    if (ctx?.store && typeof ctx.store.setState === 'function') {
                        try {
                            ctx.store.setState({
                                isLoggedIn: true,
                                user: { name: 'demo' }
                            });
                        } catch (stateErr) {
                            console.warn('⚠️ Failed to update state:', stateErr);
                        }
                    }

                    showSuccess('✓ Inloggning lyckades!');
                    displayStatus(statusDiv, 'success', '✓ PIN godkänd');

                    setTimeout(() => {
                        window.location.hash = '#/home';
                    }, 500);
                } else {
                    console.warn('❌ PIN login failed: Invalid PIN');
                    displayStatus(statusDiv, 'error', '❌ Felaktig PIN-kod');
                    showWarning('⚠️ Felaktig PIN-kod');

                    if (window._resetPin) {
                        setTimeout(() => window._resetPin(), 1000);
                    }
                }
            } catch (err) {
                console.error('❌ PIN processing error:', err);
                displayStatus(statusDiv, 'error', '❌ Ett fel uppstod');
                showWarning('⚠️ Ett fel uppstod');
                if (window._resetPin) window._resetPin();
            }
        }, 800);
    } catch (err) {
        console.error('❌ Error handling PIN submit:', err);
        reportError(
            'PIN_SUBMIT_ERROR',
            'PIN_LOGIN_VIEW',
            'src/views/login-pin.js',
            'PIN-verifiering misslyckades'
        );
        showWarning('⚠️ Ett kritiskt fel uppstod');
    }
}

/* ============================================================
 * BLOCK 5 — Status UI helper (safe textContent)
 * ============================================================ */
function displayStatus(statusDiv, type, message) {
    if (!statusDiv) return;

    try {
        while (statusDiv.firstChild) statusDiv.removeChild(statusDiv.firstChild);

        const statusElement = document.createElement('div');

        let className = 'alert ';
        if (type === 'success') className += 'alert-success';
        else if (type === 'error') className += 'alert-danger';
        else className += 'alert-info';

        statusElement.className = className;

        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messageElement.style.margin = '0';

        statusElement.appendChild(messageElement);
        statusDiv.appendChild(statusElement);
        statusDiv.style.display = 'block';
    } catch (err) {
        console.error('❌ Error displaying status:', err);
    }
}

/* ============================================================
 * BLOCK 6 — Fail-closed fallback
 * ============================================================ */
function renderErrorFallback(container) {
    try {
        if (!container) return;

        while (container.firstChild) container.removeChild(container.firstChild);

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText =
            'padding: 2rem; text-align: center; background: #ffe8e8; border-radius: 8px; margin: 2rem;';

        const errorTitle = document.createElement('h2');
        errorTitle.textContent = '⚠️ Ett fel uppstod';
        errorTitle.style.color = '#721c24';

        const errorMsg = document.createElement('p');
        errorMsg.textContent = 'PIN-inloggningssidan kunde inte läsas in. Försök ladda om sidan.';
        errorMsg.style.color = '#721c24';

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'btn btn-primary';
        reloadBtn.textContent = '🔄 Ladda om';
        reloadBtn.onclick = () => window.location.reload();

        errorDiv.appendChild(errorTitle);
        errorDiv.appendChild(errorMsg);
        errorDiv.appendChild(reloadBtn);

        container.appendChild(errorDiv);
    } catch (fallbackErr) {
        console.error('❌ CRITICAL: Fallback error rendering failed:', fallbackErr);
    }
}
