/*
 * AO-13 — RULES: Regler (enkel version för nu)
 */

export function renderRules(container, ctx) {
    const html = `
        <div class="view-container">
            <h2>Regler — HRF/Gröna Riks</h2>
            <div style="background: #e3f2fd; padding: 1.5rem; border-radius: 4px; border-left: 4px solid #2196f3;">
                <h3 style="margin-top: 0;">📋 HRF-avtalsregler</h3>
                <div style="line-height: 1.8;">
                    <h4>P0-regler (Obligatoriska)</h4>
                    <ul>
                        <li><strong>REST_11H:</strong> Dygnsvila minst 11 timmar mellan arbetsdagar</li>
                        <li><strong>MAX_10H:</strong> Max arbetstid 10 timmar per dag</li>
                        <li><strong>REST_36H:</strong> Veckovila minst 36 timmar per 7-dagars period</li>
                    </ul>

                    <h4>P1-regler (Varningar)</h4>
                    <ul>
                        <li><strong>STREAK_10:</strong> Varning vid 10+ arbetsdagar i rad</li>
                    </ul>

                    <p style="color: #666; margin-top: 1rem; font-style: italic;">
                        Denna vy är under utveckling (AO-13+).<br>
                        Den visar och låter dig konfigurera alla regler och färger.
                    </p>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}
