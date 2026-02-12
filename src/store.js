/*
 * AO-02C — STORE: Bemanningsbehov per grupp + veckodag
 * Lines marked with /* AO-02C */ show group-based demand changes
 */

const STORAGE_KEY_STATE = 'SCHEMA_APP_V1_STATE';

const DEFAULT_GROUPS = {
    SYSTEM_ADMIN: {
        id: 'SYSTEM_ADMIN',
        name: 'SYSTEM_ADMIN',
        color: '#FF6B6B',
        textColor: '#FFFFFF',
    },
    ADMIN: {
        id: 'ADMIN',
        name: 'Admin',
        color: '#4ECDC4',
        textColor: '#FFFFFF',
    },
    KITCHEN_MASTER: {
        id: 'KITCHEN_MASTER',
        name: 'Köksmästare',
        color: '#FFD93D',
        textColor: '#000000',
    },
    COOKS: {
        id: 'COOKS',
        name: 'Kockar',
        color: '#FF8C42',
        textColor: '#FFFFFF',
    },
    RESTAURANT_STAFF: {
        id: 'RESTAURANT_STAFF',
        name: 'Restaurangpersonal',
        color: '#A29BFE',
        textColor: '#FFFFFF',
    },
    DISHWASHERS: {
        id: 'DISHWASHERS',
        name: 'Diskare',
        color: '#6C5CE7',
        textColor: '#FFFFFF',
    },
    WAREHOUSE: {
        id: 'WAREHOUSE',
        name: 'Lagerarbetare',
        color: '#00B894',
        textColor: '#FFFFFF',
    },
    DRIVERS: {
        id: 'DRIVERS',
        name: 'Chaufförer',
        color: '#0984E3',
        textColor: '#FFFFFF',
    },
};

const DEFAULT_THEME = {
    statusColors: {
        A: '#c8e6c9',
        L: '#f0f0f0',
        X: '#bbdefb',
        SEM: '#fff9c4',
        SJ: '#ffcdd2',
        VAB: '#ffe0b2',
        PERM: '#b2dfdb',
        UTB: '#e1bee7',
        EXTRA: '#424242',
    },
    statusTextColors: {
        A: '#1b5e20',
        L: '#424242',
        X: '#0d47a1',
        SEM: '#f57f17',
        SJ: '#b71c1c',
        VAB: '#e65100',
        PERM: '#004d40',
        UTB: '#4a148c',
        EXTRA: '#ffeb3b',
    },
};

/* AO-02C: Bemanningsbehov per grupp per veckodag */
const DEFAULT_DEMAND = {
    /* AO-02C: struktur ändrad från weekdayTemplate till groupDemands */
    groupDemands: {
        COOKS: [3, 3, 3, 2, 2, 2, 2],        // mån–sön
        DISHWASHERS: [1, 1, 1, 1, 1, 1, 1],
        RESTAURANT_STAFF: [2, 2, 2, 2, 2, 2, 2],
        KITCHEN_MASTER: [1, 1, 1, 1, 1, 0, 0],
        WAREHOUSE: [0, 0, 1, 0, 1, 0, 0],
        DRIVERS: [0, 0, 0, 1, 0, 0, 0],
        ADMIN: [1, 1, 1, 1, 1, 0, 0],
        SYSTEM_ADMIN: [0, 0, 0, 0, 0, 0, 0],
    },
    /* AO-02C: Behål gammal struktur för bakåtkompatibilitet */
    weekdayTemplate: [
        { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 1, notes: '' },
        { KITCHEN: 4, PACK: 6, DISH: 2, SYSTEM: 1, ADMIN: 1, notes: '' },
        { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 1, notes: '' },
        { KITCHEN: 4, PACK: 4, DISH: 2, SYSTEM: 0, ADMIN: 1, notes: '' },
        { KITCHEN: 4, PACK: 4, DISH: 1, SYSTEM: 0, ADMIN: 1, notes: '' },
        { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 0, notes: '' },
        { KITCHEN: 4, PACK: 6, DISH: 1, SYSTEM: 1, ADMIN: 0, notes: '' },
    ],
};

