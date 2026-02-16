/*
 * AO-01 to AO-02D — STORE: Komplett state-hantering med grupper, behov och pass (AUTOPATCH v1.3)
 * FIL: store.js (HEL FIL)
 *
 * ÄNDRINGSLOGG (≤8)
 * 1) P0: FIX — normalizePerson: ersatt ogiltig sector," med korrekt "sector," (syntaxfix).
 * 2) (Behåller allt annat oförändrat)
 */

const STORAGE_KEY_STATE = 'SCHEMA_APP_V1_STATE';

/* ========================================================================
   BLOCK 1: DEFAULT GROUPS (AO-02B)
   ======================================================================== */

const DEFAULT_GROUPS = {
    SYSTEM_ADMIN: { id: 'SYSTEM_ADMIN', name: 'SYSTEM_ADMIN', color: '#FF6B6B', textColor: '#FFFFFF' },
    ADMIN: { id: 'ADMIN', name: 'Admin', color: '#4ECDC4', textColor: '#FFFFFF' },
    KITCHEN_MASTER: { id: 'KITCHEN_MASTER', name: 'Köksmästare', color: '#FFD93D', textColor: '#000000' },
    COOKS: { id: 'COOKS', name: 'Kockar', color: '#FF8C42', textColor: '#FFFFFF' },
    RESTAURANT_STAFF: { id: 'RESTAURANT_STAFF', name: 'Restaurangpersonal', color: '#A29BFE', textColor: '#FFFFFF' },
    DISHWASHERS: { id: 'DISHWASHERS', name: 'Diskare', color: '#6C5CE7', textColor: '#FFFFFF' },
    WAREHOUSE: { id: 'WAREHOUSE', name: 'Lagerarbetare', color: '#00B894', textColor: '#FFFFFF' },
    DRIVERS: { id: 'DRIVERS', name: 'Chaufförer', color: '#0984E3', textColor: '#FFFFFF' },
};

/* ========================================================================
   BLOCK 2: DEFAULT SHIFTS (AO-02D)
   ======================================================================== */

const DEFAULT_SHIFTS = {
    MORNING: {
        id: 'MORNING',
        name: 'Dag',
        shortName: 'D',
        startTime: '07:00',
        endTime: '16:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        color: '#FFD93D',
        description: 'Dagtid 07:00–16:00 med lunch 12:00–13:00',
    },
    AFTERNOON: {
        id: 'AFTERNOON',
        name: 'Kväll',
        shortName: 'K',
        startTime: '16:00',
        endTime: '23:00',
        breakStart: '19:00',
        breakEnd: '19:30',
        color: '#FF8C42',
        description: 'Kvällstid 16:00–23:00 med kort paus 19:00–19:30',
    },
    NIGHT: {
        id: 'NIGHT',
        name: 'Natt',
        shortName: 'N',
        startTime: '23:00',
        endTime: '07:00',
        breakStart: '03:00',
        breakEnd: '03:30',
        color: '#4ECDC4',
        description: 'Nattid 23:00–07:00 med kort paus 03:00–03:30',
    },
    FLEX: {
        id: 'FLEX',
        name: 'Flex',
        shortName: 'F',
        startTime: null,
        endTime: null,
        breakStart: null,
        breakEnd: null,
        color: '#95a5a6',
        description: 'Flexibel tid — sätts per dag',
    },
};

/* ========================================================================
   BLOCK 3: DEFAULT GROUP SHIFTS (AO-02D)
   ======================================================================== */

const DEFAULT_GROUP_SHIFTS = {
    COOKS: ['MORNING', 'AFTERNOON'],
    DISHWASHERS: ['MORNING', 'AFTERNOON', 'NIGHT'],
    RESTAURANT_STAFF: ['MORNING', 'AFTERNOON', 'FLEX'],
    KITCHEN_MASTER: ['MORNING'],
    WAREHOUSE: ['MORNING'],
    DRIVERS: ['MORNING', 'AFTERNOON'],
    ADMIN: ['MORNING'],
    SYSTEM_ADMIN: ['MORNING', 'FLEX'],
};

/* ========================================================================
   BLOCK 4: DEFAULT THEME
   ======================================================================== */

