/*
 * MAIN.JS — App entry point
 */

import { initApp } from './app.js';
import { reportError } from './diagnostics.js';

console.log('🚀 Startar Schema-Program...');

// Global error handling
window.addEventListener('unhandledrejection', (e) => {
    console.error('⚠️ Error:', e.reason);
    e.preventDefault();
});

try {
    initApp();
    console.log('✓ App started');
} catch (err) {
    console.error('❌ App init failed:', err);
    reportError('APP_INIT_ERROR', 'MAIN', 'src/main.js', err.message);
    throw err;
}
