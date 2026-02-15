/* ============================================================
 * FIL: src/router.js
 * NAMN: ROUTER — Route Management & Navigation (AUTOPATCH v2)
 *
 * MÅL:
 * - Stabil hash-routing för GitHub Pages
 * - Fail-closed: inga tysta blank-sidor
 * - Auth-sanning: store.getState().isLoggedIn (EN källa)
 *
 * FIX:
 * - Kalender och andra routes saknades i routes-map => allt föll tillbaka
 * - Lägger till lazy routes (dynamic import) så router inte spricker om view saknas
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports (endast säkra / existerande)
 * ============================================================ */
import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

/* ============================================================
 * BLOCK 2 — Router state (DOM hooks + ctx)
 * ============================================================ */
let container = null;
let errorPanel = null;
let appCtx = null;

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

function debugLog(message) {
  if (!DEBUG) return;
  console.log(`📊 ${message}`);
}

/* ============================================================
 * BLOCK 3 — Helpers
 * ============================================================ */
function safeClear(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function safeSetHash(nextHash) {
  // Undvik onödiga loopar
  if ((window.location.hash || '') === nextHash) return;
  window.location.hash = nextHash;
}

/* ============================================================
 * BLOCK 4 — Auth (SINGLE SOURCE OF TRUTH)
 * - Fail-closed: om något är oklart -> false
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
    reportError(
      'AUTH_READ_FAILED',
      'ROUTER',
      'src/router.js',
      err?.message || 'Kunde inte läsa auth-state'
    );
    return false;
  }
}

function getDefaultRoute() {
  return isLoggedIn() ? 'home' : 'login';
}

/* ============================================================
 * BLOCK 5 — Route parsing
 * ============================================================ */
function parseRoute() {
  const hash = window.location.hash || '';
  let route = hash.startsWith('#/') ? hash.slice(2) : '';
  route = route.split('?')[0].trim();

  // Tom hash => default
  if (!route) return getDefaultRoute();
  return route;
}

/* ============================================================
 * BLOCK 6 — Navbar (topbar)
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

  navbar.style.display = 'block';

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
 * BLOCK 7 — Lazy views (dynamic import)
 * - Router kan stödja routes även om view inte är “hard-importad”
 * - Fail-closed om filen saknas eller export saknas
 * ============================================================ */
async function lazyView(modulePath, exportName) {
  try {
    const mod = await import(modulePath);
    const fn = mod?.[exportName];
    if (typeof fn !== 'function') {
      throw new Error(`Export "${exportName}" saknas i ${modulePath}`);
    }
    return fn;
  } catch (err) {
    reportError(
      'LAZY_VIEW_LOAD_FAILED',
      'ROUTER',
      'src/router.js',
      `${modulePath} → ${err?.message || String(err)}`
    );
    throw err;
  }
}

/* ============================================================
 * BLOCK 8 — Route-map (ENDA källan för vilka views som finns)
 * OBS: Vi håller home/personal/login sync + resten lazy.
 * ============================================================ */
const routes = {
  // Public
  login: async (el, ctx) => renderLogin(el, ctx),

  // Protected
  home: async (el, ctx) => renderHome(el, ctx),
  personal: async (el, ctx) => renderPersonal(el, ctx),

  // Nya: Kalender (lazy)
  calendar: async (el, ctx) => {
    const renderCalendar = await lazyView('./views/calendar.js', 'renderCalendar');
    return renderCalendar(el, ctx);
  },

  // Du kan lägga till fler senare utan att hårdimporta:
  // control: async (el, ctx) => (await lazyView('./views/control.js','renderControl'))(el, ctx),
  // summary: async (el, ctx) => (await lazyView('./views/summary.js','renderSummary'))(el, ctx),
  // rules: async (el, ctx) => (await lazyView('./views/rules.js','renderRules'))(el, ctx),
  // export: async (el, ctx) => (await lazyView('./views/export.js','renderExport'))(el, ctx),
};

function routeExists(routeName) {
  return typeof routes[routeName] === 'function';
}

/* ============================================================
 * BLOCK 9 — Render route (kärnan) — ASYNC
 * ============================================================ */
async function renderRoute(routeName) {
  try {
    debugLog(`Rendering route: ${routeName}`);

    if (!container) throw new Error('Container #app missing');

    // Okänd route => fail-closed till default
    if (!routeExists(routeName)) {
      const fallback = getDefaultRoute();
      debugLog(`Unknown route "${routeName}" -> fallback "${fallback}"`);
      safeSetHash(`#/` + fallback);
      return;
    }

    const isLoginRoute = routeName === 'login';

    // 1) Navbar
    const navbarOk = setTopbarVisible(!isLoginRoute);
    if (!isLoginRoute && !navbarOk) throw new Error('Navbar setup failed');

    // 2) Auth-guard
    if (!isLoggedIn() && !isLoginRoute) {
      debugLog('Not authenticated, redirecting to login');
      safeSetHash('#/login');
      return;
    }

    // 3) Render
    const renderFn = routes[routeName];
    safeClear(container);

    await renderFn(container, { ...appCtx, currentRoute: routeName });

    // 4) Active link markering (ej på login)
    if (!isLoginRoute) markActive(routeName);

    debugLog(`Route rendered: ${routeName}`);
  } catch (err) {
    console.error(`❌ Route render failed: ${routeName}`, err);

    reportError(
      'ROUTE_RENDER_ERROR',
      'ROUTER',
      'src/router.js',
      err?.message || 'Route render failed'
    );

    // Fail-closed: visa felpanel + fallback
    if (errorPanel) {
      try {
        renderError(errorPanel, err);
      } catch (uiErr) {
        console.error('❌ Error panel render failed:', uiErr);
        errorPanel.textContent = `❌ Error: ${err?.message || 'Okänt fel'}`;
        errorPanel.style.display = 'block';
      }
    }

    // Skydd: om en protected route failar -> tillbaka till home
    if (routeName !== 'login') {
      safeSetHash('#/home');
    }
  }
}

/* ============================================================
 * BLOCK 10 — Event: hashchange
 * ============================================================ */
function onHashChange() {
  const route = parseRoute();
  void renderRoute(route);
}

/* ============================================================
 * BLOCK 11 — setupRouter (init)
 * ============================================================ */
export function setupRouter(store) {
  // Skydd mot dubbel-init
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

  debugLog('DOM elements validated');

  // Context
  appCtx = { store };

  // Listen + first render
  window.addEventListener('hashchange', onHashChange, { passive: true });

  const initialRoute = parseRoute();
  debugLog(`Initial route: ${initialRoute}`);
  void renderRoute(initialRoute);

  console.log('✓ Router ready');
}