const DEFAULT_THEME = {
    statusColors: {
        A: '#c8e6c9',
        L: '#f0f0f0',
        X: '#bbdefb',
        SEM: '#fff9c4',
        SJ: '#ffcdd2',
        VAB: '#ffe0b2',
        FÖR: '#f8bbd0',
        TJL: '#b2dfdb',
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
        FÖR: '#880e4f',
        TJL: '#004d40',
        PERM: '#004d40',
        UTB: '#4a148c',
        EXTRA: '#ffeb3b',
    },
};

/* ========================================================================
   BLOCK 5: DEFAULT DEMAND (AO-02C)
   ======================================================================== */

const DEFAULT_DEMAND = {
    groupDemands: {
        COOKS: [3, 3, 3, 2, 2, 2, 2],
        DISHWASHERS: [1, 1, 1, 1, 1, 1, 1],
        RESTAURANT_STAFF: [2, 2, 2, 2, 2, 2, 2],
        KITCHEN_MASTER: [1, 1, 1, 1, 1, 0, 0],
        WAREHOUSE: [0, 0, 1, 0, 1, 0, 0],
        DRIVERS: [0, 0, 0, 1, 0, 0, 0],
        ADMIN: [1, 1, 1, 1, 1, 0, 0],
        SYSTEM_ADMIN: [0, 0, 0, 0, 0, 0, 0],
    },
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

/* ========================================================================
   BLOCK 6: STORE CLASS
   ======================================================================== */

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
            this.load();
            this.isReady = true;
            console.log('✓ Store initialiserad');
        } catch (err) {
            console.error('Init-fel', err);
            this.lastError = err;
            this.state = this.createDefaultState();
            try {
                this.save(this.state);
            } catch (_) {}
            this.isReady = true;
        }
    }

    load() {
        try {
            const rawState = localStorage.getItem(STORAGE_KEY_STATE);

            if (!rawState) {
                const fresh = this.createDefaultState();
                this.validate(fresh);
                this.state = fresh;
                this.save(fresh);
                return fresh;
            }

            const parsed = safeParseJSON(rawState);
            if (!parsed.ok) {
                throw new Error(`Lagringen är korrupt (JSON): ${parsed.error}`);
            }

            let state = parsed.value;
            state = this.migrate(state);
            this.validate(state);

            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
            this.state = state;
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
        return safeDeepClone(this.state);
    }

    update(mutatorFn) {
        try {
            const clone = this.getState();
            mutatorFn(clone);

            const migrated = this.migrate(clone);
            this.validate(migrated);
            this.save(migrated);
            this.notify();
        } catch (err) {
            this.lastError = err;
            console.error('Update misslyckades', err);
            throw err;
        }
    }

    /**
     * P0: Kompatibilitet med UI som använder store.setState(...)
     * - next kan vara ett HELT state eller ett PARTIAL (merge ovanpå current)
     * - Kör migrate+validate+save+notify så det alltid persisteras.
     */
    setState(next) {
        try {
            const current = this.getState();
            const isObject = next && typeof next === 'object' && !Array.isArray(next);

            // Fail-closed: om next inte är objekt, avbryt med tydligt fel
            if (!isObject) {
                throw new Error('setState(next) kräver objekt (full state eller partial)');
            }

            // Heuristik: om next ser ut som "full state" (har meta+schedule+settings+people) -> använd som bas
            const looksFull =
                !!next.meta && !!next.schedule && !!next.settings && Array.isArray(next.people);

            const candidate = looksFull ? next : { ...current, ...next };

            const migrated = this.migrate(candidate);
            this.validate(migrated);
            this.save(migrated);
            this.notify();

            return this.getState();
        } catch (err) {
            this.lastError = err;
            console.error('setState misslyckades', err);
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
            const parsed = safeParseJSON(jsonString);
            if (!parsed.ok) {
                throw new Error(`JSON-parse fel: ${parsed.error}`);
            }

            let importedState = parsed.value;
            importedState = this.migrate(importedState);

            this.validate(importedState);

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

    /* ====================================================================
       VALIDATION METHODS
       ==================================================================== */

    validate(state) {
        if (!state || typeof state !== 'object') throw new Error('State måste vara ett objekt');

        if (!state.meta || typeof state.meta !== 'object') throw new Error('meta saknas eller är fel typ');
        if (!state.meta.schemaVersion) throw new Error('meta.schemaVersion saknas');
        if (typeof state.meta.updatedAt !== 'number') throw new Error('meta.updatedAt måste vara number (timestamp)');

        if (!Array.isArray(state.people)) throw new Error('people måste vara array');
        state.people.forEach((person, idx) => this.validatePerson(person, idx));

        if (!state.schedule || typeof state.schedule !== 'object') throw new Error('schedule måste vara objekt');
        if (typeof state.schedule.year !== 'number') throw new Error('schedule.year måste vara number');
        if (!Array.isArray(state.schedule.months)) throw new Error('schedule.months måste vara array');
        if (state.schedule.months.length !== 12) throw new Error('schedule.months måste ha exakt 12 månader');
        state.schedule.months.forEach((month, idx) => this.validateMonthSchedule(month, idx, state.schedule.year));

        if (!state.settings || typeof state.settings !== 'object') throw new Error('settings måste vara objekt');
        this.validateSettings(state.settings);

        if (state.demand) this.validateDemand(state.demand);
        if (state.kitchenCore) this.validateKitchenCore(state.kitchenCore, state.people);
        if (state.groups) this.validateGroups(state.groups);

        if (state.shifts) this.validateShifts(state.shifts);
        if (state.groupShifts) this.validateGroupShifts(state.groupShifts, state.groups, state.shifts);
    }

    // ... (ALLT OFÖRÄNDRAT fram till validatePerson)

    validatePerson(person, idx) {
        if (!person || typeof person !== 'object') throw new Error(`people[${idx}] måste vara objekt`);
        if (typeof person.id !== 'string' || !person.id) throw new Error(`people[${idx}].id måste vara non-empty string`);
        if (typeof person.firstName !== 'string') throw new Error(`people[${idx}].firstName måste vara string`);
        if (typeof person.lastName !== 'string') throw new Error(`people[${idx}].lastName måste vara string`);

        if (person.salary !== undefined && person.salary !== null) {
            if (typeof person.salary !== 'number' || person.salary < 0) throw new Error(`people[${idx}].salary måste vara number >= 0`);
        }

        if (typeof person.hourlyWage !== 'number' || person.hourlyWage < 0) throw new Error(`people[${idx}].hourlyWage måste vara number >= 0`);

        if (person.employerTaxRate !== undefined && person.employerTaxRate !== null) {
            if (typeof person.employerTaxRate !== 'number' || person.employerTaxRate < 0 || person.employerTaxRate > 1) {
                throw new Error(`people[${idx}].employerTaxRate måste vara 0–1 (decimal)`);
            }
        }

        if (person.taxRate !== undefined && person.taxRate !== null) {
            if (typeof person.taxRate !== 'number' || person.taxRate < 0 || person.taxRate > 1) {
                throw new Error(`people[${idx}].taxRate måste vara 0–1 (decimal)`);
            }
        }

        if (typeof person.employmentPct !== 'number' || person.employmentPct < 0 || person.employmentPct > 100) {
            throw new Error(`people[${idx}].employmentPct måste vara 0–100`);
        }
        if (typeof person.isActive !== 'boolean') throw new Error(`people[${idx}].isActive måste vara boolean`);
        if (typeof person.vacationDaysPerYear !== 'number' || person.vacationDaysPerYear < 0 || person.vacationDaysPerYear > 40) {
            throw new Error(`people[${idx}].vacationDaysPerYear måste vara 0–40`);
        }
        if (typeof person.extraDaysStartBalance !== 'number' || person.extraDaysStartBalance < 0 || person.extraDaysStartBalance > 365) {
            throw new Error(`people[${idx}].extraDaysStartBalance måste vara 0–365`);
        }

        // grupper (kan heta groups och/eller groupIds)
        if (person.groups !== undefined) {
            if (!Array.isArray(person.groups)) throw new Error(`people[${idx}].groups måste vara array`);
            person.groups.forEach((groupId, groupIdx) => {
                if (typeof groupId !== 'string' || !groupId) throw new Error(`people[${idx}].groups[${groupIdx}] måste vara non-empty string`);
            });
        }
        if (person.groupIds !== undefined) {
            if (!Array.isArray(person.groupIds)) throw new Error(`people[${idx}].groupIds måste vara array`);
        }

        // --- Personal-vy-fält (P0 kompat) ---
        if (person.name !== undefined && typeof person.name !== 'string') throw new Error(`people[${idx}].name måste vara string`);
        if (person.email !== undefined && typeof person.email !== 'string') throw new Error(`people[${idx}].email måste vara string`);
        if (person.phone !== undefined && person.phone !== null && typeof person.phone !== 'string') throw new Error(`people[${idx}].phone måste vara string|null`);
        if (person.startDate !== undefined && person.startDate !== null) {
            if (typeof person.startDate !== 'string') throw new Error(`people[${idx}].startDate måste vara string`);
        }
        if (person.degree !== undefined && typeof person.degree !== 'number') throw new Error(`people[${idx}].degree måste vara number`);
        if (person.workdaysPerWeek !== undefined && typeof person.workdaysPerWeek !== 'number') throw new Error(`people[${idx}].workdaysPerWeek måste vara number`);
        if (person.savedVacationDays !== undefined && typeof person.savedVacationDays !== 'number') throw new Error(`people[${idx}].savedVacationDays måste vara number`);
        if (person.savedLeaveDays !== undefined && typeof person.savedLeaveDays !== 'number') throw new Error(`people[${idx}].savedLeaveDays måste vara number`);
        if (person.sector !== undefined) {
            const ok = person.sector === 'private' || person.sector === 'municipal';
            if (!ok) throw new Error(`people[${idx}].sector måste vara "private"|"municipal"`);
        }
        if (person.availability !== undefined) {
            if (!Array.isArray(person.availability)) throw new Error(`people[${idx}].availability måste vara array`);
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

    // ... (ALLT OFÖRÄNDRAT efter validatePerson)

    /* ====================================================================
       MIGRATION & DEFAULT STATE
       ==================================================================== */

    migrate(state) {
        const base = this.createDefaultState();
        const s = (state && typeof state === 'object') ? state : {};

        if (!s.meta || typeof s.meta !== 'object') s.meta = {};
        if (!s.people || !Array.isArray(s.people)) s.people = [];
        if (!s.schedule || typeof s.schedule !== 'object') s.schedule = {};
        if (!s.settings || typeof s.settings !== 'object') s.settings = {};
        if (!s.demand || typeof s.demand !== 'object') s.demand = safeDeepClone(DEFAULT_DEMAND);
        if (!s.groups || typeof s.groups !== 'object') s.groups = safeDeepClone(DEFAULT_GROUPS);
        if (!s.shifts || typeof s.shifts !== 'object') s.shifts = safeDeepClone(DEFAULT_SHIFTS);
        if (!s.groupShifts || typeof s.groupShifts !== 'object') s.groupShifts = safeDeepClone(DEFAULT_GROUP_SHIFTS);

        const currentVersion = s.meta?.schemaVersion;
        if (!currentVersion) s.meta.schemaVersion = '1.0';
        else if (currentVersion !== '1.0') throw new Error(`Okänd schemaVersion "${currentVersion}" — kan inte migrera`);

        if (typeof s.meta.updatedAt !== 'number') s.meta.updatedAt = Date.now();
        if (!s.meta.appVersion) s.meta.appVersion = base.meta.appVersion;

        if (typeof s.schedule.year !== 'number') s.schedule.year = base.schedule.year;
        if (!Array.isArray(s.schedule.months) || s.schedule.months.length !== 12) s.schedule.months = base.schedule.months;
        else s.schedule.months = ensureMonthsShape(s.schedule.months, s.schedule.year, base.schedule.months);

        s.settings.defaultStart = typeof s.settings.defaultStart === 'string' ? s.settings.defaultStart : base.settings.defaultStart;
        s.settings.defaultEnd = typeof s.settings.defaultEnd === 'string' ? s.settings.defaultEnd : base.settings.defaultEnd;
        s.settings.breakStart = typeof s.settings.breakStart === 'string' ? s.settings.breakStart : base.settings.breakStart;
        s.settings.breakEnd = typeof s.settings.breakEnd === 'string' ? s.settings.breakEnd : base.settings.breakEnd;
        s.settings.hourlyWageIsDefault = typeof s.settings.hourlyWageIsDefault === 'boolean' ? s.settings.hourlyWageIsDefault : base.settings.hourlyWageIsDefault;
        s.settings.theme = s.settings.theme && typeof s.settings.theme === 'object' ? s.settings.theme : safeDeepClone(DEFAULT_THEME);

        if (!s.demand.groupDemands || typeof s.demand.groupDemands !== 'object') {
            s.demand.groupDemands = safeDeepClone(DEFAULT_DEMAND.groupDemands);
        } else {
            Object.keys(DEFAULT_DEMAND.groupDemands).forEach((gid) => {
                if (!Array.isArray(s.demand.groupDemands[gid]) || s.demand.groupDemands[gid].length !== 7) {
                    s.demand.groupDemands[gid] = safeDeepClone(DEFAULT_DEMAND.groupDemands[gid]);
                } else {
                    s.demand.groupDemands[gid] = s.demand.groupDemands[gid].map((v) => {
                        const n = typeof v === 'number' ? v : parseInt(v, 10);
                        if (!Number.isFinite(n) || n < 0) return 0;
                        if (n > 50) return 50;
                        return n;
                    });
                }
            });
        }

        if (!Array.isArray(s.demand.weekdayTemplate) || s.demand.weekdayTemplate.length !== 7) {
            s.demand.weekdayTemplate = safeDeepClone(DEFAULT_DEMAND.weekdayTemplate);
        }

        s.groups = normalizeGroupsMap(s.groups, DEFAULT_GROUPS);
        s.shifts = normalizeShiftsMap(s.shifts, DEFAULT_SHIFTS);
        s.groupShifts = normalizeGroupShifts(s.groupShifts, s.groups, s.shifts, DEFAULT_GROUP_SHIFTS);

        // P0: bevara personal-fält (normalizePerson uppdaterad)
        s.people = (s.people || []).map((p) => normalizePerson(p));

        if (s.schedule && Array.isArray(s.schedule.months)) {
            s.schedule.months.forEach((month) => {
                if (!month || !Array.isArray(month.days)) return;
                month.days.forEach((day) => {
                    if (!day || !Array.isArray(day.entries)) return;
                    day.entries = day.entries.map((e) => normalizeEntry(e));
                });
            });
        }

        return s;
    }

    createDefaultState() {
        const now = Date.now();
        const year = new Date().getFullYear();
        const months = buildMonths(year);

        return {
            meta: { schemaVersion: '1.0', updatedAt: now, appVersion: '1.0.0' },
            people: [],
            schedule: { year, months },
            settings: {
                defaultStart: '07:00',
                defaultEnd: '16:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                hourlyWageIsDefault: true,
                pinHash: '',
                enableP1Streak10: true,
                summaryToleranceHours: 0.25,
                theme: safeDeepClone(DEFAULT_THEME),
            },
            demand: safeDeepClone(DEFAULT_DEMAND),
            kitchenCore: { enabled: true, corePersonIds: [], minCorePerDay: 1 },
            groups: safeDeepClone(DEFAULT_GROUPS),
            shifts: safeDeepClone(DEFAULT_SHIFTS),
            groupShifts: safeDeepClone(DEFAULT_GROUP_SHIFTS),
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

/* ========================================================================
   BLOCK 7: SINGLETON INSTANCE & EXPORT
   ======================================================================== */

let storeInstance = null;

export function getStore() {
    if (!storeInstance) storeInstance = new Store();
    return storeInstance;
}

export default getStore();

/* ========================================================================
   BLOCK 8: HELPERS (internal)
   ======================================================================== */

function safeParseJSON(str) {
    try {
        return { ok: true, value: JSON.parse(str) };
    } catch (e) {
        return { ok: false, error: e?.message || 'Okänt JSON-fel' };
    }
}

function safeDeepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function isHHMM(v) {
    return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
}

function buildMonths(year) {
    const months = [];
    for (let m = 1; m <= 12; m++) {
        const daysInMonth = new Date(year, m, 0).getDate();
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            days.push({ date: dateStr, entries: [] });
        }
        months.push({
            month: m,
            days,
            timeDefaults: { start: '07:00', end: '16:00', breakStart: '12:00', breakEnd: '13:00' },
        });
    }
    return months;
}

function ensureMonthsShape(months, year, fallbackMonths) {
    const out = [];
    for (let i = 0; i < 12; i++) {
        const base = fallbackMonths[i];
        const m = months[i];
        if (!m || typeof m !== 'object' || typeof m.month !== 'number') {
            out.push(base);
            continue;
        }
        const monthNum = m.month;
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const days = Array.isArray(m.days) ? m.days : [];
        if (days.length !== daysInMonth) {
            out.push(base);
            continue;
        }
        const patchedDays = days.map((d) => {
            const day = d && typeof d === 'object' ? d : {};
            if (typeof day.date !== 'string') return null;
            if (!Array.isArray(day.entries)) day.entries = [];
            return day;
        });
        if (patchedDays.some((x) => x === null)) {
            out.push(base);
            continue;
        }
        out.push({
            month: monthNum,
            days: patchedDays,
            timeDefaults: (m.timeDefaults && typeof m.timeDefaults === 'object') ? m.timeDefaults : base.timeDefaults,
        });
    }
    return out;
}

function normalizeGroupsMap(groups, fallback) {
    const src = (groups && typeof groups === 'object') ? groups : {};
    const out = Object.create(null);

    Object.values(src).forEach((g) => {
        if (!g || typeof g !== 'object') return;
        const id = String(g.id ?? '').trim();
        if (!id) return;
        out[id] = {
            id,
            name: String(g.name ?? id),
            color: typeof g.color === 'string' ? g.color : (fallback[id]?.color || '#777'),
            textColor: typeof g.textColor === 'string' ? g.textColor : (fallback[id]?.textColor || '#fff'),
        };
    });

    Object.keys(fallback).forEach((key) => {
        const gid = String(fallback[key].id);
        if (!out[gid]) out[gid] = safeDeepClone(fallback[key]);
    });

    return out;
}

function normalizeShiftsMap(shifts, fallback) {
    const src = (shifts && typeof shifts === 'object') ? shifts : {};
    const out = Object.create(null);

    Object.values(src).forEach((s) => {
        if (!s || typeof s !== 'object') return;
        const id = String(s.id ?? '').trim();
        if (!id) return;

        out[id] = {
            id,
            name: String(s.name ?? id),
            shortName: typeof s.shortName === 'string' ? s.shortName : '',
            startTime: (s.startTime == null ? null : (isHHMM(s.startTime) ? s.startTime : null)),
            endTime: (s.endTime == null ? null : (isHHMM(s.endTime) ? s.endTime : null)),
            breakStart: (s.breakStart == null ? null : (isHHMM(s.breakStart) ? s.breakStart : null)),
            breakEnd: (s.breakEnd == null ? null : (isHHMM(s.breakEnd) ? s.breakEnd : null)),
            color: typeof s.color === 'string' ? s.color : (fallback[id]?.color || '#777'),
            description: typeof s.description === 'string' ? s.description : '',
        };
    });

    Object.keys(fallback).forEach((key) => {
        const sid = String(fallback[key].id);
        if (!out[sid]) out[sid] = safeDeepClone(fallback[key]);
    });

    return out;
}

function normalizeGroupShifts(groupShifts, groups, shifts, fallback) {
    const src = (groupShifts && typeof groupShifts === 'object') ? groupShifts : {};
    const out = Object.create(null);

    Object.keys(src).forEach((gidRaw) => {
        const gid = String(gidRaw);
        const arr = src[gidRaw];
        if (!Array.isArray(arr)) return;
        out[gid] = arr.map((x) => String(x ?? '').trim()).filter(Boolean).filter((sid) => !!shifts[sid]);
    });

    Object.keys(groups || {}).forEach((gid) => {
        const id = String(gid);
        if (!out[id]) {
            if (fallback && fallback[id]) out[id] = safeDeepClone(fallback[id]).filter((sid) => !!shifts[sid]);
            else out[id] = [];
        }
    });

    Object.keys(fallback || {}).forEach((gid) => {
        if (!out[gid]) out[gid] = safeDeepClone(fallback[gid]).filter((sid) => !!shifts[sid]);
    });

    return out;
}

function normalizeAvailability(av) {
    if (!Array.isArray(av)) return undefined;
    // boolean[7]
    const out = [];
    for (let i = 0; i < 7; i++) {
        out.push(Boolean(av[i]));
    }
    return out;
}

function toNumberOr(defaultVal, v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = (typeof v === 'string' && v.trim() !== '') ? Number(v) : NaN;
    return Number.isFinite(n) ? n : defaultVal;
}

function normalizePerson(p) {
    const person = (p && typeof p === 'object') ? p : {};
    const id = String(person.id ?? '').trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // groups kan komma som groups eller groupIds (Personal-vy)
    const groupsArrRaw = Array.isArray(person.groups) ? person.groups : (Array.isArray(person.groupIds) ? person.groupIds : undefined);
    const groups = Array.isArray(groupsArrRaw)
        ? groupsArrRaw.map((g) => String(g ?? '').trim()).filter(Boolean)
        : undefined;

    const sector = (person.sector === 'municipal') ? 'municipal' : 'private';

    // bevara "personal-vy" fält om de finns
    const name = (typeof person.name === 'string') ? person.name : undefined;
    const email = (typeof person.email === 'string') ? person.email : undefined;
    const phone = (person.phone === null || typeof person.phone === 'string') ? person.phone : undefined;
    const startDate = (typeof person.startDate === 'string') ? person.startDate : undefined;

    const degree = (person.degree !== undefined) ? toNumberOr(0, person.degree) : undefined;
    const workdaysPerWeek = (person.workdaysPerWeek !== undefined) ? toNumberOr(0, person.workdaysPerWeek) : undefined;
    const salary = (person.salary !== undefined) ? toNumberOr(0, person.salary) : undefined;
    const savedVacationDays = (person.savedVacationDays !== undefined) ? toNumberOr(0, person.savedVacationDays) : undefined;
    const savedLeaveDays = (person.savedLeaveDays !== undefined) ? toNumberOr(0, person.savedLeaveDays) : undefined;
    const availability = normalizeAvailability(person.availability);

    return {
        id,

        // schema-program kärnfält
        firstName: typeof person.firstName === 'string' ? person.firstName : '',
        lastName: typeof person.lastName === 'string' ? person.lastName : '',
        hourlyWage: typeof person.hourlyWage === 'number'
            ? person.hourlyWage
            : (Number.isFinite(parseFloat(person.hourlyWage)) ? parseFloat(person.hourlyWage) : 0),
        employmentPct: typeof person.employmentPct === 'number'
            ? person.employmentPct
            : (Number.isFinite(parseInt(person.employmentPct, 10)) ? parseInt(person.employmentPct, 10) : 0),
        isActive: typeof person.isActive === 'boolean' ? person.isActive : true,
        vacationDaysPerYear: typeof person.vacationDaysPerYear === 'number'
            ? person.vacationDaysPerYear
            : (Number.isFinite(parseInt(person.vacationDaysPerYear, 10)) ? parseInt(person.vacationDaysPerYear, 10) : 25),
        extraDaysStartBalance: typeof person.extraDaysStartBalance === 'number'
            ? person.extraDaysStartBalance
            : (Number.isFinite(parseInt(person.extraDaysStartBalance, 10)) ? parseInt(person.extraDaysStartBalance, 10) : 0),

        ...(groups !== undefined ? { groups } : {}),
        ...(groups !== undefined ? { groupIds: groups } : (Array.isArray(person.groupIds) ? { groupIds: person.groupIds } : {})),
        ...(person.skills && typeof person.skills === 'object' ? { skills: person.skills } : {}),

        // personal-vy fält (P0 kompat)
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(degree !== undefined ? { degree } : {}),
        ...(workdaysPerWeek !== undefined ? { workdaysPerWeek } : {}),
        ...(salary !== undefined ? { salary } : {}),
        ...(savedVacationDays !== undefined ? { savedVacationDays } : {}),
        ...(savedLeaveDays !== undefined ? { savedLeaveDays } : {}),
        ...(availability !== undefined ? { availability } : {}),
           sector,
        ...(person.createdAt ? { createdAt: person.createdAt } : {}),
        ...(person.updatedAt ? { updatedAt: person.updatedAt } : {}),
        ...(person.usedVacationDays !== undefined ? { usedVacationDays: toNumberOr(0, person.usedVacationDays) } : {}),
    };
}

function normalizeEntry(e) {
    const entry = (e && typeof e === 'object') ? e : {};
    return { ...entry, personId: String(entry.personId ?? '') };
}

