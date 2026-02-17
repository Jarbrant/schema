/*
 * ============================================================
 * APP.JS — App Initialization & State Management (AUTOPATCH v1.1 + AO-05)
 * Projekt: Schema-Program (UI-only / GitHub Pages)
 *
 * P0 FIX:
 * - Sluta skapa in-memory store som nollas vid refresh.
 * - Använd store.js (localStorage) som SINGLE SOURCE OF TRUTH.
 * - Behåll createStore()/DEFAULT_STATE exports för bakåtkompatibilitet,
 *   men createStore() proxar nu mot getStore().
 *
 * AO-05: Rensat bort "passes" (spökvariabel). State-shape ägs av store.js.
 *        DEFAULT_STATE här är bara legacy-export — store.js skapar default-state.
 * ============================================================
 */

import { setupRouter } from './router.js';
import { getStore } from './store.js';

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

/* ============================================================
   BLOCK 2 — Default state (legacy export)
   OBS: Används INTE som källa. store.js äger state + persist.
   AO-05: groups/shifts är Object/Map i store.js, men här kvar som
          legacy-placeholder. "passes" borttagen (finns inte i store).
   ============================================================ */
export const DEFAULT_STATE = {
  user: null,
  isLoggedIn: false,
  people: [],
  // AO-05: Dessa är Object/Map i store.js — här bara legacy-placeholder
  shifts: {},       // store.js: Object/Map { [id]: { id, name, ... } }
  groups: {},       // store.js: Object/Map { [id]: { id, name, color, textColor } }
  groupShifts: {},  // store.js: Object/Map { [groupId]: [shiftId, ...] }
  // AO-05: "passes" borttagen — hette "shifts" i store.js hela tiden
  // AO-05: "demands" borttagen — heter "demand" (objekt) i store.js
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
   BLOCK 3 — Store factory (bakåtkompatibilitet)
   ============================================================ */
export function createStore(_initialStateIgnored) {
  const store = getStore();

  if (DEBUG && _initialStateIgnored) {
    debugLog('warn', 'createStore(initialState) ignoreras — store.js äger state/persist', _initialStateIgnored);
  }

  const hasAPI =
    store &&
    typeof store.getState === 'function' &&
    typeof store.setState === 'function' &&
    typeof store.subscribe === 'function';

  if (!hasAPI) {
    throw new Error('P0: store.js saknar required API (getState/setState/subscribe)');
  }

  return store;
}

/* ============================================================
   BLOCK 4 — Init
   ============================================================ */
export function initApp() {
  const store = createStore(DEFAULT_STATE);
  debugLog('log', 'Store loaded (persistent)', store.getState());

  setupRouter(store);

  debugLog('log', 'App initialized');
  return { store };
}
