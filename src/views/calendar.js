/*
 * AO-22: CALENDAR — Roller + swap-läge + färgkarta
 */

import { getHolidayName, isHoliday } from '../data/holidays_2026.js';
import { getStatusStyle, getStatusLegend } from '../theme.js';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

const WEEKDAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const STATUS_OPTIONS = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'PERM', 'UTB'];

export function renderCalendar(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();

    if (!state.schedule || state.schedule.year !== 2026 || !state.schedule.months) {
        container.innerHTML =
            '<div class="view-container"><h2>Kalender</h2><p class="error-text">Schedule är korrupt eller fel år. Kan inte visa kalender.</p></div>';
        return;
    }

    const storeError = store.getLastError();
    const isReadOnly = !!storeError;

    const swapMode = sessionStorage.getItem('AO16_swapMode') === 'true';
    const swapSelection = JSON.parse(sessionStorage.getItem('AO16_swapSelection') || '[]');

    const currentMonth = parseInt(sessionStorage.getItem('AO16_selectedMonth') || String(new Date().getMonth() + 1), 10);
    const selectedMonth = Math.max(1, Math.min(12, currentMonth));

    const activePeople = (state.people || []).filter((p) => p.isActive).sort(sortByLastFirst);
    const monthData = state.schedule.months[selectedMonth - 1];
    
    if (!monthData || !Array.isArray(monthData.days)) {
        container.innerHTML = '<div class="view-container"><h2>Kalender</h2><p class="error-text">Månadens data saknas.</p></div>';
        return;
    }

    const html = `
        <div class="view-container calendar-container">
            <h2>Kalender 2026 — Schema-editor</h2>

            ${isReadOnly ? `<div class="alert alert-error">⚠️ Store är låst pga fel. Schema är läsbar men inte redigerbar.</div>` : ''}

            <!-- Swap-kontroller -->
            ${renderSwapControls(swapMode, swapSelection.length, isReadOnly)}

            <!-- Månadsväljare -->
            <div class="calendar-month-selector">
                <label for="month-select">Välj månad:</label>
                <select id="month-select" class="month-select" ${isReadOnly ? 'disabled' : ''}>
                    ${MONTH_NAMES.map((name, idx) => `
                        <option value="${idx + 1}" ${idx + 1 === selectedMonth ? 'selected' : ''}>
                            ${name} 2026
                        </option>
                    `).join('')}
                </select>
            </div>

            <h3 class="calendar-month-header">${MONTH_NAMES[selectedMonth - 1]} 2026</h3>

            <!-- Legend -->
            ${renderLegend(state)}

            <!-- Månadens tider -->
            ${renderMonthTimePanel(monthData, selectedMonth, isReadOnly)}

            <!-- Kalender-tabell -->
            ${
                activePeople.length === 0
                    ? '<p class="empty-state">Ingen aktiv personal. Lägg till personal först via Personal-vyn.</p>'
                    : renderPersonalScheduleTable(monthData, selectedMonth, activePeople, isReadOnly, swapMode, swapSelection, state)
            }

            <!-- Swap-resultat-notis -->
            <div id="swap-notification" class="swap-notification hidden"></div>
        </div>
    `;

    container.innerHTML = html;

    // Event listeners
    const monthSelect = container.querySelector('#month-select');
    if (monthSelect) {
        monthSelect.addEventListener('change', (e) => {
            sessionStorage.setItem('AO16_selectedMonth', e.target.value);
            renderCalendar(container, ctx);
        });
    }

    const swapToggleBtn = container.querySelector('#swap-toggle-btn');
    if (swapToggleBtn) {
        swapToggleBtn.addEventListener('click', () => {
            sessionStorage.setItem('AO16_swapMode', swapMode ? 'false' : 'true');
            sessionStorage.removeItem('AO16_swapSelection');
            renderCalendar(container, ctx);
        });
    }

    const swapConfirmBtn = container.querySelector('#swap-confirm-btn');
    if (swapConfirmBtn) {
        swapConfirmBtn.addEventListener('click', () => {
            if (swapSelection.length === 2) {
                handleSwap(swapSelection, store, container, ctx);
            }
        });
    }

    const swapCancelBtn = container.querySelector('#swap-cancel-btn');
    if (swapCancelBtn) {
        swapCancelBtn.addEventListener('click', () => {
            sessionStorage.removeItem('AO16_swapSelection');
            renderCalendar(container, ctx);
        });
    }

    if (!swapMode && !isReadOnly) {
        container.querySelectorAll('.status-cell').forEach((cell) => {
            cell.addEventListener('change', (e) => {
                const personId = cell.dataset.personId;
                const dateStr = cell.dataset.date;
                const newStatus = e.target.value;
                handleStatusChange(personId, dateStr, newStatus, store, container, ctx);
            });
        });
    }

    if (swapMode && !isReadOnly) {
        container.querySelectorAll('.swap-cell').forEach((cell) => {
            cell.addEventListener('click', () => {
                handleSwapCellSelect(cell, container, ctx);
            });
        });
    }
}

