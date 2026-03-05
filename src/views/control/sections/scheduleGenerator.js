/*
 * SCHEDULE GENERATOR SECTION — SPRINT 2
 *
 * ÄNDRING: Byter från scheduler.js (gammal motor utan state.rules)
 *          → scheduler/engine.js generate() (full regelmotor v3.0)
 *
 * NYA FUNKTIONER:
 * - Gruppväljare (checkboxar) — generate() kräver selectedGroupIds
 * - Frånvaro-blockering via state.absences → vacationDates/leaveDates
 * - Regelvarningar (P0/P1) visas i resultat
 * - Vakanser visas tydligt
 */

import { generate } from '../../../scheduler/engine.js';
import { showSuccess, showWarning } from '../../../ui.js';
import { reportError } from '../../../diagnostics.js';

/* ============================================================
 * BLOCK 1 — RENDER UI
 * ============================================================ */
export function renderScheduleGeneratorSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) throw new Error('Store missing');

        while (container.firstChild) container.removeChild(container.firstChild);

        const state = store.getState();
        const groups = (state.groups && typeof state.groups === 'object') ? state.groups : {};
        const groupsArr = Object.values(groups).filter(Boolean);

        // === HEADER ===
        const header = document.createElement('div');
        header.style.marginBottom = '1.5rem';

        const title = document.createElement('h2');
        title.textContent = '⚙️ Schemagenerator';

        const desc = document.createElement('p');
        desc.textContent = 'Generera schema med full regelmotor (helgrotation, frånvaro, max-timmar m.m.)';
        desc.style.color = '#666';

        header.appendChild(title);
        header.appendChild(desc);
        container.appendChild(header);

        // === RULES INFO ===
        const rules = Array.isArray(state.rules) ? state.rules.filter(r => r.isActive) : [];
        const rulesInfo = document.createElement('div');
        rulesInfo.style.cssText = 'padding:0.75rem 1rem;background:#e8f5e9;border-left:4px solid #4caf50;border-radius:6px;margin-bottom:1.5rem;font-size:0.9rem;';
        rulesInfo.innerHTML = `<strong>📋 ${rules.length} aktiva regler</strong> från <a href="#/rules" style="color:#2e7d32;">Arbetstidsregler-vyn</a> tillämpas automatiskt vid generering.`;
        container.appendChild(rulesInfo);

        // === GROUP SELECTOR ===
        const groupSection = document.createElement('div');
        groupSection.style.cssText = 'margin-bottom:1.5rem;padding:1rem;background:#f9f9f9;border-radius:6px;';

        const groupLabel = document.createElement('h3');
        groupLabel.textContent = '👥 Välj grupper att schemalägga';
        groupLabel.style.margin = '0 0 1rem 0';
        groupSection.appendChild(groupLabel);

        const groupCheckboxes = document.createElement('div');
        groupCheckboxes.style.cssText = 'display:flex;flex-wrap:wrap;gap:1rem;';
        groupCheckboxes.id = 'generator-group-checkboxes';

        if (groupsArr.length === 0) {
            groupCheckboxes.innerHTML = '<p style="color:#999;">Inga grupper definierade. Skapa grupper först.</p>';
        } else {
            groupsArr.forEach(g => {
                const label = document.createElement('label');
                label.style.cssText = 'display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding:0.5rem 0.75rem;border:1px solid #ddd;border-radius:6px;background:#fff;';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = String(g.id);
                cb.checked = true;
                cb.className = 'generator-group-cb';

                const dot = document.createElement('span');
                dot.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${sanitizeColor(g.color)};`;

                label.appendChild(cb);
                label.appendChild(dot);
                label.appendChild(document.createTextNode(g.name || g.id));
                groupCheckboxes.appendChild(label);
            });
        }

        groupSection.appendChild(groupCheckboxes);
        container.appendChild(groupSection);

        // === MODE SELECTOR ===
        const modeSection = document.createElement('div');
        modeSection.style.cssText = 'margin-bottom:1.5rem;padding:1rem;background:#f9f9f9;border-radius:6px;';

        const modeLabel = document.createElement('h3');
        modeLabel.textContent = 'Välj läge';
        modeLabel.style.margin = '0 0 1rem 0';
        modeSection.appendChild(modeLabel);

        const modeContainer = document.createElement('div');
        modeContainer.style.cssText = 'display:flex;gap:2rem;';

        const monthLabel = document.createElement('label');
        monthLabel.style.cssText = 'display:flex;align-items:center;gap:0.5rem;cursor:pointer;';
        const monthRadio = document.createElement('input');
        monthRadio.type = 'radio'; monthRadio.name = 'mode'; monthRadio.value = 'month'; monthRadio.checked = true;
        monthLabel.appendChild(monthRadio);
        monthLabel.appendChild(document.createTextNode('Månad'));
        modeContainer.appendChild(monthLabel);

        const periodLabel = document.createElement('label');
        periodLabel.style.cssText = 'display:flex;align-items:center;gap:0.5rem;cursor:pointer;';
        const periodRadio = document.createElement('input');
        periodRadio.type = 'radio'; periodRadio.name = 'mode'; periodRadio.value = 'period';
        periodLabel.appendChild(periodRadio);
        periodLabel.appendChild(document.createTextNode('Period (Från-Till)'));
        modeContainer.appendChild(periodLabel);

        modeSection.appendChild(modeContainer);
        container.appendChild(modeSection);

        // === MONTH MODE ===
        const monthDiv = document.createElement('div');
        monthDiv.id = 'month-mode';
        monthDiv.style.cssText = 'margin-bottom:1.5rem;padding:1rem;background:#fff;border:1px solid #ddd;border-radius:6px;';

        const yearInput = createLabeledInput('År:', 'number', String(state.schedule?.year || new Date().getFullYear()));
        yearInput.input.min = '2000'; yearInput.input.max = '2100'; yearInput.input.style.width = '100px';
        monthDiv.appendChild(yearInput.wrapper);

        const monthNames = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
        const monthSelect = document.createElement('select');
        monthSelect.style.cssText = 'padding:0.5rem;border:1px solid #ddd;border-radius:4px;';
        monthNames.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = String(i + 1); opt.textContent = m;
            if (i === new Date().getMonth()) opt.selected = true;
            monthSelect.appendChild(opt);
        });
        const monthWrapper = document.createElement('div');
        monthWrapper.style.marginTop = '1rem';
        const ml = document.createElement('label');
        ml.textContent = 'Månad:'; ml.style.cssText = 'display:block;margin-bottom:0.5rem;font-weight:500;';
        monthWrapper.appendChild(ml); monthWrapper.appendChild(monthSelect);
        monthDiv.appendChild(monthWrapper);
        container.appendChild(monthDiv);

        // === PERIOD MODE ===
        const periodDiv = document.createElement('div');
        periodDiv.id = 'period-mode';
        periodDiv.style.cssText = 'margin-bottom:1.5rem;padding:1rem;background:#fff;border:1px solid #ddd;border-radius:6px;display:none;';
        const fromInput = createLabeledInput('Från datum:', 'date', '');
        fromInput.input.style.maxWidth = '200px';
        const toInput = createLabeledInput('Till datum:', 'date', '');
        toInput.input.style.maxWidth = '200px';
        periodDiv.appendChild(fromInput.wrapper);
        periodDiv.appendChild(toInput.wrapper);
        container.appendChild(periodDiv);

        // === MODE TOGGLE ===
        monthRadio.onchange = () => { monthDiv.style.display = 'block'; periodDiv.style.display = 'none'; };
        periodRadio.onchange = () => { periodDiv.style.display = 'block'; monthDiv.style.display = 'none'; };

        // === RESULT AREA ===
        const resultDiv = document.createElement('div');
        resultDiv.style.marginTop = '1.5rem';

        // === GENERATE BUTTON ===
        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-primary';
        generateBtn.textContent = '⚙️ Generera schema';
        generateBtn.style.marginBottom = '1.5rem';
        generateBtn.onclick = () => handleGenerate({
            btn: generateBtn, monthRadio, yearInput: yearInput.input,
            monthSelect, fromInput: fromInput.input, toInput: toInput.input,
            store, ctx, resultDiv
        });

        container.appendChild(generateBtn);
        container.appendChild(resultDiv);

        console.log('✓ Schedule generator section rendered (Sprint 2)');
    } catch (err) {
        console.error('❌ Error rendering schedule generator:', err);
        reportError('SCHEDULE_GENERATOR_RENDER_ERROR', 'CONTROL_SECTION',
            'control/sections/scheduleGenerator.js', err?.message || 'Unknown error');
        throw err;
    }
}

/* ============================================================
 * BLOCK 2 — HANDLE GENERATE (anropar scheduler/engine.js)
 * ============================================================ */
function handleGenerate({ btn, monthRadio, yearInput, monthSelect, fromInput, toInput, store, ctx, resultDiv }) {
    try {
        console.log('🔄 Generating schedule (Sprint 2 — full engine)...');
        const state = store.getState();

        // Hämta valda grupper
        const checkboxes = document.querySelectorAll('.generator-group-cb:checked');
        const selectedGroupIds = Array.from(checkboxes).map(cb => cb.value).filter(Boolean);

        if (selectedGroupIds.length === 0) {
            showWarning('⚠️ Välj minst en grupp att schemalägga');
            return;
        }

        // Validera grunddata
        if (!state.schedule || !Array.isArray(state.schedule.months)) {
            showWarning('⚠️ Schedule saknas — initiera schema först');
            return;
        }
        if (!Array.isArray(state.people) || state.people.filter(p => p?.isActive).length === 0) {
            showWarning('⚠️ Ingen aktiv personal — lägg till personal först');
            return;
        }

        // Berika people med frånvarodatum från state.absences
        const enrichedState = enrichStateWithAbsences(state);

        // Bestäm period
        const mode = monthRadio.checked ? 'month' : 'period';

        if (mode === 'month') {
            const year = parseInt(yearInput.value, 10);
            const month = parseInt(monthSelect.value, 10);

            if (!Number.isFinite(year) || year < 2000 || year > 2100) {
                showWarning('⚠️ Ogiltigt år'); return;
            }
            if (!Number.isFinite(month) || month < 1 || month > 12) {
                showWarning('⚠️ Ogiltig månad'); return;
            }

            btn.disabled = true;
            btn.textContent = '⏳ Genererar...';

            const result = generate(enrichedState, { year, month, selectedGroupIds });
            applyResult(result, store, year, month, resultDiv);

        } else {
            if (!fromInput.value || !toInput.value) {
                showWarning('⚠️ Välj både från- och till-datum'); return;
            }
            const from = new Date(fromInput.value);
            const to = new Date(toInput.value);
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                showWarning('⚠️ Ogiltiga datum'); return;
            }
            if (to < from) {
                showWarning('⚠️ Till-datum måste vara efter från-datum'); return;
            }

            btn.disabled = true;
            btn.textContent = '⏳ Genererar...';

            // Period: kör per unik månad
            const months = getMonthsInRange(from, to);
            const allResults = [];

            for (const { year, month } of months) {
                try {
                    const freshState = enrichStateWithAbsences(store.getState());
                    const result = generate(freshState, { year, month, selectedGroupIds });
                    applyResult(result, store, year, month, null);
                    allResults.push(result);
                } catch (err) {
                    console.warn(`⚠️ Månad ${month}/${year} misslyckades:`, err.message);
                }
            }

            const totalFilled = allResults.reduce((s, r) => s + (r.summary?.filledSlots || 0), 0);
            const totalVacancies = allResults.reduce((s, r) => s + (r.summary?.vacancyCount || 0), 0);
            showSuccess(`✓ ${totalFilled} skift genererade över ${months.length} månad(er)`);
            displayPeriodResult(resultDiv, allResults, months);
        }

    } catch (err) {
        console.error('❌ Error generating schedule:', err);
        reportError('SCHEDULE_GENERATION_ERROR', 'SCHEDULE_GENERATOR',
            'control/sections/scheduleGenerator.js', err?.message || 'Unknown error');
        showWarning(`⚠️ ${err.message || 'Ett fel uppstod vid schemagenerering'}`);
        displayError(resultDiv, err.message);
    } finally {
        try {
            btn.disabled = false;
            btn.textContent = '⚙️ Generera schema';
        } catch (_) {}
    }
}

/* ============================================================
 * BLOCK 3 — APPLY RESULT (skriver proposedState till store)
 * ============================================================ */
function applyResult(result, store, year, month, resultDiv) {
    if (!result?.proposedState) return;

    const proposedMonth = result.proposedState.schedule?.months?.[month - 1];
    if (!proposedMonth) return;

    store.update(draft => {
        if (!draft.schedule || !Array.isArray(draft.schedule.months)) return;
        const targetMonth = draft.schedule.months[month - 1];
        if (!targetMonth) return;

        // Ersätt månadens dagar med det genererade resultatet
        targetMonth.days = proposedMonth.days;

        if (!draft.meta || typeof draft.meta !== 'object') draft.meta = {};
        draft.meta.updatedAt = Date.now();
    });

    const filled = result.summary?.filledSlots || 0;
    const vacancies = result.summary?.vacancyCount || 0;
    const rulesApplied = result.summary?.activeRulesApplied || 0;

    showSuccess(`✓ ${filled} skift genererade (${rulesApplied} regler tillämpade)`);

    if (resultDiv) {
        displayMonthResult(resultDiv, result, year, month);
    }
}

/* ============================================================
 * BLOCK 4 — ENRICH STATE (frånvaro → vacationDates/leaveDates)
 * ============================================================ */
function enrichStateWithAbsences(state) {
    const enriched = JSON.parse(JSON.stringify(state));
    const absences = Array.isArray(enriched.absences) ? enriched.absences : [];

    if (absences.length === 0 || !Array.isArray(enriched.people)) return enriched;

    // Bygg per-person datum-listor
    const personAbsences = {};
    absences.forEach(abs => {
        if (!abs || !abs.personId) return;
        if (!personAbsences[abs.personId]) personAbsences[abs.personId] = { vacation: [], leave: [] };

        const dates = getAbsenceDates(abs);
        const bucket = (abs.type === 'SEM' || abs.type === 'semester') ? 'vacation' : 'leave';
        personAbsences[abs.personId][bucket].push(...dates);
    });

    // Berika person-objekt
    enriched.people = enriched.people.map(p => {
        if (!p || !p.id) return p;
        const pa = personAbsences[p.id];
        if (!pa) return p;

        const existingVac = Array.isArray(p.vacationDates) ? p.vacationDates : [];
        const existingLeave = Array.isArray(p.leaveDates) ? p.leaveDates : [];

        return {
            ...p,
            vacationDates: [...new Set([...existingVac, ...pa.vacation])],
            leaveDates: [...new Set([...existingLeave, ...pa.leave])],
        };
    });

    return enriched;
}

function getAbsenceDates(abs) {
    const dates = [];
    if (!abs.startDate) return dates;

    const start = new Date(abs.startDate);
    const end = abs.endDate ? new Date(abs.endDate) : start;

    if (isNaN(start.getTime())) return dates;
    const endDate = isNaN(end.getTime()) ? start : end;

    const d = new Date(start);
    while (d <= endDate) {
        dates.push(formatDate(d));
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

/* ============================================================
 * BLOCK 5 — DISPLAY RESULTS
 * ============================================================ */
function displayMonthResult(container, result, year, month) {
    while (container.firstChild) container.removeChild(container.firstChild);

    const summary = result.summary || {};
    const notes = result.notes || [];
    const vacancies = result.vacancies || [];

    // Summary card
    const card = document.createElement('div');
    card.style.cssText = 'padding:1.5rem;background:#f0f9f0;border:1px solid #c8e6c9;border-radius:8px;margin-bottom:1rem;';

    const monthNames = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
    card.innerHTML = `
        <h3 style="margin:0 0 1rem 0;">✓ Schema genererat — ${monthNames[month - 1]} ${year}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
            <div><strong>${summary.filledSlots || 0}</strong><br><span style="color:#666;font-size:0.85rem;">Tilldelade pass</span></div>
            <div><strong>${summary.vacancyCount || 0}</strong><br><span style="color:#666;font-size:0.85rem;">Vakanser</span></div>
            <div><strong>${summary.activeRulesApplied || 0}</strong><br><span style="color:#666;font-size:0.85rem;">Regler tillämpade</span></div>
            <div><strong>${summary.hasP0Warnings ? '⚠️ Ja' : '✅ Nej'}</strong><br><span style="color:#666;font-size:0.85rem;">P0-varningar</span></div>
        </div>
    `;
    container.appendChild(card);

    // Notes
    if (notes.length > 0) {
        const notesDiv = document.createElement('div');
        notesDiv.style.cssText = 'padding:1rem;background:#fff3e0;border-left:4px solid #ff9800;border-radius:6px;margin-bottom:1rem;';
        notesDiv.innerHTML = '<strong>📋 Noteringar:</strong><ul style="margin:0.5rem 0 0 1.5rem;">' +
            notes.map(n => `<li>${escapeHtml(n)}</li>`).join('') + '</ul>';
        container.appendChild(notesDiv);
    }

    // Vacancies
    if (vacancies.length > 0) {
        const vacDiv = document.createElement('div');
        vacDiv.style.cssText = 'padding:1rem;background:#fce4ec;border-left:4px solid #e53935;border-radius:6px;';
        vacDiv.innerHTML = `<strong>🚨 ${vacancies.length} vakans(er):</strong><p style="margin:0.5rem 0 0;color:#666;font-size:0.9rem;">Dessa tider kunde inte bemannas. Överväg att lägga till fler personer eller minska bemanningsbehov.</p>`;
        container.appendChild(vacDiv);
    }
}

function displayPeriodResult(container, results, months) {
    while (container.firstChild) container.removeChild(container.firstChild);

    const totalFilled = results.reduce((s, r) => s + (r.summary?.filledSlots || 0), 0);
    const totalVacancies = results.reduce((s, r) => s + (r.summary?.vacancyCount || 0), 0);
    const hasP0 = results.some(r => r.summary?.hasP0Warnings);

    const card = document.createElement('div');
    card.style.cssText = 'padding:1.5rem;background:#f0f9f0;border:1px solid #c8e6c9;border-radius:8px;';
    card.innerHTML = `
        <h3 style="margin:0 0 1rem 0;">✓ Period-schema genererat (${months.length} månader)</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;">
            <div><strong>${totalFilled}</strong><br><span style="color:#666;font-size:0.85rem;">Tilldelade pass</span></div>
            <div><strong>${totalVacancies}</strong><br><span style="color:#666;font-size:0.85rem;">Vakanser</span></div>
            <div><strong>${hasP0 ? '⚠️ Ja' : '✅ Nej'}</strong><br><span style="color:#666;font-size:0.85rem;">P0-varningar</span></div>
        </div>
    `;
    container.appendChild(card);
}

function displayError(container, message) {
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    const div = document.createElement('div');
    div.className = 'alert alert-danger';
    div.innerHTML = `<p style="font-weight:600;margin:0 0 0.5rem;">❌ Schemagenerering misslyckades</p>
        <p style="margin:0;">${escapeHtml(message || 'Ett okänt fel uppstod')}</p>`;
    container.appendChild(div);
}

/* ============================================================
 * BLOCK 6 — HELPERS
 * ============================================================ */
function createLabeledInput(labelText, type, value) {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '1rem';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'display:block;margin-bottom:0.5rem;font-weight:500;';
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.style.cssText = 'padding:0.5rem;border:1px solid #ddd;border-radius:4px;';
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return { wrapper, input };
}

function getMonthsInRange(from, to) {
    const months = [];
    const d = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (d <= end) {
        months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
        d.setMonth(d.getMonth() + 1);
    }
    return months;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
    return String(str ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

function sanitizeColor(c) {
    if (!c || typeof c !== 'string') return '#999';
    if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
    if (/^[a-zA-Z]+$/.test(c)) return c;
    return '#999';
}
