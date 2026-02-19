/*
 * AO-01 to AO-03 — STORE: Komplett state-hantering (AUTOPATCH v2.0)
 * FIL: store.js (HEL FIL)
 *
 * AO-03 ÄNDRINGAR (additiv, inget befintligt borttaget):
 * 1) Nya state-nycklar: shiftTemplates, weekTemplates, calendarWeeks,
 *    calendarOverrides, absences, vacancies, changeLog
 * 2) schedule utökad med entries{} och lockedWeeks[]
 * 3) settings utökad med helpAutoShow och helpDismissed
 * 4) normalizePerson utökad med: employmentType, calculationPeriodStart,
 *    maxCarryOverExtraDays, preferredShifts, avoidShifts, preferredDays, salaryType
 * 5) Nya validate-metoder: validateShiftTemplates, validateWeekTemplates,
 *    validateCalendarWeeks, validateCalendarOverrides, validateAbsences,
 *    validateVacancies, validateChangeLog
 * 6) migrate() säkrar alla nya nycklar med tomma defaults
 * 7) ALLA befintliga nycklar (groups, shifts, groupShifts, demand,
 *    kitchenCore, notifications, schedule.months, people som array)
 *    är 100% oförändrade.
 *
 * TIDIGARE ÄNDRINGSLOGG:
 * 1) P0: FIX — Återinfört saknade validate*-metoder (validateMonthSchedule m.fl.)
 * 2) P0: normalizePerson bevarar personal-fält
 * 3) P0: validatePerson tillåter dessa fält
 * 4) P0: groups i person kan härledas från groupIds
 * 5) P0: availability normaliseras till boolean[7]
 */

const STORAGE_KEY_STATE = 'SCHEMA_APP_V1_STATE';

/* ========================================================================
   BLOCK 1: DEFAULT GROUPS (AO-02B) — OFÖRÄNDRAD
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
   BLOCK 2: DEFAULT SHIFTS (AO-02D) — OFÖRÄNDRAD
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
   BLOCK 3: DEFAULT GROUP SHIFTS (AO-02D) — OFÖRÄNDRAD
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
   BLOCK 4: DEFAULT THEME — OFÖRÄNDRAD
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
   BLOCK 5: DEFAULT DEMAND (AO-02C) — OFÖRÄNDRAD
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
   BLOCK 5B: FRÅNVAROTYPER (AO-03 NY)
   Giltiga absence.type-värden. Används av validateAbsences.
   ======================================================================== */

