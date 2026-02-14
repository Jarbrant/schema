/*
 * AO-03 — ROUTER: Route-hantering & Topbar visibility
 * 
 * Fix:
 * - P0: Topbar visas INTE på login-route.
 * - P0: Topbar visas på alla andra routes.
 * - Fail-closed: inte inloggad → allt utom login skickas till login.
 * - Global error hooks via Diagnostics (AO-01)
 */

import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderCalendar } from './views/calendar-new.js'; // FAS 1.2: New calendar view
import { renderControl } from './views/control.js';
import { renderSummary } from './views/summary.js';
import { renderExport } from './views/export.js';
import { renderRules } from './views/rules.js';
import { renderShifts } from './views/shifts.js';
import { renderGroups } from './views/groups.js';
import { renderLogin, isLoggedIn } from './views/login-pin.js'; // FAS 1: PIN-login
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

const routes = {
    login: renderLogin,
    home: renderHome,
    shifts: renderShifts,
    groups: renderGroups,
    personal: renderPersonal,
    calendar: renderCalendar,
    control: renderControl,
    summary: renderSummary,
    export: renderExport,
    rules: renderRules
};

let container = null;
let errorPanel = null;
let appCtx = null;

/**
 * Safe clear: Ta bort alla barn-element från en container
 */
function safeClear(el) {
    if (!el) return;
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

/**
 * Hämta default route (home om inloggad, login om inte)
 */
function getDefaultRoute() {
    return isLoggedIn() ? 'home' : 'login';
}

/**
 * Parse URL-hash och extrahera route-namn
 */
function parseRoute() {
    const hashRaw = window.location.hash || '';
    let hash = hashRaw.startsWith('#') ? hashRaw.slice(1) : hashRaw;

    if (!hash || hash === '/') {
        return getDefaultRoute();
    }

    let route = hash.startsWith('/') ? hash.slice(1) : hash;
    route = route.split('?')[0];

    // Om route inte finns → gå till default
    return routes[route] ? route : getDefaultRoute();
}

/**
 * Sätt topbar-synlighet baserat på route
 * P0: Topbar ska INTE visas på login-route
 */
function setTopbarVisible(isVisible) {
    const navbarEl = document.getElementById('navbar');
    if (!navbarEl) return;

    if (!isVisible) {
        // Topbar av på login (renare UX + säkrare)
        navbarEl.innerHTML = '';
        navbarEl.style.display = 'none';
        return;
    }

    // Topbar på
    navbarEl.style.display = 'block';

    // Bygg topbar om den saknas
    if (navbarEl.childNodes.length === 0) {
        try {
            renderNavbar(navbarEl);
        } catch (err) {
            console.error('❌ Topbar render failed:', err);
            reportError(
                'NAVBAR_RENDER_FAILED',
                'ROUTER',
                'src/router.js',
                'Navigeringsfältet kunde inte renderas'
            );
        }
    }
}

/**
 * Markera aktiv länk i topbar
 */
function markActive(routeName) {
    const links = document.querySelectorAll('#navbar a[href^="#/"]');
    links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const linkRoute = href.startsWith('#/') ? href.slice(2) : href;
        link.classList.toggle('active', linkRoute === routeName);
    });
}

/**
 * Rendera en route
 */
function renderRoute(routeName) {
    try {
        console.log(`🔄 Renderar route: ${routeName}`);

        if (!container) {
            throw new Error('Container element saknas');
        }

        const isLoginRoute = routeName === 'login';

        // P0: Topbar av på login, på för allt annat
        setTopbarVisible(!isLoginRoute);

        // Fail-closed: inte inloggad och inte login → redirect till login
        if (!isLoggedIn() && !isLoginRoute) {
            console.log('📍 Inte inloggad, omdirigerar till login');
            window.location.hash = '#/login';
            return;
        }

        const renderFn = routes[routeName] || routes[getDefaultRoute()];

        if (!renderFn) {
            throw new Error(`Route "${routeName}" inte hittat`);
        }

        // Rensa container
        safeClear(container);

        // Rendera vyn
        console.log(`✓ Anropar renderFn för "${routeName}"`);
        renderFn(container, {
            ...appCtx,
            currentRoute: routeName
        });

        // Markera aktiv länk i navbar (ej på login)
        if (!isLoginRoute) {
            markActive(routeName);
        }

        console.log(`✓ Route "${routeName}" renderad`);

    } catch (err) {
        console.error(`❌ Fel vid rendering av route "${routeName}":`, err);

        // Rapportera via Diagnostics
        reportError(
            'ROUTER_RENDER_FAILED',
            'ROUTER',
            'src/router.js',
            err.message || `Route "${routeName}" kunde inte renderas`
        );

        // Visa error-panel
        try {
            renderError(errorPanel, err);
        } catch (uiErr) {
            console.error('❌ Error-panel render failed:', uiErr);
        }
    }
}

/**
 * Hash-change event listener
 */
function onHashChange() {
    console.log('📍 Hash changed');
    const route = parseRoute();
    renderRoute(route);
}

/**
 * Initiera router (anropas från main.js)
 */
export function initRouter(containerEl, errorPanelEl, ctx) {
    // Prevent double-init
    if (window.__SCHEMA_ROUTER_INIT__) {
        console.warn('⚠️ Router redan initialiserad');
        return;
    }
    window.__SCHEMA_ROUTER_INIT__ = true;

    console.log('🚀 Initialiserar router...');

    container = containerEl;
    errorPanel = errorPanelEl;
    appCtx = ctx;

    // Lyssna på hash-ändringar
    window.addEventListener('hashchange', onHashChange, { passive: true });

    // Rendera initial route
    const initialRoute = parseRoute();
    console.log(`🔄 Initial route: ${initialRoute}`);
    renderRoute(initialRoute);

    console.log('✓ Router initialiserad');
}