function renderSwapControls(swapMode, selectedCount, isReadOnly) {
    return `
        <div class="swap-controls">
            <button id="swap-toggle-btn" class="btn btn-secondary" ${isReadOnly ? 'disabled' : ''}>
                ${swapMode ? '❌ Avsluta byte-läge' : '🔄 Byt pass'}
            </button>

            ${
                swapMode
                    ? `
                <div class="swap-status">
                    <span class="swap-status-text">Valda celler: ${selectedCount}/2</span>
                    ${
                        selectedCount === 2
                            ? `
                        <button id="swap-confirm-btn" class="btn btn-primary">✓ Bekräfta byte</button>
                        <button id="swap-cancel-btn" class="btn btn-secondary">✗ Avbryt val</button>
                    `
                            : ''
                    }
                </div>
            `
                    : ''
            }
        </div>
    `;
}

function renderLegend(state) {
    const legend = getStatusLegend(state);

    const legendItems = legend
        .map(
            (item) => `
        <div class="legend-item">
            <div class="legend-color" style="background-color: ${item.bg}; color: ${item.fg};">
                ${item.code}
            </div>
            <span class="legend-label">${item.label}</span>
        </div>
    `
        )
        .join('');

    return `
        <div class="calendar-legend">
            <h4>Statusförklaring</h4>
            <div class="legend-grid">
                ${legendItems}
                <div class="legend-item">
                    <div class="legend-color legend-holiday">RÖD</div>
                    <span class="legend-label">Röd dag (helgdag)</span>
                </div>
            </div>
        </div>
    `;
}

function renderMonthTimePanel(monthData, selectedMonth, isReadOnly) {
    const MONTH_NAMES_FULL = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
    ];

    const timeDefaults = monthData?.timeDefaults || {
        start: '07:00',
        end: '16:00',
        breakStart: '12:00',
        breakEnd: '13:00',
    };

    return `
        <div class="month-time-panel">
            <h4>Månadens tider — ${MONTH_NAMES_FULL[selectedMonth - 1]}</h4>
            <form id="month-time-form" class="month-time-form" ${isReadOnly ? 'style="pointer-events:none;opacity:0.6;"' : ''}>
                <div class="time-inputs">
                    <div class="time-input-group">
                        <label for="time-start">Start:</label>
                        <input 
                            type="time" 
                            id="time-start" 
                            name="start" 
                            value="${timeDefaults.start}"
                            ${isReadOnly ? 'disabled' : ''}
                        >
                    </div>
                    <div class="time-input-group">
                        <label for="time-end">Slut:</label>
                        <input 
                            type="time" 
                            id="time-end" 
                            name="end" 
                            value="${timeDefaults.end}"
                            ${isReadOnly ? 'disabled' : ''}
                        >
                    </div>
                    <div class="time-input-group">
                        <label for="time-break-start">Rast start:</label>
                        <input 
                            type="time" 
                            id="time-break-start" 
                            name="breakStart" 
                            value="${timeDefaults.breakStart}"
                            ${isReadOnly ? 'disabled' : ''}
                        >
                    </div>
                    <div class="time-input-group">
                        <label for="time-break-end">Rast slut:</label>
                        <input 
                            type="time" 
                            id="time-break-end" 
                            name="breakEnd" 
                            value="${timeDefaults.breakEnd}"
                            ${isReadOnly ? 'disabled' : ''}
                        >
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" ${isReadOnly ? 'disabled' : ''}>Spara månadstider</button>
            </form>
        </div>
    `;
}

