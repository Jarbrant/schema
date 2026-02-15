/* ============================================================
 * FIL: src/router.js
 * ROUTER — Route Management & Navigation (AUTOPATCH v3)
 *
 * - Hash routing för GitHub Pages
 * - Fail-closed (felpanel + fallback)
 * - Auth-sanning: store.getState().isLoggedIn
 * - Stödjer: login, home, personal, calendar, control, summary, rules, export
 * - Lazy imports för allt utom home/personal/login
 * ============================================================ */

import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

let container = null;
let errorPanel = null;
let appCtx = null;

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;
function debugLog(msg) { if (DEBUG) console.log(`📊 ${msg}`); }

function safeClear(el) { if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }
function safeSetHash(nextHash) { if ((window.location.hash || '') !== nextHash) window.location.hash = nextHash; }

/* ---------------- Auth ---------------- */
function isLoggedIn() {
  try {
    if (!appCtx?.store) return false;
    const store = appCtx.store;
    if (typeof store.getState !== 'function') {
      reportError('STORE_CONTRACT_ERROR', 'ROUTER', 'src/router.js', 'Store saknar getState()');
      return false;
    }
    const state = store.getState();
    return state?.isLoggedIn === true;
  } catch (err) {
    reportError('AUTH_READ_FAILED', 'ROUTER', 'src/router.js', err?.message || 'Kunde inte läsa auth-state');
    return false;
  }
}

function getDefaultRoute() {
  return isLoggedIn() ? 'home' : 'login';
}

/* ---------------- Parse ---------------- */
function parseRoute() {
  const hash = window.location.hash || '';
  let route = hash.startsWith('#/') ? hash.slice(2) : '';
  route = route.split('?')[0].trim();
  return route || getDefaultRoute();
}

/* ---------------- Navbar ---------------- */
function setTopbarVisible(isVisible) {
  const navbar = document.getElementById('navbar');
  if (!navbar) {
    reportError('DOM_ERROR', 'ROUTER', 'src/router.js', '#navbar element not found');
    return false;
  }

  if (!isVisible) {
    navbar.innerHTML = '';
    navbar.style.display = 'none';
    return true;
  }

  navbar.style.display = 'block';
  if (navbar.childNodes.length === 0) {
    try { renderNavbar(navbar); }
    catch (err) {
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

/* ---------------- Lazy view loader ---------------- */
async function lazyView(modulePath, exportName) {
  const mod = await import(modulePath);
  const fn = mod?.[exportName];
  if (typeof fn !== 'function') throw new Error(`Export "${exportName}" saknas i ${modulePath}`);
  return fn;
}

/* ---------------- Routes ----------------
 * Alla “extra” routes är lazy.
 * När du skapar filer senare så börjar de fungera direkt.
 */
const routes = {
  login: async (el, ctx) => renderLogin(el, ctx),

  home: async (el, ctx) => renderHome(el, ctx),
  personal: async (el, ctx) => renderPersonal(el, ctx),

  calendar: async (el, ctx) => (await lazyView('./views/calendar.js', 'renderCalendar'))(el, ctx),
  control: async (el, ctx) => (await lazyView('./views/control.js', 'renderControl'))(el, ctx),
  summary: async (el, ctx) => (await lazyView('./views/summary.js', 'renderSummary'))(el, ctx),
  rules: async (el, ctx) => (await lazyView('./views/rules.js', 'renderRules'))(el, ctx),
  export: async (el, ctx) => (await lazyView('./views/export.js', 'renderExport'))(el, ctx),
};

function routeExists(routeName) {
  return typeof routes[routeName] === 'function';
}

/* ---------------- Render ---------------- */
async function renderRoute(routeName) {
  try {
    if (!container) throw new Error('Container #app missing');

    if (!routeExists(routeName)) {
      const fb = getDefaultRoute();
      debugLog(`Unknown route "${routeName}" -> "${fb}"`);
      safeSetHash(`#/` + fb);
      return;
    }

    const isLoginRoute = routeName === 'login';

    const navbarOk = setTopbarVisible(!isLoginRoute);
    if (!isLoginRoute && !navbarOk) throw new Error('Navbar setup failed');

    if (!isLoggedIn() && !isLoginRoute) {
      safeSetHash('#/login');
      return;
    }

    safeClear(container);
    await routes[routeName](container, { ...appCtx, currentRoute: routeName });

    if (!isLoginRoute) markActive(routeName);
  } catch (err) {
    console.error(`❌ Route render failed: ${routeName}`, err);

    reportError('ROUTE_RENDER_ERROR', 'ROUTER', 'src/router.js', err?.message || 'Route render failed');

    if (errorPanel) {
      try { renderError(errorPanel, err); }
      catch {
        errorPanel.textContent = `❌ Error: ${err?.message || 'Okänt fel'}`;
        errorPanel.style.display = 'block';
      }
    }

    // Fail-closed fallback
    if (routeName !== 'login') safeSetHash('#/home');
  }
}

function onHashChange() {
  void renderRoute(parseRoute());
}

/* ---------------- Init ---------------- */
export function setupRouter(store) {
  if (window.__ROUTER_INIT__) return;
  window.__ROUTER_INIT__ = true;

  if (!store || typeof store.getState !== 'function') {
    reportError('STORE_CONTRACT_FATAL', 'ROUTER', 'src/router.js', 'setupRouter() fick fel input: store saknar getState()');
    throw new Error('FATAL: Invalid store (getState missing)');
  }

  container = document.getElementById('app');
  errorPanel = document.getElementById('error-panel');

  const navbar = document.getElementById('navbar');
  if (!container) throw new Error('FATAL: DOM element #app not found');
  if (!errorPanel) throw new Error('FATAL: DOM element #error-panel not found');
  if (!navbar) throw new Error('FATAL: DOM element #navbar not found');

  appCtx = { store };

  window.addEventListener('hashchange', onHashChange, { passive: true });

  void renderRoute(parseRoute());
  console.log('✓ Router ready');
}