const VALID_ABSENCE_TYPES = ['SEM', 'SJ', 'VAB', 'FÖR', 'PERM', 'UTB'];
const VALID_ABSENCE_PATTERNS = ['single', 'range', 'recurring'];
const VALID_VACANCY_STATUSES = ['open', 'offered', 'accepted', 'filled'];
const VALID_EMPLOYMENT_TYPES = ['regular', 'substitute'];
const VALID_SALARY_TYPES = ['monthly', 'hourly'];

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

        // AO-03: Räkna även nya schedule.entries
        let newEntryCount = 0;
        if (state.schedule && state.schedule.entries && typeof state.schedule.entries === 'object') {
            Object.values(state.schedule.entries).forEach((dayEntries) => {
                if (Array.isArray(dayEntries)) newEntryCount += dayEntries.length;
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
            newScheduleEntries: newEntryCount,
            months: state.schedule?.months?.length || 0,
            weekTemplates: state.weekTemplates ? Object.keys(state.weekTemplates).length : 0,
            shiftTemplates: state.shiftTemplates ? Object.keys(state.shiftTemplates).length : 0,
            absences: Array.isArray(state.absences) ? state.absences.length : 0,
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

        // AO-03: Validera nya nycklar (tolerant — finns de, valideras de)
        if (state.shiftTemplates) this.validateShiftTemplates(state.shiftTemplates);
        if (state.weekTemplates) this.validateWeekTemplates(state.weekTemplates);
        if (state.calendarWeeks) this.validateCalendarWeeks(state.calendarWeeks);
        if (state.calendarOverrides) this.validateCalendarOverrides(state.calendarOverrides);
        if (state.absences) this.validateAbsences(state.absences);
        if (state.vacancies) this.validateVacancies(state.vacancies);
        if (state.changeLog) this.validateChangeLog(state.changeLog);
        if (state.schedule.entries) this.validateScheduleEntries(state.schedule.entries);
        if (state.schedule.lockedWeeks) this.validateLockedWeeks(state.schedule.lockedWeeks);
    }

    validateMonthSchedule(month, idx, year) {
        if (!month || typeof month !== 'object') throw new Error(`schedule.months[${idx}] måste vara objekt`);
        if (typeof month.month !== 'number' || month.month < 1 || month.month > 12) {
            throw new Error(`schedule.months[${idx}].month måste vara 1–12`);
        }
        if (!Array.isArray(month.days)) throw new Error(`schedule.months[${idx}].days måste vara array`);

        const daysInMonth = new Date(year, month.month, 0).getDate();
        if (month.days.length !== daysInMonth) {
            throw new Error(`schedule.months[${idx}].days måste ha ${daysInMonth} dagar`);
        }

        month.days.forEach((day, dIdx) => {
            if (!day || typeof day !== 'object') throw new Error(`months[${idx}].days[${dIdx}] måste vara objekt`);
            if (typeof day.date !== 'string') throw new Error(`months[${idx}].days[${dIdx}].date måste vara string`);
            if (!Array.isArray(day.entries)) throw new Error(`months[${idx}].days[${dIdx}].entries måste vara array`);
            day.entries.forEach((e, eIdx) => {
                if (!e || typeof e !== 'object') throw new Error(`entries[${eIdx}] måste vara objekt`);
                if (typeof e.personId !== 'string') throw new Error(`entries[${eIdx}].personId måste vara string`);
                // Övriga entry-fält valideras inte här (scope: bevara befintliga varianter)
            });
        });

        if (month.timeDefaults !== undefined) {
            if (!month.timeDefaults || typeof month.timeDefaults !== 'object') {
                throw new Error(`schedule.months[${idx}].timeDefaults måste vara objekt`);
            }
            const td = month.timeDefaults;
            ['start', 'end', 'breakStart', 'breakEnd'].forEach((k) => {
                if (td[k] !== undefined && td[k] !== null && !isHHMM(td[k])) {
                    throw new Error(`schedule.months[${idx}].timeDefaults.${k} måste vara HH:MM`);
                }
            });
        }
    }

    validateSettings(settings) {
        if (!settings || typeof settings !== 'object') throw new Error('settings måste vara objekt');

        if (!isHHMM(settings.defaultStart)) throw new Error('settings.defaultStart måste vara HH:MM');
        if (!isHHMM(settings.defaultEnd)) throw new Error('settings.defaultEnd måste vara HH:MM');
        if (!isHHMM(settings.breakStart)) throw new Error('settings.breakStart måste vara HH:MM');
        if (!isHHMM(settings.breakEnd)) throw new Error('settings.breakEnd måste vara HH:MM');

        if (typeof settings.hourlyWageIsDefault !== 'boolean') throw new Error('settings.hourlyWageIsDefault måste vara boolean');

        if (settings.pinHash !== undefined && typeof settings.pinHash !== 'string') throw new Error('settings.pinHash måste vara string');
        if (settings.enableP1Streak10 !== undefined && typeof settings.enableP1Streak10 !== 'boolean') throw new Error('settings.enableP1Streak10 måste vara boolean');
        if (settings.summaryToleranceHours !== undefined && typeof settings.summaryToleranceHours !== 'number') throw new Error('settings.summaryToleranceHours måste vara number');

        if (!settings.theme || typeof settings.theme !== 'object') throw new Error('settings.theme måste vara objekt');
        if (settings.theme.statusColors !== undefined && typeof settings.theme.statusColors !== 'object') throw new Error('settings.theme.statusColors måste vara objekt');
        if (settings.theme.statusTextColors !== undefined && typeof settings.theme.statusTextColors !== 'object') throw new Error('settings.theme.statusTextColors måste vara objekt');

        // AO-03: Nya settings-fält (tolerant)
        if (settings.helpAutoShow !== undefined && typeof settings.helpAutoShow !== 'boolean') throw new Error('settings.helpAutoShow måste vara boolean');
        if (settings.helpDismissed !== undefined && (typeof settings.helpDismissed !== 'object' || settings.helpDismissed === null)) throw new Error('settings.helpDismissed måste vara objekt');
    }

    validateDemand(demand) {
        if (!demand || typeof demand !== 'object') throw new Error('demand måste vara objekt');

        if (!demand.groupDemands || typeof demand.groupDemands !== 'object') throw new Error('demand.groupDemands måste vara objekt');
        Object.keys(demand.groupDemands).forEach((gid) => {
            const arr = demand.groupDemands[gid];
            if (!Array.isArray(arr) || arr.length !== 7) throw new Error(`demand.groupDemands.${gid} måste vara array[7]`);
            arr.forEach((v, i) => {
                if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
                    throw new Error(`demand.groupDemands.${gid}[${i}] måste vara number >= 0`);
                }
            });
        });

        if (demand.weekdayTemplate !== undefined) {
            if (!Array.isArray(demand.weekdayTemplate) || demand.weekdayTemplate.length !== 7) {
                throw new Error('demand.weekdayTemplate måste vara array[7]');
            }
        }
    }

    validateKitchenCore(kitchenCore, people) {
        if (!kitchenCore || typeof kitchenCore !== 'object') throw new Error('kitchenCore måste vara objekt');
        if (typeof kitchenCore.enabled !== 'boolean') throw new Error('kitchenCore.enabled måste vara boolean');
        if (!Array.isArray(kitchenCore.corePersonIds)) throw new Error('kitchenCore.corePersonIds måste vara array');
        if (typeof kitchenCore.minCorePerDay !== 'number' || kitchenCore.minCorePerDay < 0 || kitchenCore.minCorePerDay > 50) {
            throw new Error('kitchenCore.minCorePerDay måste vara 0–50');
        }

        kitchenCore.corePersonIds.forEach((id) => {
            if (typeof id !== 'string') throw new Error('kitchenCore.corePersonIds måste vara string[]');
        });
    }

    validateGroups(groups) {
        if (!groups || typeof groups !== 'object') throw new Error('groups måste vara objekt');
        Object.values(groups).forEach((g) => {
            if (!g || typeof g !== 'object') throw new Error('groups innehåller ogiltig post');
            if (typeof g.id !== 'string' || !g.id) throw new Error('group.id måste vara non-empty string');
            if (typeof g.name !== 'string') throw new Error(`group(${g.id}).name måste vara string`);
            if (g.color !== undefined && typeof g.color !== 'string') throw new Error(`group(${g.id}).color måste vara string`);
            if (g.textColor !== undefined && typeof g.textColor !== 'string') throw new Error(`group(${g.id}).textColor måste vara string`);
            // AO-03: shiftTemplateIds är tillåtet på groups (för framtida koppling grupp→grundpass)
            if (g.shiftTemplateIds !== undefined && !Array.isArray(g.shiftTemplateIds)) throw new Error(`group(${g.id}).shiftTemplateIds måste vara array`);
        });
    }

    validateShifts(shifts) {
        if (!shifts || typeof shifts !== 'object') throw new Error('shifts måste vara objekt');
        Object.values(shifts).forEach((s) => {
            if (!s || typeof s !== 'object') throw new Error('shifts innehåller ogiltig post');
            if (typeof s.id !== 'string' || !s.id) throw new Error('shift.id måste vara non-empty string');
            if (typeof s.name !== 'string') throw new Error(`shift(${s.id}).name måste vara string`);
            if (s.shortName !== undefined && typeof s.shortName !== 'string') throw new Error(`shift(${s.id}).shortName måste vara string`);

            ['startTime', 'endTime', 'breakStart', 'breakEnd'].forEach((k) => {
                const v = s[k];
                if (v !== null && v !== undefined && !isHHMM(v)) {
                    throw new Error(`shift(${s.id}).${k} måste vara HH:MM eller null`);
                }
            });

            if (s.color !== undefined && typeof s.color !== 'string') throw new Error(`shift(${s.id}).color måste vara string`);
            if (s.description !== undefined && typeof s.description !== 'string') throw new Error(`shift(${s.id}).description måste vara string`);
        });
    }

    validateGroupShifts(groupShifts, groups, shifts) {
        if (!groupShifts || typeof groupShifts !== 'object') throw new Error('groupShifts måste vara objekt');

        Object.keys(groupShifts).forEach((gid) => {
            const arr = groupShifts[gid];
            if (!Array.isArray(arr)) throw new Error(`groupShifts.${gid} måste vara array`);
            arr.forEach((sid) => {
                if (typeof sid !== 'string' || !sid) throw new Error(`groupShifts.${gid} innehåller ogiltigt shiftId`);
                if (shifts && shifts[sid] === undefined) throw new Error(`groupShifts.${gid} refererar okänt shiftId "${sid}"`);
            });
            if (groups && groups[gid] === undefined) {
                throw new Error(`groupShifts har okänt groupId "${gid}"`);
            }
        });
    }

    /* ====================================================================
       AO-03: NYA VALIDATE-METODER
       ==================================================================== */

    validateShiftTemplates(shiftTemplates) {
        if (!shiftTemplates || typeof shiftTemplates !== 'object') throw new Error('shiftTemplates måste vara objekt');
        Object.values(shiftTemplates).forEach((st) => {
            if (!st || typeof st !== 'object') throw new Error('shiftTemplates innehåller ogiltig post');
            if (typeof st.id !== 'string' || !st.id) throw new Error('shiftTemplate.id måste vara non-empty string');
            if (typeof st.name !== 'string') throw new Error(`shiftTemplate(${st.id}).name måste vara string`);

            ['startTime', 'endTime', 'breakStart', 'breakEnd'].forEach((k) => {
                const v = st[k];
                if (v !== null && v !== undefined && !isHHMM(v)) {
                    throw new Error(`shiftTemplate(${st.id}).${k} måste vara HH:MM eller null`);
                }
            });

            if (st.color !== undefined && typeof st.color !== 'string') throw new Error(`shiftTemplate(${st.id}).color måste vara string`);
            if (st.costCenter !== undefined && typeof st.costCenter !== 'string') throw new Error(`shiftTemplate(${st.id}).costCenter måste vara string`);
            if (st.workplace !== undefined && typeof st.workplace !== 'string') throw new Error(`shiftTemplate(${st.id}).workplace måste vara string`);
        });
    }

    validateWeekTemplates(weekTemplates) {
        if (!weekTemplates || typeof weekTemplates !== 'object') throw new Error('weekTemplates måste vara objekt');
        Object.values(weekTemplates).forEach((wt) => {
            if (!wt || typeof wt !== 'object') throw new Error('weekTemplates innehåller ogiltig post');
            if (typeof wt.id !== 'string' || !wt.id) throw new Error('weekTemplate.id måste vara non-empty string');
            if (typeof wt.name !== 'string') throw new Error(`weekTemplate(${wt.id}).name måste vara string`);
            if (!Array.isArray(wt.slots)) throw new Error(`weekTemplate(${wt.id}).slots måste vara array`);

            wt.slots.forEach((slot, sIdx) => {
                if (!slot || typeof slot !== 'object') throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}] måste vara objekt`);
                if (typeof slot.dayOfWeek !== 'number' || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
                    throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}].dayOfWeek måste vara 0–6`);
                }
                if (typeof slot.groupId !== 'string' || !slot.groupId) {
                    throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}].groupId måste vara non-empty string`);
                }
                if (typeof slot.shiftTemplateId !== 'string' || !slot.shiftTemplateId) {
                    throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}].shiftTemplateId måste vara non-empty string`);
                }
                if (typeof slot.count !== 'number' || slot.count < 0 || slot.count > 50) {
                    throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}].count måste vara 0–50`);
                }
                if (typeof slot.countMin !== 'number' || slot.countMin < 0 || slot.countMin > 50) {
                    throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}].countMin måste vara 0–50`);
                }
                if (slot.countMin > slot.count) {
                    throw new Error(`weekTemplate(${wt.id}).slots[${sIdx}].countMin (${slot.countMin}) kan inte vara > count (${slot.count})`);
                }
            });
        });
    }

    validateCalendarWeeks(calendarWeeks) {
        if (!calendarWeeks || typeof calendarWeeks !== 'object') throw new Error('calendarWeeks måste vara objekt');
        Object.keys(calendarWeeks).forEach((weekKey) => {
            // Vecko-nyckel ska vara format "YYYY-Wnn"
            if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
                throw new Error(`calendarWeeks nyckel "${weekKey}" måste vara format YYYY-Wnn`);
            }
            const templateId = calendarWeeks[weekKey];
            if (typeof templateId !== 'string' || !templateId) {
                throw new Error(`calendarWeeks["${weekKey}"] måste vara non-empty string (weekTemplate id)`);
            }
        });
    }

    validateCalendarOverrides(calendarOverrides) {
        if (!calendarOverrides || typeof calendarOverrides !== 'object') throw new Error('calendarOverrides måste vara objekt');
        Object.keys(calendarOverrides).forEach((dateKey) => {
            // Datum-nyckel ska vara format "YYYY-MM-DD"
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                throw new Error(`calendarOverrides nyckel "${dateKey}" måste vara format YYYY-MM-DD`);
            }
            const overrides = calendarOverrides[dateKey];
            if (!Array.isArray(overrides)) {
                throw new Error(`calendarOverrides["${dateKey}"] måste vara array`);
            }
            overrides.forEach((ov, idx) => {
                if (!ov || typeof ov !== 'object') throw new Error(`calendarOverrides["${dateKey}"][${idx}] måste vara objekt`);
                if (typeof ov.groupId !== 'string' || !ov.groupId) throw new Error(`calendarOverrides["${dateKey}"][${idx}].groupId måste vara non-empty string`);
                if (typeof ov.shiftTemplateId !== 'string' || !ov.shiftTemplateId) throw new Error(`calendarOverrides["${dateKey}"][${idx}].shiftTemplateId måste vara non-empty string`);
                if (typeof ov.count !== 'number' || ov.count < 0) throw new Error(`calendarOverrides["${dateKey}"][${idx}].count måste vara number >= 0`);
                if (typeof ov.countMin !== 'number' || ov.countMin < 0) throw new Error(`calendarOverrides["${dateKey}"][${idx}].countMin måste vara number >= 0`);
            });
        });
    }

    validateAbsences(absences) {
        if (!Array.isArray(absences)) throw new Error('absences måste vara array');
        absences.forEach((abs, idx) => {
            if (!abs || typeof abs !== 'object') throw new Error(`absences[${idx}] måste vara objekt`);
            if (typeof abs.id !== 'string' || !abs.id) throw new Error(`absences[${idx}].id måste vara non-empty string`);
            if (typeof abs.personId !== 'string' || !abs.personId) throw new Error(`absences[${idx}].personId måste vara non-empty string`);
            if (!VALID_ABSENCE_TYPES.includes(abs.type)) throw new Error(`absences[${idx}].type "${abs.type}" är ogiltig (${VALID_ABSENCE_TYPES.join('|')})`);
            if (!VALID_ABSENCE_PATTERNS.includes(abs.pattern)) throw new Error(`absences[${idx}].pattern "${abs.pattern}" är ogiltig (${VALID_ABSENCE_PATTERNS.join('|')})`);

            if (abs.pattern === 'single') {
                if (abs.date !== null && abs.date !== undefined && typeof abs.date !== 'string') throw new Error(`absences[${idx}].date måste vara string|null`);
            }
            if (abs.pattern === 'range' || abs.pattern === 'recurring') {
                if (abs.startDate !== null && abs.startDate !== undefined && typeof abs.startDate !== 'string') throw new Error(`absences[${idx}].startDate måste vara string|null`);
                if (abs.endDate !== null && abs.endDate !== undefined && typeof abs.endDate !== 'string') throw new Error(`absences[${idx}].endDate måste vara string|null`);
            }
            if (abs.pattern === 'recurring') {
                if (abs.days !== null && abs.days !== undefined && !Array.isArray(abs.days)) throw new Error(`absences[${idx}].days måste vara array|null`);
            }
            if (abs.note !== undefined && abs.note !== null && typeof abs.note !== 'string') throw new Error(`absences[${idx}].note måste vara string|null`);
        });
    }

    validateVacancies(vacancies) {
        if (!Array.isArray(vacancies)) throw new Error('vacancies måste vara array');
        vacancies.forEach((vac, idx) => {
            if (!vac || typeof vac !== 'object') throw new Error(`vacancies[${idx}] måste vara objekt`);
            if (typeof vac.id !== 'string' || !vac.id) throw new Error(`vacancies[${idx}].id måste vara non-empty string`);
            if (typeof vac.date !== 'string') throw new Error(`vacancies[${idx}].date måste vara string`);
            if (typeof vac.groupId !== 'string') throw new Error(`vacancies[${idx}].groupId måste vara string`);
            if (typeof vac.shiftTemplateId !== 'string') throw new Error(`vacancies[${idx}].shiftTemplateId måste vara string`);
            if (!VALID_VACANCY_STATUSES.includes(vac.status)) throw new Error(`vacancies[${idx}].status "${vac.status}" är ogiltig`);
            if (vac.offeredTo !== undefined && !Array.isArray(vac.offeredTo)) throw new Error(`vacancies[${idx}].offeredTo måste vara array`);
            if (vac.acceptedBy !== undefined && vac.acceptedBy !== null && typeof vac.acceptedBy !== 'string') throw new Error(`vacancies[${idx}].acceptedBy måste vara string|null`);
        });
    }

    validateChangeLog(changeLog) {
        if (!Array.isArray(changeLog)) throw new Error('changeLog måste vara array');
        changeLog.forEach((entry, idx) => {
            if (!entry || typeof entry !== 'object') throw new Error(`changeLog[${idx}] måste vara objekt`);
            if (typeof entry.timestamp !== 'string') throw new Error(`changeLog[${idx}].timestamp måste vara string`);
            if (typeof entry.action !== 'string') throw new Error(`changeLog[${idx}].action måste vara string`);
        });
    }

    validateScheduleEntries(entries) {
        if (!entries || typeof entries !== 'object') throw new Error('schedule.entries måste vara objekt');
        Object.keys(entries).forEach((dateKey) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                throw new Error(`schedule.entries nyckel "${dateKey}" måste vara format YYYY-MM-DD`);
            }
            const dayEntries = entries[dateKey];
            if (!Array.isArray(dayEntries)) throw new Error(`schedule.entries["${dateKey}"] måste vara array`);
            dayEntries.forEach((e, idx) => {
                if (!e || typeof e !== 'object') throw new Error(`schedule.entries["${dateKey}"][${idx}] måste vara objekt`);
                if (typeof e.groupId !== 'string') throw new Error(`schedule.entries["${dateKey}"][${idx}].groupId måste vara string`);
                if (typeof e.shiftTemplateId !== 'string') throw new Error(`schedule.entries["${dateKey}"][${idx}].shiftTemplateId måste vara string`);
                if (typeof e.status !== 'string') throw new Error(`schedule.entries["${dateKey}"][${idx}].status måste vara string`);
                // personId kan vara null (vakans) eller string
                if (e.personId !== null && e.personId !== undefined && typeof e.personId !== 'string') {
                    throw new Error(`schedule.entries["${dateKey}"][${idx}].personId måste vara string|null`);
                }
            });
        });
    }

    validateLockedWeeks(lockedWeeks) {
        if (!Array.isArray(lockedWeeks)) throw new Error('schedule.lockedWeeks måste vara array');
        lockedWeeks.forEach((wk, idx) => {
            if (typeof wk !== 'string' || !/^\d{4}-W\d{2}$/.test(wk)) {
                throw new Error(`schedule.lockedWeeks[${idx}] "${wk}" måste vara format YYYY-Wnn`);
            }
        });
    }

    /* ====================================================================
       BEFINTLIG validatePerson — UTÖKAD MED AO-03-FÄLT
       ==================================================================== */

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

        // --- AO-03: Nya person-fält (tolerant validering) ---
        if (person.employmentType !== undefined && !VALID_EMPLOYMENT_TYPES.includes(person.employmentType)) {
            throw new Error(`people[${idx}].employmentType måste vara "regular"|"substitute"`);
        }
        if (person.calculationPeriodStart !== undefined && person.calculationPeriodStart !== null && typeof person.calculationPeriodStart !== 'string') {
            throw new Error(`people[${idx}].calculationPeriodStart måste vara string|null`);
        }
        if (person.maxCarryOverExtraDays !== undefined) {
            if (typeof person.maxCarryOverExtraDays !== 'number' || person.maxCarryOverExtraDays < 0 || person.maxCarryOverExtraDays > 30) {
                throw new Error(`people[${idx}].maxCarryOverExtraDays måste vara 0–30`);
            }
        }
        if (person.salaryType !== undefined && !VALID_SALARY_TYPES.includes(person.salaryType)) {
            throw new Error(`people[${idx}].salaryType måste vara "monthly"|"hourly"`);
        }
        if (person.preferredShifts !== undefined && !Array.isArray(person.preferredShifts)) {
            throw new Error(`people[${idx}].preferredShifts måste vara array`);
        }
        if (person.avoidShifts !== undefined && !Array.isArray(person.avoidShifts)) {
            throw new Error(`people[${idx}].avoidShifts måste vara array`);
        }
        if (person.preferredDays !== undefined && !Array.isArray(person.preferredDays)) {
            throw new Error(`people[${idx}].preferredDays måste vara array`);
        }
    }

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

        // AO-03: Nya settings-fält (additiv)
        if (typeof s.settings.helpAutoShow !== 'boolean') s.settings.helpAutoShow = true;
        if (!s.settings.helpDismissed || typeof s.settings.helpDismissed !== 'object') s.settings.helpDismissed = {};

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

        // AO-03: Nya top-level nycklar (additiv, tomma defaults om de saknas)
        if (!s.shiftTemplates || typeof s.shiftTemplates !== 'object') s.shiftTemplates = {};
        if (!s.weekTemplates || typeof s.weekTemplates !== 'object') s.weekTemplates = {};
        if (!s.calendarWeeks || typeof s.calendarWeeks !== 'object') s.calendarWeeks = {};
        if (!s.calendarOverrides || typeof s.calendarOverrides !== 'object') s.calendarOverrides = {};
        if (!Array.isArray(s.absences)) s.absences = [];
        if (!Array.isArray(s.vacancies)) s.vacancies = [];
        if (!Array.isArray(s.changeLog)) s.changeLog = [];

        // AO-03: Nya schedule-nycklar (additiv)
        if (!s.schedule.entries || typeof s.schedule.entries !== 'object') s.schedule.entries = {};
        if (!Array.isArray(s.schedule.lockedWeeks)) s.schedule.lockedWeeks = [];

        // P0: bevara personal-fält (normalizePerson uppdaterad med AO-03-fält)
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
            schedule: {
                year,
                months,
                // AO-03: Nya schedule-nycklar
                entries: {},
                lockedWeeks: [],
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
                theme: safeDeepClone(DEFAULT_THEME),
                // AO-03: Nya settings-fält
                helpAutoShow: true,
                helpDismissed: {},
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
            // AO-03: Nya top-level nycklar
            shiftTemplates: {},
            weekTemplates: {},
            calendarWeeks: {},
            calendarOverrides: {},
            absences: [],
            vacancies: [],
            changeLog: [],
        };
    }
}

/* ========================================================================
   BLOCK 7: SINGLETON INSTANCE & EXPORT — OFÖRÄNDRAD
   ======================================================================== */

let storeInstance = null;

export function getStore() {
    if (!storeInstance) storeInstance = new Store();
    return storeInstance;
}

export default getStore();

/* ========================================================================
   BLOCK 8: HELPERS (internal) — OFÖRÄNDRADE
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
            timeDefaults: { start: '07:00', end: '16:00', breakStart: '12:00
