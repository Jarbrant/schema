/*
 * AO-07 — HOME: Startsida
 */

export function renderHome(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const activePeople = state.people.filter(p => p.isActive).length;
    const inactivePeople = state.people.filter(p => !p.isActive).length;

    const html = `
        <div class="view-container home-container">
            <h2>Välkommen till Schema-Program</h2>
            
            <div class="welcome-section">
                <p class="welcome-text">
                    Schema-Program v1.0 — En schemaläggningslösning för HRF/Visita Gröna Riks
                </p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-content">
                        <h3>Personal</h3>
                        <p class="stat-value">${activePeople}</p>
                        <p class="stat-label">Aktiva personer</p>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon">📅</div>
                    <div class="stat-content">
                        <h3>År</h3>
                        <p class="stat-value">${state.schedule?.year || '2026'}</p>
                        <p class="stat-label">Planerat år</p>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-icon">⚙️</div>
                    <div class="stat-content">
                        <h3>System</h3>
                        <p class="stat-value">${state.meta?.appVersion || '1.0.0'}</p>
                        <p class="stat-label">App-version</p>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <h3>ℹ️ Om Schema-Program</h3>
                <div class="info-content">
                    <p>
                        <strong>Projekt:</strong> Schema-Program v1 (UI-only / GitHub Pages)<br>
                        <strong>Avtal:</strong> HRF/Visita Gröna Riks<br>
                        <strong>Status:</strong> Produktion
                    </p>
                    <p style="margin-top: 1rem;">
                        Denna applikation hjälper till att schemalägga personal enligt HRF-avtalet
                        med stöd för rollbaserad bemanningsplanering, extra-ledighetshantering och
                        automatisk schemagenering.
                    </p>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
