/*
 * FAS 1.2 — CALENDAR: Fullständig kalendervy för 2026
 * 
 * Visar månadsvisa kalendrar med:
 * - Personal som jobbar per dag
 * - Pass/skift
 * - Timmar per dag
 * - Färgkodning per grupp
 * - Navigering mellan månader
 */

/**
 * Render empty calendar with helpful message
 */
function renderEmptyCalendar(container, message) {
    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const emptyContainer = document.createElement('div');
    emptyContainer.className = 'calendar-container';

    const emptyCard = document.createElement('div');
    emptyCard.className = 'calendar-empty-state';
    emptyCard.style.cssText = 'background: white; border-radius: 12px; padding: 3rem; text-align: center; margin: 2rem auto; max-width: 600px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size: 4rem; margin-bottom: 1rem;';
    icon.textContent = '📅';

    const title = document.createElement('h2');
    title.textContent = 'Kalender 2026';
    title.style.cssText = 'margin: 0 0 1rem 0; color: #333;';

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.cssText = 'color: #666; margin: 0 0 2rem 0; line-height: 1.6;';

    const helpText = document.createElement('p');
    helpText.style.cssText = 'color: #999; font-size: 0.9rem; margin: 2rem 0 0 0;';
    helpText.textContent = '💡 Gå till Kontroll → Schemaläggning för att generera ett schema.';

    emptyCard.appendChild(icon);
    emptyCard.appendChild(title);
    emptyCard.appendChild(messageEl);
    emptyCard.appendChild(helpText);
    emptyContainer.appendChild(emptyCard);
    container.appendChild(emptyContainer);
}

export function renderCalendar(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();

    // Validate schedule data exists and is correct year
    if (!state.schedule || state.schedule.year !== 2026) {
        renderEmptyCalendar(container, 'Schedule är inte initierat eller fel år. Skapa schema först.');
        return;
    }

    // Validate months array exists and has correct length
    if (!state.schedule.months || !Array.isArray(state.schedule.months) || state.schedule.months.length !== 12) {
        renderEmptyCalendar(container, 'Schemaläggningsdata saknas eller är ofullständig. Gå till Kontroll → Schemaläggning för att generera schema.');
        return;
    }

    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Create calendar container
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-container';

    // Header
    const header = document.createElement('div');
    header.className = 'calendar-header';

    const title = document.createElement('h1');
    title.textContent = 'Kalender 2026';

    const subtitle = document.createElement('p');
    subtitle.className = 'calendar-subtitle';
    subtitle.textContent = 'Schemaöversikt per månad';

    header.appendChild(title);
    header.appendChild(subtitle);
    calendarContainer.appendChild(header);

    // Month selector
    const monthSelector = document.createElement('div');
    monthSelector.className = 'month-selector';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary month-nav-btn';
    prevBtn.textContent = '← Föregående';
    prevBtn.id = 'prev-month-btn';

    const currentMonthDisplay = document.createElement('h2');
    currentMonthDisplay.id = 'current-month-display';
    currentMonthDisplay.className = 'current-month-display';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary month-nav-btn';
    nextBtn.textContent = 'Nästa →';
    nextBtn.id = 'next-month-btn';

    monthSelector.appendChild(prevBtn);
    monthSelector.appendChild(currentMonthDisplay);
    monthSelector.appendChild(nextBtn);
    calendarContainer.appendChild(monthSelector);

    // Calendar grid container
    const calendarGrid = document.createElement('div');
    calendarGrid.id = 'calendar-grid';
    calendarGrid.className = 'calendar-grid';
    calendarContainer.appendChild(calendarGrid);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'calendar-legend';
    legend.innerHTML = `
        <h3>Förklaring:</h3>
        <div class="legend-items">
            <div class="legend-item"><span class="legend-badge status-A">A</span> Arbetar</div>
            <div class="legend-item"><span class="legend-badge status-L">L</span> Ledig</div>
            <div class="legend-item"><span class="legend-badge status-SEM">SEM</span> Semester</div>
            <div class="legend-item"><span class="legend-badge status-SJ">SJ</span> Sjuk</div>
            <div class="legend-item"><span class="legend-badge status-VAB">VAB</span> Vård av barn</div>
        </div>
    `;
    calendarContainer.appendChild(legend);

    // Add to DOM
    container.appendChild(calendarContainer);

    // Initialize calendar with current month
    const currentMonth = new Date().getMonth() + 1; // 1-12
    renderMonth(calendarGrid, currentMonthDisplay, currentMonth, state, ctx);

    // Setup navigation
    setupMonthNavigation(calendarGrid, currentMonthDisplay, prevBtn, nextBtn, state, ctx);
}

/**
 * Render a specific month
 */
