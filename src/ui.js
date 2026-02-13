/* ============================================================
 * AO-05 — UI: Navbar och error-rendering (AUTOPATCH v3)
 * FIL: src/ui.js
 *
 * Mål:
 * - Navbar byggs med DOM (XSS-säkert)
 * - Logout längst till höger
 * - Errorpanel byggs med DOM (ingen innerHTML)
 * ============================================================ */

import { logout } from './views/login.js';

/* ============================================================
   BLOCK 1: NAVBAR (DOM-builder)
   ============================================================ */

export function renderNavbar(navbar) {
  if (!navbar) return;

  // Rensa alltid, så vi inte får dubletter
  navbar.textContent = '';

  const appName = 'Schema-Program';
  const links = [
    { route: 'home', label: 'Hem' },
    { route: 'personal', label: 'Personal' },
    { route: 'calendar', label: 'Kalender' },
    { route: 'control', label: 'Kontroll' },
    { route: 'summary', label: 'Sammanställning' },
    { route: 'rules', label: '📋 Regler' },
    { route: 'export', label: 'Export/Import' }
  ];

  const topbar = document.createElement('div');
  topbar.className = 'topbar';

  const inner = document.createElement('div');
  inner.className = 'topbar-inner';

  const brand = document.createElement('div');
  brand.className = 'topbar-brand';
  brand.textContent = appName;

  const ul = document.createElement('ul');
  ul.className = 'topbar-links';

  links.forEach(({ route, label }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.href = `#/${route}`;
    a.textContent = label;
    li.appendChild(a);
    ul.appendChild(li);
  });

  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.type = 'button';
  logoutBtn.className = 'topbar-logout';
  logoutBtn.textContent = '🚪 Logga ut';

  logoutBtn.addEventListener('click', () => {
    if (confirm('Logga ut?')) logout();
  });

  inner.appendChild(brand);
  inner.appendChild(ul);
  inner.appendChild(logoutBtn);

  topbar.appendChild(inner);
  navbar.appendChild(topbar);
}

/* ============================================================
   BLOCK 2: ERROR RENDER (DOM-builder)
   ============================================================ */

export function renderError(errorPanel, error) {
  if (!errorPanel) return;

  const errorMsg = (error && error.message) ? error.message : String(error);
  const errorType = (error && error.name) ? error.name : 'Error';

  errorPanel.textContent = '';
  errorPanel.classList.remove('hidden');

  const h3 = document.createElement('h3');
  h3.textContent = 'Något gick fel';

  const type = document.createElement('div');
  type.className = 'error-type';
  type.textContent = `${errorType}: ${errorMsg}`;

  const tip = document.createElement('p');
  tip.className = 'error-tip';
  tip.textContent = '💡 Öppna Console för fler detaljer';

  errorPanel.appendChild(h3);
  errorPanel.appendChild(type);
  errorPanel.appendChild(tip);

  // Auto-hide (fail-soft)
  window.clearTimeout(errorPanel.__hideTimer);
  errorPanel.__hideTimer = window.setTimeout(() => {
    try {
      errorPanel.classList.add('hidden');
    } catch (_) {}
  }, 8000);
}
