/*
 * AO-02 — APP: Huvudapplikation med router
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

        if (!this.container || !this.navbar) {
            console.error('Kritiska DOM-element saknas');
            return;
        }

        this.init();
    }

    init() {
        try {
            if (!store.isReady) {
                throw new Error('Store kunde inte initialiseras');
            }

            const loggedIn = isLoggedIn();

            if (!loggedIn) {
                window.location.hash = '#/login';
                return;
            }

            renderNavbar(this.navbar);

            const ctx = {
                store,
                auth: {
                    isLoggedIn: loggedIn,
                },
            };
            initRouter(this.container, this.errorPanel, ctx);

            console.log('Appen initialiserad (inloggad)');
        } catch (err) {
            console.error('Init-fel', err);
            this.showError(err);
        }
    }

    showError(error) {
        renderError(this.errorPanel, error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SchemaApp();
    });
} else {
    new SchemaApp();
}
