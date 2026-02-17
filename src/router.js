/* ============================================================
 * FIL: src/router.js  (HEL FIL) — AUTOPATCH v2 + AO-03
 * NAMN: ROUTER — Route Management & Navigation
 *
 * Fixar:
 * - P0: routes-map innehåller ALLA routes som navbar + home-snabbnav länkar till
 * - P0: okända routes failar till default (home/login) utan "tyst" beteende
 * - P0: navbar syns på ALLA skyddade routes (allt utom login)
 * - P1: placeholders för ej-implementerade vyer (stabilt i prod)
 * - AO-03: groups route pekar på renderGroups istället för placeholder
 *
 * Policy:
 * - UI-only / GitHub Pages
 * - Fail-closed
 * - Inga nya storage keys
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports
 * ============================================================ */
import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderGroups } from './views/groups.js';           // AO-03
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

/* ============================================================
 * BLOCK 2 — View helpers (placeholders)
 * ============================================================ */
function renderPlaceholder(title, note) {
  return function (container) {
    container.innerHTML = `
      <div class="view-container">
        <h2>${title}</h2>
        <p class="empty-state">
          ${note || 'Denna vy är under utveckling.'}
        </p>
      </div>
    `;
  };
}

/* ============================================================
 * BLOCK 3 — CALENDAR view (din baseline)
 * ============================================================ */
