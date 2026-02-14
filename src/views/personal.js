/*
 * PERSONAL.JS — Personal Management View (COMPLETE v2)
 * 
 * Displays and manages people in the system.
 * - Add new person
 * - Edit person
 * - Delete person
 * - View all people
 * Uses store.setState() (NOT store.update())
 */

import { showSuccess, showWarning } from '../ui.js';
import { reportError } from '../diagnostics.js';

export function renderPersonal(container, ctx) {
    try {
        if (!container) {
            throw new Error('Container missing');
        }

        const store = ctx?.store;
        if (!store) {
            throw new Error('Store missing');
        }

        const state = store.getState();
        const people = state.people || [];

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Create page structure
        const viewContainer = document.createElement('div');
        viewContainer.className = 'view-container';

        // Header
        const header = document.createElement('div');
        header.className = 'section-header';

        const title = document.createElement('h1');
        title.textContent = '👤 Personal';

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Hantera personallistan för schemasystemet';

        header.appendChild(title);
        header.appendChild(subtitle);

        // Status row
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

        // Form section
        const formSection = document.createElement('div');
        formSection.className = 'section-header';
        formSection.style.marginTop = '2rem';

        const formTitle = document.createElement('h2');
        formTitle.textContent = 'Lägg till ny personal';

        formSection.appendChild(formTitle);

        // Form
        const form = document.createElement('form');
        form.id = 'personal-form';
        form.style.background = '#f9f9f9';
        form.style.padding = '1.5rem';
        form.style.borderRadius = '8px';

        // Name field
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';

        const nameLabel = document.createElement('label');
        nameLabel.setAttribute('for', 'personal-name');
        nameLabel.textContent = 'Namn *';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'personal-name';
        nameInput.className = 'form-control';
        nameInput.placeholder = 'Ex: Anna Ström';
        nameInput.required = true;

        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        form.appendChild(nameGroup);

        // Email field
        const emailGroup = document.createElement('div');
        emailGroup.className = 'form-group';

        const emailLabel = document.createElement('label');
        emailLabel.setAttribute('for', 'personal-email');
        emailLabel.textContent = 'E-post *';

        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'personal-email';
        emailInput.className = 'form-control';
        emailInput.placeholder = 'anna@example.com';
        emailInput.required = true;

        emailGroup.appendChild(emailLabel);
        emailGroup.appendChild(emailInput);
        form.appendChild(emailGroup);

        // Phone field
        const phoneGroup = document.createElement('div');
        phoneGroup.className = 'form-group';

        const phoneLabel = document.createElement('label');
        phoneLabel.setAttribute('for', 'personal-phone');
        phoneLabel.textContent = 'Telefon';

        const phoneInput = document.createElement('input');
        phoneInput.type = 'tel';
        phoneInput.id = 'personal-phone';
        phoneInput.className = 'form-control';
        phoneInput.placeholder = '+46 70 123 45 67';

        phoneGroup.appendChild(phoneLabel);
        phoneGroup.appendChild(phoneInput);
        form.appendChild(phoneGroup);

        // Role field
        const roleGroup = document.createElement('div');
        roleGroup.className = 'form-group';

        const roleLabel = document.createElement('label');
        roleLabel.setAttribute('for', 'personal-role');
        roleLabel.textContent = 'Roll/Titel';

        const roleInput = document.createElement('input');
        roleInput.type = 'text';
        roleInput.id = 'personal-role';
        roleInput.className = 'form-control';
        roleInput.placeholder = 'Ex: Projektledare, Utvecklare';

        roleGroup.appendChild(roleLabel);
        roleGroup.appendChild(roleInput);
        form.appendChild(roleGroup);

        // Button group
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.gap = '1rem';
        buttonGroup.style.marginTop = '1rem';

        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = '➕ Lägg till';

        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.type = 'reset';
        resetBtn.className = 'btn btn-secondary';
        resetBtn.textContent = '🔄 Rensa';

        buttonGroup.appendChild(submitBtn);
        buttonGroup.appendChild(resetBtn);
        form.appendChild(buttonGroup);

        // Error message div
        const errorDiv = document.createElement('div');
        errorDiv.id = 'personal-error';
        errorDiv.style.marginTop = '1rem';
        form.appendChild(errorDiv);

        // Setup form listener
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            addPerson(form, errorDiv, store, ctx, container);
        });

        // People list section
        const listSection = document.createElement('div');
        listSection.className = 'section-header';
        listSection.style.marginTop = '2rem';

        const listTitle = document.createElement('h2');
        if (people.length === 0) {
            listTitle.textContent = 'Aktiva (0)';
        } else if (people.length === 1) {
            listTitle.textContent = 'Aktiva (1)';
        } else {
            listTitle.textContent = `Aktiva (${people.length})`;
        }

        listSection.appendChild(listTitle);

        // People list
        const list = document.createElement('div');
        list.id = 'personal-list';
        list.style.marginTop = '1rem';

        if (people.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'Ingen personal.';
            emptyMsg.style.color = '#999';
            emptyMsg.style.fontStyle = 'italic';
            list.appendChild(emptyMsg);
        } else {
            // Create table for people
            const table = document.createElement('table');
            table.className = 'people-table';
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.marginTop = '1rem';

            // Table head
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            headRow.style.background = '#f0f0f0';
            headRow.style.borderBottom = '2px solid #ddd';

            const headers = ['Namn', 'E-post', 'Telefon', 'Roll', 'Åtgärder'];
            headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                th.style.padding = '0.75rem';
                th.style.textAlign = 'left';
                th.style.fontWeight = '600';
                th.style.color = '#333';
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);

            // Table body
            const tbody = document.createElement('tbody');
            people.forEach((person, index) => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #eee';

                // Name
                const nameCell = document.createElement('td');
                nameCell.textContent = person.name || '-';
                nameCell.style.padding = '0.75rem';
                nameCell.style.color = '#333';
                row.appendChild(nameCell);

                // Email
                const emailCell = document.createElement('td');
                emailCell.textContent = person.email || '-';
                emailCell.style.padding = '0.75rem';
                emailCell.style.color = '#666';
                emailCell.style.fontSize = '0.9rem';
                row.appendChild(emailCell);

                // Phone
                const phoneCell = document.createElement('td');
                phoneCell.textContent = person.phone || '-';
                phoneCell.style.padding = '0.75rem';
                phoneCell.style.color = '#666';
                phoneCell.style.fontSize = '0.9rem';
                row.appendChild(phoneCell);

                // Role
                const roleCell = document.createElement('td');
                roleCell.textContent = person.role || '-';
                roleCell.style.padding = '0.75rem';
                roleCell.style.color = '#666';
                roleCell.style.fontSize = '0.9rem';
                row.appendChild(roleCell);

                // Actions
                const actionsCell = document.createElement('td');
                actionsCell.style.padding = '0.75rem';
                actionsCell.style.whiteSpace = 'nowrap';

                // Edit button
                const editBtn = document.createElement('button');
                editBtn.textContent = '✏️ Redigera';
                editBtn.className = 'btn btn-secondary';
                editBtn.style.padding = '0.5rem 0.75rem';
                editBtn.style.fontSize = '0.85rem';
                editBtn.style.marginRight = '0.5rem';
                editBtn.onclick = (e) => {
                    e.preventDefault();
                    editPerson(person, store, ctx, container);
                };

                // Delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️ Ta bort';
                deleteBtn.className = 'btn btn-secondary';
                deleteBtn.style.padding = '0.5rem 0.75rem';
                deleteBtn.style.fontSize = '0.85rem';
                deleteBtn.style.background = '#f8d7da';
                deleteBtn.style.color = '#721c24';
                deleteBtn.onclick = (e) => {
                    e.preventDefault();
                    deletePerson(person.id, store, ctx, container);
                };

                actionsCell.appendChild(editBtn);
                actionsCell.appendChild(deleteBtn);
                row.appendChild(actionsCell);

                // Hover effect
                row.onmouseover = () => {
                    row.style.background = '#f9f9f9';
                };
                row.onmouseout = () => {
                    row.style.background = 'transparent';
                };

                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            list.appendChild(table);
        }

        // Assemble page
        viewContainer.appendChild(header);
        viewContainer.appendChild(statusRow);
        viewContainer.appendChild(formSection);
        viewContainer.appendChild(form);
        viewContainer.appendChild(listSection);
        viewContainer.appendChild(list);

        container.appendChild(viewContainer);

        console.log('✓ Personal view rendered');

    } catch (err) {
        console.error('❌ Error rendering personal:', err);
        reportError(
            'PERSONAL_RENDER_ERROR',
            'PERSONAL_VIEW',
            'src/views/personal.js',
            'Personal-sidan kunde inte renderas'
        );
    }
}

