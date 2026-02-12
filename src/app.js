/*
 * AO-02 — APP: Huvudapplikation med router (AUTOPATCH v1)
 * P0-FIX: Router måste initieras även när användaren inte är inloggad,
 * annars renderas aldrig login-vyn och #container förblir tom.
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

        if (!this.container || !this.navbar || !this.errorPanel) {
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

            // Navbar: endast om inloggad
            if (loggedIn) {
                console.log('✓ Inloggad → visar navbar');
                renderNavbar(this.navbar);
            } else {
                console.log('📍 Inte inloggad → navbar göms');
                this.navbar.innerHTML = '';
            }

            // Auth-context till router (router/vyer avgör vad som får visas)
            const ctx = {
                store,
                auth: {
                    isLoggedIn: loggedIn,
                },
            };

            // P0: Om inte inloggad, se till att vi är på login-route
            // MEN starta fortfarande routern så vyn faktiskt renderas.
            if (!loggedIn) {
                const h = window.location.hash || '';
                if (!h.startsWith('#/login')) {
                    window.location.hash = '#/login';
                }
            }

            console.log('🧭 Initierar router');
            initRouter(this.container, this.errorPanel, ctx);

            console.log('✓ Appen initialiserad');
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