export function renderCalendar(container, ctx) {
  const store = ctx?.store;
  if (!store) {
    container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
    return;
  }

  const state = store.getState();

  if (!state.schedule || state.schedule.year !== 2026) {
    container.innerHTML =
      '<div class="view-container"><h2>Kalender</h2><p class="error-text">Schedule är korrupt eller fel år. Kan inte visa kalender.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="view-container">
      <h2>Kalender 2026</h2>
      <p class="empty-state">
        📅 Kalendervyn är under utveckling (AO-09+).<br>
        För nu: Använd "Personal" för att lägga till personal och "Kontroll" för att se statistik.
      </p>
    </div>
  `;
}

/* ============================================================
 * BLOCK 4 — Route-map (ENDA källan för vilka views som finns)
 * OBS: Måste matcha href i navbar (ui.js) + home-snabbnav
 * ============================================================ */
const routes = {
  // Public
  login: renderLogin,

  // Protected
  home: renderHome,
  shifts: renderPlaceholder('Skift', '📋 Skiftvyn är under utveckling.'),
  groups: renderGroups,                                      // AO-03 (var renderPlaceholder)
  personal: renderPersonal,
  calendar: renderCalendar,
  control: renderPlaceholder('Kontroll', '✓ Kontrollvyn är under utveckling.'),
  summary: renderPlaceholder('Sammanställning', '📊 Sammanställningsvyn är under utveckling.'),
  rules: renderPlaceholder('Regler', '⚖️ Regelvyn är under utveckling.'),
  export: renderPlaceholder('Export', '💾 Export/Import är under utveckling.')
};

/* ============================================================
 * BLOCK 5 — Router state (DOM hooks + ctx)
 * ============================================================ */
let container = null;
let errorPanel = null;
let appCtx = null;

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;
function debugLog(message) {
  if (!DEBUG) return;
  console.log(`📊 ${message}`);
}

function safeClear(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

/* ============================================================
 * BLOCK 6 — Auth (SINGLE SOURCE OF TRUTH)
 * - Fail-closed: om oklart -> false
 * ============================================================ */
function isLoggedIn() {
  try {
    if (!appCtx || !appCtx.store) return false;

    const store = appCtx.store;
    if (typeof store.getState !== 'function') {
      reportError('STORE_CONTRACT_ERROR', 'ROUTER', 'src/router.js', 'Store saknar getState()');
      return false;
    }

    const state = store.getState();
    return state && state.isLoggedIn === true;
  } catch (err) {
    reportError('AUTH_READ_FAILED', 'ROUTER', 'src/router.js', err?.message || 'Kunde inte läsa auth-state');
    return false;
  }
}

function getDefaultRoute() {
  return isLoggedIn() ? 'home' : 'login';
}

/* ============================================================
 * BLOCK 7 — Parse route (hash)
 * - Fail-closed: okänd route -> default
 * ============================================================ */
function parseRoute() {
  const hash = window.location.hash || '';
  let route = hash.startsWith('#/') ? hash.slice(2) : '';
  route = route.split('?')[0];

  if (!route) return getDefaultRoute();
  return routes[route] ? route : getDefaultRoute();
}

/* ============================================================
 * BLOCK 8 — Navbar (topbar)
 * - Login ska vara "ren" sida utan navbar
 * ============================================================ */
function setTopbarVisible(isVisible) {
  const navbar = document.getElementById('navbar');

  if (!navbar) {
    console.error('❌ DOM element #navbar missing');
    reportError('DOM_ERROR', 'ROUTER', 'src/router.js', '#navbar element not found');
    return false;
  }

  if (!isVisible) {
    navbar.innerHTML = '';
    navbar.style.display = 'none';
    debugLog('Navbar hidden (login route)');
    return true;
  }

  // Viktigt: återställ från "display:none" på andra routes
  navbar.style.display = 'block';

  // Rendera navbar om tom
  if (navbar.childNodes.length === 0) {
    try {
      renderNavbar(navbar);
      debugLog('Navbar rendered');
    } catch (err) {
      console.error('❌ Navbar render failed:', err);
      reportError('NAVBAR_RENDER_ERROR', 'ROUTER', 'src/router.js', err?.message || String(err));
      return false;
    }
  }

  return true;
}

function markActive(routeName) {
  const links = document.querySelectorAll('#navbar a[href^="#/"]');
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const linkRoute = href.startsWith('#/') ? href.slice(2) : href;
    link.classList.toggle('active', linkRoute === routeName);
  });
}

/* ============================================================
 * BLOCK 9 — Render route (kärnan)
 * ============================================================ */
function renderRoute(routeName) {
  try {
    debugLog(`Rendering route: ${routeName}`);

    if (!container) throw new Error('Container #app missing');

    const isLoginRoute = routeName === 'login';

    // 1) Navbar
    const navbarOk = setTopbarVisible(!isLoginRoute);
    if (!isLoginRoute && !navbarOk) throw new Error('Navbar setup failed');

    // 2) Auth-guard: inte inloggad + inte login -> login
    if (!isLoggedIn() && !isLoginRoute) {
      debugLog('Not authenticated, redirecting to login');
      window.location.hash = '#/login';
      return;
    }

    // 3) Render-funktion
    const renderFn = routes[routeName] || routes[getDefaultRoute()];
    if (!renderFn) throw new Error(`Route "${routeName}" not found`);

    // 4) Render
    safeClear(container);
    renderFn(container, { ...appCtx, currentRoute: routeName });

    // 5) Active link (ej på login)
    if (!isLoginRoute) markActive(routeName);

    debugLog(`Route rendered: ${routeName}`);
  } catch (err) {
    console.error(`❌ Route render failed: ${routeName}`, err);

    reportError('ROUTE_RENDER_ERROR', 'ROUTER', 'src/router.js', err?.message || 'Route render failed');

    if (errorPanel) {
      try {
        renderError(errorPanel, err);
      } catch (uiErr) {
        console.error('❌ Error panel render failed:', uiErr);
        errorPanel.textContent = `❌ Error: ${err?.message || 'Okänt fel'}`;
        errorPanel.style.display = 'block';
      }
    } else {
      console.error('⚠️ Error panel #error-panel missing, cannot display error');
    }
  }
}

/* ============================================================
 * BLOCK 10 — Event: hashchange
 * ============================================================ */
function onHashChange() {
  const route = parseRoute();
  renderRoute(route);
}

/* ============================================================
 * BLOCK 11 — setupRouter (init)
 * ============================================================ */
export function setupRouter(store) {
  if (window.__ROUTER_INIT__) {
    console.warn('⚠️ Router already initialized');
    return;
  }
  window.__ROUTER_INIT__ = true;

  console.log('🚀 Setting up router...');

  // Store-kontrakt
  if (!store || typeof store.getState !== 'function') {
    reportError(
      'STORE_CONTRACT_FATAL',
      'ROUTER',
      'src/router.js',
      'setupRouter() fick fel input: store saknar getState()'
    );
    throw new Error('FATAL: Invalid store (getState missing)');
  }

  // DOM-kontrakt
  container = document.getElementById('app');
  errorPanel = document.getElementById('error-panel');
  const navbar = document.getElementById('navbar');

  if (!container) throw new Error('FATAL: DOM element #app not found');
  if (!errorPanel) throw new Error('FATAL: DOM element #error-panel not found');
  if (!navbar) throw new Error('FATAL: DOM element #navbar not found');

  appCtx = { store };

  window.addEventListener('hashchange', onHashChange, { passive: true });

  const initialRoute = parseRoute();
  debugLog(`Initial route: ${initialRoute}`);
  renderRoute(initialRoute);

  console.log('✓ Router ready');
}
