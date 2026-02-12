/*
 * AO-06 — LOGIN: Inloggning med PIN
 */

const SESSION_KEY = 'SCHEMA_APP_V1_SESSION';
const DEFAULT_PIN = '123456';

export function renderLogin(container, ctx) {
    console.log('🔐 renderLogin anropad');
    console.log('Container:', container);
    
    const store = ctx?.store;
    if (!store) {
        console.error('❌ Store saknas i ctx');
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const hasError = store.getLastError();
    const loggedIn = isLoggedIn();

    const isFirstStart = !loggedIn && (!state.settings?.pinHash || state.settings.pinHash === '');

    console.log('🔐 Login-state:', { loggedIn, isFirstStart, hasError });

    // ... resten av koden
