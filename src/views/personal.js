/*
 * PERSONAL.JS — Personal Management with Tabs (COMPLETE v5)
 * 
 * TAB 1: ➕ Lägg till ny personal (formulär)
 * TAB 2: 🔍 Hantera personal (sök + redigera)
 * 
 * Features:
 * - Add/Edit/Delete person
 * - Sector selection (Private/Municipal)
 * - Start date → Auto vacation calc
 * - Search & filter
 * - Multi-group assignment
 * - Availability calendar
 */

import { showSuccess, showWarning } from '../ui.js';
import { reportError } from '../diagnostics.js';
import {
    getVacationDaysPerYear,
    calculateYearsEmployed,
    SECTOR_TYPES
} from '../hr-rules.js';

const DAYS_OF_WEEK = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export function renderPersonal(container, ctx) {
    try {
        if (!container || !ctx?.store) {
            throw new Error('Container eller store missing');
        }

        const store = ctx.store;
        const state = store.getState();
        const people = state.people || [];
        const groups = state.groups || [];

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create page structure
        const viewContainer = document.createElement('div');
        viewContainer.className = 'view-container';

        // === HEADER ===
        const header = document.createElement('div');
        header.className = 'section-header';

        const title = document.createElement('h1');
        title.textContent = '👤 Personal';

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Lägg till eller hantera personal, semesterdagar och löner';

        header.appendChild(title);
        header.appendChild(subtitle);
        viewContainer.appendChild(header);

        // === STATUS ROW ===
        const statusRow = document.createElement('div');
        statusRow.className = 'control-status';

        const statusItem = document.createElement('div');
        statusItem.className = 'status-item';

        const statusLabel = document.createElement('span');
        statusLabel.className = 'status-label';
        statusLabel.textContent = 'Totalt personal:';

        const statusValue = document.createElement('span');
        statusValue.className = 'status-value';
        statusValue.textContent = people.length;

        statusItem.appendChild(statusLabel);
        statusItem.appendChild(statusValue);
        statusRow.appendChild(statusItem);
        viewContainer.appendChild(statusRow);

        // === TAB NAVIGATION ===
        const tabNav = document.createElement('div');
        tabNav.className = 'tab-navigation';
        tabNav.style.display = 'flex';
        tabNav.style.gap = '0.5rem';
        tabNav.style.marginTop = '2rem';
        tabNav.style.marginBottom = '0';
        tabNav.style.borderBottom = '2px solid #eee';

        // Tab 1: Add
        const addTab = document.createElement('button');
        addTab.className = 'tab-button active';
        addTab.textContent = '➕ Lägg till ny';
        addTab.style.padding = '1rem 1.5rem';
        addTab.style.border = 'none';
        addTab.style.background = 'transparent';
        addTab.style.cursor = 'pointer';
        addTab.style.fontWeight = '600';
        addTab.style.color = '#667eea';
        addTab.style.borderBottom = '3px solid #667eea';
        addTab.style.transition = 'all 0.2s';
        addTab.dataset.tab = 'add';

        // Tab 2: Search
        const searchTab = document.createElement('button');
        searchTab.className = 'tab-button';
        searchTab.textContent = '🔍 Hantera personal';
        searchTab.style.padding = '1rem 1.5rem';
        searchTab.style.border = 'none';
        searchTab.style.background = 'transparent';
        searchTab.style.cursor = 'pointer';
        searchTab.style.fontWeight = '600';
        searchTab.style.color = '#999';
        searchTab.style.borderBottom = '3px solid transparent';
        searchTab.style.transition = 'all 0.2s';
        searchTab.dataset.tab = 'search';

        tabNav.appendChild(addTab);
        tabNav.appendChild(searchTab);
        viewContainer.appendChild(tabNav);

        // === TAB CONTENT ===
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';

        // --- ADD TAB ---
        const addPanel = document.createElement('div');
        addPanel.id = 'tab-add';
        addPanel.className = 'tab-panel active';
        addPanel.style.padding = '2rem';
        addPanel.style.background = '#f9f9f9';
        addPanel.style.borderRadius = '0 0 8px 8px';

        renderAddForm(addPanel, store, ctx, container, groups);
        tabContent.appendChild(addPanel);

        // --- SEARCH TAB ---
        const searchPanel = document.createElement('div');
        searchPanel.id = 'tab-search';
        searchPanel.className = 'tab-panel';
        searchPanel.style.padding = '2rem';
        searchPanel.style.background = '#f9f9f9';
        searchPanel.style.borderRadius = '0 0 8px 8px';
        searchPanel.style.display = 'none';

        renderSearchPanel(searchPanel, store, ctx, container, groups, people);
        tabContent.appendChild(searchPanel);

        viewContainer.appendChild(tabContent);

        // === TAB SWITCHING ===
        addTab.onclick = () => switchTab('add', addTab, searchTab, addPanel, searchPanel);
        searchTab.onclick = () => switchTab('search', addTab, searchTab, addPanel, searchPanel);

        container.appendChild(viewContainer);

        console.log('✓ Personal view rendered with tabs');

    } catch (err) {
        console.error('❌ Error rendering personal:', err);
        reportError(
            'PERSONAL_RENDER_ERROR',
            'PERSONAL_VIEW',
            'src/views/personal.js',
            err.message
        );
    }
}