/**
 * Add new person to store
 */
function addPerson(form, errorDiv, store, ctx, container) {
    try {
        // Clear previous error
        while (errorDiv.firstChild) {
            errorDiv.removeChild(errorDiv.firstChild);
        }

        // Get form values
        const nameInput = form.querySelector('#personal-name');
        const emailInput = form.querySelector('#personal-email');
        const phoneInput = form.querySelector('#personal-phone');
        const roleInput = form.querySelector('#personal-role');

        const name = (nameInput?.value || '').trim();
        const email = (emailInput?.value || '').trim();
        const phone = (phoneInput?.value || '').trim();
        const role = (roleInput?.value || '').trim();

        // Validate
        if (!name || name.length < 2) {
            showWarning('⚠️ Namn krävs (min 2 tecken)');
            displayError(errorDiv, 'Namn krävs (min 2 tecken)');
            return;
        }

        if (!email || !email.includes('@')) {
            showWarning('⚠️ Giltigt e-postadress krävs');
            displayError(errorDiv, 'Giltigt e-postadress krävs');
            return;
        }

        // Get current state
        const state = store.getState();
        const people = state.people || [];

        // Check for duplicates
        const isDuplicate = people.some(p => p.email.toLowerCase() === email.toLowerCase());
        if (isDuplicate) {
            showWarning('⚠️ E-postadressen finns redan');
            displayError(errorDiv, 'E-postadressen finns redan');
            return;
        }

        // Create new person
        const newPerson = {
            id: `person_${Date.now()}`,
            name: name,
            email: email,
            phone: phone || null,
            role: role || null,
            createdAt: new Date().toISOString()
        };

        // Update store using setState (NOT store.update)
        store.setState({
            ...state,
            people: [...people, newPerson]
        });

        console.log('✓ Person added:', newPerson);
        showSuccess('✓ Personal tillagd');

        // Reset form
        form.reset();

        // Re-render personal view
        renderPersonal(container.closest('[class*="container"]'), ctx);

    } catch (err) {
        console.error('❌ Error adding person:', err);
        reportError(
            'PERSONAL_ADD_ERROR',
            'PERSONAL_VIEW',
            'src/views/personal.js',
            `Kunde inte lägga till personal: ${err.message}`
        );
        displayError(errorDiv, `Fel: ${err.message}`);
        showWarning('⚠️ Kunde inte lägga till personal');
    }
}

