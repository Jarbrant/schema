/*
 * UI.JS — Shared UI Utilities (UPPDATERAD)
 *
 * Nytt i denna version:
 * - P0: EN källa för nav-länkar: NAV_ITEMS (används av navbar + quicklinks)
 * - P0: renderQuickLinks(container, opts) -> rutor/snabbnavigation för alla topbar routes
 *
 * Funktioner:
 * - renderNavbar: Visa navigeringsfältet
 * - renderQuickLinks: Visa snabbnavigation (rutor)
 * - renderError: Visa felmeddelanden säkert (med modul-healthcheck)
 * - showSuccess/showWarning/showInfo: Toast-meddelanden
 * - showConfirm: Confirm-dialog
 */

import { diagnostics } from './diagnostics.js';

/* ============================================================
 * BLOCK 1 — NAV_ITEMS (Single source of truth)
 * - Måste matcha router.js routes-map
 * - Används av navbar + quicklinks
 * ============================================================ */
const NAV_ITEMS = [
  { route: 'home',    label: 'Hem',            icon: '🏠', desc: 'Startsida' },
  { route: 'shifts',  label: 'Skift',          icon: '📋', desc: 'Planera skift' },
  { route: 'groups',  label: 'Grupper',        icon: '👥', desc: 'Hantera grupper' },
  { route: 'personal',label: 'Personal',       icon: '👤', desc: 'Hantera personaldata' },
  { route: 'calendar',label: 'Kalender',       icon: '📅', desc: 'Redigera schema' },
  { route: 'control', label: 'Kontroll',       icon: '✓',  desc: 'Regelöversikt' },
  { route: 'summary', label: 'Sammanfattning', icon: '📊', desc: 'Timsummering' },
  { route: 'rules',   label: 'Regler',         icon: '⚖️', desc: 'HRF-avtalsregler' },
  { route: 'export',  label: 'Export/Import',  icon: '💾', desc: 'Säkerhetskopiering' }
];