function renderMonth(calendarGrid, monthDisplay, monthNum, state, ctx) {
    // Clear grid
    while (calendarGrid.firstChild) {
        calendarGrid.removeChild(calendarGrid.firstChild);
    }

    // Validate schedule data
    if (!state.schedule || !state.schedule.months || !Array.isArray(state.schedule.months)) {
        calendarGrid.innerHTML = '<p class="error-text">Schemaläggningsdata saknas. Schemat har inte initierats ännu.</p>';
        return;
    }

    // Get month data
    const monthData = state.schedule.months[monthNum - 1];
    if (!monthData) {
        calendarGrid.innerHTML = '<p class="error-text">Månad saknas i data</p>';
        return;
    }

    // Update month display
    const monthNames = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];
    monthDisplay.textContent = `${monthNames[monthNum - 1]} 2026`;

    // Weekday headers
    const weekdays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
    weekdays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });

    // Get first day of month (0=Sun, 1=Mon, ..., 6=Sat)
    const firstDay = new Date(2026, monthNum - 1, 1).getDay();
    // Convert to Mon=0, Tue=1, ..., Sun=6
    const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayAdjusted; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell empty';
        calendarGrid.appendChild(emptyCell);
    }

    // Add day cells
    monthData.days.forEach((day, index) => {
        const dayCell = createDayCell(day, index + 1, state, ctx);
        calendarGrid.appendChild(dayCell);
    });
}

/**
 * Create a day cell
 */
function createDayCell(day, dayNum, state, ctx) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell';

    // Check if today
    const today = new Date();
    const cellDate = new Date(day.date);
    if (cellDate.toDateString() === today.toDateString()) {
        cell.classList.add('today');
    }

    // Check if weekend
    const dayOfWeek = cellDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        cell.classList.add('weekend');
    }

    // Day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = dayNum;
    cell.appendChild(dayNumber);

    // Entries container
    const entriesContainer = document.createElement('div');
    entriesContainer.className = 'day-entries';

    if (day.entries && day.entries.length > 0) {
        // Show entries
        day.entries.forEach(entry => {
            const entryDiv = createEntryElement(entry, state);
            entriesContainer.appendChild(entryDiv);
        });
    } else {
        // No entries
        const noEntries = document.createElement('div');
        noEntries.className = 'no-entries';
        noEntries.textContent = '–';
        entriesContainer.appendChild(noEntries);
    }

    cell.appendChild(entriesContainer);

    return cell;
}

/**
 * Create an entry element (person working on this day)
 */
function createEntryElement(entry, state) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'calendar-entry';

    // Find person
    const person = state.people.find(p => p.id === entry.personId);
    const personName = person ? person.name : 'Okänd';

    // Find group for color
    const group = state.groups.find(g => g.members && g.members.includes(entry.personId));
    if (group && group.color) {
        entryDiv.style.borderLeft = `4px solid ${group.color}`;
    }

    // Status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge status-${entry.status}`;
    statusBadge.textContent = entry.status;
    entryDiv.appendChild(statusBadge);

    // Person name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'entry-person';
    nameSpan.textContent = personName;
    entryDiv.appendChild(nameSpan);

    // Time info (if working)
    if (entry.status === 'A' && entry.start && entry.end) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'entry-time';
        const hours = calculateHours(entry.start, entry.end, entry.breakStart, entry.breakEnd);
        timeSpan.textContent = `${entry.start}-${entry.end} (${hours.toFixed(1)}h)`;
        entryDiv.appendChild(timeSpan);
    }

    return entryDiv;
}

/**
 * Calculate hours worked
 */
function calculateHours(start, end, breakStart, breakEnd) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    let totalMinutes = endMinutes - startMinutes;
    
    // Subtract break if exists
    if (breakStart && breakEnd) {
        const [breakStartH, breakStartM] = breakStart.split(':').map(Number);
        const [breakEndH, breakEndM] = breakEnd.split(':').map(Number);
        const breakMinutes = (breakEndH * 60 + breakEndM) - (breakStartH * 60 + breakStartM);
        totalMinutes -= breakMinutes;
    }
    
    return totalMinutes / 60;
}

/**
 * Setup month navigation
 */
function setupMonthNavigation(calendarGrid, monthDisplay, prevBtn, nextBtn, state, ctx) {
    let currentMonth = new Date().getMonth() + 1; // 1-12

    prevBtn.addEventListener('click', () => {
        if (currentMonth > 1) {
            currentMonth--;
            renderMonth(calendarGrid, monthDisplay, currentMonth, state, ctx);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentMonth < 12) {
            currentMonth++;
            renderMonth(calendarGrid, monthDisplay, currentMonth, state, ctx);
        }
    });
}