function renderPersonalScheduleTable(monthData, selectedMonth, activePeople, isReadOnly, swapMode, swapSelection, state) {
    const days = monthData.days || [];
    const firstDate = new Date(`2026-${String(selectedMonth).padStart(2, '0')}-01`);
    const firstDayOfWeek = firstDate.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    let headerHtml = `
        <thead>
            <tr>
                <th class="person-col">Person</th>
    `;

    for (let i = 0; i < startOffset; i++) {
        headerHtml += '<th class="day-col empty"></th>';
    }

    days.forEach((dayData) => {
        const dayOfMonth = dayData.date.split('-')[2];
        const isHol = isHoliday(dayData.date);
        const holidayName = getHolidayName(dayData.date);

        const dayClass = isHol ? 'holiday-header' : '';
        const title = isHol ? `Röd dag: ${holidayName}` : '';

        headerHtml += `
            <th class="day-col ${dayClass}" title="${title}">
                <div class="day-header-inner">
                    <div class="day-number">${dayOfMonth}</div>
                    ${isHol ? `<div class="holiday-tag">RÖD</div>` : ''}
                </div>
            </th>
        `;
    });

    headerHtml += `
            </tr>
        </thead>
    `;

    let bodyHtml = '<tbody>';

    activePeople.forEach((person) => {
        bodyHtml += `
            <tr class="person-row">
                <td class="person-col">${person.lastName}, ${person.firstName}</td>
        `;

        for (let i = 0; i < startOffset; i++) {
            bodyHtml += '<td class="day-cell empty"></td>';
        }

        days.forEach((dayData) => {
            const entry = dayData.entries.find((e) => e.personId === person.id);
            const currentStatus = entry?.status || '';
            const role = entry?.role || '';
            const isHol = isHoliday(dayData.date);

            const style = getStatusStyle(currentStatus, state);

            const cellId = `cell-${person.id}-${dayData.date}`;
            const isSelected = swapSelection.some((sel) => sel.personId === person.id && sel.date === dayData.date);

            const cellClasses = [
                'day-cell',
                isHol ? 'holiday-cell' : '',
                isSelected ? 'swap-selected' : '',
            ]
                .filter(Boolean)
                .join(' ');

            if (swapMode) {
                bodyHtml += `
                    <td class="${cellClasses} swap-cell ${style.colorClass}" 
                        id="${cellId}"
                        data-person-id="${person.id}"
                        data-date="${dayData.date}"
                        style="background-color: ${style.bg}; color: ${style.fg};"
                        title="${currentStatus ? `${style.label}${role ? ` (${role})` : ''}` : 'Tom'}">
                        ${getStatusDisplay(currentStatus, role)}
                    </td>
                `;
            } else {
                bodyHtml += `
                    <td class="day-cell ${isHol ? 'holiday-cell' : ''}" 
                        style="background-color: ${style.bg};">
                        <select 
                            class="status-cell ${style.colorClass}"
                            data-person-id="${person.id}"
                            data-date="${dayData.date}"
                            style="color: ${style.fg}; font-weight: 600;"
                            ${isReadOnly ? 'disabled' : ''}
                        >
                            <option value="">—</option>
                            ${STATUS_OPTIONS.map((status) => {
                                const optStyle = getStatusStyle(status, state);
                                return `
                                <option value="${status}" ${status === currentStatus ? 'selected' : ''}>
                                    ${optStyle.label}
                                </option>
                            `;
                            }).join('')}
                        </select>
                    </td>
                `;
            }
        });

        bodyHtml += '</tr>';
    });

    bodyHtml += '</tbody>';

    return `
        <div class="calendar-table-wrapper">
            <table class="calendar-schedule-table">
                ${headerHtml}
                ${bodyHtml}
            </table>
        </div>
    `;
}

