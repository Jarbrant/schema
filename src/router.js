/*
 * ROUTER — Route Management & Navigation
 * 
 * CONTRACTS:
 * - DOM elements required: #app, #error-panel, #navbar
 * - Auth source: store.getState().isLoggedIn
 * - Fail-closed: errors logged + minimal UI shown
 * 
 * CHANGELOG (autopatch, no features removed):
 * - Hard-guard: store contract validation (getState required)
 * - Fail-closed: isLoggedIn() now safe (try/catch + contract checks)
 * - Clearer fatal errors when store is wrong (prevents “blank page”)
 */

import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

// Routes: CORRECT mapping
const routes = {
    login: renderLogin,
    home: renderHome,
    personal: renderPersonal
};

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
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

/**
 * Fail-closed auth check (SINGLE SOURCE OF TRUTH: store)
 */
function isLoggedIn() {
    try {
        if (!appCtx || !appCtx.store) return false;
        const store = appCtx.store;

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
            'AUTH_STATE_READ_FAILED',
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

function parseRoute() {
    const hash = window.location.hash || '';
    let route = hash.startsWith('#/') ? hash.slice(2) : '';
    route = route.split('?')[0];
    return routes[route] ? route : getDefaultRoute();
}

function setTopbarVisible(isVisible) {
    const navbar = document.getElementById('navbar');

    // Fail-closed: missing navbar = error
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
            reportError('NAVBAR_RENDER_ERROR', 'ROUTER', 'src/router.js', err.message);
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

function renderRoute(routeName) {
    try {
        debugLog(`Rendering route: ${routeName}`);

        if (!container) {
            throw new Error('Container #app missing');
        }

        const isLoginRoute = routeName === 'login';

        // Topbar (fail-closed)
        const navbarOk = setTopbarVisible(!isLoginRoute);
        if (!isLoginRoute && !navbarOk) {
            throw new Error('Navbar setup failed');
        }

        // Not logged in + not login → redirect
        if (!isLoggedIn() && !isLoginRoute) {
            debugLog('Not authenticated, redirecting to login');
            window.location.hash = '#/login';
            return;
        }

        const renderFn = routes[routeName] || routes[getDefaultRoute()];
        if (!renderFn) {
            throw new Error(`Route "${routeName}" not found`);
        }

        safeClear(container);
        renderFn(container, { ...appCtx, currentRoute: routeName });

        if (!isLoginRoute) {
            markActive(routeName);
        }

        debugLog(`Route rendered: ${routeName}`);
    } catch (err) {
        console.error(`❌ Route render failed: ${routeName}`, err);
        reportError('ROUTE_RENDER_ERROR', 'ROUTER', 'src/router.js', err.message);

        // Fail-closed: show error if errorPanel exists
        if (errorPanel) {
            try {
                renderError(errorPanel, err);
            } catch (uiErr) {
                console.error('❌ Error panel render failed:', uiErr);
                errorPanel.textContent = `❌ Error: ${err.message}`;
            }
        } else {
            console.error('⚠️ Error panel #error-panel missing, cannot display error');
        }
    }
}

function onHashChange() {
    const route = parseRoute();
    renderRoute(route);
}

/**
 * Setup router
 * 
 * REQUIREMENTS:
 * - DOM: #app, #error-panel, #navbar must exist
 * - store must implement getState() (and preferably setState/subscribe)
 * - Fails closed: throws if requirements not met
 */
export function setupRouter(store) {
    if (window.__ROUTER_INIT__) {
        console.warn('⚠️ Router already initialized');
        return;
    }
    window.__ROUTER_INIT__ = true;

    console.log('🚀 Setting up router...');

    // Validate store contract (fail-closed)
    if (!store || typeof store.getState !== 'function') {
        reportError(
            'STORE_CONTRACT_FATAL',
            'ROUTER',
            'src/router.js',
            'setupRouter() fick fel input: store saknar getState()'
        );
        throw new Error('FATAL: Invalid store (getState missing)');
    }

    // Validate DOM
    container = document.getElementById('app');
    errorPanel = document.getElementById('error-panel');
    const navbar = document.getElementById('navbar');

    if (!container) {
        throw new Error('FATAL: DOM element #app not found');
    }
    if (!errorPanel) {
        throw new Error('FATAL: DOM element #error-panel not found');
    }
    if (!navbar) {
        throw new Error('FATAL: DOM element #navbar not found');
    }

    debugLog('DOM elements validated');

    // Setup context
    appCtx = { store };

    // Listen for route changes
    window.addEventListener('hashchange', onHashChange, { passive: true });

    // Render initial route
    const initialRoute = parseRoute();
    debugLog(`Initial route: ${initialRoute}`);
    renderRoute(initialRoute);

    console.log('✓ Router ready');
}
