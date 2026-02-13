/*
 * AO-01 — DIAGNOSTICS CORE (UPPDATERAD för AO-05)
 * 
 * Gemensam felhantering som fångar "vad gick fel" och "var".
 * NY: Module registry för healthcheck per modul.
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
 * Module Status Object
 */
class ModuleStatus {
    constructor(id, fileHint) {
        this.id = id;                           // 'control.groupFilter'
        this.fileHint = fileHint;              // 'src/views/control/sections/groupFilter.js'
        this.status = 'pending';               // 'pending', 'initializing', 'ok', 'failed'
        this.startedAt = null;
        this.completedAt = null;
        this.error = null;
        this.duration = 0;
    }

    /**
     * Markera som påbörjad
     */
    start() {
        this.status = 'initializing';
        this.startedAt = new Date();
        console.log(`🔄 Module start: ${this.id}`);
    }

    /**
     * Markera som OK
     */
    ok() {
        this.status = 'ok';
        this.completedAt = new Date();
        this.duration = this.completedAt - this.startedAt;
        console.log(`✓ Module ok: ${this.id} (${this.duration}ms)`);
    }

    /**
     * Markera som failed
     */
    fail(error) {
        this.status = 'failed';
        this.completedAt = new Date();
        this.duration = this.completedAt - this.startedAt;
        this.error = error?.message || String(error);
        console.log(`❌ Module failed: ${this.id} (${this.duration}ms) - ${this.error}`);
    }

    /**
     * Hämta status-emoji
     */
    getStatusEmoji() {
        switch (this.status) {
            case 'ok': return '✓';
            case 'failed': return '❌';
            case 'initializing': return '🔄';
            default: return '⏳';
        }
    }

    /**
     * Hämta status-text
     */
    getStatusText() {
        switch (this.status) {
            case 'ok': return 'OK';
            case 'failed': return `FAILED (${this.error})`;
            case 'initializing': return 'INITIALIZING';
            default: return 'PENDING';
        }
    }
}

/**
 * DIAGNOSTICS MANAGER (UPPDATERAD)
 * Central felhantering för hela appen + module registry
 */
export class Diagnostics {
    constructor() {
        this.reports = [];
        this.maxReports = 50;
        this.listeners = [];
        this.modules = new Map();  // NY: Module registry
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
     * NY: Registrera modul-start
     */
    moduleStart(moduleId, fileHint) {
        const status = new ModuleStatus(moduleId, fileHint);
        status.start();
        this.modules.set(moduleId, status);
    }

    /**
     * NY: Markera modul som OK
     */
    moduleOk(moduleId) {
        const status = this.modules.get(moduleId);
        if (status) {
            status.ok();
        } else {
            console.warn(`⚠️ Modul ${moduleId} inte registrerad`);
        }
    }

    /**
     * NY: Markera modul som failed
     */
    moduleFail(moduleId, error) {
        const status = this.modules.get(moduleId);
        if (status) {
            status.fail(error);
        } else {
            console.warn(`⚠️ Modul ${moduleId} inte registrerad`);
        }
    }

    /**
     * NY: Hämta modul-status
     */
    getModuleStatus(moduleId) {
        return this.modules.get(moduleId) || null;
    }

    /**
     * NY: Hämta alla modul-statuser
     */
    getAllModuleStatuses() {
        return Array.from(this.modules.values());
    }

    /**
     * NY: Hämta modul-hälsostatus (övergripande)
     */
    getModuleHealth() {
        const statuses = this.getAllModuleStatuses();
        if (statuses.length === 0) {
            return { healthy: true, total: 0, ok: 0, failed: 0, pending: 0 };
        }

        const health = {
            healthy: true,
            total: statuses.length,
            ok: statuses.filter(s => s.status === 'ok').length,
            failed: statuses.filter(s => s.status === 'failed').length,
            pending: statuses.filter(s => s.status === 'pending').length,
            failedModules: statuses.filter(s => s.status === 'failed')
        };

        health.healthy = health.failed === 0;

        return health;
    }

    /**
     * Subscribe till error-rapporter
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
