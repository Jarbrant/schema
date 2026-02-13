/*
 * ROUTER — AUTOPATCH (Topbar AV på login)
 *
 * Fix:
 * - P0: Topbar visas INTE på login-route.
 * - P0: Topbar visas på alla andra routes.
 * - Fail-closed: inte inloggad → allt utom login skickas till login.
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

import { renderError, renderNavbar } from './ui.js';

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

function safeClear(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function getDefaultRoute() {
  return isLoggedIn() ? 'home' : 'login';
}

function parseRoute() {
  const hashRaw = window.location.hash || '';
  let hash = hashRaw.startsWith('#') ? hashRaw.slice(1) : hashRaw;

  if (!hash || hash === '/') return getDefaultRoute();

  let route = hash.startsWith('/') ? hash.slice(1) : hash;
  route = route.split('?')[0];

  return routes[route] ? route : getDefaultRoute();
}

/* ================================
   TOPBAR VISIBILITY
   ================================ */

function setTopbarVisible(isVisible) {
  const navbarEl = document.getElementById('navbar');
  if (!navbarEl) return;

  if (!isVisible) {
    // P0: Inget nav alls på login (känns säkrare + renare)
    navbarEl.textContent = '';
    navbarEl.style.display = 'none';
    return;
  }

  navbarEl.style.display = 'block';

  // Bygg topbar om den saknas
  if (navbarEl.childNodes.length === 0) {
    try {
      renderNavbar(navbarEl);
    } catch (_) {
      console.error('NAVBAR_RENDER_FAIL');
    }
  }
}

function markActive(routeName) {
  const links = document.querySelectorAll('#navbar a[href^="#/"]');
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const r = href.startsWith('#/') ? href.slice(2) : href;
    a.classList.toggle('active', r === routeName);
  });
}

function renderRoute(routeName) {
  try {
    if (!container) throw new Error('ROUTER_NO_CONTAINER');

    const isLoginRoute = routeName === 'login';

    // P0: Topbar av på login
    setTopbarVisible(!isLoginRoute);

    // Fail-closed auth: inte inloggad → login
    if (!isLoggedIn() && !isLoginRoute) {
      window.location.hash = '#/login';
      return;
    }

    const renderFn = routes[routeName] || routes[getDefaultRoute()];

    safeClear(container);

    // Ingen extra “ram” här – vyn renderar direkt
    renderFn(container, { ...appCtx, currentRoute: routeName });

    if (!isLoginRoute) markActive(routeName);
  } catch (err) {
    console.error('ROUTER_RENDER_FAIL');
    try { renderError(errorPanel, err); } catch (_) {}
  }
}

function onHashChange() {
  renderRoute(parseRoute());
}

export function initRouter(containerEl, errorPanelEl, ctx) {
  if (window.__SCHEMA_ROUTER_INIT__) return;
  window.__SCHEMA_ROUTER_INIT__ = true;

  container = containerEl;
  errorPanel = errorPanelEl;
  appCtx = ctx;

  window.addEventListener('hashchange', onHashChange, { passive: true });

  renderRoute(parseRoute());
}
