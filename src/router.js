/*
 * AO-03 — ROUTER: Route-hantering
 */

import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderCalendar } from './views/calendar.js';
import { renderControl } from './views/control.js';
import { renderSummary } from './views/summary.js';
import { renderExport } from './views/export.js';
import { renderRules } from './views/rules.js';
import { renderLogin, isLoggedIn } from './views/login.js';
import { renderError } from './ui.js';

const routes = {
    login: renderLogin,
    home: renderHome,
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
    if (!hash || hash === '/') {
        return isLoggedIn() ? 'home' : 'login';
    }

    let route = hash.startsWith('/') ? hash.slice(1) : hash;
    route = route.split('?')[0];

    if (!routes[route]) {
        console.warn(`Okänd route "${route}"`);
        return isLoggedIn() ? 'home' : 'login';
    }

    return route;
}

async function renderRoute(routeName) {
    try {
        if (!container) {
            throw new Error('Container saknas');
        }

        if (!isLoggedIn() && routeName !== 'login') {
            window.location.hash = '#/login';
            return;
        }

        const renderFn = routes[routeName];
        if (!renderFn) {
            throw new Error(`Route "${routeName}" inte hittat`);
        }

        container.innerHTML = '';
        renderFn(container, appCtx);

        currentRoute = routeName;
        updateNavbar(routeName);
    } catch (err) {
        console.error(`Fel vid rendering av "${routeName}"`, err);
        renderError(errorPanel, err);
        if (container) {
            container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Vyn kunde inte renderas.</p></div>';
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
    const route = parseRoute();
    renderRoute(route);
}

export function initRouter(containerEl, errorPanelEl, ctx) {
    container = containerEl;
    errorPanel = errorPanelEl;
    appCtx = ctx;

    window.addEventListener('hashchange', onHashChange);

    const initialRoute = parseRoute();
    renderRoute(initialRoute);
}
