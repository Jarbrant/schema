/*
 * MAIN.JS — Entry point for Schema-Program (AUTOPATCH v1)
 *
 * Säkerhet/Stabilitet:
 * - P0: Rätt import för createStore (från store.js)
 * - Fail-closed: visar fel i error-panel istället för att krascha tyst
 * - Init-guard: ingen dubbel init
 * - Inga “spam-logs” i normal drift (kan slås på via ?debug=1)
 */

import { initRouter } from './router.js';
import { createStore } from './store.js';

(function bootstrap() {
  // Init-guard (skydd mot dubbel init)
  if (window.__SCHEMA_APP_INIT__) return;
  window.__SCHEMA_APP_INIT__ = true;

  const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';

  function safeLog(...args) {
    if (DEBUG) console.log(...args);
  }

  function showFatal(errorPanel, code, message) {
    try {
      if (errorPanel) {
        errorPanel.textContent = `${code}: ${message}`;
        errorPanel.style.display = 'block';
        errorPanel.style.padding = '12px';
        errorPanel.style.margin = '12px';
        errorPanel.style.borderRadius = '10px';
        errorPanel.style.border = '1px solid rgba(0,0,0,0.15)';
      } else {
        // Fail-closed fallback om error-panel saknas
        alert(`${code}: ${message}`);
      }
    } catch (_) {
      // Sista fallback
      alert(`${code}: ${message}`);
    }
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      try {
        safeLog('Init: Schema-Program');

        // DOM elements (fail-closed om root saknas)
        const appContainer = document.getElementById('app-container');
        const errorPanel = document.getElementById('error-panel');

        if (!appContainer) {
          showFatal(errorPanel, 'SCHEMA_E_NO_ROOT', 'app-container saknas i index.html');
          return;
        }

        // Create store (state)
        const store = createStore({
          user: null,
          people: [],
          shifts: [],
          groups: [],
          passes: [],
          schedule: { year: new Date().getFullYear() },
          meta: { appVersion: '1.0.0', appName: 'Schema-Program' }
        });

        // App context (lås objektet så det inte råkar “bytas ut”)
        const appCtx = Object.freeze({
          store,
          currentRoute: null,
          shiftTab: 'schedule',
          groupsTab: 'groups'
        });

        // Init router (fail-closed)
        initRouter(appContainer, errorPanel, appCtx);

        safeLog('Init: OK');
      } catch (err) {
        const errorPanel = document.getElementById('error-panel');
        showFatal(errorPanel, 'SCHEMA_E_BOOT', 'Appen kunde inte starta. Kontrollera console för detaljer.');
        // Logga kort utan känslig info
        console.error('SCHEMA_E_BOOT', err);
      }
    },
    { once: true }
  );
})();