/**
 * Switch between tabs
 */
function switchTab(tabName, addTab, searchTab, addPanel, searchPanel) {
    if (tabName === 'add') {
        addTab.style.color = '#667eea';
        addTab.style.borderBottomColor = '#667eea';
        searchTab.style.color = '#999';
        searchTab.style.borderBottomColor = 'transparent';
        addPanel.style.display = 'block';
        searchPanel.style.display = 'none';
    } else {
        searchTab.style.color = '#667eea';
        searchTab.style.borderBottomColor = '#667eea';
        addTab.style.color = '#999';
        addTab.style.borderBottomColor = 'transparent';
        searchPanel.style.display = 'block';
        addPanel.style.display = 'none';
    }
}

/**
 * Render ADD FORM tab
 */
function renderAddForm(container, store, ctx, mainContainer, groups) {
    try {
        // === BASIC INFO ===
        const basicInfo = document.createElement('fieldset');
        basicInfo.style.border = 'none';
        basicInfo.style.marginBottom = '1.5rem';
        basicInfo.style.padding = '1rem';
        basicInfo.style.background = '#fff';
        basicInfo.style.borderRadius = '6px';

        const basicLegend = document.createElement('legend');
        basicLegend.textContent = 'Grundinformation';
        basicLegend.style.fontWeight = '600';
        basicLegend.style.marginBottom = '1rem';
        basicInfo.appendChild(basicLegend);

        const nameGroup = createFormGroup('personal-name', 'Namn *', 'text', 'Ex: Anna Ström');
        basicInfo.appendChild(nameGroup);

        const emailGroup = createFormGroup('personal-email', 'E-post *', 'email', 'anna@example.com');
        basicInfo.appendChild(emailGroup);

        const phoneGroup = createFormGroup('personal-phone', 'Telefon', 'tel', '+46 70 123 45 67');
        basicInfo.appendChild(phoneGroup);

        container.appendChild(basicInfo);

        // === EMPLOYMENT INFO ===
        const employmentInfo = document.createElement('fieldset');
        employmentInfo.style.border = 'none';
        employmentInfo.style.marginBottom = '1.5rem';
        employmentInfo.style.padding = '1rem';
        employmentInfo.style.background = '#fff';
        employmentInfo.style.borderRadius = '6px';

        const employmentLegend = document.createElement('legend');
        employmentLegend.textContent = 'Anställningsinformation';
        employmentLegend.style.fontWeight = '600';
        employmentLegend.style.marginBottom = '1rem';
        employmentInfo.appendChild(employmentLegend);

        const startDateGroup = createFormGroup('personal-start-date', 'Startdatum *', 'date', '');
        employmentInfo.appendChild(startDateGroup);

        const degreeGroup = createFormGroup('personal-degree', 'Tjänstgöringsgrad (%) *', 'number', '100');
        const degreeInput = degreeGroup.querySelector('input');
        degreeInput.min = '10';
        degreeInput.max = '100';
        degreeInput.value = '100';
        employmentInfo.appendChild(degreeGroup);

        const workdaysGroup = createFormGroup('personal-workdays', 'Arbetsdagar per vecka *', 'number', '5');
        const workdaysInput = workdaysGroup.querySelector('input');
        workdaysInput.min = '1';
        workdaysInput.max = '7';
        workdaysInput.value = '5';
        employmentInfo.appendChild(workdaysGroup);

        container.appendChild(employmentInfo);

        // === SECTOR SELECTION ===
        const sectorInfo = document.createElement('fieldset');
        sectorInfo.style.border = 'none';
        sectorInfo.style.marginBottom = '1.5rem';
        sectorInfo.style.padding = '1rem';
        sectorInfo.style.background = '#fff';
        sectorInfo.style.borderRadius = '6px';

        const sectorLegend = document.createElement('legend');
        sectorLegend.textContent = 'Sektor *';
        sectorLegend.style.fontWeight = '600';
        sectorLegend.style.marginBottom = '1rem';
        sectorInfo.appendChild(sectorLegend);

        const sectorContainer = document.createElement('div');
        sectorContainer.style.display = 'grid';
        sectorContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        sectorContainer.style.gap = '1rem';

        // Private sector
        const privateLabel = document.createElement('label');
        privateLabel.style.display = 'flex';
        privateLabel.style.alignItems = 'center';
        privateLabel.style.gap = '0.5rem';
        privateLabel.style.cursor = 'pointer';
        privateLabel.style.padding = '0.75rem';
        privateLabel.style.border = '2px solid #ddd';
        privateLabel.style.borderRadius = '6px';
        privateLabel.style.transition = 'all 0.2s';

        const privateRadio = document.createElement('input');
        privateRadio.type = 'radio';
        privateRadio.name = 'sector';
        privateRadio.value = 'private';
        privateRadio.checked = true;
        privateRadio.style.cursor = 'pointer';

        const privateSpan = document.createElement('span');
        privateSpan.innerHTML = '<strong>Privat sektor</strong><br><small>25/28/31 dagar</small>';

        privateLabel.appendChild(privateRadio);
        privateLabel.appendChild(privateSpan);

        privateLabel.onmouseover = () => {
            privateLabel.style.borderColor = '#667eea';
            privateLabel.style.background = '#f9f9f9';
        };
        privateLabel.onmouseout = () => {
            privateLabel.style.borderColor = privateRadio.checked ? '#667eea' : '#ddd';
            privateLabel.style.background = 'transparent';
        };
        privateRadio.onchange = () => {
            privateLabel.style.borderColor = '#667eea';
            privateLabel.style.background = '#f0f4ff';
            municipalLabel.style.borderColor = '#ddd';
            municipalLabel.style.background = 'transparent';
        };

        sectorContainer.appendChild(privateLabel);

        // Municipal sector
        const municipalLabel = document.createElement('label');
        municipalLabel.style.display = 'flex';
        municipalLabel.style.alignItems = 'center';
        municipalLabel.style.gap = '0.5rem';
        municipalLabel.style.cursor = 'pointer';
        municipalLabel.style.padding = '0.75rem';
        municipalLabel.style.border = '2px solid #ddd';
        municipalLabel.style.borderRadius = '6px';
        municipalLabel.style.transition = 'all 0.2s';

        const municipalRadio = document.createElement('input');
        municipalRadio.type = 'radio';
        municipalRadio.name = 'sector';
        municipalRadio.value = 'municipal';
        municipalRadio.style.cursor = 'pointer';

        const municipalSpan = document.createElement('span');
        municipalSpan.innerHTML = '<strong>Kommunal sektor</strong><br><small>28/30/32 dagar</small>';

        municipalLabel.appendChild(municipalRadio);
        municipalLabel.appendChild(municipalSpan);

        municipalLabel.onmouseover = () => {
            municipalLabel.style.borderColor = '#667eea';
            municipalLabel.style.background = '#f9f9f9';
        };
        municipalLabel.onmouseout = () => {
            municipalLabel.style.borderColor = municipalRadio.checked ? '#667eea' : '#ddd';
            municipalLabel.style.background = 'transparent';
        };
        municipalRadio.onchange = () => {
            municipalLabel.style.borderColor = '#667eea';
            municipalLabel.style.background = '#f0f4ff';
            privateLabel.style.borderColor = '#ddd';
            privateLabel.style.background = 'transparent';
        };

        sectorContainer.appendChild(municipalLabel);

        sectorInfo.appendChild(sectorContainer);
        container.appendChild(sectorInfo);

        // === SALARY & VACATION ===
        const salaryInfo = document.createElement('fieldset');
        salaryInfo.style.border = 'none';
        salaryInfo.style.marginBottom = '1.5rem';
        salaryInfo.style.padding = '1rem';
        salaryInfo.style.background = '#fff';
        salaryInfo.style.borderRadius = '6px';

        const salaryLegend = document.createElement('legend');
        salaryLegend.textContent = 'Lön & Semesterdagar';
        salaryLegend.style.fontWeight = '600';
        salaryLegend.style.marginBottom = '1rem';
        salaryInfo.appendChild(salaryLegend);

        const salaryGroup = createFormGroup('personal-salary', 'Månadslön (SEK)', 'number', '25000');
        salaryInfo.appendChild(salaryGroup);

        const savedVacationGroup = createFormGroup('personal-saved-vacation', 'Sparade semesterdagar', 'number', '0');
        salaryInfo.appendChild(savedVacationGroup);

        const savedLeaveGroup = createFormGroup('personal-saved-leave', 'Sparade ledighetsdagar', 'number', '0');
        salaryInfo.appendChild(savedLeaveGroup);

        container.appendChild(salaryInfo);

        // === GROUPS ===
        const groupsInfo = document.createElement('fieldset');
        groupsInfo.style.border = 'none';
        groupsInfo.style.marginBottom = '1.5rem';
        groupsInfo.style.padding = '1rem';
        groupsInfo.style.background = '#fff';
        groupsInfo.style.borderRadius = '6px';

        const groupsLegend = document.createElement('legend');
        groupsLegend.textContent = 'Arbetgrupper *';
        groupsLegend.style.fontWeight = '600';
        groupsLegend.style.marginBottom = '1rem';
        groupsInfo.appendChild(groupsLegend);

        const groupsContainer = document.createElement('div');
        groupsContainer.id = 'personal-groups';
        groupsContainer.style.display = 'grid';
        groupsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        groupsContainer.style.gap = '1rem';

        if (groups.length === 0) {
            const noGroupsMsg = document.createElement('p');
            noGroupsMsg.textContent = 'Ingen grupper definierade. Skapa grupper först.';
            noGroupsMsg.style.color = '#999';
            noGroupsMsg.style.fontStyle = 'italic';
            groupsContainer.appendChild(noGroupsMsg);
        } else {
            groups.forEach(group => {
                const checkbox = document.createElement('label');
                checkbox.style.display = 'flex';
                checkbox.style.alignItems = 'center';
                checkbox.style.gap = '0.5rem';
                checkbox.style.cursor = 'pointer';
                checkbox.style.padding = '0.5rem';
                checkbox.style.border = '1px solid #ddd';
                checkbox.style.borderRadius = '6px';
                checkbox.style.transition = 'all 0.2s';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'group-checkbox';
                input.value = group.id;
                input.style.cursor = 'pointer';

                const span = document.createElement('span');
                span.textContent = group.name;

                checkbox.appendChild(input);
                checkbox.appendChild(span);

                checkbox.onmouseover = () => {
                    checkbox.style.background = '#f9f9f9';
                };
                checkbox.onmouseout = () => {
                    checkbox.style.background = 'transparent';
                };

                groupsContainer.appendChild(checkbox);
            });
        }

        groupsInfo.appendChild(groupsContainer);
        container.appendChild(groupsInfo);

        // === AVAILABILITY ===
        const availabilityInfo = document.createElement('fieldset');
        availabilityInfo.style.border = 'none';
        availabilityInfo.style.marginBottom = '1.5rem';
        availabilityInfo.style.padding = '1rem';
        availabilityInfo.style.background = '#fff';
        availabilityInfo.style.borderRadius = '6px';

        const availabilityLegend = document.createElement('legend');
        availabilityLegend.textContent = 'Tillgänglighet (vecka)';
        availabilityLegend.style.fontWeight = '600';
        availabilityLegend.style.marginBottom = '1rem';
        availabilityInfo.appendChild(availabilityLegend);

        const availabilityContainer = document.createElement('div');
        availabilityContainer.id = 'personal-availability';
        availabilityContainer.style.display = 'flex';
        availabilityContainer.style.gap = '0.5rem';
        availabilityContainer.style.flexWrap = 'wrap';

        DAYS_OF_WEEK.forEach((day, index) => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '0.5rem';
            label.style.cursor = 'pointer';
            label.style.padding = '0.5rem 1rem';
            label.style.background = '#f0f0f0';
            label.style.borderRadius = '6px';
            label.style.transition = 'all 0.2s';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'availability-checkbox';
            checkbox.value = index;
            checkbox.checked = index < 5; // Mån-Fre as default
            checkbox.style.cursor = 'pointer';

            const span = document.createElement('span');
            span.textContent = day;

            label.appendChild(checkbox);
            label.appendChild(span);

            label.onmouseover = () => {
                label.style.background = '#e0e0e0';
            };
            label.onmouseout = () => {
                label.style.background = checkbox.checked ? '#d4e6ff' : '#f0f0f0';
            };

            checkbox.onchange = () => {
                label.style.background = checkbox.checked ? '#d4e6ff' : '#f0f0f0';
            };

            availabilityContainer.appendChild(label);
        });

        availabilityInfo.appendChild(availabilityContainer);
        container.appendChild(availabilityInfo);

        // === BUTTONS ===
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.gap = '1rem';
        buttonGroup.style.marginTop = '1.5rem';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = '➕ Lägg till';

        const resetBtn = document.createElement('button');
        resetBtn.type = 'reset';
        resetBtn.className = 'btn btn-secondary';
        resetBtn.textContent = '🔄 Rensa';

        buttonGroup.appendChild(submitBtn);
        buttonGroup.appendChild(resetBtn);

        // Error message
        const errorDiv = document.createElement('div');
        errorDiv.id = 'personal-error';
        errorDiv.style.marginTop = '1rem';

        // Create form wrapper
        const form = document.createElement('form');
        form.id = 'personal-form';

        form.appendChild(basicInfo);
        form.appendChild(employmentInfo);
        form.appendChild(sectorInfo);
        form.appendChild(salaryInfo);
        form.appendChild(groupsInfo);
        form.appendChild(availabilityInfo);
        form.appendChild(buttonGroup);
        form.appendChild(errorDiv);

        container.appendChild(form);

        // Setup form listener
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            addPerson(form, errorDiv, store, ctx, mainContainer);
        });

    } catch (err) {
        console.error('❌ Error rendering add form:', err);
        throw err;
    }
}

