/*
 * PERSONAL.JS — Personal Management View
 * 
 * Displays and manages people in the system.
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
        nameLabel.textContent = 'Namn';

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
        emailLabel.textContent = 'E-post';

        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'personal-email';
        emailInput.className = 'form-control';
        emailInput.placeholder = 'anna@example.com';
        emailInput.required = true;

        emailGroup.appendChild(emailLabel);
        emailGroup.appendChild(emailInput);
        form.appendChild(emailGroup);

        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'btn btn-primary';
        submitBtn.textContent = '➕ Lägg till';

        form.appendChild(submitBtn);

        // Error message div
        const errorDiv = document.createElement('div');
        errorDiv.id = 'personal-error';
        errorDiv.style.marginTop = '1rem';
        form.appendChild(errorDiv);

        // Setup form listener
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            addPerson(form, errorDiv, store);
        });

        // People list section
        const listSection = document.createElement('div');
        listSection.className = 'section-header';
        listSection.style.marginTop = '2rem';

        const listTitle = document.createElement('h2');
        listTitle.textContent = 'Aktiva (0)';
        if (people.length > 0) {
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
            people.forEach(person => {
                const card = document.createElement('div');
                card.className = 'card';
                card.style.marginBottom = '1rem';
                card.style.padding = '1rem';
                card.style.background = '#fff';
                card.style.border = '1px solid #ddd';
                card.style.borderRadius = '6px';

                const name = document.createElement('h3');
                name.style.margin = '0 0 0.5rem 0';
                name.textContent = person.name || 'Unknown';

                const email = document.createElement('p');
                email.style.margin = '0';
                email.style.color = '#666';
                email.style.fontSize = '0.9rem';
                email.textContent = person.email || 'No email';

                card.appendChild(name);
                card.appendChild(email);
                list.appendChild(card);
            });
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
function addPerson(form, errorDiv, store) {
    try {
        // Clear previous error
        while (errorDiv.firstChild) {
            errorDiv.removeChild(errorDiv.firstChild);
        }

        // Get form values
        const nameInput = form.querySelector('#personal-name');
        const emailInput = form.querySelector('#personal-email');

        const name = (nameInput?.value || '').trim();
        const email = (emailInput?.value || '').trim();

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

        // Create new person
        const newPerson = {
            id: `person_${Date.now()}`,
            name: name,
            email: email,
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

        // Re-render (optional - depends on your setup)
        // For now, just show success

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

    errorDiv.appendChild(msg);
    container.appendChild(errorDiv);
}
