/*
 * APP.JS — App Initialization & State Management
 */

import { setupRouter } from './router.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

function debugLog(level, message, data) {
    if (!DEBUG) return;
    const prefix = { log: '📊', warn: '⚠️', error: '❌' }[level] || '📋';
    if (data !== undefined) {
        console[level](`${prefix} ${message}`, data);
    } else {
        console[level](`${prefix} ${message}`);
    }
}

function isValidStateUpdate(newState) {
    if (!newState || typeof newState !== 'object' || Array.isArray(newState)) {
        return false;
    }
    return true;
}

export function createStore(initialState) {
    let state = { ...initialState };
    const listeners = [];
    
    if (DEBUG) {
        Object.freeze(state);
        debugLog('log', 'State frozen in development mode');
    }
    
    return {
        getState() {
            return state;
        },
        
        setState(newState) {
            if (!isValidStateUpdate(newState)) {
                console.warn('⚠️ setState: Invalid state object');
                return false;
            }
            
            const oldState = state;
            state = { ...state, ...newState };
            
            if (DEBUG) {
                Object.freeze(state);
            }
            
            debugLog('log', 'State updated', { from: oldState, to: state });
            notifyListeners(state);
            return true;
        },
        
        subscribe(listener) {
            if (typeof listener !== 'function') {
                console.warn('⚠️ subscribe: Listener must be a function');
                return () => {};
            }
            
            listeners.push(listener);
            debugLog('log', `Listener registered (total: ${listeners.length})`);
            
            return () => {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                    debugLog('log', `Listener removed (remaining: ${listeners.length})`);
                }
            };
        }
    };
}

function notifyListeners(state) {
    listeners.forEach((listener, index) => {
        try {
            listener(state);
        } catch (err) {
            console.error(`⚠️ Listener #${index} error:`, err.message);
            debugLog('error', `Listener #${index} failed`, err);
        }
    });
}

export const DEFAULT_STATE = {
    user: null,
    isLoggedIn: false,
    people: [],
    shifts: [],
    groups: [],
    passes: [],
    demands: [],
    schedule: {
        year: new Date().getFullYear(),
        startDate: null,
        endDate: null
    },
    meta: {
        appVersion: '1.0.0',
        appName: 'Schema-Program',
        lastUpdated: new Date().toISOString()
    }
};

export function initApp() {
    const store = createStore(DEFAULT_STATE);
    debugLog('log', 'Store created');
    
    // Setup router immediately (DOM should be ready)
    setupRouter(store);
    
    debugLog('log', 'App initialized');
    return { store };
}

const listeners = [];
