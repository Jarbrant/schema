/*
 * AO-05 — UI: Navbar och error-rendering
 */

import { logout } from './views/login.js';

export function renderNavbar(navbar) {
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

    let navHTML = `<h1>${appName}</h1>`;
    navHTML += '<nav><ul>';
    links.forEach(({ route, label }) => {
        navHTML += `<li><a href="#/${route}" class="nav-link">${label}</a></li>`;
    });
    navHTML += `<li><button id="logout-btn" class="nav-logout-btn">🚪 Logga ut</button></li>`;
    navHTML += '</ul></nav>';

    navbar.innerHTML = navHTML;

    const logoutBtn = navbar.querySelector('#logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Logga ut?')) {
                logout();
            }
        });
    }
}

export function renderError(errorPanel, error) {
    if (!errorPanel) return;

    const errorMsg = error?.message || String(error);
    const errorType = error?.name || 'Error';

    const html = `
        <h3>Något gick fel</h3>
        <div class="error-type">${errorType}: ${errorMsg}</div>
        <p class="error-tip">💡 Öppna Console för fler detaljer</p>
    `;

    errorPanel.innerHTML = html;
    errorPanel.classList.remove('hidden');

    setTimeout(() => {
        errorPanel.classList.add('hidden');
    }, 8000);
}