/**
 * Render SEARCH/MANAGE tab
 */
function renderSearchPanel(container, store, ctx, mainContainer, groups, people) {
    try {
        // === SEARCH BAR ===
        const searchDiv = document.createElement('div');
        searchDiv.style.marginBottom = '1.5rem';
        searchDiv.style.padding = '1rem';
        searchDiv.style.background = '#fff';
        searchDiv.style.borderRadius = '6px';

        const searchLabel = document.createElement('label');
        searchLabel.textContent = 'Sök personal:';
        searchLabel.style.display = 'block';
        searchLabel.style.marginBottom = '0.5rem';
        searchLabel.style.fontWeight = '600';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'personal-search';
        searchInput.placeholder = 'Skriv namn eller e-post...';
        searchInput.style.width = '100%';
        searchInput.style.padding = '0.75rem';
        searchInput.style.border = '1px solid #ddd';
        searchInput.style.borderRadius = '6px';
        searchInput.style.fontSize = '1rem';

        searchDiv.appendChild(searchLabel);
        searchDiv.appendChild(searchInput);
        container.appendChild(searchDiv);

        // === RESULTS AREA ===
        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'personal-results';

        container.appendChild(resultsDiv);

        // Initial render
        renderPersonList(resultsDiv, people, groups, store, ctx, mainContainer, '');

        // Search listener
        searchInput.addEventListener('input', (e) => {
            const query = (e.target.value || '').toLowerCase();
            renderPersonList(resultsDiv, people, groups, store, ctx, mainContainer, query);
        });

    } catch (err) {
        console.error('❌ Error rendering search panel:', err);
        throw err;
    }
}

