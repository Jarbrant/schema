/*
 * MAIN.JS — Entry point for Schema-Program (AUTOPATCH v2)
 *
 * Fix:
 * - P0: Använd store.js (getStore) istället för createStore
 * - Fail-closed: visa fel i error-panel om något saknas
 * - Init-guard: ingen dubbel init
 * - Mindre loggspam (debug via ?debug=1)
 */

import { initRouter } from './router.js';
import { getStore } from './store.js';

(function bootstrap() {
  if (window.__SCHEMA_APP_INIT__) return;
  window.__SCHEMA_APP_INIT__ = true;

  const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';

  function log(...args) {
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
        alert(`${code}: ${message}`);
      }
    } catch (_) {
      alert(`${code}: ${message}`);
    }
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      try {
        const appContainer = document.getElementById('app-container');
        const errorPanel = document.getElementById('error-panel');

        if (!appContainer) {
          showFatal(errorPanel, 'SCHEMA_E_NO_ROOT', 'app-container saknas i index.html');
          return;
        }

        // ✅ Robust store (singleton) från store.js
        const store = getStore();

        // Context till router/views
        const appCtx = Object.freeze({
          store,
          currentRoute: null,
          shiftTab: 'schedule',
          groupsTab: 'groups'
        });

        log('Init router...');
        initRouter(appContainer, errorPanel, appCtx);
        log('Init OK');
      } catch (err) {
        const errorPanel = document.getElementById('error-panel');
        showFatal(errorPanel, 'SCHEMA_E_BOOT', 'Appen kunde inte starta.');
        console.error('SCHEMA_E_BOOT', err);
      }
    },
    { once: true }
  );
})();
