/*
 * AO-07: HOME — Startsida med gradient bakgrund & card-layout
 *
 * Patch v2 (Design enligt screenshot):
 * - Tagline under H1 borttagen
 * - Stats (Personal/År/System) flyttade upp till topp-rad (höger om H1)
 * - Stats gjorda kompaktare (mini-cards) utan att kräva extern CSS-ändring
 * - Snabb-navigation (ALLA toppbar-länkar) kvar längre ned
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

  // Få aktuell route från context
  const currentRoute = ctx?.currentRoute || 'home';

  const yearValue = state.schedule?.year || '2026';
  const versionValue = state.meta?.appVersion || '1.0.0';

  const html = `
    <div class="home-container">
      <div class="home-content">

        <!-- Home-scoped mini-stats styles (ingen extern CSS krävs) -->
        <style>
          .home-toprow{
            display:flex;
            align-items:flex-end;
            justify-content:space-between;
            gap:1rem;
            margin-top:0.25rem;
            margin-bottom:0.5rem;
          }
          .home-titlewrap h1{ margin:0; }
          .home-mini-stats{
            display:flex;
            gap:0.75rem;
            flex-wrap:wrap;
            justify-content:flex-end;
          }
          .home-mini-card{
            background:#fff;
            border:1px solid rgba(0,0,0,0.10);
            border-radius:10px;
            padding:0.55rem 0.75rem;
            min-width:120px;
            box-shadow:0 6px 18px rgba(0,0,0,0.06);
          }
          .home-mini-top{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:0.5rem;
            margin-bottom:0.15rem;
          }
          .home-mini-icon{ font-size:1.05rem; line-height:1; }
          .home-mini-label{
            font-weight:600;
            color:#333;
            font-size:0.85rem;
            white-space:nowrap;
          }
          .home-mini-value{
            font-size:1.1rem;
            font-weight:800;
            color:#667eea;
            margin:0.05rem 0 0;
          }
          .home-mini-sub{
            font-size:0.75rem;
            color:#777;
            margin:0.1rem 0 0;
            white-space:nowrap;
          }
          @media (max-width: 880px){
            .home-toprow{ align-items:flex-start; }
            .home-titlewrap{ width:100%; }
            .home-mini-stats{ width:100%; justify-content:flex-start; }
          }
        </style>

        <!-- TOPP-RAD: H1 + 3 mini-stats (flyttade upp) -->
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
          <a href="#/shifts" class="home-tab ${currentRoute === 'shifts' ? 'active' : ''}">Skift</a>
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

          <!-- ALLA toppbar-länkar som rutor -->
          <div class="home-nav-grid">
            <a href="#/home" class="home-nav-item">
              <span class="home-nav-item-icon">🏠</span>
              <span class="home-nav-item-title">Hem</span>
              <span class="home-nav-item-desc">Startsida</span>
            </a>

            <a href="#/shifts" class="home-nav-item">
              <span class="home-nav-item-icon">📋</span>
              <span class="home-nav-item-title">Skift</span>
              <span class="home-nav-item-desc">Planera skift</span>
            </a>

            <a href="#/groups" class="home-nav-item">
              <span class="home-nav-item-icon">👥</span>
              <span class="home-nav-item-title">Grupper</span>
              <span class="home-nav-item-desc">Hantera grupper</span>
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
