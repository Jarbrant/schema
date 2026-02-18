/*
 * ============================================================
 * APP.JS — App Initialization & State Management (AUTOPATCH v1.2 + AO-05)
 * Projekt: Schema-Program (UI-only / GitHub Pages)
 *
 * P0 FIX (NY):
 * - Backspace ska fungera i input/textarea/contenteditable.
 * - Vi stoppar propagation för Backspace i editfält för att hindra
 *   globala shortcuts/guards från att köra preventDefault().
 *
 * Policy:
 * - UI-only
 * - Inga nya storage keys
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
   BLOCK 1.5 — Keyboard guard (P0 FIX: Backspace)
   ============================================================ */
function installKeyboardGuardsOnce() {
  if (window.__KB_GUARD_INSTALLED__) return;
  window.__KB_GUARD_INSTALLED__ = true;

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Backspace') return;

      const t = e.target;
      const isEditable =
        t &&
        (
          t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable === true
        );

      // Backspace i editfält ska ALLTID få fungera.
      // Vi stoppar propagation så att globala handlers inte kan preventDefault().
      if (isEditable) {
        e.stopImmediatePropagation();
        // OBS: vi kallar INTE preventDefault här.
      }
    },
    true // capture: körs tidigt
  );

  debugLog('log', 'Keyboard guard installed (Backspace safe in inputs)');
}

/* ============================================================
   BLOCK 2 — Default state (legacy export)
   ============================================================ */
export const DEFAULT_STATE = {
  user: null,
  isLoggedIn: false,
  people: [],
  shifts: {},
  groups: {},
  groupShifts: {},
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
  // P0: installera tidigt innan views/router kör shortcuts
  installKeyboardGuardsOnce();

  const store = createStore(DEFAULT_STATE);
  debugLog('log', 'Store loaded (persistent)', store.getState());

  setupRouter(store);

  debugLog('log', 'App initialized');
  return { store };
}
