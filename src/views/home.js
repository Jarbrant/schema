/*
 * AO-07: HOME — Startsida med gradient bakgrund & card-layout
 * 
 * Renderar välkomstsidan med:
 * - Gradient-bakgrund
 * - Horisontell tab-navigation
 * - Stats (Personal, År, System)
 * - Snabb-navigation
 */

export function renderHome(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const activePeople = state.people.filter(p => p.isActive).length;
    
    // Få aktuell route från context
    const currentRoute = ctx?.currentRoute || 'home';

    const html = `
        <div class="home-container">
            <div class="home-content">
                <h1>Välkommen till Schema-Program</h1>
                <p class="home-tagline">
                    En schemaläggningslösning för HRF/Visita Gröna Riks
                </p>

                <!-- Horisontell tab-navigation -->
                <div class="home-tabs">
                    <a href="#/home" class="home-tab ${currentRoute === 'home' ? 'active' : ''}">Hem</a>
                    <a href="#/personal" class="home-tab ${currentRoute === 'personal' ? 'active' : ''}">Personal</a>
                    <a href="#/calendar" class="home-tab ${currentRoute === 'calendar' ? 'active' : ''}">Kalender</a>
                    <a href="#/control" class="home-tab ${currentRoute === 'control' ? 'active' : ''}">Kontroll</a>
                    <a href="#/summary" class="home-tab ${currentRoute === 'summary' ? 'active' : ''}">Sammanställning</a>
                    <a href="#/rules" class="home-tab ${currentRoute === 'rules' ? 'active' : ''}">Regler</a>
                    <a href="#/export" class="home-tab ${currentRoute === 'export' ? 'active' : ''}">Export/Import</a>
                </div>

                <div class="home-hero">
                    Schema-Program v1.0 — En schemaläggningslösning för HRF/Visita Gröna Riks
                </div>

                <div class="home-stats">
                    <div class="stat-card">
                        <div class="stat-card-icon">👥</div>
                        <h3>Personal</h3>
                        <div class="value">${activePeople}</div>
                        <p>Aktiva personer</p>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card-icon">📅</div>
                        <h3>År</h3>
                        <div class="value">${state.schedule?.year || '2026'}</div>
                        <p>Planerat år</p>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card-icon">⚙️</div>
                        <h3>System</h3>
                        <div class="value">${state.meta?.appVersion || '1.0.0'}</div>
                        <p>App-version</p>
                    </div>
                </div>

                <div class="home-nav-section">
                    <h2>Snabb-navigation</h2>
                    <div class="home-nav-grid">
                        <a href="#/personal" class="home-nav-item">
                            <span class="home-nav-item-icon">👥</span>
                            <span class="home-nav-item-title">Personal</span>
                            <span class="home-nav-item-desc">Hantera personaldata</span>
                        </a>
                        <a href="#/calendar" class="home-nav-item">
                            <span class="home-nav-item-icon">📅</span>
                            <span class="home-nav-item-title">Kalender</span>
                            <span class="home-nav-item-desc">Redigera schema</span>
                        </a>
                        <a href="#/control" class="home-nav-item">
                            <span class="home-nav-item-icon">🔍</span>
                            <span class="home-nav-item-title">Kontroll</span>
                            <span class="home-nav-item-desc">Regelöversikt</span>
                        </a>
                        <a href="#/summary" class="home-nav-item">
                            <span class="home-nav-item-icon">📊</span>
                            <span class="home-nav-item-title">Sammanställning</span>
                            <span class="home-nav-item-desc">Timsummering</span>
                        </a>
                        <a href="#/rules" class="home-nav-item">
                            <span class="home-nav-item-icon">📋</span>
                            <span class="home-nav-item-title">Regler</span>
                            <span class="home-nav-item-desc">HRF-avtalsregler</span>
                        </a>
                        <a href="#/export" class="home-nav-item">
                            <span class="home-nav-item-icon">💾</span>
                            <span class="home-nav-item-title">Export/Import</span>
                            <span class="home-nav-item-desc">Säkerhetskopiering</span>
                        </a>
                    </div>
                </div>

                <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #eee;">
                    <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: #333;">ℹ️ Om Schema-Program</h3>
                    <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #667eea;">
                        <p style="margin-bottom: 0.5rem; color: #666;">
                            <strong>Projekt:</strong> Schema-Program v1 (UI-only / GitHub Pages)
                        </p>
                        <p style="margin-bottom: 0.5rem; color: #666;">
                            <strong>Avtal:</strong> HRF/Visita Gröna Riks
                        </p>
                        <p style="color: #666;">
                            <strong>Status:</strong> Produktion
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
