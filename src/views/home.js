/*
 * AO-07: HOME — Startsida med gradient bakgrund & card-layout
 *
 * SPRINT 1 PATCH:
 *   - "Skift" → "Grundpass" i tabs + snabb-navigation
 *   - Beskrivning uppdaterad: "Passöversikt" istf "Planera skift"
 */

export function renderHome(container, ctx) {
  const store = ctx?.store;
  if (!store) {
    container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
    return;
  }

  const state = store.getState();
  const people = Array.isArray(state.people) ? state.people : [];
  const activePeople = people.filter((p) => p && p.isActive).length;

  const currentRoute = ctx?.currentRoute || 'home';

  const yearValue = state.schedule?.year || '2026';
  const versionValue = state.meta?.appVersion || '1.0.0';

  const html = `
    <div class="home-container">
      <div class="home-content">

        <!-- TOPP-RAD: H1 + 3 mini-stats -->
        <div class="home-toprow">
          <div class="home-titlewrap">
            <h1>Välkommen till Schema-Program</h1>
          </div>

          <div class="home-mini-stats" aria-label="Statistik">
            <div class="home-mini-card" role="group" aria-label="Personal">
              <div class="home-mini-top">
                <span class="home-mini-icon" aria-hidden="true">👥</span>
                <span class="home-mini-label">Personal</span>
              </div>
              <div class="home-mini-value">${activePeople}</div>
              <div class="home-mini-sub">Aktiva personer</div>
            </div>

            <div class="home-mini-card" role="group" aria-label="År">
              <div class="home-mini-top">
                <span class="home-mini-icon" aria-hidden="true">📅</span>
                <span class="home-mini-label">År</span>
              </div>
              <div class="home-mini-value">${yearValue}</div>
              <div class="home-mini-sub">Planerat år</div>
            </div>

            <div class="home-mini-card" role="group" aria-label="System">
              <div class="home-mini-top">
                <span class="home-mini-icon" aria-hidden="true">⚙️</span>
                <span class="home-mini-label">System</span>
              </div>
              <div class="home-mini-value">${versionValue}</div>
              <div class="home-mini-sub">App-version</div>
            </div>
          </div>
        </div>

        <!-- Horisontell tab-navigation -->
        <div class="home-tabs">
          <a href="#/home" class="home-tab ${currentRoute === 'home' ? 'active' : ''}">Hem</a>
          <a href="#/shifts" class="home-tab ${currentRoute === 'shifts' ? 'active' : ''}">Grundpass</a>
          <a href="#/groups" class="home-tab ${currentRoute === 'groups' ? 'active' : ''}">Grupper</a>
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

        <div class="home-nav-section">
          <h2>Snabb-navigation</h2>

          <div class="home-nav-grid">
            <a href="#/home" class="home-nav-item">
              <span class="home-nav-item-icon">🏠</span>
              <span class="home-nav-item-title">Hem</span>
              <span class="home-nav-item-desc">Startsida</span>
            </a>

            <a href="#/shifts" class="home-nav-item">
              <span class="home-nav-item-icon">⏰</span>
              <span class="home-nav-item-title">Grundpass</span>
              <span class="home-nav-item-desc">Passöversikt</span>
            </a>

            <a href="#/groups" class="home-nav-item">
              <span class="home-nav-item-icon">👥</span>
              <span class="home-nav-item-title">Grupper</span>
              <span class="home-nav-item-desc">Hantera grupper & skapa pass</span>
            </a>

            <a href="#/personal" class="home-nav-item">
              <span class="home-nav-item-icon">👤</span>
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
              <span class="home-nav-item-icon">⚖️</span>
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

        <div class="home-about">
          <h3>ℹ️ Om Schema-Program</h3>
          <div class="home-about-card">
            <p><strong>Projekt:</strong> Schema-Program v1 (UI-only / GitHub Pages)</p>
            <p><strong>Avtal:</strong> HRF/Visita Gröna Riks</p>
            <p><strong>Status:</strong> Produktion</p>
          </div>
        </div>

      </div>
    </div>
  `;

  container.innerHTML = html;
}
