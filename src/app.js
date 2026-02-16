/*
 * ============================================================
 * APP.JS — App Initialization & State Management (AUTOPATCH v1.1)
 * Projekt: Schema-Program (UI-only / GitHub Pages)
 *
 * P0 FIX:
 * - Sluta skapa in-memory store som nollas vid refresh.
 * - Använd store.js (localStorage) som SINGLE SOURCE OF TRUTH.
 * - Behåll createStore()/DEFAULT_STATE exports för bakåtkompatibilitet,
 *   men createStore() proxar nu mot getStore().
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
   OBS: Används inte längre som källa. store.js äger state + persist.
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
   BLOCK 3 — Store factory (bakåtkompatibilitet)
   ============================================================ */
export function createStore(_initialStateIgnored) {
  // P0: Proxy till persistenta store-instansen i store.js
  const store = getStore();

  // DEBUG: tydlig signal om någon försöker använda initialState
  if (DEBUG && _initialStateIgnored) {
    debugLog('warn', 'createStore(initialState) ignoreras — store.js äger state/persist', _initialStateIgnored);
  }

  // GUARD: kräver att store har getState/setState/subscribe
  const hasAPI =
    store &&
    typeof store.getState === 'function' &&
    typeof store.setState === 'function' &&
    typeof store.subscribe === 'function';

  if (!hasAPI) {
    // Fail-closed: om store.js inte är korrekt laddad, krascha tidigt med tydligt fel
    throw new Error('P0: store.js saknar required API (getState/setState/subscribe)');
  }

  return store;
}

/* ============================================================
   BLOCK 4 — Init
   ============================================================ */
export function initApp() {
  // P0: skapa inte ny state, använd persistent store
  const store = createStore(DEFAULT_STATE);
  debugLog('log', 'Store loaded (persistent)', store.getState());

  // Router kräver: #app, #navbar, #error-panel
  setupRouter(store);

  debugLog('log', 'App initialized');
  return { store };
}
