/*
 * ============================================================
 * MAIN.JS — App Entry (AUTOPATCH)
 * Projekt: Schema-Program (UI-only / GitHub Pages)
 * Syfte: Starta appen när DOM är redo (fail-closed)
 * ============================================================
 */

import { initApp } from './app.js';

function start() {
  try {
    initApp();
  } catch (err) {
    console.error('❌ FATAL: initApp failed:', err);
    // Fail-closed: om appen inte kan starta, visa något i UI om möjligt
    const errorPanel = document.getElementById('error-panel');
    if (errorPanel) {
      errorPanel.style.display = 'block';
      errorPanel.textContent = `❌ Appen kunde inte starta: ${err?.message || err}`;
    }
  }
}

// Starta när DOM är redo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
