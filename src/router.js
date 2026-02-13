/*
 * AO-03 — ROUTER: Route-hantering (DEBUG VERSION)
 */

import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderCalendar } from './views/calendar.js';
import { renderControl } from './views/control.js';
import { renderSummary } from './views/summary.js';
import { renderExport } from './views/export.js';
import { renderRules } from './views/rules.js';
import { renderShifts } from './views/shifts.js';
import { renderLogin, isLoggedIn } from './views/login.js';
import { renderError } from './ui.js';

const routes = {
    login: renderLogin,
    home: renderHome,
    shifts: renderShifts,
    personal: renderPersonal,
    calendar: renderCalendar,
    control: renderControl,
    summary: renderSummary,
    export: renderExport,
    rules: renderRules,
};

let currentRoute = null;
let container = null;
let errorPanel = null;
let appCtx = null;

function parseRoute() {
    let hash = window.location.hash.slice(1);
    console.log('📍 parseRoute hash:', hash);
    
    if (!hash || hash === '/') {
        const loggedIn = isLoggedIn();
        console.log('📍 hash tom, inloggad?', loggedIn);
        return loggedIn ? 'home' : 'login';
    }

    let route = hash.startsWith('/') ? hash.slice(1) : hash;
    route = route.split('?')[0];

    console.log('📍 parsed route:', route);

    if (!routes[route]) {
        console.warn(`❌ Okänd route "${route}"`);
        return isLoggedIn() ? 'home' : 'login';
    }

    return route;
}

async function renderRoute(routeName) {
    try {
        console.log('🔄 renderRoute kallad:', routeName);
        console.log('🔄 container:', container);
        console.log('🔄 routes[routeName]:', routes[routeName]);

        if (!container) {
            console.error('❌ Container saknas!');
            throw new Error('Container saknas');
        }

        if (!isLoggedIn() && routeName !== 'login') {
            console.log('📍 Inte inloggad och inte login-route → redirect till #/login');
            window.location.hash = '#/login';
            return;
        }

        const renderFn = routes[routeName];
        if (!renderFn) {
            console.error(`❌ renderFn för "${routeName}" inte hittat`);
            throw new Error(`Route "${routeName}" inte hittat`);
        }

        console.log(`✓ Renderar route: ${routeName}`);
        container.innerHTML = '';
        
        console.log('🔄 Anropar renderFn med:', { container, appCtx });
        renderFn(container, {
            ...appCtx,
            currentRoute: routeName
        });

        currentRoute = routeName;
        updateNavbar(routeName);
        console.log(`✓ Route ${routeName} renderad`);
    } catch (err) {
        console.error(`❌ Fel vid rendering av "${routeName}":`, err);
        renderError(errorPanel, err);
        if (container) {
            container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Vyn kunde inte renderas. Se console för detaljer.</p></div>';
        }
    }
}

function updateNavbar(routeName) {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = routeName === 'login' ? 'none' : 'block';
    }

    document.querySelectorAll('nav a').forEach((link) => {
        const href = link.getAttribute('href');
        const route = href.slice(2);
        link.classList.toggle('active', route === routeName);
    });
}

function onHashChange() {
    console.log('📍 hashchange event');
    const route = parseRoute();
    renderRoute(route);
}

export function initRouter(containerEl, errorPanelEl, ctx) {
    console.log('🔄 initRouter kallad');
    console.log('🔄 containerEl:', containerEl);
    console.log('🔄 errorPanelEl:', errorPanelEl);
    console.log('🔄 ctx:', ctx);

    container = containerEl;
    errorPanel = errorPanelEl;
    appCtx = ctx;

    window.addEventListener('hashchange', onHashChange);

    const initialRoute = parseRoute();
    console.log(`🔄 Initial route: ${initialRoute}`);
    renderRoute(initialRoute);
}
