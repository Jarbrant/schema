/*
 * LOGIN.JS — Login View
 * 
 * AO-06 Update:
 * - Secure rendering (no innerHTML with user input)
 * - Fail-closed validation
 * - Safe error handling via Diagnostics
 */

import { showSuccess, showWarning } from '../ui.js';
import { reportError, diagnostics } from '../diagnostics.js';

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
    const state = typeof window !== 'undefined' 
        ? sessionStorage.getItem('schema_user') 
        : null;
    return state ? JSON.parse(state).isLoggedIn === true : false;
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

        // Create login form elements (NO innerHTML with user input)
        const loginContainer = document.createElement('div');
        loginContainer.className = 'login-container';

        const loginBox = document.createElement('div');
        loginBox.className = 'login-box';

        // Header
        const header = document.createElement('div');
        header.className = 'login-header';

        const title = document.createElement('h1');
        title.textContent = '📅 Schema-Program';
        title.className = 'login-title';

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Logga in för att komma igång';
        subtitle.className = 'login-subtitle';

        header.appendChild(title);
        header.appendChild(subtitle);

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
        usernameInput.className = 'login-input';
        usernameInput.placeholder = 'Ex: anna.ström';
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
        passwordInput.className = 'login-input';
        passwordInput.placeholder = 'Ditt lösenord';
        passwordInput.required = true;
        passwordInput.autocomplete = 'current-password';

        passwordGroup.appendChild(passwordLabel);
        passwordGroup.appendChild(passwordInput);

        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary login-btn';
        submitBtn.textContent = '🔓 Logga in';

        form.appendChild(usernameGroup);
        form.appendChild(passwordGroup);
        form.appendChild(submitBtn);

        // Error/Status message (initially hidden)
        const statusDiv = document.createElement('div');
        statusDiv.className = 'login-status';
        statusDiv.id = 'login-status';
        statusDiv.style.display = 'none';

        // Demo info
        const demoInfo = document.createElement('div');
        demoInfo.className = 'login-demo-info';

        const demoTitle = document.createElement('strong');
        demoTitle.textContent = 'Demo-inloggning:';

        const demoParagraph = document.createElement('p');
        demoParagraph.className = 'demo-credentials';
        demoParagraph.textContent = 'Användarnamn: demo | Lösenord: demo123';

        demoInfo.appendChild(demoTitle);
        demoInfo.appendChild(demoParagraph);

        // Assemble login box
        loginBox.appendChild(header);
        loginBox.appendChild(form);
        loginBox.appendChild(statusDiv);
        loginBox.appendChild(demoInfo);

        // Assemble container
        loginContainer.appendChild(loginBox);
        container.appendChild(loginContainer);

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

        // Fallback rendering
        if (container) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center;"><h2>⚠️ Ett fel uppstod</h2><p>Inloggningssidan kunde inte läsas in.</p><button onclick="window.location.reload()">Ladda om</button></div>';
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
        // Get input values (sanitize automatically by textContent/value)
        const username = form.querySelector('#login-username')?.value?.trim() || '';
        const password = form.querySelector('#login-password')?.value || '';

        // Fail-closed validation
        if (!username || username.length < 2) {
            showWarning('⚠️ Användarnamn krävs (min 2 tecken)');
            displayStatus(statusDiv, 'error', 'Användarnamn krävs');
            return;
        }

        if (!password || password.length < 4) {
            showWarning('⚠️ Lösenord krävs (min 4 tecken)');
            displayStatus(statusDiv, 'error', 'Lösenord krävs');
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
                // Simple demo validation (fail-closed: only demo/demo123)
                const isValid = username.toLowerCase() === 'demo' && password === 'demo123';

                if (isValid) {
                    console.log('✓ Login successful');

                    // Save login state
                    const loginData = {
                        isLoggedIn: true,
                        username: username,
                        loginTime: new Date().toISOString()
                    };
                    sessionStorage.setItem('schema_user', JSON.stringify(loginData));

                    // Update app context
                    if (ctx?.store) {
                        const state = ctx.store.getState();
                        ctx.store.setState({
                            ...state,
                            isLoggedIn: true,
                            user: { name: username }
                        });
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

                    // Reset form
                    form.reset();
                    form.querySelector('#login-username')?.focus();
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
 * Display status message safely
 */
function displayStatus(statusDiv, type, message) {
    if (!statusDiv) return;

    // Clear previous content
    while (statusDiv.firstChild) {
        statusDiv.removeChild(statusDiv.firstChild);
    }

    // Create status element
    const statusElement = document.createElement('div');
    statusElement.className = `login-status-${type}`;

    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.style.margin = '0';

    statusElement.appendChild(messageElement);
    statusDiv.appendChild(statusElement);
    statusDiv.style.display = 'block';
}
