/* ============================================================
 * AO-05 — UI: Navbar och error-rendering (AUTOPATCH v2)
 * FIL: src/ui.js
 *
 * Mål:
 * - P0: Navbar ska alltid renderas horisontellt (ingen vertikal UL-lista).
 * - P0: Logout ska ligga på samma rad längst till höger.
 * - P1: Minska XSS-yta: bygg navbar med DOM (inte innerHTML).
 * - P1: Block + inlinekommentarer för framtida underhåll.
 * ============================================================ */

import { logout } from './views/login.js';

/* ============================================================
   BLOCK 1: NAVBAR (DOM-builder)
   ============================================================ */

/**
 * Renderar topbar i #navbar.
 * Bygger DOM säkert (textContent), inga dynamiska user-texter.
 *
 * Förväntad CSS (base.css):
 * - .topbar, .topbar-inner, .topbar-brand, .topbar-links, .topbar-logout
 */
export function renderNavbar(navbar) {
    if (!navbar) return;

    // GUARD: rensa alltid container för att undvika dubletter vid rerender
    navbar.textContent = '';

    const appName = 'Schema-Program';
    const links = [
        { route: 'home', label: 'Hem' },
        { route: 'personal', label: 'Personal' },
        { route: 'calendar', label: 'Kalender' },
        { route: 'control', label: 'Kontroll' },
        { route: 'summary', label: 'Sammanställning' },
        { route: 'rules', label: '📋 Regler' },
        { route: 'export', label: 'Export/Import' },
    ];

    // Topbar wrapper
    const topbar = document.createElement('div');
    topbar.className = 'topbar';

    const inner = document.createElement('div');
    inner.className = 'topbar-inner';

    // Brand (vänster)
    const brand = document.createElement('div');
    brand.className = 'topbar-brand';
    brand.textContent = appName;

    // Links (mitten/vänster)
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

    // Logout (höger)
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.type = 'button';
    logoutBtn.className = 'topbar-logout';
    logoutBtn.textContent = '🚪 Logga ut';

    logoutBtn.addEventListener('click', () => {
        // UX: enkel bekräftelse (ingen extra logik)
        if (confirm('Logga ut?')) logout();
    });

    // Montera
    inner.appendChild(brand);
    inner.appendChild(ul);
    inner.appendChild(logoutBtn);

    topbar.appendChild(inner);
    navbar.appendChild(topbar);
}

/* ============================================================
   BLOCK 2: ERROR RENDER
   ============================================================ */

export function renderError(errorPanel, error) {
    if (!errorPanel) return;

    const errorMsg = error?.message || String(error);
    const errorType = error?.name || 'Error';

    // SCOPE: detta är en dev-friendly panel, inte “snygg UI”
    const html = `
        <h3>Något gick fel</h3>
        <div class="error-type">${escapeHtml(`${errorType}: ${errorMsg}`)}</div>
        <p class="error-tip">💡 Öppna Console för fler detaljer</p>
    `;

    errorPanel.innerHTML = html;
    errorPanel.classList.remove('hidden');

    setTimeout(() => {
        errorPanel.classList.add('hidden');
    }, 8000);
}

/* ============================================================
   BLOCK 3: UTILS
   ============================================================ */

/**
 * XSS-guard även om input oftast är “system errors”.
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