function handleSwapCellSelect(cellElement, container, ctx) {
    const personId = cellElement.dataset.personId;
    const date = cellElement.dataset.date;

    const swapSelection = JSON.parse(sessionStorage.getItem('AO16_swapSelection') || '[]');

    const isAlreadySelected = swapSelection.some((sel) => sel.personId === personId && sel.date === date);

    if (isAlreadySelected) {
        const filtered = swapSelection.filter((sel) => !(sel.personId === personId && sel.date === date));
        sessionStorage.setItem('AO16_swapSelection', JSON.stringify(filtered));
    } else {
        if (swapSelection.length < 2) {
            swapSelection.push({ personId, date });
            sessionStorage.setItem('AO16_swapSelection', JSON.stringify(swapSelection));
        }
    }

    renderCalendar(container, ctx);
}

function handleSwap(swapSelection, store, container, ctx) {
    try {
        if (swapSelection.length !== 2) {
            alert('Välj exakt två celler för byte');
            return;
        }

        const [sel1, sel2] = swapSelection;

        store.update((state) => {
            const getEntryData = (personId, dateStr) => {
                const [year, month, day] = dateStr.split('-').map(Number);
                const monthData = state.schedule.months[month - 1];
                const dayData = monthData?.days[day - 1];
                const entry = dayData?.entries.find((e) => e.personId === personId);
                return { monthData, dayData, entry };
            };

            const { dayData: dayData1, entry: entry1 } = getEntryData(sel1.personId, sel1.date);
            const { dayData: dayData2, entry: entry2 } = getEntryData(sel2.personId, sel2.date);

            dayData1.entries = dayData1.entries.filter((e) => e.personId !== sel1.personId);
            dayData2.entries = dayData2.entries.filter((e) => e.personId !== sel2.personId);

            if (entry2) {
                const newEntry1 = {
                    ...entry2,
                    personId: sel1.personId,
                };
                dayData1.entries.push(newEntry1);
            }

            if (entry1) {
                const newEntry2 = {
                    ...entry1,
                    personId: sel2.personId,
                };
                dayData2.entries.push(newEntry2);
            }

            state.meta.updatedAt = Date.now();
            return state;
        });

        sessionStorage.removeItem('AO16_swapSelection');
        sessionStorage.setItem('AO16_swapMode', 'false');

        showSwapNotification(container, 'Byte klart! Kontrollera Kontroll-vyn för HRF-varningar.');

        setTimeout(() => {
            renderCalendar(container, ctx);
        }, 1000);
    } catch (err) {
        console.error('Swap-fel', err);
        alert(`Fel vid byte: ${err.message}`);
    }
}

function showSwapNotification(container, message) {
    const notificationDiv = container.querySelector('#swap-notification');
    if (notificationDiv) {
        notificationDiv.textContent = message;
        notificationDiv.classList.remove('hidden');

        setTimeout(() => {
            notificationDiv.classList.add('hidden');
        }, 4000);
    }
}

function handleStatusChange(personId, dateStr, newStatus, store, container, ctx) {
    try {
        store.update((state) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const monthIndex = month - 1;
            const dayIndex = day - 1;

            const monthData = state.schedule.months[monthIndex];
            if (!monthData || !monthData.days[dayIndex]) {
                throw new Error(`Dag ${dateStr} inte funnen`);
            }

            const dayData = monthData.days[dayIndex];

            let entry = dayData.entries.find((e) => e.personId === personId);

            if (!entry && newStatus) {
                entry = {
                    personId,
                    status: newStatus,
                    role: null,
                    start: null,
                    end: null,
                    breakStart: null,
                    breakEnd: null,
                };
                dayData.entries.push(entry);
            } else if (entry && newStatus) {
                entry.status = newStatus;
            } else if (entry && !newStatus) {
                dayData.entries = dayData.entries.filter((e) => e.personId !== personId);
            }

            state.meta.updatedAt = Date.now();
            return state;
        });

        renderCalendar(container, ctx);
    } catch (err) {
        console.error('Status-ändringsfel', err);
        alert(`Fel vid ändringar: ${err.message}`);
    }
}

function getStatusDisplay(status, role) {
    if (!status) {
        return '<span class="status-empty">—</span>';
    }

    const text = role ? `${status}/${role}` : status;
    return `<span class="status-text">${text}</span>`;
}

function sortByLastFirst(a, b) {
    const aLast = a.lastName.toLowerCase();
    const bLast = b.lastName.toLowerCase();
    if (aLast !== bLast) {
        return aLast.localeCompare(bLast);
    }
    return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase());
}
