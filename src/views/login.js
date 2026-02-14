/*
 * LOGIN.JS — Login View (BUGFIX v2)
 * 
 * AO-06 Update:
 * - Secure rendering (no innerHTML with user input)
 * - Fail-closed validation
 * - Safe error handling via Diagnostics
 * - BUGFIX: Fixed sessionStorage parsing, form reset, and error fallback
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
 * Render login view
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
        loginCard.className = 'login-card';

        // Header
        const title = document.createElement('h1');
        title.textContent = '📅 Schema-Program';

        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Logga in';

        // Form
        const form = document.createElement('form');
        form.className = 'login-form';
        form.id = 'login-form';

        // Username field
        const usernameGroup = document.createElement('div');
        usernameGroup.className = 'form-group';

        const usernameLabel = document.createElement('label');
        usernameLabel.textContent = 'Användarnamn';
        usernameLabel.setAttribute('for', 'login-username');

        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.id = 'login-username';
        usernameInput.className = 'form-control';
        usernameInput.placeholder = 'Ex: demo';
        usernameInput.required = true;
        usernameInput.autocomplete = 'username';

        usernameGroup.appendChild(usernameLabel);
        usernameGroup.appendChild(usernameInput);

        // Password field
        const passwordGroup = document.createElement('div');
        passwordGroup.className = 'form-group';

        const passwordLabel = document.createElement('label');
        passwordLabel.textContent = 'Lösenord';
        passwordLabel.setAttribute('for', 'login-password');

        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.id = 'login-password';
        passwordInput.className = 'form-control';
        passwordInput.placeholder = 'Ditt lösenord';
        passwordInput.required = true;
        passwordInput.autocomplete = 'current-password';

        passwordGroup.appendChild(passwordLabel);
        passwordGroup.appendChild(passwordInput);

        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary btn-login';
        submitBtn.textContent = '🔓 Logga in';

        form.appendChild(usernameGroup);
        form.appendChild(passwordGroup);
        form.appendChild(submitBtn);

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
        demoTitle.textContent = 'Demo-inloggning:';

        const demoParagraph = document.createElement('p');
        demoParagraph.style.margin = '0.5rem 0 0 0';
        demoParagraph.textContent = 'Användarnamn: demo | Lösenord: demo123';

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
        loginCard.appendChild(form);
        loginCard.appendChild(statusDiv);
        loginCard.appendChild(demoInfo);
        loginCard.appendChild(footer);

        // Assemble container
        loginContainer.appendChild(loginCard);

        // Assemble page
        loginPage.appendChild(loginContainer);

        // Add to DOM
        container.appendChild(loginPage);

        console.log('✓ Login form rendered');

        // Setup event listeners
        setupLoginListeners(form, statusDiv, ctx);

    } catch (err) {
        console.error('❌ Error rendering login:', err);
        reportError(
            'LOGIN_RENDER_ERROR',
            'LOGIN_VIEW',
            'src/views/login.js',
            'Inloggningssidan kunde inte renderas'
        );

        // Fallback: Safe DOM-based error display
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
                errorMsg.textContent = 'Inloggningssidan kunde inte läsas in. Försök ladda om sidan.';
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
}

/**
 * Setup login form event listeners
 */
function setupLoginListeners(form, statusDiv, ctx) {
    try {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin(form, statusDiv, ctx);
        });

        console.log('✓ Login listeners setup');

    } catch (err) {
        console.error('❌ Error setting up login listeners:', err);
        reportError(
            'LOGIN_LISTENER_SETUP_ERROR',
            'LOGIN_VIEW',
            'src/views/login.js',
            'Login-formuläret kunde inte initialiseras'
        );
    }
}

/**
 * Handle login form submission
 */
function handleLogin(form, statusDiv, ctx) {
    try {
        // Get input values (safe extraction)
        const usernameInput = form.querySelector('#login-username');
        const passwordInput = form.querySelector('#login-password');

        if (!usernameInput || !passwordInput) {
            throw new Error('Form inputs not found');
        }

        const username = (usernameInput.value || '').trim();
        const password = passwordInput.value || '';

        // Fail-closed validation
        if (!username || username.length < 2) {
            showWarning('⚠️ Användarnamn krävs (min 2 tecken)');
            displayStatus(statusDiv, 'error', 'Användarnamn krävs');
            usernameInput.focus();
            return;
        }

        if (!password || password.length < 4) {
            showWarning('⚠️ Lösenord krävs (min 4 tecken)');
            displayStatus(statusDiv, 'error', 'Lösenord krävs');
            passwordInput.focus();
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '🔄 Loggar in...';
        }

        // Simulate API call (in real app: call backend)
        setTimeout(() => {
            try {
                // Fail-closed: only demo/demo123
                const isValid = username.toLowerCase() === 'demo' && password === 'demo123';

                if (isValid) {
                    console.log('✓ Login successful');

                    // Save login state safely
                    try {
                        const loginData = {
                            isLoggedIn: true,
                            username: username,
                            loginTime: new Date().toISOString()
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
                                user: { name: username }
                            });
                        } catch (stateErr) {
                            console.warn('⚠️ Failed to update state:', stateErr);
                        }
                    }

                    showSuccess('✓ Inloggning lyckades!');
                    displayStatus(statusDiv, 'success', '✓ Inloggning lyckades');

                    // Redirect to home
                    setTimeout(() => {
                        window.location.hash = '#/home';
                    }, 500);

                } else {
                    console.warn('❌ Login failed: Invalid credentials');
                    displayStatus(statusDiv, 'error', '❌ Ogiltiga inloggningsuppgifter');
                    showWarning('⚠️ Ogiltiga inloggningsuppgifter');

                    // Reset form safely
                    try {
                        form.reset();
                        usernameInput.focus();
                    } catch (resetErr) {
                        console.warn('⚠️ Failed to reset form:', resetErr);
                    }
                }

            } catch (err) {
                console.error('❌ Login processing error:', err);
                displayStatus(statusDiv, 'error', '❌ Ett fel uppstod vid inloggning');
                showWarning('⚠️ Ett fel uppstod');
            } finally {
                // Reset button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '🔓 Logga in';
                }
            }
        }, 800);

    } catch (err) {
        console.error('❌ Error handling login:', err);
        reportError(
            'LOGIN_HANDLE_ERROR',
            'LOGIN_VIEW',
            'src/views/login.js',
            'Inloggning kunde inte bearbetas'
        );
        showWarning('⚠️ Ett kritiskt fel uppstod');
    }
}

/**
 * Display status message safely (DOM-based, no innerHTML)
 */
function displayStatus(statusDiv, type, message) {
    if (!statusDiv) return;

    try {
        // Clear previous content safely
        while (statusDiv.firstChild) {
            statusDiv.removeChild(statusDiv.firstChild);
        }

        // Create status element
        const statusElement = document.createElement('div');
        statusElement.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;

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
