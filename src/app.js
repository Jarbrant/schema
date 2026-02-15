/*
 * ============================================================
 * APP.JS — App Initialization & State Management (AUTOPATCH)
 * Projekt: Schema-Program (UI-only / GitHub Pages)
 *
 * FIX (P0):
 * - notifyListeners måste använda samma listeners-array som subscribe() fyller på.
 * - Tar bort felaktig global "listeners" (dubbeldeklaration).
 * ============================================================
 */

import { setupRouter } from './router.js';

/* ============================================================
   BLOCK 1 — Debug helpers
   ============================================================ */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

function debugLog(level, message, data) {
  if (!DEBUG) return;
  const prefix = { log: '📊', warn: '⚠️', error: '❌' }[level] || '📋';
  if (data !== undefined) console[level](`${prefix} ${message}`, data);
  else console[level](`${prefix} ${message}`);
}

function isValidStateUpdate(newState) {
  // GUARD: fail-closed på konstiga uppdateringar
  return !!newState && typeof newState === 'object' && !Array.isArray(newState);
}

/* ============================================================
   BLOCK 2 — Store (SINGLE SOURCE OF TRUTH)
   ============================================================ */
export function createStore(initialState) {
  let state = { ...initialState };

  // SCOPE: dessa listeners ska endast leva i store-instansen
  const listeners = [];

  // DEBUG: Freeze för att hitta mutationer i dev
  if (DEBUG) {
    Object.freeze(state);
    debugLog('log', 'State frozen in development mode');
  }

  // IMPORTANT: notifyListeners ligger här så den ser rätt listeners-array
  function notifyListeners(nextState) {
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
    /* BLOCK 2.1 — Read */
    getState() {
      return state;
    },

    /* BLOCK 2.2 — Write */
    setState(newState) {
      if (!isValidStateUpdate(newState)) {
        console.warn('⚠️ setState: Invalid state object');
        return false;
      }

      const oldState = state;
      state = { ...state, ...newState };

      if (DEBUG) Object.freeze(state);

      debugLog('log', 'State updated', { from: oldState, to: state });
      notifyListeners(state);
      return true;
    },

    /* BLOCK 2.3 — Subscribe */
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

/* ============================================================
   BLOCK 3 — Default state
   ============================================================ */
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

/* ============================================================
   BLOCK 4 — Init
   ============================================================ */
export function initApp() {
  const store = createStore(DEFAULT_STATE);
  debugLog('log', 'Store created');

  // Router kräver: #app, #navbar, #error-panel
  setupRouter(store);

  debugLog('log', 'App initialized');
  return { store };
}
