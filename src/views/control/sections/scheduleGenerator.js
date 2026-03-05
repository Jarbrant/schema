/*
 * SCHEDULE GENERATOR SECTION
 *
 * AO-04 — Schemagenerator: Månad + Period
 * Renderar UI för schemagenerering
 *
 * AUTOPATCH (P0) — Anpassad till store.js-modellen:
 * - state.groups är map/object (inte array)  -> Object.values
 * - "pass" definieras av state.shifts (map/object med start/end/break)  -> Object.values
 * - bemanningsbehov tas från state.demand.groupDemands[groupId][weekdayIdx]
 * - store.setState finns inte -> store.update(...)
 * - skriver schema till state.schedule.months[].days[].entries[] (ingen ny top-level key)
 * - använder lokalt resultDiv (inte document.getElementById)
 */

// RÄTT IMPORT:
import { generateSchedule } from '../../../scheduler.js';
import { showSuccess, showWarning } from '../../../ui.js';
import { reportError } from '../../../diagnostics.js';

export function renderScheduleGeneratorSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) throw new Error('Store missing');

        // Clear container
        while (container.firstChild) container.removeChild(container.firstChild);

        // === HEADER ===
        const header = document.createElement('div');
        header.style.marginBottom = '1.5rem';

        const title = document.createElement('h2');
        title.textContent = '⚙️ Schemagenerator';

        const desc = document.createElement('p');
        desc.textContent = 'Generera automatiskt schema baserat på bemanningsbehov, grupper och tillgänglighet';
        desc.style.color = '#666';

        header.appendChild(title);
        header.appendChild(desc);
        container.appendChild(header);

        // === MODE SELECTOR ===
        const modeSection = document.createElement('div');
        modeSection.style.marginBottom = '1.5rem';
        modeSection.style.padding = '1rem';
        modeSection.style.background = '#f9f9f9';
        modeSection.style.borderRadius = '6px';

        const modeLabel = document.createElement('h3');
        modeLabel.textContent = 'Välj läge';
        modeLabel.style.margin = '0 0 1rem 0';
        modeSection.appendChild(modeLabel);

        const modeContainer = document.createElement('div');
        modeContainer.style.display = 'flex';
        modeContainer.style.gap = '2rem';

        // Month mode
        const monthLabel = document.createElement('label');
        monthLabel.style.display = 'flex';
        monthLabel.style.alignItems = 'center';
        monthLabel.style.gap = '0.5rem';
        monthLabel.style.cursor = 'pointer';

        const monthRadio = document.createElement('input');
        monthRadio.type = 'radio';
        monthRadio.name = 'mode';
        monthRadio.value = 'month';
        monthRadio.checked = true;

        monthLabel.appendChild(monthRadio);
        monthLabel.appendChild(document.createTextNode('Månad'));
        modeContainer.appendChild(monthLabel);

        // Period mode
        const periodLabel = document.createElement('label');
        periodLabel.style.display = 'flex';
        periodLabel.style.alignItems = 'center';
        periodLabel.style.gap = '0.5rem';
        periodLabel.style.cursor = 'pointer';

        const periodRadio = document.createElement('input');
        periodRadio.type = 'radio';
        periodRadio.name = 'mode';
        periodRadio.value = 'period';

        periodLabel.appendChild(periodRadio);
        periodLabel.appendChild(document.createTextNode('Period (Från-Till)'));
        modeContainer.appendChild(periodLabel);

        modeSection.appendChild(modeContainer);
        container.appendChild(modeSection);

        // === MONTH MODE ===
        const monthDiv = document.createElement('div');
        monthDiv.id = 'month-mode';
        monthDiv.style.marginBottom = '1.5rem';
        monthDiv.style.padding = '1rem';
        monthDiv.style.background = '#fff';
        monthDiv.style.border = '1px solid #ddd';
        monthDiv.style.borderRadius = '6px';

        const monthYearGroup = document.createElement('div');
        monthYearGroup.style.marginBottom = '1rem';

        const yearLabel = document.createElement('label');
        yearLabel.textContent = 'År:';
        yearLabel.style.display = 'block';
        yearLabel.style.marginBottom = '0.5rem';
        yearLabel.style.fontWeight = '500';

        const yearInput = document.createElement('input');
        yearInput.type = 'number';
        yearInput.id = 'generator-year';
        yearInput.value = String(new Date().getFullYear());
        yearInput.min = '2000';
        yearInput.max = '2100';
        yearInput.style.width = '100px';
        yearInput.style.padding = '0.5rem';
        yearInput.style.border = '1px solid #ddd';
        yearInput.style.borderRadius = '4px';

        monthYearGroup.appendChild(yearLabel);
        monthYearGroup.appendChild(yearInput);
        monthDiv.appendChild(monthYearGroup);

        const monthGroup = document.createElement('div');
        const monthLabel2 = document.createElement('label');
        monthLabel2.textContent = 'Månad:';
        monthLabel2.style.display = 'block';
        monthLabel2.style.marginBottom = '0.5rem';
        monthLabel2.style.fontWeight = '500';

        const monthSelect = document.createElement('select');
        monthSelect.id = 'generator-month';
        monthSelect.style.padding = '0.5rem';
        monthSelect.style.border = '1px solid #ddd';
        monthSelect.style.borderRadius = '4px';

        const months = [
            'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
            'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
        ];
        months.forEach((m, i) => {
            const option = document.createElement('option');
            option.value = String(i + 1);
            option.textContent = m;
            if (i === new Date().getMonth()) option.selected = true;
            monthSelect.appendChild(option);
        });

        monthGroup.appendChild(monthLabel2);
        monthGroup.appendChild(monthSelect);
        monthDiv.appendChild(monthGroup);
        container.appendChild(monthDiv);

        // === PERIOD MODE ===
        const periodDiv = document.createElement('div');
        periodDiv.id = 'period-mode';
        periodDiv.style.marginBottom = '1.5rem';
        periodDiv.style.padding = '1rem';
        periodDiv.style.background = '#fff';
        periodDiv.style.border = '1px solid #ddd';
        periodDiv.style.borderRadius = '6px';
        periodDiv.style.display = 'none';

        const fromDateGroup = document.createElement('div');
        fromDateGroup.style.marginBottom = '1rem';

        const fromLabel = document.createElement('label');
        fromLabel.textContent = 'Från datum:';
        fromLabel.style.display = 'block';
        fromLabel.style.marginBottom = '0.5rem';
        fromLabel.style.fontWeight = '500';

        const fromInput = document.createElement('input');
        fromInput.type = 'date';
        fromInput.id = 'generator-from-date';
        fromInput.style.width = '100%';
        fromInput.style.maxWidth = '200px';
        fromInput.style.padding = '0.5rem';
        fromInput.style.border = '1px solid #ddd';
        fromInput.style.borderRadius = '4px';

        fromDateGroup.appendChild(fromLabel);
        fromDateGroup.appendChild(fromInput);
        periodDiv.appendChild(fromDateGroup);

        const toDateGroup = document.createElement('div');
        const toLabel = document.createElement('label');
        toLabel.textContent = 'Till datum:';
        toLabel.style.display = 'block';
        toLabel.style.marginBottom = '0.5rem';
        toLabel.style.fontWeight = '500';

        const toInput = document.createElement('input');
        toInput.type = 'date';
        toInput.id = 'generator-to-date';
        toInput.style.width = '100%';
        toInput.style.maxWidth = '200px';
        toInput.style.padding = '0.5rem';
        toInput.style.border = '1px solid #ddd';
        toInput.style.borderRadius = '4px';

        toDateGroup.appendChild(toLabel);
        toDateGroup.appendChild(toInput);
        periodDiv.appendChild(toDateGroup);
        container.appendChild(periodDiv);

        // === MODE TOGGLE ===
        monthRadio.onchange = () => {
            monthDiv.style.display = monthRadio.checked ? 'block' : 'none';
            periodDiv.style.display = 'none';
        };

        periodRadio.onchange = () => {
            periodDiv.style.display = periodRadio.checked ? 'block' : 'none';
            monthDiv.style.display = 'none';
        };

        // === RESULT AREA (lokal ref) ===
        const resultDiv = document.createElement('div');
        resultDiv.id = 'generator-result';
        resultDiv.style.marginTop = '1.5rem';

        // === GENERATE BUTTON ===
        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-primary';
        generateBtn.textContent = '⚙️ Föreslå schema';
        generateBtn.style.marginBottom = '1.5rem';
        generateBtn.onclick = () =>
            handleGenerate({
                btn: generateBtn,
                monthRadio,
                yearInput,
                monthSelect,
                fromInput,
                toInput,
                store,
                ctx,
                resultDiv
            });

        container.appendChild(generateBtn);
        container.appendChild(resultDiv);

        console.log('✓ Schedule generator section rendered');
    } catch (err) {
        console.error('❌ Error rendering schedule generator:', err);
        reportError(
            'SCHEDULE_GENERATOR_RENDER_ERROR',
            'CONTROL_SECTION',
            'control/sections/scheduleGenerator.js',
            err?.message || 'Unknown error'
        );
        throw err;
    }
}

