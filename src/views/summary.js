/*
 * AO-19 — SUMMARY: Sammanställning (enkel version för nu)
 */

export function renderSummary(container, ctx) {
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
            <h2>Sammanställning</h2>
            <div style="background: #f0f0f0; padding: 2rem; border-radius: 4px; text-align: center;">
                <h3>📊 Timmarsummering</h3>
                <p>Aktiva personer: <strong>${activePeople}</strong></p>
                <p style="color: #666; margin-top: 1rem;">
                    Denna vy är under utveckling (AO-19+).<br>
                    Den visar timmarsummering och extra-ledighet per person.
                </p>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
