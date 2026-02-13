/*
 * AO-06 — LOGIN: Inloggning med PIN (AUTOPATCH v1)
 * FIL: src/views/login.js
 *
 * Fail-closed:
 * - Om store saknas -> tydligt fel
 * - Session i sessionStorage (inte localStorage)
 * - Ingen osäker HTML för feltexter (escapeHtml)
 */

const SESSION_KEY = 'SCHEMA_APP_V1_SESSION';
const DEFAULT_PIN = '123456';

export function renderLogin(container, ctx) {
  const store = ctx?.store;
  if (!store) {
    container.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'view-container';
    const h2 = document.createElement('h2');
    h2.textContent = 'Fel';
    const p = document.createElement('p');
    p.textContent = 'Store saknas.';
    wrap.appendChild(h2);
    wrap.appendChild(p);
    container.appendChild(wrap);
    return;
  }

  const state = store.getState();
  const hasError = store.getLastError ? store.getLastError() : null;
  const loggedIn = isLoggedIn();
  const isFirstStart = !loggedIn && (!state.settings?.pinHash || state.settings.pinHash === '');

  // Render (enkel, men safe för feltexter)
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
        if (confirm('Logga ut?')) logout();
      });
    }
    return;
  }

  const loginForm = container.querySelector('#login-form');
  const pinInput = container.querySelector('#pin-input');

  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }

  if (loginForm && !hasError) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin(store, container);
    });
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
      <button id="logout-from-settings-btn" class="btn btn-secondary">🚪 Logga ut</button>
    </div>
  `;
}

async function handleLogin(store, container) {
  try {
    const pinInput = container.querySelector('#pin-input');
    const enteredPin = pinInput ? pinInput.value : '';
    const errorDiv = container.querySelector('#login-error');

    if (!enteredPin) {
      showError(errorDiv, 'Ange en PIN-kod');
      return;
    }

    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }

    const state = store.getState();
    let pinHash = state.settings?.pinHash;

    // Initiera default pinHash första gången
    if (!pinHash) {
      const defaultHash = await hashPin(DEFAULT_PIN);
      store.update((s) => {
        s.settings.pinHash = defaultHash;
        return s;
      });
      pinHash = defaultHash;
    }

    const enteredHash = await hashPin(enteredPin);

    if (enteredHash !== pinHash) {
      showError(errorDiv, 'Felaktig PIN-kod');
      if (pinInput) pinInput.value = '';
      return;
    }

    // Session (fail-closed: minimal info)
    const session = { ok: true, ts: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    window.location.hash = '#/home';
  } catch (err) {
    console.error('LOGIN_FAIL', err);
    const errorDiv = container.querySelector('#login-error');
    showError(errorDiv, 'Fel vid inloggning. Försök igen.');
  }
}

function showError(errorDiv, message) {
  if (!errorDiv) return;
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(pin || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isLoggedIn() {
  const sessionJson = sessionStorage.getItem(SESSION_KEY);
  if (!sessionJson) return false;

  try {
    const session = JSON.parse(sessionJson);
    return session && session.ok === true;
  } catch (_) {
    return false;
  }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.hash = '#/login';
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