function escapeHtml(str) {
  // Fail-closed XSS-skydd (även om vi i praktiken bara använder statiska strängar här)
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function routeToHash(route) {
  return `#/` + String(route || '').replace(/^\#\/?/, '');
}

/* ============================================================
 * BLOCK 2 — Navbar/topbar
 * ============================================================ */
export function renderNavbar(container) {
  try {
    const linksHtml = NAV_ITEMS.map(item => {
      const href = routeToHash(item.route);
      // icon + label för bättre visuellt matchning (som du visar i screenshots)
      return `<a href="${escapeHtml(href)}" class="nav-link">${escapeHtml(item.icon)} ${escapeHtml(item.label)}</a>`;
    }).join('');

    const html = `
      <div class="navbar-content">
        <div class="navbar-brand">
          <h2>📅 Schema-Program</h2>
        </div>

        <nav class="navbar-menu">
          ${linksHtml}
        </nav>

        <div class="navbar-actions">
          <button onclick="window.location.hash = '#/login'" class="btn-logout">
            🚪 Logga ut
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    console.log('✓ Navbar renderad');
  } catch (err) {
    console.error('❌ Fel vid renderNavbar:', err);
    throw err;
  }
}

/* ============================================================
 * BLOCK 3 — QuickLinks (rutor/snabbnavigation)
 * - Kan användas på valfri sida för att visa rutor för alla topbar-länkar
 * - opts:
 *   - title: rubrik (default "Snabb-navigation")
 *   - currentRoute: markerar aktiv (om din CSS stödjer .active)
 *   - excludeRoutes: array, routes att dölja (t.ex. ['home'] om du vill)
 * ============================================================ */
export function renderQuickLinks(container, opts = {}) {
  if (!container) return;

  const title = typeof opts.title === 'string' ? opts.title : 'Snabb-navigation';
  const currentRoute = typeof opts.currentRoute === 'string' ? opts.currentRoute : '';
  const excludeRoutes = Array.isArray(opts.excludeRoutes) ? opts.excludeRoutes : [];

  const items = NAV_ITEMS.filter(it => !excludeRoutes.includes(it.route));

  const cardsHtml = items.map(item => {
    const href = routeToHash(item.route);
    const isActive = item.route === currentRoute;
    // Återanvänder befintliga home-klasser så vi slipper ny CSS
    return `
      <a href="${escapeHtml(href)}" class="home-nav-item${isActive ? ' active' : ''}">
        <span class="home-nav-item-icon">${escapeHtml(item.icon)}</span>
        <span class="home-nav-item-title">${escapeHtml(item.label)}</span>
        <span class="home-nav-item-desc">${escapeHtml(item.desc)}</span>
      </a>
    `;
  }).join('');

  // Vi använder samma wrapper-klasser som Home redan använder (home-nav-section/home-nav-grid)
  // Om en sida inte har "home-container/home-content" gör det inget; dessa sektioner funkar ändå.
  const html = `
    <div class="home-nav-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="home-nav-grid">
        ${cardsHtml}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/* ============================================================
 * BLOCK 4 — Error Rendering
 * ============================================================ */
export function renderError(container, errorOrReport) {
  if (!container) {
    console.error('❌ Error-container saknas');
    return;
  }

  try {
    // Konvertera Error till DiagnosticReport om nödvändigt
    let report;

    if (errorOrReport instanceof Error) {
      report = diagnostics.report({
        code: 'RENDER_ERROR',
        where: 'UI_UTILITY',
        fileHint: 'src/ui.js',
        detailsSafe: errorOrReport.message || 'Ett fel uppstod under rendering'
      });
    } else {
      report = errorOrReport;
    }

    const publicMsg = report.getPublicMessage();
    const debugMsg = report.getDebugMessage();

    // Hämta modul-healthcheck
    const moduleHealth = diagnostics.getModuleHealth();
    const allModuleStatuses = diagnostics.getAllModuleStatuses();

    const html = `
      <div class="error-panel-content">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <h3>Ett fel uppstod</h3>
        </div>

        <div class="error-details">
          <div class="error-code">
            <strong>Kod:</strong> ${escapeHtml(publicMsg.code)}
          </div>
          <div class="error-where">
            <strong>Modul:</strong> ${escapeHtml(publicMsg.where)}
          </div>
          <div class="error-message">
            <strong>Meddelande:</strong> ${escapeHtml(publicMsg.message)}
          </div>
          <div class="error-hint">
            💡 ${escapeHtml(publicMsg.hint)}
          </div>

          ${debugMsg ? `
            <details class="error-debug">
              <summary>🔍 Debug-info</summary>
              <pre>${escapeHtml(JSON.stringify(debugMsg, null, 2))}</pre>
            </details>
          ` : ''}

          ${Array.isArray(allModuleStatuses) && allModuleStatuses.length > 0 ? `
            <details class="module-health">
              <summary>🏥 Modul-hälsa (${escapeHtml(moduleHealth.ok)}/${escapeHtml(moduleHealth.total)} OK)</summary>
              <div class="module-list">
                ${allModuleStatuses.map(status => `
                  <div class="module-item module-${escapeHtml(status.status)}">
                    <span class="module-emoji">${escapeHtml(status.getStatusEmoji())}</span>
                    <span class="module-id">${escapeHtml(status.id)}</span>
                    <span class="module-status">${escapeHtml(status.getStatusText())}</span>
                    ${status.duration ? `<span class="module-duration">${escapeHtml(status.duration)}ms</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </details>
          ` : ''}
        </div>

        <div class="error-actions">
          <button onclick="window.location.reload()" class="btn btn-primary">
            🔄 Ladda om sidan
          </button>
          <button onclick="window.location.hash = '#/home'" class="btn btn-secondary">
            🏠 Gå till Hem
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
    console.log('✓ Error-panel renderad');
  } catch (err) {
    console.error('❌ KRITISKT: Error-panel render failed:', err);
    // Fallback: Visa simpel text-error
    if (container) {
      container.innerHTML = `
        <div style="padding: 2rem; background: #ffe8e8; border: 2px solid #d63031; border-radius: 8px; color: #721c24;">
          <h3>⚠️ Ett kritiskt fel uppstod</h3>
          <p>Systemet kunde inte visa en detaljerad felbeskrivning.</p>
          <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
            🔄 Ladda om sidan
          </button>
        </div>
      `;
      container.style.display = 'block';
    }
  }
}

/* ============================================================
 * BLOCK 5 — Toasts
 * ============================================================ */
export function showSuccess(message, duration = 3000) {
  const div = document.createElement('div');
  div.className = 'alert alert-success';
  div.textContent = '✓ ' + message;
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.right = '20px';
  div.style.zIndex = '9999';
  div.style.animation = 'slideIn 0.3s ease';

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

export function showWarning(message, duration = 5000) {
  const div = document.createElement('div');
  div.className = 'alert alert-warning';
  div.textContent = '⚠️ ' + message;
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.right = '20px';
  div.style.zIndex = '9999';
  div.style.animation = 'slideIn 0.3s ease';

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

export function showInfo(message, duration = 4000) {
  const div = document.createElement('div');
  div.className = 'alert alert-info';
  div.textContent = 'ℹ️ ' + message;
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.right = '20px';
  div.style.zIndex = '9999';
  div.style.animation = 'slideIn 0.3s ease';

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

/* ============================================================
 * BLOCK 6 — Confirm dialog
 * ============================================================ */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    div.className = 'confirm-overlay';
    div.innerHTML = `
      <div class="confirm-dialog">
        <h3>Bekräftelse</h3>
        <p>${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick="this.closest('.confirm-overlay').dataset.result = 'cancel'; this.closest('.confirm-overlay').remove();">
            Avbryt
          </button>
          <button class="btn btn-primary" onclick="this.closest('.confirm-overlay').dataset.result = 'ok'; this.closest('.confirm-overlay').remove();">
            OK
          </button>
        </div>
      </div>
    `;

    div.addEventListener('remove', () => {
      resolve(div.dataset.result === 'ok');
    });

    document.body.appendChild(div);
  });
}
