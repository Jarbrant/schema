/*
 * PIN-LOGIN.JS — PIN-based Login View
 * 
 * FAS 1: Implementerar 4-siffrig PIN-inloggning enligt spec
 * - Numeriskt tangentbord (PIN-pad)
 * - Fail-closed validation
 * - Demo PIN: 1234
 * - Säker sessionStorage hantering
 */

import { showSuccess, showWarning } from '../ui.js';
import { reportError } from '../diagnostics.js';

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
    try {
        const state = typeof window !== 'undefined' 
            ? sessionStorage.getItem('schema_user') 
            : null;
        
        if (!state) return false;
        
        const parsed = JSON.parse(state);
        return parsed?.isLoggedIn === true;
    } catch (err) {
        console.warn('⚠️ Error checking login status:', err);
        return false;
    }
}

/**
 * Render PIN login view
 */
export function renderLogin(container, ctx) {
    try {
        if (!container) {
            throw new Error('Container element missing');
        }

        // Clear any previous content
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create login page wrapper
        const loginPage = document.createElement('div');
        loginPage.className = 'login-page';

        // Create login container
        const loginContainer = document.createElement('div');
        loginContainer.className = 'login-container';

        // Create login card
        const loginCard = document.createElement('div');
        loginCard.className = 'login-card pin-login-card';

        // Header
        const title = document.createElement('h1');
        title.textContent = '📅 Schema-Program';

        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Ange PIN-kod';

        // PIN display area
        const pinDisplay = document.createElement('div');
        pinDisplay.className = 'pin-display';
        pinDisplay.id = 'pin-display';

        // Create 4 PIN dots
        for (let i = 0; i < 4; i++) {
            const dot = document.createElement('div');
            dot.className = 'pin-dot';
            dot.id = `pin-dot-${i}`;
            pinDisplay.appendChild(dot);
        }

        // Hidden input to store PIN
        const pinInput = document.createElement('input');
        pinInput.type = 'password';
        pinInput.id = 'pin-input';
        pinInput.style.position = 'absolute';
        pinInput.style.left = '-9999px';
        pinInput.maxLength = 4;
        pinInput.pattern = '[0-9]{4}';

        // PIN pad (numeric keyboard)
        const pinPad = document.createElement('div');
        pinPad.className = 'pin-pad';

        // Create number buttons (1-9)
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pin-button';
            btn.textContent = i;
            btn.dataset.value = i;
            pinPad.appendChild(btn);
        }

        // Bottom row: Clear, 0, Submit
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

        // Status message (initially hidden)
        const statusDiv = document.createElement('div');
        statusDiv.className = 'login-status';
        statusDiv.id = 'login-status';
        statusDiv.style.display = 'none';

        // Demo info
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

        // Footer
        const footer = document.createElement('div');
        footer.className = 'login-footer';

        const footerText = document.createElement('p');
        footerText.className = 'footer-text';
        footerText.textContent = '© 2026 Schema-Program. All rights reserved.';

        footer.appendChild(footerText);

        // Assemble card
        loginCard.appendChild(title);
        loginCard.appendChild(subtitle);
        loginCard.appendChild(pinDisplay);
        loginCard.appendChild(pinInput);
        loginCard.appendChild(pinPad);
        loginCard.appendChild(statusDiv);
        loginCard.appendChild(demoInfo);
        loginCard.appendChild(footer);

        // Assemble container
        loginContainer.appendChild(loginCard);

        // Assemble page
        loginPage.appendChild(loginContainer);

        // Add to DOM
        container.appendChild(loginPage);

        console.log('✓ PIN login rendered');

        // Setup event listeners
        setupPinListeners(pinInput, pinDisplay, pinPad, submitBtn, statusDiv, ctx);

    } catch (err) {
        console.error('❌ Error rendering PIN login:', err);
        reportError(
            'PIN_LOGIN_RENDER_ERROR',
            'PIN_LOGIN_VIEW',
            'src/views/login-pin.js',
            'PIN-inloggningssidan kunde inte renderas'
        );

        // Fallback error display
        renderErrorFallback(container);
    }
}

/**
 * Setup PIN pad event listeners
 */