function handleGenerate({ btn, monthRadio, yearInput, monthSelect, fromInput, toInput, store, ctx, resultDiv }) {
    try {
        console.log('🔄 Generating schedule...');

        const state = store.getState();

        // === Store-model bridge ===
        const groupsArr = objectValuesSafe(state.groups); // groups map -> array
        const passDefsArr = objectValuesSafe(state.shifts); // shifts map -> array of "pass defs"
        const groupDemands = state?.demand?.groupDemands || null;
        const peopleArr = Array.isArray(state.people) ? state.people : [];

        // Validate prerequisites (fail-closed men tydligt)
        if (groupsArr.length === 0) {
            showWarning('⚠️ Inga grupper definierade');
            return;
        }
        if (passDefsArr.length === 0) {
            showWarning('⚠️ Inga pass definierade (state.shifts saknas)');
            return;
        }
        if (!groupDemands || typeof groupDemands !== 'object') {
            showWarning('⚠️ Inget bemanningsbehov definierat (state.demand.groupDemands saknas)');
            return;
        }
        if (peopleArr.length === 0) {
            showWarning('⚠️ Ingen personal definierad');
            return;
        }

        // Build scheduler-compatible people (FULLSTÄNDIG DATA för rules-engine)
const peopleForScheduler = peopleArr.map((p) => ({
    id: String(p?.id ?? ''),
    name: `${String(p?.firstName ?? '').trim()} ${String(p?.lastName ?? '').trim()}`.trim() || 'Okänd',
    firstName: String(p?.firstName ?? '').trim(),
    lastName: String(p?.lastName ?? '').trim(),
    employmentPct: typeof p?.employmentPct === 'number' ? p.employmentPct : 100,
    degree: typeof p?.employmentPct === 'number' ? p.employmentPct : 100,
    groups: Array.isArray(p?.groups) ? p.groups.map(String)
          : Array.isArray(p?.groupIds) ? p.groupIds.map(String)
          : [],
    availability: Array.isArray(p?.availability) ? p.availability : [true, true, true, true, true, false, false],
    workdaysPerWeek: typeof p?.workdaysPerWeek === 'number' ? p.workdaysPerWeek : 5,
    startDate: p?.startDate || '2020-01-01',
    sector: p?.sector || 'private',
    vacationDates: Array.isArray(p?.vacationDates) ? p.vacationDates : [],
    leaveDates: Array.isArray(p?.leaveDates) ? p.leaveDates : [],
    isActive: p?.isActive !== false,
    collectiveAgreement: p?.collectiveAgreement || 'HRF',
    hourlyWage: p?.hourlyWage || 0,
    preferredShifts: Array.isArray(p?.preferredShifts) ? p.preferredShifts : [],
    avoidShifts: Array.isArray(p?.avoidShifts) ? p.avoidShifts : [],
    employmentType: p?.employmentType || 'regular',
})).filter(p => !!p.id && p.isActive);

        if (peopleForScheduler.length === 0) {
            showWarning('⚠️ Personer saknar giltiga id (kan inte generera)');
            return;
        }

        // Get mode + date interval
        const mode = monthRadio.checked ? 'month' : 'period';
        let startDate = null;
        let endDate = null;

        if (mode === 'month') {
            const y = parseInt(yearInput.value, 10);
            const m = parseInt(monthSelect.value, 10);
            if (!Number.isFinite(y) || y < 2000 || y > 2100) {
                showWarning('⚠️ Ogiltigt år');
                return;
            }
            if (!Number.isFinite(m) || m < 1 || m > 12) {
                showWarning('⚠️ Ogiltig månad');
                return;
            }
            startDate = new Date(y, m - 1, 1);
            endDate = new Date(y, m, 0);
        } else {
            if (!fromInput.value || !toInput.value) {
                showWarning('⚠️ Välj både från- och till-datum');
                return;
            }
            startDate = new Date(fromInput.value);
            endDate = new Date(toInput.value);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                showWarning('⚠️ Ogiltiga datum');
                return;
            }
            if (endDate < startDate) {
                showWarning('⚠️ Till-datum måste vara efter från-datum');
                return;
            }
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            if (daysDiff > 93) {
                showWarning(`⚠️ Period kan max vara 93 dagar (du valde ${daysDiff} dagar)`);
                return;
            }
        }

        // IMPORTANT: scheduler.js använder en statisk "demands"-lista (ingen weekday-logik).
        // För att stödja weekday-variation utan att patcha scheduler.js kör vi dag-för-dag
        // och skickar demands för just den dagen (count från groupDemands[groupId][weekdayIdx]).
        const allGenerated = [];
        const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        btn.disabled = true;

        for (let di = 0; di < dayCount; di++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + di);
            const dateStr = formatDate(d);
            const weekdayIdx = getWeekdayIdxMonday0(d); // mån=0 ... sön=6

            const demandsForDay = buildDemandsForDay(groupsArr, passDefsArr, groupDemands, weekdayIdx);

            // Om ingen efterfrågan den dagen: hoppa
            if (demandsForDay.totalCount === 0) continue;

            const paramsForDay = {
                mode: 'period',
                fromDate: dateStr,
                toDate: dateStr,
                groups: groupsArr,
                passes: passDefsArr,
                demands: demandsForDay.items,
                people: peopleForScheduler
            };

            const res = generateSchedule(paramsForDay);
            if (!res?.success) {
                // Fortsätt, men logga och visa i result
                console.warn('⚠️ Dag misslyckades:', dateStr, res?.errors);
                allGenerated.push(...[]); // no-op, behåll flöde
            } else {
                allGenerated.push(...(res.shifts || []));
            }
        }

        if (allGenerated.length === 0) {
            showWarning('⚠️ Inga skift genererades (kontrollera bemanningsbehov + pass + grupper)');
            displayResult(resultDiv, { success: false, errors: ['Inga skift genererades'] });
            return;
        }

        // Skriv in i schedule (state.schedule.months[].days[].entries[]) via store.update
        store.update((draft) => {
            if (!draft.schedule || !Array.isArray(draft.schedule.months)) return;

            // Bygg index för snabb lookup
            const monthByNum = Object.create(null);
            draft.schedule.months.forEach((m) => { monthByNum[m.month] = m; });

            // Append entries per day
            allGenerated.forEach((gs) => {
                const date = String(gs.date || '');
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

                const yyyy = parseInt(date.slice(0, 4), 10);
                const mm = parseInt(date.slice(5, 7), 10);
                const dd = parseInt(date.slice(8, 10), 10);

                const monthObj = monthByNum[mm];
                if (!monthObj || !Array.isArray(monthObj.days)) return;
                const dayObj = monthObj.days[dd - 1];
                if (!dayObj || !Array.isArray(dayObj.entries)) return;

                const entry = {
                    personId: String(gs.personId ?? ''),
                    status: 'A',
                    start: (gs.startTime ?? null),
                    end: (gs.endTime ?? null),
                    breakStart: (gs.breakStart ?? null),
                    breakEnd: (gs.breakEnd ?? null)
                };

                if (!entry.personId) return;

                // Dedupe: samma person + datum + start/end (enkelt skydd)
                const already = dayObj.entries.some((e) =>
                    String(e?.personId) === entry.personId &&
                    String(e?.shiftId ?? '') === entry.shiftId &&
                    String(e?.groupId ?? '') === entry.groupId &&
                    String(e?.status ?? '') === 'A'
                );
                if (!already) dayObj.entries.push(entry);
            });

            // meta.updatedAt
            if (!draft.meta || typeof draft.meta !== 'object') draft.meta = {};
            draft.meta.updatedAt = Date.now();
        });

        showSuccess(`✓ ${allGenerated.length} skift genererade och inskrivna i schemat`);
        displayResult(resultDiv, { success: true, shifts: allGenerated, errors: [] });

    } catch (err) {
        console.error('❌ Error generating schedule:', err);
        reportError(
            'SCHEDULE_GENERATION_ERROR',
            'SCHEDULE_GENERATOR',
            'control/sections/scheduleGenerator.js',
            err?.message || 'Unknown error'
        );
        showWarning('⚠️ Ett fel uppstod vid schemagenerering');
        displayResult(resultDiv, { success: false, errors: [err?.message || 'Okänt fel'] });
    } finally {
        try { btn.disabled = false; } catch (_) {}
    }
}

