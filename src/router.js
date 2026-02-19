/* ============================================================
 * FIL: src/router.js  (HEL FIL) — AUTOPATCH v4 + AO-05 + AO-06
 * NAMN: ROUTER — Route Management & Navigation
 *
 * AO-06: Ny route 'week-templates' → renderWeekTemplates
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports
 * ============================================================ */
import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderGroups } from './views/groups.js';
import { renderShifts } from './views/shifts.js';
import { renderWeekTemplates } from './views/week-templates.js';    // AO-06
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
 * BLOCK 4 — CALENDAR view (din baseline) — XSS-safe
 * ============================================================ */
export function renderCalendar(container, ctx) {
    safeClear(container);

    const store = ctx?.store;
    const wrap = el('div', 'view-container');

    if (!store) {
        const h2 = el('h2');
        addText(h2, 'Fel');
        const p = el('p');
        addText(p, 'Store saknas.');
        wrap.appendChild(h2);
        wrap.appendChild(p);
        container.appendChild(wrap);
        return;
    }

    const state = store.getState?.();
    const h2 = el('h2');
    addText(h2, 'Kalender 2026');
    wrap.appendChild(h2);

    if (!state?.schedule || state.schedule.year !== 2026) {
        const pErr = el('p', 'error-text');
        addText(pErr, 'Schedule är korrupt eller fel år. Kan inte visa kalender.');
        wrap.appendChild(pErr);
        container.appendChild(wrap);
        return;
    }

    const p = el('p', 'empty-state');
    p.appendChild(document.createTextNode('📅 Kalendervyn är under utveckling (AO-09+).'));
    p.appendChild(document.createElement('br'));
    p.appendChild(document.createTextNode('För nu: Använd "Personal" för att lägga till personal och "Kontroll" för att se statistik.'));
    wrap.appendChild(p);

    container.appendChild(wrap);
}

/* ============================================================
 * BLOCK 5 — Route-map (ENDA källan för vilka views som finns)
 * OBS: Måste matcha href i navbar (ui.js) + home-snabbnav
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
    calendar: renderCalendar,
    control: renderPlaceholder('Kontroll', '✓ Kontrollvyn är under utveckling.'),
    summary: renderPlaceholder('Sammanställning', '📊 Sammanställningsvyn är under utveckling.'),
    rules: renderPlaceholder('Regler', '⚖️ Regelvyn är under utveckling.'),
    export: renderPlaceholder('Export', '💾 Export/Import är under utveckling.')
};

/* ============================================================
 * BLOCK 6 — Router state (DOM hooks + ctx)
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
 * BLOCK 7 — Auth (SINGLE SOURCE OF TRUTH)
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
 * BLOCK 8 — Parse route (hash) — robust normalisering
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
 * BLOCK 9 — Navbar (topbar)
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
 * BLOCK 10 — Render route (kärnan)
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
 * BLOCK 11 — Event: hashchange
 * ============================================================ */
function onHashChange() {
    const route = parseRoute();
    renderRoute(route);
}

/* ============================================================
 * BLOCK 12 — setupRouter (init)
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