function setupPinListeners(pinInput, pinDisplay, pinPad, submitBtn, statusDiv, ctx) {
    try {
        let currentPin = '';

        // Update display
        function updateDisplay() {
            for (let i = 0; i < 4; i++) {
                const dot = document.getElementById(`pin-dot-${i}`);
                if (dot) {
                    if (i < currentPin.length) {
                        dot.classList.add('filled');
                    } else {
                        dot.classList.remove('filled');
                    }
                }
            }
            
            // Enable/disable submit button
            submitBtn.disabled = currentPin.length !== 4;
        }

        // Add digit
        function addDigit(digit) {
            if (currentPin.length < 4) {
                currentPin += digit;
                pinInput.value = currentPin;
                updateDisplay();
                
                // Auto-submit if 4 digits
                if (currentPin.length === 4) {
                    setTimeout(() => handlePinSubmit(currentPin, statusDiv, ctx), 200);
                }
            }
        }

        // Clear last digit
        function clearDigit() {
            if (currentPin.length > 0) {
                currentPin = currentPin.slice(0, -1);
                pinInput.value = currentPin;
                updateDisplay();
                
                // Hide status when clearing
                statusDiv.style.display = 'none';
            }
        }

        // Reset PIN
        function resetPin() {
            currentPin = '';
            pinInput.value = '';
            updateDisplay();
        }

        // Number button clicks
        const numberButtons = pinPad.querySelectorAll('.pin-button[data-value]');
        numberButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                if (value) {
                    addDigit(value);
                }
            });
        });

        // Clear button
        const clearBtn = pinPad.querySelector('.pin-button-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearDigit);
        }

        // Submit button
        submitBtn.addEventListener('click', () => {
            if (currentPin.length === 4) {
                handlePinSubmit(currentPin, statusDiv, ctx);
            }
        });

        // Keyboard input (physical keyboard)
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

        // Store reset function for access after failed login
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

/**
 * Handle PIN submission
 */
function handlePinSubmit(pin, statusDiv, ctx) {
    try {
        // Fail-closed validation
        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            showWarning('⚠️ PIN måste vara exakt 4 siffror');
            displayStatus(statusDiv, 'error', 'Ogiltig PIN-kod');
            if (window._resetPin) window._resetPin();
            return;
        }

        // Show loading
        displayStatus(statusDiv, 'info', '🔄 Verifierar PIN...');

        // Simulate validation (in real app: call backend)
        setTimeout(() => {
            try {
                // Fail-closed: only demo PIN 1234
                const isValid = pin === '1234';

                if (isValid) {
                    console.log('✓ PIN login successful');

                    // Save login state safely
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

                    // Update app context
                    if (ctx?.store) {
                        try {
                            const state = ctx.store.getState();
                            ctx.store.setState({
                                ...state,
                                isLoggedIn: true,
                                user: { name: 'demo' }
                            });
                        } catch (stateErr) {
                            console.warn('⚠️ Failed to update state:', stateErr);
                        }
                    }

                    showSuccess('✓ Inloggning lyckades!');
                    displayStatus(statusDiv, 'success', '✓ PIN godkänd');

                    // Redirect to home
                    setTimeout(() => {
                        window.location.hash = '#/home';
                    }, 500);

                } else {
                    console.warn('❌ PIN login failed: Invalid PIN');
                    displayStatus(statusDiv, 'error', '❌ Felaktig PIN-kod');
                    showWarning('⚠️ Felaktig PIN-kod');
                    
                    // Reset PIN
                    if (window._resetPin) {
                        setTimeout(() => {
                            window._resetPin();
                        }, 1000);
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

/**
 * Display status message safely
 */
function displayStatus(statusDiv, type, message) {
    if (!statusDiv) return;

    try {
        // Clear previous content
        while (statusDiv.firstChild) {
            statusDiv.removeChild(statusDiv.firstChild);
        }

        // Create status element
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

/**
 * Render error fallback
 */
function renderErrorFallback(container) {
    try {
        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 2rem; text-align: center; background: #ffe8e8; border-radius: 8px; margin: 2rem;';

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
        }
    } catch (fallbackErr) {
        console.error('❌ CRITICAL: Fallback error rendering failed:', fallbackErr);
    }
}
