/*
 * AO-14 — HELP VIEW (Hjälp & Guide)
 * FIL: src/views/help.js
 *
 * Visar hjälp, guide och FAQ för varje vy i systemet.
 * Tillgänglig via #/help i navigeringen.
 *
 * Sektioner:
 *   1. Kom igång (steg-för-steg)
 *   2. Vyguide (en sektion per vy)
 *   3. Vanliga frågor (FAQ)
 *   4. Kortkommandon
 *   5. Om programmet
 *
 * Kontrakt:
 *   - Exporterar renderHelp(container, ctx)
 *   - XSS-safe
 */

export function renderHelp(container, ctx) {
    if (!container) return;

    try {
        container.innerHTML = `
            <div class="help-container">

                <!-- HEADER -->
                <div class="help-header">
                    <h1>📖 Hjälp & Guide</h1>
                    <p class="help-subtitle">Allt du behöver veta för att använda Schema-Program</p>
                </div>

                <!-- QUICK NAV -->
                <div class="help-nav">
                    <button class="help-nav-btn active" data-help-section="start">🚀 Kom igång</button>
                    <button class="help-nav-btn" data-help-section="views">📋 Vyguide</button>
                    <button class="help-nav-btn" data-help-section="faq">❓ FAQ</button>
                    <button class="help-nav-btn" data-help-section="shortcuts">⌨️ Genvägar</button>
                    <button class="help-nav-btn" data-help-section="about">ℹ️ Om</button>
                </div>

                <!-- CONTENT -->
                <div class="help-content">

                    <!-- ═══════════════════════════════════════
                         SEKTION 1: KOM IGÅNG
                         ═══════════════════════════════════════ -->
                    <div class="help-section active" id="help-start">
                        <h2>🚀 Kom igång — 5 steg till ditt första schema</h2>

                        <div class="help-steps">
                            <div class="help-step">
                                <div class="help-step-number">1</div>
                                <div class="help-step-content">
                                    <h3>👥 Lägg till personal</h3>
                                    <p>Gå till <strong>Personal</strong>-vyn och lägg till dina anställda. Fyll i namn, sysselsättningsgrad och lön.</p>
                                    <div class="help-tip">💡 Sätt rätt sysselsättningsgrad — den styr hur många dagar personen schemaläggas.</div>
                                </div>
                            </div>

                            <div class="help-step">
                                <div class="help-step-number">2</div>
                                <div class="help-step-content">
                                    <h3>📂 Skapa grupper</h3>
                                    <p>Gå till <strong>Grupper</strong>-vyn. Skapa grupper (t.ex. "Kök", "Servering", "Bar") och tilldela personal till dem.</p>
                                    <div class="help-tip">💡 En person kan tillhöra flera grupper.</div>
                                </div>
                            </div>

                            <div class="help-step">
                                <div class="help-step-number">3</div>
                                <div class="help-step-content">
                                    <h3>⏰ Definiera pass</h3>
                                    <p>Gå till <strong>Pass</strong>-vyn. Skapa passmallar med tider (t.ex. "Förmiddag 07:00–15:00", "Kväll 15:00–23:00").</p>
                                    <div class="help-tip">💡 Du kan hoppa över detta steg om du bara vill schemalägga dagar utan specifika tider.</div>
                                </div>
                            </div>

                            <div class="help-step">
                                <div class="help-step-number">4</div>
                                <div class="help-step-content">
                                    <h3>📊 Ange bemanningsbehov</h3>
                                    <p>Gå till <strong>Kontroll</strong>-vyn. Ange hur många som behövs per veckodag för varje grupp (t.ex. Mån: 3, Lör: 2).</p>
                                    <div class="help-tip">💡 Detta är det viktigaste steget — utan behov kan inte motorn generera schema.</div>
                                </div>
                            </div>

                            <div class="help-step">
                                <div class="help-step-number">5</div>
                                <div class="help-step-content">
                                    <h3>🔄 Generera!</h3>
                                    <p>I <strong>Kontroll</strong>-vyn: välj grupper, välj månad och klicka "Generera schema". Motorn skapar ett förslag baserat på reglerna.</p>
                                    <div class="help-tip">💡 Du kan alltid redigera schemat manuellt i Kalender-vyn efteråt.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ═══════════════════════════════════════
                         SEKTION 2: VYGUIDE
                         ═══════════════════════════════════════ -->
                    <div class="help-section" id="help-views">
                        <h2>📋 Vyguide</h2>

                        ${renderViewGuide('🏠', 'Hem', '#/home',
                            'Startsidan visar en översikt med snabbkort: antal personal, grupper, vakanser och senaste generering.',
                            ['Klicka på ett kort för att navigera till den vyn.'])}

                        ${renderViewGuide('👥', 'Personal', '#/personal',
                            'Hantera all personal: lägg till, redigera, ta bort. Varje person har namn, lön, sysselsättningsgrad, grupper och tillgänglighet.',
                            [
                                '<strong>Sysselsättningsgrad</strong> (50–100%) styr hur många dagar/timmar personen schemaläggas.',
                                '<strong>Tillgänglighet</strong> — ange vilka veckodagar personen kan jobba.',
                                '<strong>Startdatum</strong> — person med framtida datum blockeras automatiskt.',
                                'Klicka på ett personkort för att se detaljer och redigera.',
                            ])}

                        ${renderViewGuide('📂', 'Grupper', '#/groups',
                            'Organisera personal i grupper (t.ex. Kök, Servering). Grupper styr vilka som schemaläggas tillsammans och behovet per veckodag.',
                            [
                                'En person kan tillhöra flera grupper.',
                                'Bemanningsbehovet ställs in per grupp i Kontroll-vyn.',
                            ])}

                        ${renderViewGuide('⏰', 'Pass', '#/shifts',
                            'Skapa passmallar med start- och sluttid. Pass kan kopplas till veckomallar.',
                            [
                                'T.ex. "FM" = 07:00–15:00, "EM" = 15:00–23:00.',
                                'Pass är valfria — schemat fungerar även med bara A/L-status.',
                            ])}

                        ${renderViewGuide('📅', 'Veckomallar', '#/week-templates',
                            'Skapa mallar för typveckor. En veckoomall visar vilka pass som ska köras vilken dag.',
                            [
                                'Kopiera en mall till en specifik vecka i kalendern.',
                                'Bra för återkommande scheman.',
                            ])}

                        ${renderViewGuide('🗓️', 'Kalender', '#/calendar',
                            'Se och redigera schemat dag för dag. Visar vem som jobbar, vilka pass och eventuella vakanser.',
                            [
                                'Klicka på en dag för att redigera.',
                                'Färgkoder: <span style="color:#27ae60">grön = arbete</span>, <span style="color:#e67e22">orange = semester</span>, <span style="color:#e74c3c">röd = sjuk</span>.',
                                'EXTRA-markering = vakans (personal saknas).',
                            ])}

                        ${renderViewGuide('🎛️', 'Kontroll', '#/control',
                            'Schemagenerering och kontroll. Här ställer du in behov, väljer grupper och genererar schemaförslag.',
                            [
                                '<strong>Behov</strong>: ange antal personal per veckodag per grupp.',
                                '<strong>Generera</strong>: motorn skapar förslag baserat på alla aktiva regler.',
                                '<strong>Varningar</strong>: visar regelbrott (P0 = blockerande, P1 = rekommendation).',
                                'Genererat schema kan godkännas eller förkastas.',
                            ])}

                        ${renderViewGuide('📊', 'Sammanställning', '#/summary',
                            'Översikt av timmar, kostnader och balans per person och period.',
                            [
                                'Visar schemalagda timmar vs mål per person.',
                                'Lönekostnader med arbetsgivaravgifter.',
                                'Timbalans: positiv = övertid, negativ = undertid.',
                            ])}

                        ${renderViewGuide('⚖️', 'Regler', '#/rules',
                            'Arbetstidsregler som schemamotorn tar hänsyn till. CRUD: skapa, redigera, aktivera/inaktivera.',
                            [
                                '<strong>P0-regler</strong> (röda) blockerar schemaläggning helt.',
                                '<strong>P1-regler</strong> (gula) nedprioriterar personen.',
                                '<strong>Systemregler</strong> (🔒) kan inte inaktiveras.',
                                'Alla regler visas grupperade efter kategori.',
                            ])}

                        ${renderViewGuide('📤', 'Export', '#/export',
                            'Exportera och importera data. Backup, delning och datahantering.',
                            [
                                'Exportera hela schemat som JSON.',
                                'Importera data från en annan instans.',
                                'Gör alltid backup innan stora ändringar!',
                            ])}
                    </div>

                    <!-- ═══════════════════════════════════════
                         SEKTION 3: FAQ
                         ═══════════════════════════════════════ -->
                    <div class="help-section" id="help-faq">
                        <h2>❓ Vanliga frågor</h2>

                        ${renderFAQ('Varför schemaläggas samma person varje helg?',
                            'Motorn (v4.0) använder kumulativ helg-räkning. Om alla har 0 helg-dagar avgör namnet vem som får första helgen. Kontrollera att regeln <strong>"Helg-rotation"</strong> är aktiv i Regler-vyn (#/rules).')}

                        ${renderFAQ('Vad betyder P0 och P1?',
                            '<strong>P0 = Blockerar</strong>: personen KAN INTE schemaläggas om regeln bryts (t.ex. max 6 dagar i rad).<br><strong>P1 = Nedprioriterar</strong>: personen KAN schemaläggas men får lägre prioritet (t.ex. jobbade förra helgen).')}

                        ${renderFAQ('Hur fungerar sysselsättningsgraden?',
                            'En person med 75% får max 30 tim/vecka (75% av 40h). Motorn räknar antal dagar × 8h som estimat. Personens target-dagar beräknas proportionellt.')}

                        ${renderFAQ('Kan jag ändra schemat manuellt efter generering?',
                            'Ja! Schemat som genereras är ett <strong>förslag</strong>. Gå till Kalender-vyn och redigera enskilda dagar. Kontroll-vyn visar varningar om du bryter regler.')}

                        ${renderFAQ('Vad är "vakanser"?',
                            'En vakans uppstår när motorn inte hittar någon ledig person att schemalägga. Markeras som <strong>EXTRA</strong> i kalendern. Lös genom att lägga till fler personer, ändra tillgänglighet eller sänka behovet.')}

                        ${renderFAQ('Hur sparas data?',
                            'All data sparas i <strong>webbläsarens localStorage</strong>. Det betyder att data finns kvar när du stänger fliken, men försvinner om du rensar webbläsardata. Gör regelbunden backup via Export-vyn!')}

                        ${renderFAQ('Kan flera personer använda systemet samtidigt?',
                            'Nej, inte i nuvarande version. Schemat är lokalt per webbläsare. För att dela, exportera som JSON och importera hos den andra personen.')}

                        ${renderFAQ('Vad är skillnaden på "Systemregler" och vanliga regler?',
                            'Systemregler (🔒) är alltid aktiva och kan inte inaktiveras eller tas bort. De säkerställer grundläggande funktionalitet som tillgänglighetskontroll och frånvarohantering.')}
                    </div>

                    <!-- ═══════════════════════════════════════
                         SEKTION 4: KORTKOMMANDON
                         ═══════════════════════════════════════ -->
                    <div class="help-section" id="help-shortcuts">
                        <h2>⌨️ Kortkommandon & Tips</h2>

                        <table class="help-shortcuts-table">
                            <thead>
                                <tr><th>Genväg</th><th>Åtgärd</th></tr>
                            </thead>
                            <tbody>
                                <tr><td><kbd>#/home</kbd></td><td>Gå till startsidan</td></tr>
                                <tr><td><kbd>#/personal</kbd></td><td>Gå till Personal</td></tr>
                                <tr><td><kbd>#/groups</kbd></td><td>Gå till Grupper</td></tr>
                                <tr><td><kbd>#/calendar</kbd></td><td>Gå till Kalender</td></tr>
                                <tr><td><kbd>#/control</kbd></td><td>Gå till Kontroll</td></tr>
                                <tr><td><kbd>#/rules</kbd></td><td>Gå till Regler</td></tr>
                                <tr><td><kbd>#/help</kbd></td><td>Visa denna hjälp</td></tr>
                                <tr><td><kbd>#/export</kbd></td><td>Export / Backup</td></tr>
                            </tbody>
                        </table>

                        <div class="help-tips-box">
                            <h3>💡 Tips</h3>
                            <ul>
                                <li>Gör <strong>alltid backup</strong> (Export-vyn) innan du genererar ett nytt schema.</li>
                                <li>Börja med <strong>en grupp</strong> tills du förstår hur motorn fungerar.</li>
                                <li>Kontrollera <strong>Regler-vyn</strong> om schemat ser konstigt ut — kanske en regel är inaktiv.</li>
                                <li>Om en person aldrig schemaläggas: kontrollera tillgänglighet, startdatum och gruppmedlemskap.</li>
                                <li>Du kan använda <strong>F12 → Console</strong> för att se motorns logg under generering.</li>
                            </ul>
                        </div>
                    </div>

                    <!-- ═══════════════════════════════════════
                         SEKTION 5: OM PROGRAMMET
                         ═══════════════════════════════════════ -->
                    <div class="help-section" id="help-about">
                        <h2>ℹ️ Om Schema-Program</h2>

                        <div class="help-about-card">
                            <h3>📅 Schema-Program v3.0</h3>
                            <p>Schemaläggningssystem för restaurang, hotell och serviceföretag.</p>

                            <table class="help-about-table">
                                <tr><td><strong>Version</strong></td><td>3.0 (Rules Integration)</td></tr>
                                <tr><td><strong>Motor</strong></td><td>Scheduler Engine v4.0 (Kumulativ helg-rotation)</td></tr>
                                <tr><td><strong>Regler</strong></td><td>16 regeltyper (P0/P1), ATL + HRF + EU-direktiv</td></tr>
                                <tr><td><strong>Teknik</strong></td><td>Vanilla JavaScript, GitHub Pages</td></tr>
                                <tr><td><strong>Data</strong></td><td>localStorage (lokalt i webbläsaren)</td></tr>
                                <tr><td><strong>Licens</strong></td><td>Privat</td></tr>
                            </table>

                            <h4>Lagstöd som reglerna bygger på:</h4>
                            <ul>
                                <li><strong>ATL</strong> — Arbetstidslagen (SFS 1982:673)</li>
                                <li><strong>EU 2003/88/EG</strong> — Europeiska arbetstidsdirektivet</li>
                                <li><strong>HRF-avtalet</strong> — Hotell- och Restaurangfackets kollektivavtal</li>
                            </ul>
                        </div>
                    </div>

                </div>
            </div>`;

        // Event listeners
        setupHelpListeners(container);

    } catch (err) {
        console.error('❌ renderHelp kraschade:', err);
        container.innerHTML = `<div class="help-error"><h2>❌ Fel</h2><p>${escapeHtml(String(err.message))}</p></div>`;
    }
}

/* ── HELPERS ── */

function renderViewGuide(icon, title, route, description, tips) {
    const tipsList = tips.map(t => `<li>${t}</li>`).join('');
    return `
        <div class="help-view-guide">
            <div class="help-view-guide-header">
                <span class="help-view-icon">${icon}</span>
                <h3>${escapeHtml(title)}</h3>
                <a href="${escapeHtml(route)}" class="help-view-link">Öppna →</a>
            </div>
            <p>${description}</p>
            ${tips.length > 0 ? `<ul class="help-view-tips">${tipsList}</ul>` : ''}
        </div>`;
}

function renderFAQ(question, answer) {
    return `
        <details class="help-faq-item">
            <summary><strong>${escapeHtml(question)}</strong></summary>
            <div class="help-faq-answer">${answer}</div>
        </details>`;
}

function setupHelpListeners(container) {
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-help-section]');
        if (!btn) return;

        const section = btn.dataset.helpSection;

        // Toggle nav buttons
        container.querySelectorAll('.help-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle sections
        container.querySelectorAll('.help-section').forEach(s => s.classList.remove('active'));
        const target = container.querySelector(`#help-${section}`);
        if (target) target.classList.add('active');
    });
}

function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
