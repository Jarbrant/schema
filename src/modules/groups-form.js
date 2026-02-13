/*
 * GROUPS FORM — Form-hantering & event listeners
 */

import { validateGroupName, validatePassTime, validateGroupMembers } from './groups-validate.js';

/**
 * Setup event listeners för grupp-formulären
 */
export function setupGroupsEventListeners(container, store, ctx) {
    setupGroupFormSubmit(container, store, ctx);
    setupPassFormSubmit(container, store, ctx);
    setupTabNavigation(container, ctx);
    setupDeleteButtons(container, store, ctx);
}

/**
 * Setup grupp-form submit
 */
function setupGroupFormSubmit(container, store, ctx) {
    const form = container.querySelector('#group-form');
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const groupName = formData.get('name');
        
        // Validera
        const nameError = validateGroupName(groupName);
        if (nameError) {
            alert('❌ ' + nameError);
            return;
        }
        
        // Hämta valda personer
        const memberCheckboxes = form.querySelectorAll('input[name="members"]:checked');
        const members = Array.from(memberCheckboxes).map(cb => cb.value);
        
        const memberError = validateGroupMembers(members);
        if (memberError) {
            alert('❌ ' + memberError);
            return;
        }
        
        // Skapa grupp-objekt
        const newGroup = {
            id: Date.now().toString(),
            name: groupName,
            members: members,
            createdAt: new Date().toISOString()
        };
        
        // Lägg till i store
        const state = store.getState();
        const groups = state.groups || [];
        groups.push(newGroup);
        
        store.setState({
            ...state,
            groups: groups
        });
        
        // Rendera om
        const { renderGroups } = require('../views/groups.js');
        renderGroups(container, ctx);
        
        alert('✓ Grupp skapad!');
    });
}

/**
 * Setup grundpass-form submit
 */
function setupPassFormSubmit(container, store, ctx) {
    const form = container.querySelector('#pass-form');
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const startTime = formData.get('startTime');
        const endTime = formData.get('endTime');
        
        // Validera tid
        const timeError = validatePassTime(startTime, endTime);
        if (timeError) {
            alert('❌ ' + timeError);
            return;
        }
        
        // Skapa grundpass-objekt
        const newPass = {
            id: Date.now().toString(),
            name: formData.get('name'),
            startTime: startTime,
            endTime: endTime,
            breakStart: formData.get('breakStart') || null,
            breakEnd: formData.get('breakEnd') || null,
            color: formData.get('color') || '#667eea',
            costCenter: formData.get('costCenter') || '',
            workplace: formData.get('workplace') || '',
            createdAt: new Date().toISOString()
        };
        
        // Lägg till i store
        const state = store.getState();
        const passes = state.passes || [];
        passes.push(newPass);
        
        store.setState({
            ...state,
            passes: passes
        });
        
        // Rendera om
        const { renderGroups } = require('../views/groups.js');
        renderGroups(container, ctx);
        
        alert('✓ Grundpass skapat!');
    });
}

/**
 * Setup tab-navigation
 */
function setupTabNavigation(container, ctx) {
    const tabs = container.querySelectorAll('.groups-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            ctx.groupsTab = tab.dataset.tab;
            const { renderGroups } = require('../views/groups.js');
            renderGroups(container, ctx);
        });
    });
}

/**
 * Setup delete-buttons
 */
function setupDeleteButtons(container, store, ctx) {
    // Delete grupp
    const deleteGroupButtons = container.querySelectorAll('[data-action="delete-group"]');
    deleteGroupButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!confirm('Är du säker på att du vill radera denna grupp?')) return;
            
            const groupId = e.target.dataset.id;
            const state = store.getState();
            const groups = (state.groups || []).filter(g => g.id !== groupId);
            
            store.setState({ ...state, groups });
            
            const { renderGroups } = require('../views/groups.js');
            renderGroups(container, ctx);
        });
    });
    
    // Delete pass
    const deletePassButtons = container.querySelectorAll('[data-action="delete-pass"]');
    deletePassButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!confirm('Är du säker på att du vill radera detta grundpass?')) return;
            
            const passId = e.target.dataset.id;
            const state = store.getState();
            const passes = (state.passes || []).filter(p => p.id !== passId);
            
            store.setState({ ...state, passes });
            
            const { renderGroups } = require('../views/groups.js');
            renderGroups(container, ctx);
        });
    });
}