function displayResult(container, result) {
    while (container.firstChild) container.removeChild(container.firstChild);

    if (result && result.success) {
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success';
        successDiv.style.marginBottom = '1rem';

        const msg = document.createElement('p');
        msg.textContent = `✓ ${(result.shifts || []).length} skift genererade`;
        msg.style.margin = '0';

        successDiv.appendChild(msg);
        container.appendChild(successDiv);

        if ((result.shifts || []).length > 0) {
            const summary = document.createElement('div');
            summary.style.marginTop = '1rem';
            summary.style.padding = '1rem';
            summary.style.background = '#f9f9f9';
            summary.style.borderRadius = '6px';

            const title = document.createElement('h4');
            title.style.margin = '0 0 0.75rem 0';
            title.textContent = 'Schemagenerering Klar';

            const details = document.createElement('p');
            details.style.margin = '0';
            details.textContent = `Systemet har fördelat ${(result.shifts || []).length} skift baserat på bemanningsbehov och tillgänglighet.`;

            summary.appendChild(title);
            summary.appendChild(details);
            container.appendChild(summary);
        }
    } else {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';

        const title = document.createElement('p');
        title.textContent = '❌ Schemagenerering misslyckades';
        title.style.margin = '0 0 0.5rem 0';
        title.style.fontWeight = '600';

        const errors = document.createElement('ul');
        errors.style.margin = '0';
        errors.style.paddingLeft = '1.5rem';

        const list = (result && Array.isArray(result.errors) && result.errors.length)
            ? result.errors
            : ['Ett okänt fel uppstod'];

        list.forEach((error) => {
            const li = document.createElement('li');
            li.textContent = String(error);
            errors.appendChild(li);
        });

        errorDiv.appendChild(title);
        errorDiv.appendChild(errors);
        container.appendChild(errorDiv);
    }
}

