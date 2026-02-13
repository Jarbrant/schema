/*
 * AO-03 — ROUTER: Route-hantering (AUTOPATCH v1.4)
 *
 * Fix:
 * - P0: Topbar syns igen (renderNavbar() anropas alltid).
 * - P0: Ta bort “andra ramen” (ingen extra wrapper runt innehållet).
 * - P0: Topbar visas även på login (så du kan navigera).
 * - P1: Aktiv länk markeras robust (tål både <div id="navbar"> och <nav id="navbar">).
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

const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
function log(...args) { if (DEBUG) console.log(...args); }

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

  if (!routes[route]) return getDefaultRoute();
  return route;
}

function ensureTopbar() {
  const navbarEl = document.getElementById('navbar');
  if (!navbarEl) return;

  // Bygg topbar varje gång (ui.js rensar ändå själv med textContent)
  try {
    renderNavbar(navbarEl);
  } catch (e) {
    console.error('NAVBAR_RENDER_FAIL');
  }
}

function markActiveLink(routeName) {
  // Markera aktiv länk oavsett om du har <nav> eller <div> runt topbar
  const links = document.querySelectorAll('#navbar a[href^="#/"]');
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const route = href.startsWith('#/') ? href.slice(2) : href;
    link.classList.toggle('active', route === routeName);
  });
}

function showFallbackView() {
  if (!container) return;
  safeClear(container);

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

    // Topbar ska alltid finnas (även på login)
    ensureTopbar();

    // Fail-closed: inte inloggad → allt utom login går till login
    if (!isLoggedIn() && routeName !== 'login') {
      window.location.hash = '#/login';
      return;
    }

    const renderFn = routes[routeName];
    if (!renderFn) {
      window.location.hash = `#/${getDefaultRoute()}`;
      return;
    }

    safeClear(container);

    // VIKTIGT: ingen extra “ram” här – vyn renderar direkt som tidigare
    renderFn(container, { ...appCtx, currentRoute: routeName });

    markActiveLink(routeName);
    log('Route rendered:', routeName);
  } catch (err) {
    console.error('ROUTER_RENDER_FAIL');
    try { renderError(errorPanel, err); } catch (_) {}
    showFallbackView();
  }
}

function onHashChange() {
  renderRoute(parseRoute());
}

export function initRouter(containerEl, errorPanelEl, ctx) {
  // Init-guard
  if (window.__SCHEMA_ROUTER_INIT__) return;
  window.__SCHEMA_ROUTER_INIT__ = true;

  container = containerEl;
  errorPanel = errorPanelEl;
  appCtx = ctx;

  window.addEventListener('hashchange', onHashChange, { passive: true });

  const initialRoute = parseRoute();
  ensureTopbar();
  renderRoute(initialRoute);
}