/**
 * Edit existing person
 */
function editPerson(person, store, ctx, container) {
    try {
        console.log('✏️ Redigerar person:', person.id);

        // Get new values (simplified - shows prompt dialogs)
        const newName = prompt('Namn:', person.name);
        if (newName === null) return; // Cancelled

        const newEmail = prompt('E-post:', person.email);
        if (newEmail === null) return; // Cancelled

        const newPhone = prompt('Telefon:', person.phone || '');
        const newRole = prompt('Roll:', person.role || '');

        // Validate
        if (!newName || newName.length < 2) {
            showWarning('⚠️ Namn krävs (min 2 tecken)');
            return;
        }

        if (!newEmail || !newEmail.includes('@')) {
            showWarning('⚠️ Giltigt e-postadress krävs');
            return;
        }

        // Get current state
        const state = store.getState();
        const people = state.people || [];

        // Check for duplicate email (but allow same person)
        const isDuplicate = people.some(p => 
            p.email.toLowerCase() === newEmail.toLowerCase() && p.id !== person.id
        );
        if (isDuplicate) {
            showWarning('⚠️ E-postadressen finns redan');
            return;
        }

        // Update person
        const updatedPeople = people.map(p => {
            if (p.id === person.id) {
                return {
                    ...p,
                    name: newName,
                    email: newEmail,
                    phone: newPhone || null,
                    role: newRole || null,
                    updatedAt: new Date().toISOString()
                };
            }
            return p;
        });

        store.setState({
            ...state,
            people: updatedPeople
        });

        console.log('✓ Person uppdaterad');
        showSuccess('✓ Personal uppdaterad');

        // Re-render
        renderPersonal(container.closest('[class*="container"]'), ctx);

    } catch (err) {
        console.error('❌ Error editing person:', err);
        reportError(
            'PERSONAL_EDIT_ERROR',
            'PERSONAL_VIEW',
            'src/views/personal.js',
            `Kunde inte redigera personal: ${err.message}`
        );
        showWarning('⚠️ Kunde inte redigera personal');
    }
}

/**
 * Delete person from store
 */
function deletePerson(personId, store, ctx, container) {
    try {
        // Confirm deletion
        const confirmed = confirm('Är du säker på att du vill ta bort denna person?');
        if (!confirmed) return;

        console.log('🗑️ Tar bort person:', personId);

        // Get current state
        const state = store.getState();
        const people = state.people || [];

        // Filter out deleted person
        const updatedPeople = people.filter(p => p.id !== personId);

        store.setState({
            ...state,
            people: updatedPeople
        });

        console.log('✓ Person borttagen');
        showSuccess('✓ Personal borttagen');

        // Re-render
        renderPersonal(container.closest('[class*="container"]'), ctx);

    } catch (err) {
        console.error('❌ Error deleting person:', err);
        reportError(
            'PERSONAL_DELETE_ERROR',
            'PERSONAL_VIEW',
            'src/views/personal.js',
            `Kunde inte ta bort personal: ${err.message}`
        );
        showWarning('⚠️ Kunde inte ta bort personal');
    }
}

/**
 * Display error message safely
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
