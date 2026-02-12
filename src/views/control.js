/*
 * AO-22 — CONTROL: Kontroll (enkel version för nu)
 */

export function renderControl(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const people = state.people || [];
    const activePeople = people.filter(p => p.isActive).length;

    const html = `
        <div class="view-container">
            <h2>Kontroll</h2>
            <div style="background: #f0f0f0; padding: 2rem; border-radius: 4px;">
                <h3>🔍 Regelöversikt & Bemanningskontroll</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
                    <div style="background: white; padding: 1rem; border-radius: 4px; text-align: center;">
                        <strong>Aktiva personer</strong>
                        <p style="font-size: 2rem; color: #667eea; margin: 0.5rem 0;">${activePeople}</p>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 4px; text-align: center;">
                        <strong>P0 Varningar</strong>
                        <p style="font-size: 2rem; color: #f44336; margin: 0.5rem 0;">0</p>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 4px; text-align: center;">
                        <strong>P1 Varningar</strong>
                        <p style="font-size: 2rem; color: #ff9800; margin: 0.5rem 0;">0</p>
                    </div>
                </div>
                <p style="color: #666; margin-top: 1.5rem;">
                    Denna vy är under utveckling (AO-22+).<br>
                    Den visar regelvarningar, bemanningsbehov och schemaläggning.
                </p>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