class Store {
    constructor() {
        this.state = null;
        this.subscribers = [];
        this.lastError = null;
        this.isReady = false;

        this.init();
    }

    init() {
        try {
            const loaded = this.load();
            this.isReady = true;
            console.log('✓ Store initialiserad');
        } catch (err) {
            console.error('Init-fel', err);
            this.lastError = err;
            this.state = this.createDefaultState();
            this.isReady = true;
        }
    }

    load() {
        try {
            const rawState = localStorage.getItem(STORAGE_KEY_STATE);

            if (!rawState) {
                this.state = this.createDefaultState();
                this.save(this.state);
                return this.state;
            }

            let state;
            try {
                state = JSON.parse(rawState);
            } catch (parseErr) {
                throw new Error(`Lagringen är korrupt (JSON): ${parseErr.message}`);
            }

            this.validate(state);
            state = this.migrate(state);

            this.state = state;
            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));

            this.lastError = null;
            return state;
        } catch (err) {
            this.lastError = err;
            throw err;
        }
    }

    save(state) {
        try {
            this.validate(state);
            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
            this.state = state;
            this.lastError = null;
        } catch (err) {
            this.lastError = err;
            console.error('Sparning misslyckades', err);
            throw err;
        }
    }

    getState() {
        if (!this.state) {
            return this.createDefaultState();
        }
        return JSON.parse(JSON.stringify(this.state));
    }

    update(mutatorFn) {
        try {
            const clone = this.getState();
            mutatorFn(clone);
            this.validate(clone);
            this.save(clone);
            this.notify();
        } catch (err) {
            this.lastError = err;
            console.error('Update misslyckades', err);
            throw err;
        }
    }

    subscribe(fn) {
        this.subscribers.push(fn);
        return () => {
            this.subscribers = this.subscribers.filter((s) => s !== fn);
        };
    }

    notify() {
        this.subscribers.forEach((fn) => {
            try {
                fn(this.getState());
            } catch (err) {
                console.error('Subscriber-fel', err);
            }
        });
    }

    getLastError() {
        return this.lastError;
    }

    exportState() {
        try {
            const state = this.getState();
            return JSON.stringify(state, null, 2);
        } catch (err) {
            throw new Error(`Export misslyckades: ${err.message}`);
        }
    }

    importState(jsonString, importOpts = {}) {
        try {
            let importedState;
            try {
                importedState = JSON.parse(jsonString);
            } catch (parseErr) {
                throw new Error(`JSON-parse fel: ${parseErr.message}`);
            }

            this.validate(importedState);
            importedState = this.migrate(importedState);

            if (importOpts.previewOnly) {
                return {
                    isValid: true,
                    preview: this.generateImportPreview(importedState),
                };
            }

            this.save(importedState);
            this.notify();

            return {
                isValid: true,
                message: 'Import lyckades!',
            };
        } catch (err) {
            this.lastError = err;
            console.error('Import-fel', err);
            return {
                isValid: false,
                error: err.message,
            };
        }
    }

    generateImportPreview(state) {
        const activePeople = (state.people || []).filter((p) => p.isActive).length;
        const inactivePeople = (state.people || []).filter((p) => !p.isActive).length;

        let entryCount = 0;
        if (state.schedule && state.schedule.months) {
            state.schedule.months.forEach((month) => {
                if (month.days) {
                    month.days.forEach((day) => {
                        entryCount += (day.entries || []).length;
                    });
                }
            });
        }

        return {
            schemaVersion: state.meta?.schemaVersion || 'saknas',
            appVersion: state.meta?.appVersion || 'saknas',
            updatedAt: state.meta?.updatedAt ? new Date(state.meta.updatedAt).toLocaleString('sv-SE') : 'okänd',
            year: state.schedule?.year || '?',
            totalPeople: activePeople + inactivePeople,
            activePeople,
            inactivePeople,
            totalEntries: entryCount,
            months: state.schedule?.months?.length || 0,
        };
    }

    validate(state) {
        if (!state || typeof state !== 'object') {
            throw new Error('State måste vara ett objekt');
        }

        if (!state.meta || typeof state.meta !== 'object') {
            throw new Error('meta saknas eller är fel typ');
        }
        if (!state.meta.schemaVersion) {
            throw new Error('meta.schemaVersion saknas');
        }
        if (typeof state.meta.updatedAt !== 'number') {
            throw new Error('meta.updatedAt måste vara number (timestamp)');
        }

        if (!Array.isArray(state.people)) {
            throw new Error('people måste vara array');
        }
        state.people.forEach((person, idx) => {
            this.validatePerson(person, idx);
        });

        if (!state.schedule || typeof state.schedule !== 'object') {
            throw new Error('schedule måste vara objekt');
        }
        if (typeof state.schedule.year !== 'number') {
            throw new Error('schedule.year måste vara number');
        }
        if (!Array.isArray(state.schedule.months)) {
            throw new Error('schedule.months måste vara array');
        }
        if (state.schedule.months.length !== 12) {
            throw new Error('schedule.months måste ha exakt 12 månader');
        }
        state.schedule.months.forEach((month, idx) => {
            this.validateMonthSchedule(month, idx, state.schedule.year);
        });

        if (!state.settings || typeof state.settings !== 'object') {
            throw new Error('settings måste vara objekt');
        }
        this.validateSettings(state.settings);

        /* AO-02C: Validera grupp-behov */
        if (state.demand) {
            this.validateDemand(state.demand);
        }
        if (state.kitchenCore) {
            this.validateKitchenCore(state.kitchenCore, state.people);
        }

        if (state.groups) {
            this.validateGroups(state.groups);
        }
    }

    /* AO-02C: Validering för grupp-behov */
    validateDemand(demand) {
        if (typeof demand !== 'object') {
            throw new Error('demand måste vara objekt');
        }

        /* AO-02C: Validera groupDemands */
        if (demand.groupDemands) {
            if (typeof demand.groupDemands !== 'object') {
                throw new Error('demand.groupDemands måste vara objekt');
            }

            Object.keys(demand.groupDemands).forEach((groupId) => {
                const weekdays = demand.groupDemands[groupId];
                if (!Array.isArray(weekdays)) {
                    throw new Error(`demand.groupDemands[${groupId}] måste vara array`);
                }
                if (weekdays.length !== 7) {
                    throw new Error(`demand.groupDemands[${groupId}] måste ha 7 värden (mån–sön)`);
                }
                weekdays.forEach((val, dayIdx) => {
                    if (typeof val !== 'number' || val < 0 || val > 50) {
                        throw new Error(
                            `demand.groupDemands[${groupId}][${dayIdx}] måste vara 0–50, fick ${val}`
                        );
                    }
                });
            });
        }

        /* AO-02C: Behål gammal validering för bakåtkompatibilitet */
        if (!Array.isArray(demand.weekdayTemplate)) {
            throw new Error('demand.weekdayTemplate måste vara array');
        }

        if (demand.weekdayTemplate.length !== 7) {
            throw new Error('demand.weekdayTemplate måste ha exakt 7 poster (Mon–Sun)');
        }

        const roles = ['KITCHEN', 'PACK', 'DISH', 'SYSTEM', 'ADMIN'];

        demand.weekdayTemplate.forEach((day, idx) => {
            if (typeof day !== 'object') {
                throw new Error(`demand.weekdayTemplate[${idx}] måste vara objekt`);
            }

            roles.forEach((role) => {
                const value = day[role];
                if (typeof value !== 'number' || value < 0 || value > 50) {
                    throw new Error(`demand.weekdayTemplate[${idx}].${role} måste vara 0–50`);
                }
            });

            if (day.notes !== undefined && typeof day.notes !== 'string') {
                throw new Error(`demand.weekdayTemplate[${idx}].notes måste vara string eller undefined`);
            }
        });
    }

    validateKitchenCore(kitchenCore, people) {
        if (typeof kitchenCore !== 'object') {
            throw new Error('kitchenCore måste vara objekt');
        }

        if (typeof kitchenCore.enabled !== 'boolean') {
            throw new Error('kitchenCore.enabled måste vara boolean');
        }

        if (!Array.isArray(kitchenCore.corePersonIds)) {
            throw new Error('kitchenCore.corePersonIds måste vara array');
        }

        if (typeof kitchenCore.minCorePerDay !== 'number' || kitchenCore.minCorePerDay < 0) {
            throw new Error('kitchenCore.minCorePerDay måste vara number >= 0');
        }

        const personIds = new Set(people.map((p) => p.id));
        kitchenCore.corePersonIds.forEach((id) => {
            if (!personIds.has(id)) {
                console.warn(`kitchenCore innehåller okänd personId: ${id}`);
            }
        });
    }

    validateGroups(groups) {
        if (typeof groups !== 'object') {
            throw new Error('groups måste vara objekt');
        }

        Object.keys(groups).forEach((groupId) => {
            const group = groups[groupId];
            if (!group || typeof group !== 'object') {
                throw new Error(`groups[${groupId}] måste vara objekt`);
            }
            if (typeof group.id !== 'string' || !group.id) {
                throw new Error(`groups[${groupId}].id måste vara non-empty string`);
            }
            if (typeof group.name !== 'string' || !group.name) {
                throw new Error(`groups[${groupId}].name måste vara non-empty string`);
            }
            if (group.color && typeof group.color !== 'string') {
                throw new Error(`groups[${groupId}].color måste vara string`);
            }
            if (group.textColor && typeof group.textColor !== 'string') {
                throw new Error(`groups[${groupId}].textColor måste vara string`);
            }
        });
    }

    validateSettings(settings) {
        if (typeof settings.defaultStart !== 'string') {
            throw new Error('settings.defaultStart måste vara string (HH:MM)');
        }
        if (typeof settings.defaultEnd !== 'string') {
            throw new Error('settings.defaultEnd måste vara string (HH:MM)');
        }
        if (typeof settings.breakStart !== 'string') {
            throw new Error('settings.breakStart måste vara string (HH:MM)');
        }
        if (typeof settings.breakEnd !== 'string') {
            throw new Error('settings.breakEnd måste vara string (HH:MM)');
        }
        if (typeof settings.hourlyWageIsDefault !== 'boolean') {
            throw new Error('settings.hourlyWageIsDefault måste vara boolean');
        }

        if (settings.theme) {
            this.validateTheme(settings.theme);
        }
    }

    validatePerson(person, idx) {
        if (!person || typeof person !== 'object') {
            throw new Error(`people[${idx}] måste vara objekt`);
        }
        if (typeof person.id !== 'string' || !person.id) {
            throw new Error(`people[${idx}].id måste vara non-empty string`);
        }
        if (typeof person.firstName !== 'string') {
            throw new Error(`people[${idx}].firstName måste vara string`);
        }
        if (typeof person.lastName !== 'string') {
            throw new Error(`people[${idx}].lastName måste vara string`);
        }
        if (typeof person.hourlyWage !== 'number' || person.hourlyWage < 0) {
            throw new Error(`people[${idx}].hourlyWage måste vara number >= 0`);
        }
        if (typeof person.employmentPct !== 'number' || person.employmentPct < 0 || person.employmentPct > 100) {
            throw new Error(`people[${idx}].employmentPct måste vara 0–100`);
        }
        if (typeof person.isActive !== 'boolean') {
            throw new Error(`people[${idx}].isActive måste vara boolean`);
        }
        if (typeof person.vacationDaysPerYear !== 'number' || person.vacationDaysPerYear < 0 || person.vacationDaysPerYear > 40) {
            throw new Error(`people[${idx}].vacationDaysPerYear måste vara 0–40`);
        }
        if (typeof person.extraDaysStartBalance !== 'number' || person.extraDaysStartBalance < 0 || person.extraDaysStartBalance > 365) {
            throw new Error(`people[${idx}].extraDaysStartBalance måste vara 0–365`);
        }

        if (person.groups !== undefined) {
            if (!Array.isArray(person.groups)) {
                throw new Error(`people[${idx}].groups måste vara array`);
            }
            person.groups.forEach((groupId, groupIdx) => {
                if (typeof groupId !== 'string' || !groupId) {
                    throw new Error(`people[${idx}].groups[${groupIdx}] måste vara non-empty string`);
                }
            });
        }

        if (person.skills && typeof person.skills === 'object') {
            const skillNames = ['KITCHEN', 'PACK', 'DISH', 'SYSTEM', 'ADMIN'];
            skillNames.forEach((skill) => {
                if (person.skills[skill] !== undefined && typeof person.skills[skill] !== 'boolean') {
                    throw new Error(`people[${idx}].skills.${skill} måste vara boolean`);
                }
            });
        }
    }

    validateMonthSchedule(month, idx, year) {
        if (!month || typeof month !== 'object') {
            throw new Error(`schedule.months[${idx}] måste vara objekt`);
        }
        if (typeof month.month !== 'number' || month.month < 1 || month.month > 12) {
            throw new Error(`schedule.months[${idx}].month måste vara 1–12`);
        }
        if (!Array.isArray(month.days)) {
            throw new Error(`schedule.months[${idx}].days måste vara array`);
        }

        const daysInMonth = new Date(year, month.month, 0).getDate();
        if (month.days.length !== daysInMonth) {
            throw new Error(
                `schedule.months[${idx}] (månad ${month.month}) ska ha ${daysInMonth} dagar, har ${month.days.length}`
            );
        }

        month.days.forEach((day, dayIdx) => {
            this.validateDaySchedule(day, idx, dayIdx);
        });

        if (month.timeDefaults) {
            if (typeof month.timeDefaults !== 'object') {
                throw new Error(`schedule.months[${idx}].timeDefaults måste vara objekt`);
            }
            const timeFields = ['start', 'end', 'breakStart', 'breakEnd'];
            timeFields.forEach((field) => {
                if (month.timeDefaults[field] !== null && month.timeDefaults[field] !== undefined) {
                    if (typeof month.timeDefaults[field] !== 'string' || !/^\d{2}:\d{2}$/.test(month.timeDefaults[field])) {
                        throw new Error(`schedule.months[${idx}].timeDefaults.${field} måste vara HH:MM eller null`);
                    }
                }
            });
        }
    }

    validateDaySchedule(day, monthIdx, dayIdx) {
        if (!day || typeof day !== 'object') {
            throw new Error(`schedule.months[${monthIdx}].days[${dayIdx}] måste vara objekt`);
        }
        if (typeof day.date !== 'string') {
            throw new Error(`schedule.months[${monthIdx}].days[${dayIdx}].date måste vara string (YYYY-MM-DD)`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
            throw new Error(`schedule.months[${monthIdx}].days[${dayIdx}].date måste vara YYYY-MM-DD`);
        }
        if (!Array.isArray(day.entries)) {
            throw new Error(`schedule.months[${monthIdx}].days[${dayIdx}].entries måste vara array`);
        }
        day.entries.forEach((entry, entryIdx) => {
            this.validateEntry(entry, monthIdx, dayIdx, entryIdx);
        });
    }

    validateEntry(entry, monthIdx, dayIdx, entryIdx) {
        if (!entry || typeof entry !== 'object') {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}] måste vara objekt`);
        }
        if (typeof entry.personId !== 'string') {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}].personId måste vara string`);
        }
        const validStatuses = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'PERM', 'UTB', 'EXTRA'];
        if (!validStatuses.includes(entry.status)) {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}].status måste vara en av: ${validStatuses.join(', ')}`);
        }
        if (entry.start !== null && (typeof entry.start !== 'string' || !/^\d{2}:\d{2}$/.test(entry.start))) {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}].start måste vara null eller HH:MM`);
        }
        if (entry.end !== null && (typeof entry.end !== 'string' || !/^\d{2}:\d{2}$/.test(entry.end))) {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}].end måste vara null eller HH:MM`);
        }
        if (entry.breakStart !== null && (typeof entry.breakStart !== 'string' || !/^\d{2}:\d{2}$/.test(entry.breakStart))) {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}].breakStart måste vara null eller HH:MM`);
        }
        if (entry.breakEnd !== null && (typeof entry.breakEnd !== 'string' || !/^\d{2}:\d{2}$/.test(entry.breakEnd))) {
            throw new Error(`Entry [${monthIdx}][${dayIdx}][${entryIdx}].breakEnd måste vara null eller HH:MM`);
        }
    }

    validateTheme(theme) {
        if (typeof theme !== 'object') {
            throw new Error('settings.theme måste vara objekt');
        }

        if (theme.statusColors && typeof theme.statusColors === 'object') {
            Object.keys(theme.statusColors).forEach((status) => {
                const color = theme.statusColors[status];
                if (typeof color !== 'string' || !this.isValidHexColor(color)) {
                    throw new Error(`settings.theme.statusColors.${status} måste vara valid hex-färg`);
                }
            });
        }

        if (theme.statusTextColors && typeof theme.statusTextColors === 'object') {
            Object.keys(theme.statusTextColors).forEach((status) => {
                const color = theme.statusTextColors[status];
                if (typeof color !== 'string' || !this.isValidHexColor(color)) {
                    throw new Error(`settings.theme.statusTextColors.${status} måste vara valid hex-färg`);
                }
            });
        }
    }

    isValidHexColor(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    }

    migrate(state) {
        const currentVersion = state.meta?.schemaVersion;

        if (currentVersion === '1.0') {
            return state;
        }

        if (!currentVersion) {
            console.log('Migrerar från tom version → 1.0');
            state.meta = state.meta || {};
            state.meta.schemaVersion = '1.0';
            state.meta.updatedAt = Date.now();
            return state;
        }

        throw new Error(`Okänd schemaVersion "${currentVersion}" — kan inte migrera`);
    }

    createDefaultState() {
        const now = Date.now();
        const year = 2026;

        const months = [];
        for (let m = 1; m <= 12; m++) {
            const daysInMonth = new Date(year, m, 0).getDate();
            const days = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                days.push({
                    date: dateStr,
                    entries: [],
                });
            }
            months.push({
                month: m,
                days,
                timeDefaults: {
                    start: '07:00',
                    end: '16:00',
                    breakStart: '12:00',
                    breakEnd: '13:00',
                },
            });
        }

        return {
            meta: {
                schemaVersion: '1.0',
                updatedAt: now,
                appVersion: '1.0.0',
            },
            people: [],
            schedule: {
                year,
                months,
            },
            settings: {
                defaultStart: '07:00',
                defaultEnd: '16:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                hourlyWageIsDefault: true,
                pinHash: '',
                enableP1Streak10: true,
                summaryToleranceHours: 0.25,
                theme: JSON.parse(JSON.stringify(DEFAULT_THEME)),
            },
            /* AO-02C: Uppdaterad demand-struktur */
            demand: JSON.parse(JSON.stringify(DEFAULT_DEMAND)),
            kitchenCore: {
                enabled: true,
                corePersonIds: [],
                minCorePerDay: 1,
            },
            groups: JSON.parse(JSON.stringify(DEFAULT_GROUPS)),
            notifications: {
                queue: [],
                settings: {
                    enabled: false,
                    provider: 'mock',
                    twilioAccountSid: '',
                    twilioAuthToken: '',
                    twilioFromNumber: '',
                },
            },
        };
    }
}

let storeInstance = null;

export function getStore() {
    if (!storeInstance) {
        storeInstance = new Store();
    }
    return storeInstance;
}

export default getStore();
