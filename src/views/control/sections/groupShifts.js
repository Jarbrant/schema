/*
 * CONTROL SECTION — Grupp-skift
 * 
 * Visar schemalägda skift för valda grupper.
 */

import { reportError } from '../../../diagnostics.js';

export function renderGroupShiftsSection(container, ctx) {
    try {
        const store = ctx?.store;
        if (!store) {
            throw new Error('Store saknas i context');
        }

        const state = store.getState();
        const shifts = state.shifts || [];
        const groups = state.groups || [];
        const people = state.people || [];
        const selectedGroups = ctx?.selectedGroups || groups.map(g => g.id);

        // Filtrera skift för valda grupper
        const filteredShifts = shifts.filter(shift => {
            const person = people.find(p => p.id === shift.personId);
            const personGroup = groups.find(g => g.members?.includes(person?.id));
            return personGroup && selectedGroups.includes(personGroup.id);
        });

        const html = `
            <div class="section-header">
                <h2>📅 Grupp-skift</h2>
                <p>Schemalägda skift för valda grupper. Valideras mot HRF-regler.</p>
            </div>

            <div class="section-content">
                ${filteredShifts.length > 0 ? `
                    <div class="shifts-overview">
                        <div class="overview-stat">
                            <span class="stat-label">Totala skift:</span>
                            <span class="stat-value">${filteredShifts.length}</span>
                        </div>
                        <div class="overview-stat">
                            <span class="stat-label">Unika personal:</span>
                            <span class="stat-value">${new Set(filteredShifts.map(s => s.personId)).size}</span>
                        </div>
                    </div>

                    <div class="shifts-table-wrapper">
                        <table class="shifts-table">
                            <thead>
                                <tr>
                                    <th>Datum</th>
                                    <th>Tid</th>
                                    <th>Person</th>
                                    <th>Grupp</th>
                                    <th>Roll</th>
                                    <th>Timmar</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredShifts.map(shift => {
                                    const person = people.find(p => p.id === shift.personId);
                                    const personGroup = groups.find(g => g.members?.includes(person?.id));
                                    const hours = calculateHours(shift.startTime, shift.endTime);
                                    const isValid = validateShiftRules(shift);

                                    return `
                                        <tr>
                                            <td>${shift.date}</td>
                                            <td>${shift.startTime} - ${shift.endTime}</td>
                                            <td>${person?.name || 'Okänd'}</td>
                                            <td>${personGroup?.name || '-'}</td>
                                            <td>${shift.role || '-'}</td>
                                            <td>${hours.toFixed(1)}h</td>
                                            <td>
                                                <span class="status-badge ${isValid ? 'status-ok' : 'status-error'}">
                                                    ${isValid ? '✓ OK' : '⚠ Varning'}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        Inga schemalägda skift för valda grupper.
                    </div>
                `}
            </div>
        `;

        container.innerHTML = html;

    } catch (err) {
        console.error('❌ Fel i renderGroupShiftsSection:', err);
        throw err;
    }
}

/**
 * Beräkna timmar mellan två tider
 */
function calculateHours(startTime, endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    return (endMinutes - startMinutes) / 60;
}

/**
 * Validera skift mot enkla regler
 */
function validateShiftRules(shift) {
    const hours = calculateHours(shift.startTime, shift.endTime);
    
    // Regel: Skift mellan 4-12 timmar
    return hours >= 4 && hours <= 12;
}
