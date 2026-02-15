/* ============================================================
 * FIL: src/router.js
 * NAMN: ROUTER — Route Management & Navigation
 *
 * MÅL:
 * - Stabil routing (hash-baserad) för GitHub Pages
 * - Fail-closed: krascha inte tyst, visa felpanel om möjligt
 * - Auth-sanning: store.getState().isLoggedIn (EN källa)
 *
 * AUTOPATCH (utan att ta bort funktioner):
 * - Tydligare “store-kontrakt” (fångar fel input direkt)
 * - Säkrare auth-läsning (try/catch)
 * - Säkrare render-felhantering (minimal fallback om UI-panel failar)
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports
 * ============================================================ */
import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

/* ============================================================
 * BLOCK 2 — Route-map (ENDA källan för vilka views som finns)
 * ============================================================ */
const routes = {
    login: renderLogin,
    home: renderHome,
    personal: renderPersonal
};

/* ============================================================
 * BLOCK 3 — Router state (DOM hooks + ctx)
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
 * BLOCK 4 — Små helpers
 * ============================================================ */
function safeClear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

/* ============================================================
 * BLOCK 5 — Auth (SINGLE SOURCE OF TRUTH)
 * - Fail-closed: om något är oklart -> false
 * ============================================================ */
function isLoggedIn() {
    try {
        if (!appCtx || !appCtx.store) return false;

        const store = appCtx.store;

        // INLINE: Store-kontrakt: måste ha getState()
        if (typeof store.getState !== 'function') {
            reportError(
                'STORE_CONTRACT_ERROR',
                'ROUTER',
                'src/router.js',
                'Store saknar getState()'
            );
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
 * BLOCK 6 — Parse route (hash)
 * - Fail-closed: okänd route -> default
 * ============================================================ */
function parseRoute() {
    const hash = window.location.hash || '';
    let route = hash.startsWith('#/') ? hash.slice(2) : '';
    route = route.split('?')[0];

    // INLINE: okänd route -> default (home/login)
    return routes[route] ? route : getDefaultRoute();
}

/* ============================================================
 * BLOCK 7 — Navbar (topbar)
 * - Fail-closed: navbar saknas -> rapportera och stoppa “skyddade” vyer
 * ============================================================ */
function setTopbarVisible(isVisible) {
    const navbar = document.getElementById('navbar');

    if (!navbar) {
        console.error('❌ DOM element #navbar missing');
        reportError('DOM_ERROR', 'ROUTER', 'src/router.js', '#navbar element not found');
        return false;
    }

    if (!isVisible) {
        // INLINE: login ska vara “ren” sida utan navbar
        navbar.innerHTML = '';
        navbar.style.display = 'none';
        debugLog('Navbar hidden (login route)');
        return true;
    }

    navbar.style.display = 'block';

    // INLINE: rendera navbar en gång om den är tom
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
 * BLOCK 8 — Render route (kärnan)
 * - Fail-closed: inte inloggad + skyddad route -> login
 * - Alla fel: reportError + renderError
 * ============================================================ */
function renderRoute(routeName) {
    try {
        debugLog(`Rendering route: ${routeName}`);

        if (!container) throw new Error('Container #app missing');

        const isLoginRoute = routeName === 'login';

        // 1) Navbar
        const navbarOk = setTopbarVisible(!isLoginRoute);

        // INLINE: Om navbar saknas på skyddade routes -> stoppa
        if (!isLoginRoute && !navbarOk) {
            throw new Error('Navbar setup failed');
        }

        // 2) Auth-guard: inte inloggad + inte login -> redirect
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

        // 5) Active link markering (ej på login)
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

        // Fail-closed: visa felpanel om möjligt
        if (errorPanel) {
            try {
                renderError(errorPanel, err);
            } catch (uiErr) {
                console.error('❌ Error panel render failed:', uiErr);
                // Minimal fallback så vi inte “tystar” felet
                errorPanel.textContent = `❌ Error: ${err?.message || 'Okänt fel'}`;
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
 * - Validerar store-kontrakt + DOM-kontrakt
 * - Initierar eventlyssnare och ritar första vyn
 * ============================================================ */
export function setupRouter(store) {
    // INLINE: skydd mot dubbel-init
    if (window.__ROUTER_INIT__) {
        console.warn('⚠️ Router already initialized');
        return;
    }
    window.__ROUTER_INIT__ = true;

    console.log('🚀 Setting up router...');

    /* ---------- BLOCK 10.1 — Store-kontrakt ---------- */
    if (!store || typeof store.getState !== 'function') {
        reportError(
            'STORE_CONTRACT_FATAL',
            'ROUTER',
            'src/router.js',
            'setupRouter() fick fel input: store saknar getState()'
        );
        // Fail-closed: stoppa hårt så vi inte får “blank tyst sida”
        throw new Error('FATAL: Invalid store (getState missing)');
    }

    /* ---------- BLOCK 10.2 — DOM-kontrakt ---------- */
    container = document.getElementById('app');
    errorPanel = document.getElementById('error-panel');
    const navbar = document.getElementById('navbar');

    if (!container) throw new Error('FATAL: DOM element #app not found');
    if (!errorPanel) throw new Error('FATAL: DOM element #error-panel not found');
    if (!navbar) throw new Error('FATAL: DOM element #navbar not found');

    debugLog('DOM elements validated');

    /* ---------- BLOCK 10.3 — Context ---------- */
    appCtx = { store };

    /* ---------- BLOCK 10.4 — Listen + First render ---------- */
    window.addEventListener('hashchange', onHashChange, { passive: true });

    const initialRoute = parseRoute();
    debugLog(`Initial route: ${initialRoute}`);
    renderRoute(initialRoute);

    console.log('✓ Router ready');
}