/**
 * Render person list with search filter
 */
function renderPersonList(container, people, groups, store, ctx, mainContainer, searchQuery) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Filter people based on search
    const filtered = people.filter(p => {
        if (!searchQuery) return true;
        const name = (p.name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        return name.includes(searchQuery) || email.includes(searchQuery);
    });

    if (filtered.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = searchQuery 
            ? `Ingen personal hittad med "${searchQuery}"`
            : 'Ingen personal definierad';
        emptyMsg.style.color = '#999';
        emptyMsg.style.fontStyle = 'italic';
        emptyMsg.style.padding = '2rem 1rem';
        emptyMsg.style.textAlign = 'center';
        container.appendChild(emptyMsg);
        return;
    }

    // Create table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.background = '#fff';
    table.style.borderRadius = '6px';
    table.style.overflow = 'hidden';

    // Table head
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.style.background = '#f0f0f0';
    headRow.style.borderBottom = '2px solid #ddd';

    const headers = ['Namn', 'E-post', 'Sektor', 'År', 'Tjänstgöringsgrad', 'Åtgärder'];
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.style.padding = '1rem';
        th.style.textAlign = 'left';
        th.style.fontWeight = '600';
        th.style.color = '#333';
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    filtered.forEach((person, index) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #eee';
        if (index % 2 === 0) row.style.background = '#fafafa';

        // Name
        const nameCell = document.createElement('td');
        nameCell.textContent = person.name;
        nameCell.style.padding = '1rem';
        row.appendChild(nameCell);

        // Email
        const emailCell = document.createElement('td');
        emailCell.textContent = person.email;
        emailCell.style.padding = '1rem';
        emailCell.style.fontSize = '0.9rem';
        emailCell.style.color = '#666';
        row.appendChild(emailCell);

        // Sector
        const sectorCell = document.createElement('td');
        const sectorName = person.sector === 'municipal' ? 'Kommunal' : 'Privat';
        sectorCell.textContent = sectorName;
        sectorCell.style.padding = '1rem';
        sectorCell.style.fontSize = '0.9rem';
        row.appendChild(sectorCell);

        // Years
        const yearsEmployed = calculateYearsEmployed(person.startDate, person.sector || 'private');
        const yearsCell = document.createElement('td');
        yearsCell.textContent = yearsEmployed;
        yearsCell.style.padding = '1rem';
        yearsCell.style.fontSize = '0.9rem';
        row.appendChild(yearsCell);

        // Degree
        const degreeCell = document.createElement('td');
        degreeCell.textContent = `${person.degree || 100}%`;
        degreeCell.style.padding = '1rem';
        degreeCell.style.fontSize = '0.9rem';
        row.appendChild(degreeCell);

        // Actions
        const actionsCell = document.createElement('td');
        actionsCell.style.padding = '1rem';
        actionsCell.style.whiteSpace = 'nowrap';

        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️ Redigera';
        editBtn.className = 'btn btn-secondary';
        editBtn.style.padding = '0.5rem 0.75rem';
        editBtn.style.fontSize = '0.85rem';
        editBtn.style.marginRight = '0.5rem';
        editBtn.onclick = (e) => {
            e.preventDefault();
            editPerson(person, store, ctx, mainContainer);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Ta bort';
        deleteBtn.className = 'btn btn-secondary';
        deleteBtn.style.padding = '0.5rem 0.75rem';
        deleteBtn.style.fontSize = '0.85rem';
        deleteBtn.style.background = '#f8d7da';
        deleteBtn.style.color = '#721c24';
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            deletePerson(person.id, store, ctx, mainContainer);
        };

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
        row.appendChild(actionsCell);

        // Hover effect
        row.onmouseover = () => {
            row.style.background = '#f0f4ff';
        };
        row.onmouseout = () => {
            row.style.background = index % 2 === 0 ? '#fafafa' : '#fff';
        };

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

/**
 * Create a form group helper
 */
function createFormGroup(id, label, type, placeholder) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const labelEl = document.createElement('label');
    labelEl.setAttribute('for', id);
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.className = 'form-control';
    input.placeholder = placeholder;

    group.appendChild(labelEl);
    group.appendChild(input);

    return group;
}

/**
 * Format date to Swedish format
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('sv');
    } catch {
        return dateStr;
    }
}

/**
 * Add new person
 */
function addPerson(form, errorDiv, store, ctx, mainContainer) {
    try {
        while (errorDiv.firstChild) {
            errorDiv.removeChild(errorDiv.firstChild);
        }

        // Get values
        const name = (form.querySelector('#personal-name')?.value || '').trim();
        const email = (form.querySelector('#personal-email')?.value || '').trim();
        const phone = (form.querySelector('#personal-phone')?.value || '').trim();
        const startDate = form.querySelector('#personal-start-date')?.value;
        const degree = parseInt(form.querySelector('#personal-degree')?.value || 100);
        const workdaysPerWeek = parseInt(form.querySelector('#personal-workdays')?.value || 5);
        const salary = parseInt(form.querySelector('#personal-salary')?.value || 0);
        const savedVacation = parseInt(form.querySelector('#personal-saved-vacation')?.value || 0);
        const savedLeave = parseInt(form.querySelector('#personal-saved-leave')?.value || 0);
        const sector = document.querySelector('input[name="sector"]:checked')?.value || 'private';

        // Get selected groups
        const groupIds = Array.from(document.querySelectorAll('.group-checkbox:checked'))
            .map(cb => cb.value);

        // Get availability
        const availability = Array.from(document.querySelectorAll('.availability-checkbox'))
            .map(cb => cb.checked);

        // Validate
        if (!name || name.length < 2) {
            throw new Error('Namn krävs (min 2 tecken)');
        }
        if (!email || !email.includes('@')) {
            throw new Error('Giltigt e-postadress krävs');
        }
        if (!startDate) {
            throw new Error('Startdatum krävs');
        }

        const state = store.getState();
        const people = state.people || [];

        // Check duplicate email
        if (people.some(p => p.email.toLowerCase() === email.toLowerCase())) {
            throw new Error('E-postadressen finns redan');
        }

        // Create person
        const newPerson = {
            id: `person_${Date.now()}`,
            name,
            email,
            phone: phone || null,
            startDate,
            degree,
            workdaysPerWeek,
            salary,
            savedVacationDays: savedVacation,
            savedLeaveDays: savedLeave,
            sector,
            groupIds,
            availability,
            usedVacationDays: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        store.setState({
            ...state,
            people: [...people, newPerson]
        });

        console.log('✓ Person tillagd:', newPerson);
        showSuccess('✓ Personal tillagd');
        form.reset();
        renderPersonal(mainContainer.closest('[class*="container"]'), ctx);

    } catch (err) {
        console.error('❌ Error adding person:', err);
        displayError(errorDiv, err.message);
        showWarning(`⚠️ ${err.message}`);
    }
}

/**
 * Edit person
 */
function editPerson(person, store, ctx, mainContainer) {
    try {
        console.log('✏️ Redigerar person:', person.id);
        const newName = prompt('Namn:', person.name);
        if (newName === null) return;

        const newEmail = prompt('E-post:', person.email);
        if (newEmail === null) return;

        if (!newName || newName.length < 2) throw new Error('Namn krävs');
        if (!newEmail || !newEmail.includes('@')) throw new Error('Giltigt e-postadress krävs');

        const state = store.getState();
        const people = state.people || [];

        if (people.some(p => p.email.toLowerCase() === newEmail.toLowerCase() && p.id !== person.id)) {
            throw new Error('E-postadressen finns redan');
        }

        const updatedPeople = people.map(p => 
            p.id === person.id ? { 
                ...p, 
                name: newName, 
                email: newEmail, 
                updatedAt: new Date().toISOString() 
            } : p
        );

        store.setState({ ...state, people: updatedPeople });
        console.log('✓ Person uppdaterad');
        showSuccess('✓ Personal uppdaterad');
        renderPersonal(mainContainer.closest('[class*="container"]'), ctx);

    } catch (err) {
        console.error('❌ Error editing person:', err);
        showWarning(`⚠️ ${err.message}`);
    }
}

/**
 * Delete person
 */
function deletePerson(personId, store, ctx, mainContainer) {
    try {
        if (!confirm('Är du säker på att du vill ta bort denna person?')) return;

        const state = store.getState();
        store.setState({
            ...state,
            people: (state.people || []).filter(p => p.id !== personId)
        });

        console.log('✓ Person borttagen');
        showSuccess('✓ Personal borttagen');
        renderPersonal(mainContainer.closest('[class*="container"]'), ctx);

    } catch (err) {
        console.error('❌ Error deleting person:', err);
        showWarning(`⚠️ ${err.message}`);
    }
}

/**
 * Display error
 */
function displayError(container, message) {
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';

    const msg = document.createElement('p');
    msg.textContent = `Fel: ${message}`;
    msg.style.margin = '0';

    errorDiv.appendChild(msg);
    container.appendChild(errorDiv);
}
