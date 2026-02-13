/*
 * SHIFTS FORM — Form-hantering & event listeners
 */

/**
 * Setup event listeners för shifts-formuläret
 * @param {HTMLElement} container - Container-element
 * @param {object} store - App-store
 * @param {object} ctx - App-context
 */
export function setupShiftsEventListeners(container, store, ctx) {
    setupFormSubmit(container, store, ctx);
    setupTabNavigation(container, ctx);
    setupDeleteButtons(container, store, ctx);
}

/**
 * Setup form-submit listener
 */
function setupFormSubmit(container, store, ctx) {
    const form = container.querySelector('#shift-form');
    
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const newShift = {
            date: formData.get('date'),
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            personId: formData.get('personId'),
            role: formData.get('role'),
            location: formData.get('location'),
            notes: formData.get('notes')
        };
        
        // Validera innan sparande
        if (!newShift.date || !newShift.startTime || !newShift.endTime || !newShift.personId || !newShift.role) {
            alert('Alla obligatoriska fält måste fyllas i!');
            return;
        }
        
        // Lägg till i store
        const state = store.getState();
        const shifts = state.shifts || [];
        shifts.push(newShift);
        
        store.setState({
            ...state,
            shifts: shifts
        });
        
        // Rendera om
        const { renderShifts } = require('../views/shifts.js');
        renderShifts(container, ctx);
        
        alert('✓ Skift tillagt!');
    });
}

/**
 * Setup tab-navigation listeners
 */
function setupTabNavigation(container, ctx) {
    const tabs = container.querySelectorAll('.shifts-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            ctx.shiftTab = tab.dataset.tab;
            const { renderShifts } = require('../views/shifts.js');
            renderShifts(container, ctx);
        });
    });
}

/**
 * Setup delete-button listeners
 */
function setupDeleteButtons(container, store, ctx) {
    const deleteButtons = container.querySelectorAll('[data-action="delete"]');
    
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!confirm('Är du säker på att du vill radera detta skift?')) {
                return;
            }
            
            const index = e.target.dataset.id;
            const state = store.getState();
            const shifts = state.shifts || [];
            
            shifts.splice(index, 1);
            
            store.setState({
                ...state,
                shifts: shifts
            });
            
            const { renderShifts } = require('../views/shifts.js');
            renderShifts(container, ctx);
            
            alert('✓ Skift raderat!');
        });
    });
}
