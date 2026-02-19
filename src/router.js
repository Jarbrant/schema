/* ============================================================
 * FIL: src/router.js  (HEL FIL) — AUTOPATCH v9 + AO-11 FINAL
 * NAMN: ROUTER — Route Management & Navigation
 *
 * AO-06:  Route 'week-templates' → renderWeekTemplates
 * AO-07:  Route 'calendar'       → renderCalendar
 * AO-08:  Route 'control'        → renderControl
 * AO-09:  Route 'summary'        → renderSummary
 * AO-10:  Route 'rules'          → renderRules
 * AO-11:  Route 'export'         → renderExport
 *
 * ALLA ROUTES IMPLEMENTERADE — INGA PLACEHOLDERS KVAR
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports
 * ============================================================ */
import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderGroups } from './views/groups.js';
import { renderShifts } from './views/shifts.js';
import { renderWeekTemplates } from './views/week-templates.js';    // AO-06
import { renderCalendar } from './views/calendar.js';               // AO-07
import { renderControl } from './views/control.js';                 // AO-08
import { renderSummary } from './views/summary.js';                 // AO-09
import { renderRules } from './views/rules.js';                     // AO-10
import { renderExport } from './views/export.js';                   // AO-11
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

/* ============================================================
 * BLOCK 2 — DOM helpers (XSS-safe)
 * ============================================================ */
function safeClear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

/* ============================================================
 * BLOCK 3 — Route-map  (INGA PLACEHOLDERS KVAR!)
 * ============================================================ */
const routes = {
    // Public
    login: renderLogin,

    // Protected — alla implementerade
    home: renderHome,
    shifts: renderShifts,
    groups: renderGroups,
    'week-templates': renderWeekTemplates,                                         // AO-06
    personal: renderPersonal,
    calendar: renderCalendar,                                                      // AO-07
    control: renderControl,                                                        // AO-08
    summary: renderSummary,                                                        // AO-09
    rules: renderRules,                                                            // AO-10
    export: renderExport,                                                          // AO-11
};

/* ============================================================
 * BLOCK 4 — Router state (DOM hooks + ctx)
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
 * BLOCK 5 — Auth (SINGLE SOURCE OF TRUTH)
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
 * BLOCK 6 — Parse route (hash) — robust normalisering
 * - Fail-closed: okänd route -> default
 * ============================================================ */
function normalizeRouteName(name) {
    let route = String(name ?? '');
    route = route.split('?')[0];
    route = route.replace(/\/+$/, '');
    return route;
}

function parseRoute() {
    const hash = window.location.hash || '';
    let route = hash.startsWith('#/') ? hash.slice(2) : '';
    route = normalizeRouteName(route);

    if (!route) return getDefaultRoute();
    return routes[route] ? route : getDefaultRoute();
}

/* ============================================================
 * BLOCK 7 — Navbar (topbar)
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
        safeClear(navbar);
        navbar.style.display = 'none';
        debugLog('Navbar hidden (login route)');
        return true;
    }

    navbar.style.display = 'block';

    try {
        safeClear(navbar);
        renderNavbar(navbar);
        debugLog('Navbar rendered/refreshed');
    } catch (err) {
        console.error('❌ Navbar render failed:', err);
        reportError('NAVBAR_RENDER_ERROR', 'ROUTER', 'src/router.js', err?.message || String(err));
        return false;
    }

    return true;
}

function markActive(routeName) {
    const links = document.querySelectorAll('#navbar a[href^="#/"]');
    links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const linkRouteRaw = href.startsWith('#/') ? href.slice(2) : href;
        const linkRoute = normalizeRouteName(linkRouteRaw);
        link.classList.toggle('active', linkRoute === routeName);
    });
}

/* ============================================================
 * BLOCK 8 — Render route (kärnan)
 * ============================================================ */
function renderRoute(routeName) {
    try {
        debugLog(`Rendering route: ${routeName}`);

        if (!container) throw new Error('Container #app missing');

        const isLoginRoute = routeName === 'login';

        const navbarOk = setTopbarVisible(!isLoginRoute);
        if (!isLoginRoute && !navbarOk) throw new Error('Navbar setup failed');

        if (!isLoggedIn() && !isLoginRoute) {
            debugLog('Not authenticated, redirecting to login');
            if (window.location.hash !== '#/login') window.location.hash = '#/login';
            return;
        }

        const renderFn = routes[routeName] || routes[getDefaultRoute()];
        if (!renderFn) throw new Error(`Route "${routeName}" not found`);

        safeClear(container);
        renderFn(container, { ...appCtx, currentRoute: routeName });

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
 * BLOCK 9 — Event: hashchange
 * ============================================================ */
function onHashChange() {
    const route = parseRoute();
    renderRoute(route);
}

/* ============================================================
 * BLOCK 10 — setupRouter (init)
 * ============================================================ */
export function setupRouter(store) {
    if (window.__ROUTER_INIT__) {
        console.warn('⚠️ Router already initialized');
        return;
    }
    window.__ROUTER_INIT__ = true;

    console.log('🚀 Setting up router...');

    if (!store || typeof store.getState !== 'function') {
        reportError(
            'STORE_CONTRACT_FATAL',
            'ROUTER',
            'src/router.js',
            'setupRouter() fick fel input: store saknar getState()'
        );
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

    const initialRoute = parseRoute();
    debugLog(`Initial route: ${initialRoute}`);
    renderRoute(initialRoute);

    console.log('✓ Router ready — ALL VIEWS IMPLEMENTED 🎉');
}
