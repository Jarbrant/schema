/*
 * SCHEDULE GENERATOR SECTION
 * 
 * AO-04 — Schemagenerator: Månad + Period
 * Renderar UI för schemagenerering
 */

// RÄTT IMPORT:
import { generateSchedule } from '../../../scheduler.js';  // ← Rätt namn!
import { showSuccess, showWarning } from '../../../ui.js';
import { reportError, diagnostics } from '../../../diagnostics.js';

export function renderScheduleGeneratorSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) {
            throw new Error('Store missing');
        }

        const state = store.getState();
        const groups = state.groups || [];
        const passes = state.passes || [];
        const demands = state.demands || [];
        const people = state.people || [];

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

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
        yearInput.value = new Date().getFullYear();
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

        const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
        months.forEach((m, i) => {
            const option = document.createElement('option');
            option.value = i + 1;
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

        // === GENERATE BUTTON ===
        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-primary';
        generateBtn.textContent = '⚙️ Föreslå schema';
        generateBtn.style.marginBottom = '1.5rem';
        generateBtn.onclick = () => handleGenerate(generateBtn, monthRadio, yearInput, monthSelect, fromInput, toInput, store, ctx);

        container.appendChild(generateBtn);

        // === RESULT AREA ===
        const resultDiv = document.createElement('div');
        resultDiv.id = 'generator-result';
        resultDiv.style.marginTop = '1.5rem';
        container.appendChild(resultDiv);

        console.log('✓ Schedule generator section rendered');

    } catch (err) {
        console.error('❌ Error rendering schedule generator:', err);
        reportError(
            'SCHEDULE_GENERATOR_RENDER_ERROR',
            'CONTROL_SECTION',
            'control/sections/scheduleGenerator.js',
            err.message
        );
        throw err;
    }
}

function handleGenerate(btn, monthRadio, yearInput, monthSelect, fromInput, toInput, store, ctx) {
    try {
        console.log('🔄 Generating schedule...');

        const state = store.getState();
        const groups = state.groups || [];
        const passes = state.passes || [];
        const demands = state.demands || [];
        const people = state.people || [];

        // Validate prerequisites
        if (groups.length === 0) {
            showWarning('⚠️ Inga grupper definierade');
            return;
        }
        if (passes.length === 0) {
            showWarning('⚠️ Inga grundpass definierade');
            return;
        }
        if (demands.length === 0) {
            showWarning('⚠️ Inget bemanningsbehov definierat');
            return;
        }
        if (people.length === 0) {
            showWarning('⚠️ Ingen personal definierad');
            return;
        }

        // Get parameters
        const mode = monthRadio.checked ? 'month' : 'period';
        const params = {
            mode,
            groups,
            passes,
            demands,
            people
        };

        if (mode === 'month') {
            params.year = parseInt(yearInput.value);
            params.month = parseInt(monthSelect.value);
        } else {
            params.fromDate = fromInput.value;
            params.toDate = toInput.value;
        }

        // Call generator (RÄTT NAMN)
        const result = generateSchedule(params);

        if (result.success) {
            console.log('✓ Schema genererat:', result.shifts.length, 'skift');
            showSuccess(`✓ ${result.shifts.length} skift genererade`);

            // Update store with generated shifts
            store.setState({
                ...state,
                generatedShifts: result.shifts,
                lastGenerationParams: params
            });

            // Show result
            displayResult(document.getElementById('generator-result'), result);

        } else {
            console.error('❌ Generation failed:', result.errors);
            showWarning(`⚠️ ${result.errors[0] || 'Schemagenerering misslyckades'}`);
            displayResult(document.getElementById('generator-result'), result);
        }

    } catch (err) {
        console.error('❌ Error generating schedule:', err);
        reportError(
            'SCHEDULE_GENERATION_ERROR',
            'SCHEDULE_GENERATOR',
            'control/sections/scheduleGenerator.js',
            err.message
        );
        showWarning('⚠️ Ett fel uppstod vid schemagenerering');
    }
}

function displayResult(container, result) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (result.success) {
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success';
        successDiv.style.marginBottom = '1rem';

        const msg = document.createElement('p');
        msg.textContent = `✓ ${result.shifts.length} skift genererade`;
        msg.style.margin = '0';

        successDiv.appendChild(msg);
        container.appendChild(successDiv);

        // Show brief summary
        if (result.shifts.length > 0) {
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
            details.textContent = `Systemet har fördelat ${result.shifts.length} skift baserat på bemanningsbehov och tillgänglighet.`;

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

        result.errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errors.appendChild(li);
        });

        errorDiv.appendChild(title);
        errorDiv.appendChild(errors);
        container.appendChild(errorDiv);
    }
}