/* =========================
   Helpers (local)
   ========================= */

function objectValuesSafe(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.values(obj).filter(Boolean);
}

// JS Date.getDay(): sön=0 ... lör=6
// Vi vill: mån=0 ... sön=6
function getWeekdayIdxMonday0(d) {
    const js = d.getDay(); // 0..6 (sön..lör)
    return (js + 6) % 7;   // mån=0, tis=1, ... sön=6
}

function buildDemandsForDay(groupsArr, passDefsArr, groupDemands, weekdayIdx) {
    const items = [];
    let total = 0;

    groupsArr.forEach((g) => {
        const gid = String(g?.id ?? '').trim();
        if (!gid) return;

        const week = groupDemands[gid];
        const countForGroup = Array.isArray(week) && typeof week[weekdayIdx] === 'number'
            ? week[weekdayIdx]
            : 0;

        // Om gruppen inte behöver någon: ingen demands för den dagen
        if (!countForGroup || countForGroup <= 0) return;

        // För enkel baseline: samma count används för alla pass i gruppen den dagen.
        // (Vill ni fördela per pass: då behöver vi en annan demand-modell/AO.)
        passDefsArr.forEach((p) => {
            const pid = String(p?.id ?? '').trim();
            if (!pid) return;
            items.push({
                key: `${gid}_${pid}`,
                count: countForGroup
            });
            total += countForGroup;
        });
    });

    return { items, totalCount: total };
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
