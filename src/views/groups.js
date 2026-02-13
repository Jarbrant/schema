/*
 * AO-04: GROUPS — Grupp-hantering & Grundpass-konfiguration
 * 
 * Två tabs:
 * 1. Grupper — Skapa/redigera grupper och välj medlemmar
 * 2. Grundpass — Definiera arbetstider, raster, färger
 */

import { setupGroupsEventListeners } from '../modules/groups-form.js';

export function renderGroups(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const groups = state.groups || [];
    const passes = state.passes || [];
    const people = state.people || [];
    const currentTab = ctx?.groupsTab || 'groups';

    const html = `
        <div class="groups-container">
            <div class="groups-content">
                <h1>Grupp-hantering & Grundpass</h1>
                <p class="groups-tagline">
                    Skapa arbetstidsgrupper och definiera grundpass för schemaläggninga
                </p>

                <!-- Tab Navigation -->
                <div class="groups-tabs">
                    <button class="groups-tab ${currentTab === 'groups' ? 'active' : ''}" data-tab="groups">
                        👥 Grupper
                    </button>
                    <button class="groups-tab ${currentTab === 'passes' ? 'active' : ''}" data-tab="passes">
                        🕐 Grundpass
                    </button>
                </div>

                <!-- TAB 1: GRUPPER -->
                ${currentTab === 'groups' ? `
                    <div class="groups-form-section">
                        <h2>Skapa ny grupp</h2>
                        <form id="group-form" class="groups-form">
                            <div class="form-group">
                                <label for="group-name">Grupp-namn *</label>
                                <input type="text" id="group-name" name="name" placeholder="t.ex. Restaurang Personal" required>
                            </div>

                            <div class="form-group">
                                <label>Välj medlemmar *</label>
                                <div class="checkbox-grid">
                                    ${people.length > 0 ? people.map(p => `
                                        <div class="checkbox-item">
                                            <input type="checkbox" id="member-${p.id}" name="members" value="${p.id}">
                                            <label for="member-${p.id}">${p.name}</label>
                                        </div>
                                    `).join('') : '<p>Inga personer tilgängliga. Skapa personal först.</p>'}
                                </div>
                            </div>

                            <div class="form-buttons">
                                <button type="submit" class="btn btn-primary">Skapa grupp</button>
                                <button type="reset" class="btn btn-secondary">Rensa</button>
                            </div>
                        </form>
                    </div>

                    <div class="groups-table-section">
                        <h2>Befintliga grupper</h2>
                        ${groups.length > 0 ? `
                            <div class="groups-table-wrapper">
                                <table class="groups-table">
                                    <thead>
                                        <tr>
                                            <th>Grupp-namn</th>
                                            <th>Medlemmar</th>
                                            <th>Antal</th>
                                            <th>Åtgärd</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${groups.map(group => `
                                            <tr>
                                                <td>${group.name}</td>
                                                <td>${group.members.map(mid => {
                                                    const person = people.find(p => p.id === mid);
                                                    return person?.name || 'Okänd';
                                                }).join(', ')}</td>
                                                <td>${group.members.length}</td>
                                                <td>
                                                    <div class="groups-table-actions">
                                                        <button class="btn-edit" data-action="edit" data-id="${group.id}">Redigera</button>
                                                        <button class="btn-delete" data-action="delete-group" data-id="${group.id}">Radera</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                Inga grupper skapade ännu. Skapa din första grupp ovan.
                            </div>
                        `}
                    </div>
                ` : ''}

                <!-- TAB 2: GRUNDPASS -->
                ${currentTab === 'passes' ? `
                    <div class="groups-form-section">
                        <h2>Skapa nytt grundpass</h2>
                        <form id="pass-form" class="groups-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="pass-name">Namn *</label>
                                    <input type="text" id="pass-name" name="name" placeholder="t.ex. Semester" required>
                                </div>
                                <div class="form-group">
                                    <label for="pass-color">Färg</label>
                                    <input type="color" id="pass-color" name="color" value="#667eea">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="pass-start">Starttid *</label>
                                    <input type="time" id="pass-start" name="startTime" required>
                                </div>
                                <div class="form-group">
                                    <label for="pass-end">Sluttid *</label>
                                    <input type="time" id="pass-end" name="endTime" required>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="pass-break-start">Rast från</label>
                                    <input type="time" id="pass-break-start" name="breakStart">
                                </div>
                                <div class="form-group">
                                    <label for="pass-break-end">Rast till</label>
                                    <input type="time" id="pass-break-end" name="breakEnd">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="pass-cost">Kostnadsställe</label>
                                    <input type="text" id="pass-cost" name="costCenter" placeholder="t.ex. 8 Semester">
                                </div>
                                <div class="form-group">
                                    <label for="pass-workplace">Arbetsplats</label>
                                    <input type="text" id="pass-workplace" name="workplace" placeholder="t.ex. Restaurang Borg">
                                </div>
                            </div>

                            <div class="form-buttons">
                                <button type="submit" class="btn btn-primary">Skapa grundpass</button>
                                <button type="reset" class="btn btn-secondary">Rensa</button>
                            </div>
                        </form>
                    </div>

                    <div class="groups-table-section">
                        <h2>Befintliga grundpass</h2>
                        ${passes.length > 0 ? `
                            <div class="groups-table-wrapper">
                                <table class="groups-table">
                                    <thead>
                                        <tr>
                                            <th>Namn</th>
                                            <th>Tid</th>
                                            <th>Rast</th>
                                            <th>Färg</th>
                                            <th>Kostnadsställe</th>
                                            <th>Arbetsplats</th>
                                            <th>Åtgärd</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${passes.map(pass => `
                                            <tr>
                                                <td>${pass.name}</td>
                                                <td>${pass.startTime} - ${pass.endTime}</td>
                                                <td>${pass.breakStart && pass.breakEnd ? pass.breakStart + ' - ' + pass.breakEnd : '-'}</td>
                                                <td>
                                                    <span class="color-badge" style="background-color: ${pass.color};"></span>
                                                </td>
                                                <td>${pass.costCenter || '-'}</td>
                                                <td>${pass.workplace || '-'}</td>
                                                <td>
                                                    <div class="groups-table-actions">
                                                        <button class="btn-edit" data-action="edit" data-id="${pass.id}">Redigera</button>
                                                        <button class="btn-delete" data-action="delete-pass" data-id="${pass.id}">Radera</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state">
                                Inga grundpass skapade ännu. Skapa ditt första pass ovan.
                            </div>
                        `}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Setup event listeners
    setupGroupsEventListeners(container, store, ctx);
}
