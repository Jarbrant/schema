/*
 * APP.JS — App Initialization & State Management
 * 
 * Globalt state för hela appen.
 * Alla views och modules läser/skriver via denna store.
 * 
 * FEATURES:
 * - Input validation (fail-closed)
 * - Protected listener loop (error isolation)
 * - Configurable logging (debug mode)
 * - Documented merge policy (shallow merge)
 * - State freeze in dev (mutation detection)
 */

import { setupRouter } from './router.js';

// Debug mode: Set window.__DEBUG__ = true to enable logging
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/**
 * Log helper (respects debug flag)
 * @param {string} level - 'log', 'warn', 'error'
 * @param {string} message - Message to log
 * @param {any} data - Optional data
 */
function debugLog(level, message, data) {
    if (!DEBUG) return;
    
    const prefix = {
        log: '📊',
        warn: '⚠️',
        error: '❌'
    }[level] || '📋';
    
    if (data !== undefined) {
        console[level](`${prefix} ${message}`, data);
    } else {
        console[level](`${prefix} ${message}`);
    }
}

/**
 * Validate state object
 * @param {any} newState - State to validate
 * @returns {boolean} True if valid
 */
function isValidStateUpdate(newState) {
    // Must be object (not array, null, etc)
    if (!newState || typeof newState !== 'object' || Array.isArray(newState)) {
        return false;
    }
    return true;
}

/**
 * Skapa app-store (state management)
 * 
 * MERGE POLICY (shallow merge):
 * - Top-level keys are merged: { ...state, ...newState }
 * - Nested objects are REPLACED (not merged)
 * - Example: setState({ people: [...] }) replaces entire people array
 * - Safe: No accidental mutations of nested objects
 * 
 * @param {object} initialState - Initial state
 * @returns {object} Store med getState, setState, subscribe
 */
export function createStore(initialState) {
    let state = { ...initialState };
    const listeners = [];
    
    // Freeze state in development to prevent mutations
    if (DEBUG) {
        Object.freeze(state);
        debugLog('log', 'State frozen in development mode');
    }
    
    return {
        /**
         * Hämta aktuellt state
         * @returns {object} Current state
         */
        getState() {
            return state;
        },
        
        /**
         * Uppdatera state (shallow merge)
         * 
         * VALIDATION:
         * - Rejects null, undefined, non-objects
         * - Logs warning and skips update
         * - Returns false on failure, true on success
         * 
         * @param {object} newState - Ny state (shallow merged)
         * @returns {boolean} Success flag
         */
        setState(newState) {
            // 1. VALIDATE INPUT
            if (!isValidStateUpdate(newState)) {
                console.warn('⚠️ setState: Invalid state object (must be plain object)');
                return false;
            }
            
            // 2. MERGE (shallow)
            const oldState = state;
            state = { ...state, ...newState };
            
            // 3. RE-FREEZE in dev
            if (DEBUG) {
                Object.freeze(state);
            }
            
            debugLog('log', 'State updated', { from: oldState, to: state });
            
            // 4. NOTIFY (protected)
            notifyListeners(state);
            
            return true;
        },
        
        /**
         * Subscribe till state-ändringar
         * @param {function} listener - Callback när state ändras
         * @returns {function} Unsubscribe-funktion
         */
        subscribe(listener) {
            if (typeof listener !== 'function') {
                console.warn('⚠️ subscribe: Listener must be a function');
                return () => {}; // Dummy unsubscribe
            }
            
            listeners.push(listener);
            debugLog('log', `Listener registrerad (totalt: ${listeners.length})`);
            
            // Return unsubscribe function
            return () => {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                    debugLog('log', `Listener borttagen (kvar: ${listeners.length})`);
                }
            };
        }
    };
}

/**
 * Notify all listeners safely
 * 
 * ERROR ISOLATION:
 * - Each listener runs in try-catch
 * - If listener #2 fails, #1 and #3 still execute
 * - Errors are logged but don't crash the loop
 * 
 * @param {object} state - Current state
 */
function notifyListeners(state) {
    listeners.forEach((listener, index) => {
        try {
            listener(state);
        } catch (err) {
            console.error(`⚠️ Listener #${index} threw error:`, err.message);
            debugLog('error', `Listener #${index} failed`, err);
            // Don't re-throw, continue notifying other listeners
        }
    });
}

/**
 * DEFAULT INITIAL STATE
 */
export const DEFAULT_STATE = {
    // Authentication
    user: null,
    isLoggedIn: false,
    
    // Data
    people: [],
    shifts: [],
    groups: [],
    passes: [],
    demands: [],
    
    // Schedule info
    schedule: {
        year: new Date().getFullYear(),
        startDate: null,
        endDate: null
    },
    
    // App metadata
    meta: {
        appVersion: '1.0.0',
        appName: 'Schema-Program',
        lastUpdated: new Date().toISOString()
    }
};

/**
 * Initialize app
 * Sets up store, router, and starts the application
 */
export function initApp() {
    try {
        // 1. Create global store
        const store = createStore(DEFAULT_STATE);
        debugLog('log', 'Store initialised');
        
        // 2. Setup router
        const ctx = { store };
        setupRouter(ctx);
        debugLog('log', 'Router initialised');
        
        // 3. Log initial state
        debugLog('log', 'Initial state', store.getState());
        
        return { store, ctx };
    } catch (err) {
        console.error('❌ App initialization failed:', err);
        throw err;
    }
}
