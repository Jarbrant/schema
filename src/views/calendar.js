/*
 * AO-09 — CALENDAR: Kalender (enkel version för nu)
 */

export function renderCalendar(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();

    if (!state.schedule || state.schedule.year !== 2026) {
        container.innerHTML =
            '<div class="view-container"><h2>Kalender</h2><p class="error-text">Schedule är korrupt eller fel år. Kan inte visa kalender.</p></div>';
        return;
    }

    const html = `
        <div class="view-container">
            <h2>Kalender 2026</h2>
            <p class="empty-state">
                📅 Kalendervyn är under utveckling (AO-09+).<br>
                För nu: Använd "Personal" för att lägga till personal och "Kontroll" för att se statistik.
            </p>
        </div>
    `;

    container.innerHTML = html;
}
