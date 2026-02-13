/*
 * AO-02F: SHIFTS — Schemaläggning & skifthantering
 * 
 * Två tabs:
 * 1. Schemaläggning — Lägg till/redigera/radera shifts
 * 2. Kontroll — Validering & regel-överträdelser
 */

import { calculateHours, getRoleLabel } from '../modules/shifts-utils.js';
import { validateShift } from '../modules/shifts-validate.js';
import { setupShiftsEventListeners } from '../modules/shifts-form.js';

export function renderShifts(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const shifts = state.shifts || [];
    const currentTab = ctx?.shiftTab || 'schedule';

    const html = `
        <div class="shifts-container">
            <div class="shifts-content">
                <h1>Schemaläggning</h1>
                <p class="shifts-tagline">
                    Hantera arbetsschema och validera mot HRF-avtalsregler
                </p>

                <!-- Tab Navigation -->
                <div class="shifts-tabs">
                    <button class="shifts-tab ${currentTab === 'schedule' ? 'active' : ''}" data-tab="schedule">
                        📅 Schemaläggning
                    </button>
                    <button class="shifts-tab ${currentTab === 'control' ? 'active' : ''}" data-tab="control">
                        ✓ Kontroll
                    </button>
                </div>

                <!-- TAB 1: SCHEMALÄGGNING -->
                ${currentTab === 'schedule' ? `
                    <div class="shifts-form-section">
                        <h2>Lägg till nytt skift</h2>
                        <form id="shift-form" class="shifts-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="shift-date">Datum *</label>
                                    <input type="date" id="shift-date" name="date" required>
                                </div>
                                <div class="form-group">
                                    <label for="shift-start">Starttid *</label>
                                    <input type="time" id="shift-start" name="startTime" required>
                                </div>
                                <div class="form-group">
                                    <label for="shift-end">Sluttid *</label>
                                    <input type="time" id="shift-end" name="endTime" required>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="shift-person">Person *</label>
                                    <select id="shift-person" name="personId" required>
                                        <option value="">-- Välj person --</option>
                                        ${(state.people || []).map(p => `
                                            <option value="${p.id}">${p.name}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="shift-role">Roll *</label>
                                    <select id="shift-role" name="role" required>
                                        <option value="">-- Välj roll --</option>
                                        <option value="staff">Personal</option>
                                        <option value="foreman">Befälhavare</option>
                                        <option value="chairman">Ordförande</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="shift-location">Plats</label>
                                    <input type="text" id="shift-location" name="location" placeholder="t.ex. Avdelning A">
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="shift-notes">Anteckningar</label>
                                <textarea id="shift-notes" name="notes" rows="3" placeholder="Eventuella noteringar..."></textarea>
                            </div>

                            <div class="form-buttons">
                                <button type="submit" class="btn btn-primary">Lägg till skift</button>
                                <button type="reset" class="btn btn-secondary">Rensa</button>
                            </div>
                        </form>
                    </div>

                    <div class="shifts-table-section">
                        <h2>Befintliga skift</h2>
                        ${shifts.length > 0 ? `
                            <div class="shifts-table-wrapper">
                                <table class="shifts-table">
                                    <thead>
                                        <tr>
                                            <th>Datum</th>
                                            <th>Tid</th>
                                            <th>Person</th>
                                            <th>Roll</th>
                                            <th>Plats</th>
                                            <th>Timmar</th>
                                            <th>Åtgärd</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${shifts.map((shift, i) => {
                                            const person = (state.people || []).find(p => p.id === shift.personId);
                                            const hours = calculateHours(shift.startTime, shift.endTime);
                                            return `
                                                <tr>
                                                    <td>${shift.date}</td>
                                                    <td>${shift.startTime} - ${shift.endTime}</td>
                                                    <td>${person?.name || 'Okänd'}</td>
                                                    <td>${getRoleLabel(shift.role)}</td>
                                                    <td>${shift.location || '-'}</td>
                                                    <td>${hours.toFixed(1)}h</td>
                                                    <td>
                                                        <div class="shifts-table-actions">
                                                            <button class="btn-edit" data-action="edit" data-id="${i}">Redigera</button>
                                                            <button class="btn-delete" data-action="delete" data-id="${i}">Radera</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                Inga skift har lagts till ännu. Skapa ditt första skift ovan.
                            </div>
                        `}
                    </div>
                ` : ''}

                <!-- TAB 2: KONTROLL -->
                ${currentTab === 'control' ? `
                    <div class="shifts-form-section">
                        <h2>Regelvalidering</h2>
                        <p style="color: #666; margin-bottom: 1.5rem;">
                            Här visas överträdelser mot HRF-avtalsregler.
                        </p>
                        
                        ${shifts.length > 0 ? `
                            <div class="shifts-table-wrapper">
                                <table class="shifts-table">
                                    <thead>
                                        <tr>
                                            <th>Datum</th>
                                            <th>Person</th>
                                            <th>Status</th>
                                            <th>Meddelande</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${shifts.map((shift, i) => {
                                            const violations = validateShift(shift, state);
                                            return `
                                                <tr>
                                                    <td>${shift.date}</td>
                                                    <td>${(state.people || []).find(p => p.id === shift.personId)?.name || 'Okänd'}</td>
                                                    <td>
                                                        <span class="status-badge ${violations.length === 0 ? 'status-active' : 'status-inactive'}">
                                                            ${violations.length === 0 ? '✓ OK' : '⚠ Varning'}
                                                        </span>
                                                    </td>
                                                    <td>${violations.length > 0 ? violations.join(', ') : 'Inga överträdelser'}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                Inga skift att validera ännu.
                            </div>
                        `}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Setup event listeners
    setupShiftsEventListeners(container, store, ctx);
}
