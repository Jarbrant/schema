/*
 * AO-06 — LOGIN: Inloggning med PIN
 */

const SESSION_KEY = 'SCHEMA_APP_V1_SESSION';
const DEFAULT_PIN = '123456';

export function renderLogin(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const hasError = store.getLastError();
    const loggedIn = isLoggedIn();

    const isFirstStart = !loggedIn && (!state.settings?.pinHash || state.settings.pinHash === '');

    const html = `
        <div class="login-page">
            <div class="login-container">
                <div class="login-card">
                    <h1>🔒 Schema-Program</h1>
                    
                    ${loggedIn ? renderLoggedInSection() : renderLoginSection(state, hasError, isFirstStart)}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    if (loggedIn) {
        const logoutBtn = container.querySelector('#logout-from-settings-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Logga ut?')) {
                    logout();
                }
            });
        }
    } else {
        const loginForm = container.querySelector('#login-form');
        if (loginForm && !hasError) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleLogin(store, container, ctx);
            });
        }

        const pinInput = container.querySelector('#pin-input');
        if (pinInput) {
            pinInput.value = '';
            pinInput.focus();
        }
    }
}

function renderLoginSection(state, hasError, isFirstStart) {
    return `
        <h2>Logga in</h2>

        ${hasError ? `<div class="alert alert-error"><h4>❌ Datafel</h4><p>${escapeHtml(hasError.message)}</p></div>` : ''}

        ${isFirstStart ? `<div class="alert alert-info"><h4>ℹ️ Första start</h4><p>Standardkod är: <code>${DEFAULT_PIN}</code></p></div>` : ''}

        <form id="login-form" class="login-form" ${hasError ? 'style="pointer-events:none;opacity:0.5;"' : ''}>
            <div class="form-group">
                <label for="pin-input">PIN-kod:</label>
                <input
                    type="password"
                    id="pin-input"
                    name="pin"
                    placeholder="Ange PIN-kod"
                    maxlength="20"
                    autofocus
                    ${hasError ? 'disabled' : ''}
                >
            </div>

            <button type="submit" class="btn btn-primary btn-login" ${hasError ? 'disabled' : ''}>
                Logga in
            </button>

            <div id="login-error" class="login-error hidden"></div>
        </form>

        <div class="login-footer">
            <p class="footer-text">Schema-Program v1.0 | HRF/Visita Gröna Riks</p>
        </div>
    `;
}

function renderLoggedInSection() {
    return `
        <h2>Inloggad ✓</h2>
        <div class="logged-in-section">
            <p class="logged-in-text">Du är inloggad i Schema-Program.</p>
            <button id="logout-from-settings-btn" class="btn btn-secondary">
                🚪 Logga ut
            </button>
        </div>
    `;
}

async function handleLogin(store, container, ctx) {
    try {
        const pinInput = container.querySelector('#pin-input');
        const enteredPin = pinInput.value;
        const errorDiv = container.querySelector('#login-error');

        if (!enteredPin) {
            showError(errorDiv, 'Ange en PIN-kod');
            return;
        }

        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';

        const state = store.getState();
        let pinHash = state.settings?.pinHash;

        if (!pinHash) {
            try {
                const defaultHash = await hashPin(DEFAULT_PIN);
                store.update((s) => {
                    s.settings.pinHash = defaultHash;
                    return s;
                });
                pinHash = defaultHash;
            } catch (hashErr) {
                console.error('Hash-fel vid init', hashErr);
                showError(errorDiv, 'Kunde inte initialisera PIN. Försök igen.');
                return;
            }
        }

        let enteredHash;
        try {
            enteredHash = await hashPin(enteredPin);
        } catch (hashErr) {
            console.error('Hash-fel', hashErr);
            showError(errorDiv, 'Krypteringsfel. Försök igen.');
            return;
        }

        if (enteredHash !== pinHash) {
            showError(errorDiv, 'Felaktig PIN-kod');
            pinInput.value = '';
            return;
        }

        const session = {
            ok: true,
            ts: Date.now(),
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

        console.log('Inloggning lyckades');
        window.location.hash = '#/home';
    } catch (err) {
        console.error('Login-fel', err);
        const errorDiv = container.querySelector('#login-error');
        showError(errorDiv, `Fel: ${err.message}`);
    }
}

function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export function isLoggedIn() {
    const sessionJson = sessionStorage.getItem(SESSION_KEY);
    if (!sessionJson) {
        return false;
    }

    try {
        const session = JSON.parse(sessionJson);
        return session.ok === true;
    } catch {
        return false;
    }
}

export function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.hash = '#/login';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}
