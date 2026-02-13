/*
 * AO-03 — ROUTER: Route-hantering (AUTOPATCH v1.2)
 *
 * Säkrare/stabilare:
 * - Init-guard: ingen dubbel init/listeners
 * - Mindre loggspam (debug via ?debug=1)
 * - Fail-closed: okänd route → login/home beroende på inloggning
 * - Render: rensar container med DOM-metod (ingen onödig innerHTML)
 * - Navbar: robustare aktiv länk (tål att nav saknas)
 */

import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderCalendar } from './views/calendar.js';
import { renderControl } from './views/control.js';
import { renderSummary } from './views/summary.js';
import { renderExport } from './views/export.js';
import { renderRules } from './views/rules.js';
import { renderShifts } from './views/shifts.js';
import { renderGroups } from './views/groups.js';
import { renderLogin, isLoggedIn } from './views/login.js';
import { renderError } from './ui.js';

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

let currentRoute = null;
let container = null;
let errorPanel = null;
let appCtx = null;

const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
function log(...args) {
  if (DEBUG) console.log(...args);
}

function safeClearContainer(el) {
  if (!el) return;
  // DOM-säkert: ta bort barn
  while (el.firstChild) el.removeChild(el.firstChild);
}

function getDefaultRoute() {
  return isLoggedIn() ? 'home' : 'login';
}

function parseRoute() {
  const hashRaw = window.location.hash || '';
  let hash = hashRaw.startsWith('#') ? hashRaw.slice(1) : hashRaw;

  if (!hash || hash === '/') {
    return getDefaultRoute();
  }

  let route = hash.startsWith('/') ? hash.slice(1) : hash;
  route = route.split('?')[0];

  if (!routes[route]) {
    return getDefaultRoute();
  }

  return route;
}

function updateNavbar(routeName) {
  const navbar = document.getElementById('navbar');
  if (navbar) {
    navbar.style.display = routeName === 'login' ? 'none' : 'block';
  }

  // Tål att det inte finns länkar ännu
  const links = document.querySelectorAll('nav a[href^="#/"]');
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const route = href.startsWith('#/') ? href.slice(2) : href;
    link.classList.toggle('active', route === routeName);
  });
}

function showFallbackView() {
  if (!container) return;
  safeClearContainer(container);

  const wrap = document.createElement('div');
  wrap.className = 'view-container';

  const h2 = document.createElement('h2');
  h2.textContent = 'Fel';

  const p = document.createElement('p');
  p.textContent = 'Vyn kunde inte renderas.';

  wrap.appendChild(h2);
  wrap.appendChild(p);
  container.appendChild(wrap);
}

function renderRoute(routeName) {
  try {
    if (!container) throw new Error('ROUTER_NO_CONTAINER');

    // Fail-closed auth: inte inloggad → alltid login
    if (!isLoggedIn() && routeName !== 'login') {
      window.location.hash = '#/login';
      return;
    }

    const renderFn = routes[routeName];
    if (!renderFn) {
      window.location.hash = `#/${getDefaultRoute()}`;
      return;
    }

    safeClearContainer(container);

    renderFn(container, { ...appCtx, currentRoute: routeName });

    currentRoute = routeName;
    updateNavbar(routeName);
  } catch (err) {
    console.error('ROUTER_RENDER_FAIL', err);
    try {
      renderError(errorPanel, err);
    } catch (_) {
      // om ui.js saknas/krashar – visa fallback
    }
    showFallbackView();
  }
}

function onHashChange() {
  const route = parseRoute();
  renderRoute(route);
}

export function initRouter(containerEl, errorPanelEl, ctx) {
  // Init-guard mot dubbla listeners
  if (window.__SCHEMA_ROUTER_INIT__) return;
  window.__SCHEMA_ROUTER_INIT__ = true;

  container = containerEl;
  errorPanel = errorPanelEl;
  appCtx = ctx;

  window.addEventListener('hashchange', onHashChange, { passive: true });

  const initialRoute = parseRoute();
  log('Router init route:', initialRoute);
  renderRoute(initialRoute);
}
