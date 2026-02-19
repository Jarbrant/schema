/* ============================================================
 * FIL: src/router.js  (HEL FIL) — AUTOPATCH v7 + AO-09
 * NAMN: ROUTER — Route Management & Navigation
 *
 * AO-06: Route 'week-templates' → renderWeekTemplates
 * AO-07: Route 'calendar' → renderCalendar (från views/calendar.js)
 * AO-08: Route 'control' → renderControl (från views/control.js)
 * AO-09: Route 'summary' → renderSummary (från views/summary.js)
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

function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

function addText(node, text) {
    node.textContent = String(text ?? '');
    return node;
}

/* ============================================================
 * BLOCK 3 — View helpers (placeholders) — XSS-safe
 * ============================================================ */
function renderPlaceholder(title, note) {
    return function (container) {
        safeClear(container);

        const wrap = el('div', 'view-container');

        const h2 = el('h2');
        addText(h2, title);

        const p = el('p', 'empty-state');
        addText(p, note || 'Denna vy är under utveckling.');

        wrap.appendChild(h2);
        wrap.appendChild(p);
        container.appendChild(wrap);
    };
}

/* ============================================================
 * BLOCK 4 — Route-map
 * ============================================================ */
const routes = {
    // Public
    login: renderLogin,

    // Protected
    home: renderHome,
    shifts: renderShifts,
    groups: renderGroups,
    'week-templates': renderWeekTemplates,                                         // AO-06
    personal: renderPersonal,
    calendar: renderCalendar,                                                      // AO-07
    control: renderControl,                                                        // AO-08
    summary: renderSummary,                                                        // AO-09
    rules: renderPlaceholder('Regler', '⚖️ Regelvyn är under utveckling.'),
    export: renderPlaceholder('Export', '💾 Export/Import är under utveckling.'),
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

/* ============================================================
 * BLOCK 6 — Auth (SINGLE SOURCE OF TRUTH)
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
 * BLOCK 8 — Navbar (topbar)
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
 * BLOCK 9 — Render route (kärnan)
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

    console.log('✓ Router ready');
}
