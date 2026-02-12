/*
 * AO-02 — APP: Huvudapplikation med router (DEBUG VERSION)
 */

import { initRouter } from './router.js';
import { renderNavbar, renderError } from './ui.js';
import { isLoggedIn } from './views/login.js';
import store from './store.js';

class SchemaApp {
    constructor() {
        this.container = document.getElementById('container');
        this.errorPanel = document.getElementById('error-panel');
        this.navbar = document.getElementById('navbar');

        console.log('🔍 SchemaApp konstruktor startad');
        console.log('Container:', this.container);
        console.log('ErrorPanel:', this.errorPanel);
        console.log('Navbar:', this.navbar);

        if (!this.container || !this.navbar) {
            console.error('❌ Kritiska DOM-element saknas');
            return;
        }

        this.init();
    }

    init() {
        try {
            console.log('🔄 Init startad');
            console.log('Store isReady:', store.isReady);
            console.log('Store:', store);

            if (!store.isReady) {
                throw new Error('Store kunde inte initialiseras');
            }

            const loggedIn = isLoggedIn();
            console.log('✓ Inloggad:', loggedIn);

            if (!loggedIn) {
                console.log('📍 Inte inloggad → visar login-sidan');
                window.location.hash = '#/login';
                return;
            }

            console.log('✓ Inloggad → visar navbar och router');
            renderNavbar(this.navbar);

            const ctx = {
                store,
                auth: {
                    isLoggedIn: loggedIn,
                },
            };
            initRouter(this.container, this.errorPanel, ctx);

            console.log('✓ Appen initialiserad (inloggad)');
        } catch (err) {
            console.error('❌ Init-fel:', err);
            this.showError(err);
        }
    }

    showError(error) {
        renderError(this.errorPanel, error);
    }
}

if (document.readyState === 'loading') {
    console.log('📍 Väntar på DOM...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✓ DOM ready');
        new SchemaApp();
    });
} else {
    console.log('✓ DOM redan ready');
    new SchemaApp();
}
