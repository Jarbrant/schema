/* ============================================================
 * FIL: src/app.js
 * NAMN: APP.JS — App Initialization & State Management
 * SYFTE: Skapa global store + starta router på ett robust sätt.
 *
 * VIKTIGT (AUTOPATCH):
 * - FIX P0: listeners/notify låg i fel scope (UI kunde bli “död”)
 * - Ingen funktion tas bort. Endast robusthet + korrekt notify.
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports + Debug-flagga
 * ============================================================ */
import { setupRouter } from './router.js';

// DEBUG: styr loggar utan att spamma prod
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/* ============================================================
 * BLOCK 2 — Debug/log-hjälpare + validering
 * ============================================================ */
function debugLog(level, message, data) {
    if (!DEBUG) return;

    const prefix = { log: '📊', warn: '⚠️', error: '❌' }[level] || '📋';
    const fn = console[level] ? console[level].bind(console) : console.log.bind(console);

    if (data !== undefined) fn(`${prefix} ${message}`, data);
    else fn(`${prefix} ${message}`);
}

// GUARD: fail-closed light — stoppa uppenbart fel input till setState
function isValidStateUpdate(newState) {
    if (!newState || typeof newState !== 'object' || Array.isArray(newState)) return false;
    return true;
}

/* ============================================================
 * BLOCK 3 — Store (state management)
 * - Single source of truth för app-state
 * - subscribe() + notify() måste använda samma listeners-lista
 * ============================================================ */
export function createStore(initialState) {
    let state = { ...initialState };

    // SCOPE: listeners hör till just denna store-instans (inte globalt)
    const listeners = [];

    // DEBUG: gör mutationer synliga tidigt under utveckling
    if (DEBUG) {
        Object.freeze(state);
        debugLog('log', 'State frozen in development mode');
    }

    // GUARD: notify måste vara i samma scope som listeners
    function notify(nextState) {
        // ROBUST: en trasig listener får inte stoppa resten
        listeners.forEach((listener, index) => {
            try {
                listener(nextState);
            } catch (err) {
                console.error(`⚠️ Listener #${index} error:`, err?.message || err);
                debugLog('error', `Listener #${index} failed`, err);
            }
        });
    }

    return {
        /* ---------- BLOCK 3.1 — getState ---------- */
        getState() {
            return state;
        },

        /* ---------- BLOCK 3.2 — setState ---------- */
        setState(newState) {
            if (!isValidStateUpdate(newState)) {
                console.warn('⚠️ setState: Invalid state object');
                return false;
            }

            const oldState = state;
            state = { ...state, ...newState };

            if (DEBUG) Object.freeze(state);

            debugLog('log', 'State updated', { from: oldState, to: state });

            // FIX: notify kör rätt listeners (samma scope)
            notify(state);

            return true;
        },

        /* ---------- BLOCK 3.3 — subscribe ---------- */
        subscribe(listener) {
            if (typeof listener !== 'function') {
                console.warn('⚠️ subscribe: Listener must be a function');
                return () => {};
            }

            listeners.push(listener);
            debugLog('log', `Listener registered (total: ${listeners.length})`);

            // Returnera unsubscribe
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

/* ============================================================
 * BLOCK 4 — Default state
 * ============================================================ */
export const DEFAULT_STATE = {
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

/* ============================================================
 * BLOCK 5 — initApp (startpunkt)
 * - Skapar store
 * - Startar router när DOM är redo (robust)
 * ============================================================ */
export function initApp() {
    const store = createStore(DEFAULT_STATE);
    debugLog('log', 'Store created');

    // GUARD: om initApp körs innan DOM är redo → vänta (förhindrar blank sida)
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
        debugLog('warn', 'DOM not ready yet — deferring router setup');
        document.addEventListener(
            'DOMContentLoaded',
            () => {
                try {
                    setupRouter(store);
                    debugLog('log', 'Router initialized (deferred)');
                } catch (err) {
                    console.error('❌ Router init failed (deferred):', err);
                }
            },
            { once: true }
        );
    } else {
        // Setup router immediately
        setupRouter(store);
        debugLog('log', 'Router initialized');
    }

    debugLog('log', 'App initialized');
    return { store };
}
