/*
 * AO-01 — DIAGNOSTICS CORE
 * 
 * Gemensam felhantering för hela appen.
 * Fångar, loggar och rapporterar fel säkert (utan att läcka data).
 */

/**
 * Diagnostic Report Object
 */
class DiagnosticReport {
    constructor(config) {
        this.code = config.code || 'UNKNOWN_ERROR';
        this.where = config.where || 'UNKNOWN_MODULE';
        this.fileHint = config.fileHint || 'unknown-file.js';
        this.detailsSafe = config.detailsSafe || 'Ett okänt fel uppstod';
        this.timestamp = new Date().toISOString();
        this.userAgent = navigator.userAgent;
        this.url = window.location.href;
        this.debugMode = this._isDebugMode();
    }

    /**
     * Kontrollera om debug-läge är aktiverat (?debug=1)
     */
    _isDebugMode() {
        const params = new URLSearchParams(window.location.search);
        return params.get('debug') === '1' || localStorage.getItem('debug-mode') === 'true';
    }

    /**
     * Få säker output för användare
     */
    getPublicMessage() {
        return {
            code: this.code,
            where: this.where,
            message: this.detailsSafe,
            hint: `Prova att ladda om sidan eller gå till Hem.`,
            timestamp: this.timestamp
        };
    }

    /**
     * Få teknisk debug-info (endast i debug-läge)
     */
    getDebugMessage() {
        if (!this.debugMode) return null;

        return {
            code: this.code,
            where: this.where,
            fileHint: this.fileHint,
            detailsSafe: this.detailsSafe,
            timestamp: this.timestamp,
            userAgent: this.userAgent,
            url: this.url,
            debugMode: this.debugMode
        };
    }

    /**
     * Logg till console (säker version)
     */
    log() {
        console.group(`❌ [${this.code}] ${this.where}`);
        console.error(`Fil: ${this.fileHint}`);
        console.error(`Meddelande: ${this.detailsSafe}`);
        console.error(`Tid: ${this.timestamp}`);
        if (this.debugMode) {
            console.log('🔍 Debug-info:', this.getDebugMessage());
        }
        console.groupEnd();
    }
}

/**
 * DIAGNOSTICS MANAGER
 * Central felhantering för hela appen
 */
export class Diagnostics {
    constructor() {
        this.reports = [];
        this.maxReports = 50; // Spara senaste 50 rapporter
        this.listeners = [];
        this.setupGlobalHooks();
    }

    /**
     * Setup globala error-hooks
     */
    setupGlobalHooks() {
        // Fånga okända errors
        window.addEventListener('error', (event) => {
            this.report({
                code: 'UNCAUGHT_ERROR',
                where: 'GLOBAL_ERROR_HANDLER',
                fileHint: event.filename || 'unknown',
                detailsSafe: event.message || 'Ett okänt fel uppstod'
            });
        });

        // Fånga unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.report({
                code: 'UNHANDLED_PROMISE_REJECTION',
                where: 'GLOBAL_PROMISE_HANDLER',
                fileHint: 'async-code',
                detailsSafe: event.reason?.message || 'Ett async-fel uppstod'
            });
        });

        console.log('✓ Global error hooks registrerade');
    }

    /**
     * Rapportera ett fel
     * @param {object} config - { code, where, fileHint, detailsSafe }
     * @returns {DiagnosticReport}
     */
    report(config) {
        const report = new DiagnosticReport(config);
        
        // Spara rapport
        this.reports.push(report);
        if (this.reports.length > this.maxReports) {
            this.reports.shift();
        }

        // Logg till console
        report.log();

        // Notifiera alla listeners
        this.listeners.forEach(listener => listener(report));

        return report;
    }

    /**
     * Subscribe till error-rapporter
     * @param {function} listener - Callback när fel rapporteras
     * @returns {function} Unsubscribe-funktion
     */
    subscribe(listener) {
        this.listeners.push(listener);
        console.log(`📡 Diagnostics-listener registrerad (totalt: ${this.listeners.length})`);

        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Hämta alla rapporter
     */
    getReports() {
        return [...this.reports];
    }

    /**
     * Hämta senaste rapport
     */
    getLatestReport() {
        return this.reports[this.reports.length - 1] || null;
    }

    /**
     * Rensa alla rapporter
     */
    clearReports() {
        this.reports = [];
        console.log('✓ Diagnostics-rapporter rensade');
    }

    /**
     * Togglea debug-läge
     */
    toggleDebugMode() {
        const current = localStorage.getItem('debug-mode') === 'true';
        localStorage.setItem('debug-mode', !current);
        console.log(`🔍 Debug-läge: ${!current ? 'PÅ' : 'AV'}`);
        return !current;
    }

    /**
     * Hämta alla rapporter som JSON (för export)
     */
    exportReports() {
        return JSON.stringify(this.reports.map(r => r.getPublicMessage()), null, 2);
    }
}

/**
 * SINGLETON INSTANCE
 */
export const diagnostics = new Diagnostics();

/**
 * Helper-funktion för quick-reporting från views/modules
 */
export function reportError(code, where, fileHint, detailsSafe) {
    return diagnostics.report({
        code,
        where,
        fileHint,
        detailsSafe
    });
}
