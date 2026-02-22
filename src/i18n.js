/*
 * AO-13 — INTERNATIONALISERING (i18n)
 * FIL: src/i18n.js
 *
 * Centraliserade texter för hela applikationen.
 * Stödjer svenska (sv) och engelska (en).
 *
 * Användning:
 *   import { t, setLocale, getLocale } from './i18n.js';
 *   t('nav.home')        → 'Hem'
 *   t('nav.home', 'en')  → 'Home'
 *   t('greeting', null, { name: 'Anna' }) → 'Hej Anna!'
 *
 * Kontrakt:
 *   - Exporterar t(), setLocale(), getLocale(), LOCALES
 *   - Fallback: om nyckel saknas → returnerar nyckeln
 *   - Fallback: om språk saknas → svenska
 */

/* ── SPRÅK ── */
let currentLocale = 'sv';

export const LOCALES = {
    sv: { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
    en: { code: 'en', name: 'English', flag: '🇬🇧' },
};

/* ── API ── */

export function setLocale(locale) {
    if (LOCALES[locale]) {
        currentLocale = locale;
        try { localStorage.setItem('schema-locale', locale); } catch {}
    }
}

export function getLocale() {
    return currentLocale;
}

/**
 * Hämta en översatt text
 * @param {string} key - Nyckeln (t.ex. 'nav.home')
 * @param {string} [locale] - Språk (default: currentLocale)
 * @param {object} [vars] - Variabler att byta ut: { name: 'Anna' } → {{name}} → Anna
 * @returns {string}
 */
export function t(key, locale, vars) {
    const lang = locale || currentLocale;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['sv'];

    // Stöd nästade nycklar: 'nav.home' → dict.nav.home
    const parts = key.split('.');
    let value = dict;
    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            // Fallback till svenska
            value = null;
            break;
        }
    }

    // Fallback till svenska om nyckeln inte fanns i valt språk
    if (value === null || value === undefined) {
        let svValue = TRANSLATIONS['sv'];
        for (const part of parts) {
            if (svValue && typeof svValue === 'object' && part in svValue) {
                svValue = svValue[part];
            } else {
                return key; // nyckeln finns inte alls → returnera nyckeln
            }
        }
        value = svValue;
    }

    if (typeof value !== 'string') return key;

    // Byt ut {{variabler}}
    if (vars && typeof vars === 'object') {
        return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return vars[varName] !== undefined ? String(vars[varName]) : match;
        });
    }

    return value;
}

/* ── Initiera från localStorage ── */
try {
    const saved = localStorage.getItem('schema-locale');
    if (saved && LOCALES[saved]) currentLocale = saved;
} catch {}

/* ══════════════════════════════════════════════════════════════
 * ÖVERSÄTTNINGAR
 * ══════════════════════════════════════════════════════════════ */

const TRANSLATIONS = {

    /* ──────────────────────────────────────────────
     * SVENSKA
     * ────────────────────────────────────────────── */
    sv: {
        app: {
            title: 'Schema-Program',
            version: 'v3.0',
            tagline: 'Schemaläggning för restaurang & hotell',
        },

        nav: {
            home: 'Hem',
            personal: 'Personal',
            groups: 'Grupper',
            shifts: 'Pass',
            weekTemplates: 'Veckomallar',
            calendar: 'Kalender',
            control: 'Kontroll',
            summary: 'Sammanställning',
            rules: 'Regler',
            export: 'Export',
            help: 'Hjälp',
            logout: 'Logga ut',
        },

        common: {
            save: 'Spara',
            cancel: 'Avbryt',
            delete: 'Ta bort',
            edit: 'Redigera',
            create: 'Skapa',
            close: 'Stäng',
            yes: 'Ja',
            no: 'Nej',
            ok: 'OK',
            loading: 'Laddar...',
            error: 'Fel',
            warning: 'Varning',
            success: 'Klar',
            active: 'Aktiv',
            inactive: 'Inaktiv',
            total: 'Totalt',
            search: 'Sök',
            filter: 'Filtrera',
            noData: 'Ingen data',
            confirm: 'Bekräfta',
            back: 'Tillbaka',
        },

        days: {
            mon: 'Mån', tue: 'Tis', wed: 'Ons', thu: 'Tor',
            fri: 'Fre', sat: 'Lör', sun: 'Sön',
            monday: 'Måndag', tuesday: 'Tisdag', wednesday: 'Onsdag',
            thursday: 'Torsdag', friday: 'Fredag', saturday: 'Lördag',
            sunday: 'Söndag',
        },

        months: {
            jan: 'Januari', feb: 'Februari', mar: 'Mars',
            apr: 'April', may: 'Maj', jun: 'Juni',
            jul: 'Juli', aug: 'Augusti', sep: 'September',
            oct: 'Oktober', nov: 'November', dec: 'December',
        },

        status: {
            A: 'Arbete',
            L: 'Ledig',
            X: 'Ej tillgänglig',
            SEM: 'Semester',
            SJ: 'Sjuk',
            VAB: 'Vård av barn',
            PERM: 'Permission',
            UTB: 'Utbildning',
            EXTRA: 'Extrapersonal behövs',
            FÖR: 'Föräldraledig',
            TJL: 'Tjänstledig',
        },

        rules: {
            title: 'Arbetstidsregler',
            newRule: '+ Ny regel',
            editRule: 'Redigera regel',
            noRules: 'Inga regler definierade',
            noRulesDesc: 'Skapa arbetstidsregler som schemat ska följa.',
            systemRule: 'Systemregel — alltid aktiv',
            value: 'Värde',
            unit: 'Enhet',
            source: 'Källa',
            severity: 'Allvarlighetsgrad',
            appliesTo: 'Gäller för',
            consequence: 'Konsekvens vid brott',
            p0: 'P0 — Blockerar',
            p1: 'P1 — Nedprioriterar',
            categories: {
                time: 'Arbetstid',
                rest: 'Vila & Rotation',
                staff: 'Bemanning & Tillgänglighet',
                cost: 'Kostnad & OB',
                priority: 'Prioritering',
                custom: 'Övrigt',
            },
        },

        personal: {
            title: 'Personal',
            addPerson: '+ Lägg till',
            firstName: 'Förnamn',
            lastName: 'Efternamn',
            phone: 'Telefon',
            email: 'E-post',
            employmentPct: 'Sysselsättningsgrad',
            salary: 'Månadslön',
            startDate: 'Startdatum',
            workdaysPerWeek: 'Arbetsdagar/vecka',
            group: 'Grupp',
            employmentType: 'Anställningstyp',
            permanent: 'Tillsvidareanställd',
            substitute: 'Vikarie',
        },

        calendar: {
            title: 'Kalender',
            today: 'Idag',
            week: 'Vecka',
            month: 'Månad',
        },

        control: {
            title: 'Kontroll',
            generate: 'Generera schema',
            generating: 'Genererar...',
            selectGroups: 'Välj grupper',
            noGroups: 'Inga grupper valda',
            vacancies: 'Vakanser',
            warnings: 'Varningar',
            rulesApplied: 'Regler tillämpade',
        },

        help: {
            title: 'Hjälp & Guide',
            subtitle: 'Lär dig hur du använder Schema-Program',
            gettingStarted: 'Kom igång',
            faq: 'Vanliga frågor',
            shortcuts: 'Kortkommandon',
            about: 'Om programmet',
        },

        errors: {
            stateInvalid: 'State saknas eller är fel typ',
            scheduleMissing: 'Schedule saknas i state',
            invalidYear: 'Input.year måste vara ett giltigt år',
            invalidMonth: 'Månad måste vara 1–12',
            noGroups: 'Inga grupper valda. Välj minst en grupp i filtret innan generering.',
            noActivePeople: 'Ingen aktiv personal hör till de valda grupperna.',
            demandMissing: 'Bemanningsbehov saknas',
        },
    },

    /* ──────────────────────────────────────────────
     * ENGLISH
     * ────────────────────────────────────────────── */
    en: {
        app: {
            title: 'Schedule Program',
            version: 'v3.0',
            tagline: 'Scheduling for restaurants & hotels',
        },

        nav: {
            home: 'Home',
            personal: 'Staff',
            groups: 'Groups',
            shifts: 'Shifts',
            weekTemplates: 'Week Templates',
            calendar: 'Calendar',
            control: 'Control',
            summary: 'Summary',
            rules: 'Rules',
            export: 'Export',
            help: 'Help',
            logout: 'Log out',
        },

        common: {
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
            edit: 'Edit',
            create: 'Create',
            close: 'Close',
            yes: 'Yes',
            no: 'No',
            ok: 'OK',
            loading: 'Loading...',
            error: 'Error',
            warning: 'Warning',
            success: 'Done',
            active: 'Active',
            inactive: 'Inactive',
            total: 'Total',
            search: 'Search',
            filter: 'Filter',
            noData: 'No data',
            confirm: 'Confirm',
            back: 'Back',
        },

        days: {
            mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
            fri: 'Fri', sat: 'Sat', sun: 'Sun',
            monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
            thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
            sunday: 'Sunday',
        },

        months: {
            jan: 'January', feb: 'February', mar: 'March',
            apr: 'April', may: 'May', jun: 'June',
            jul: 'July', aug: 'August', sep: 'September',
            oct: 'October', nov: 'November', dec: 'December',
        },

        status: {
            A: 'Working',
            L: 'Day off',
            X: 'Not available',
            SEM: 'Vacation',
            SJ: 'Sick',
            VAB: 'Child care',
            PERM: 'Leave of absence',
            UTB: 'Training',
            EXTRA: 'Extra staff needed',
            FÖR: 'Parental leave',
            TJL: 'Leave of absence',
        },

        rules: {
            title: 'Work Time Rules',
            newRule: '+ New Rule',
            editRule: 'Edit Rule',
            noRules: 'No rules defined',
            noRulesDesc: 'Create work time rules that the schedule must follow.',
            systemRule: 'System rule — always active',
            value: 'Value',
            unit: 'Unit',
            source: 'Source',
            severity: 'Severity',
            appliesTo: 'Applies to',
            consequence: 'Consequence',
            p0: 'P0 — Blocks',
            p1: 'P1 — Deprioritizes',
            categories: {
                time: 'Work Time',
                rest: 'Rest & Rotation',
                staff: 'Staffing & Availability',
                cost: 'Cost & Unsocial Hours',
                priority: 'Priority',
                custom: 'Other',
            },
        },

        personal: {
            title: 'Staff',
            addPerson: '+ Add Person',
            firstName: 'First Name',
            lastName: 'Last Name',
            phone: 'Phone',
            email: 'Email',
            employmentPct: 'Employment %',
            salary: 'Monthly Salary',
            startDate: 'Start Date',
            workdaysPerWeek: 'Workdays/week',
            group: 'Group',
            employmentType: 'Employment Type',
            permanent: 'Permanent',
            substitute: 'Substitute',
        },

        calendar: {
            title: 'Calendar',
            today: 'Today',
            week: 'Week',
            month: 'Month',
        },

        control: {
            title: 'Control',
            generate: 'Generate schedule',
            generating: 'Generating...',
            selectGroups: 'Select groups',
            noGroups: 'No groups selected',
            vacancies: 'Vacancies',
            warnings: 'Warnings',
            rulesApplied: 'Rules applied',
        },

        help: {
            title: 'Help & Guide',
            subtitle: 'Learn how to use the Schedule Program',
            gettingStarted: 'Getting Started',
            faq: 'FAQ',
            shortcuts: 'Keyboard Shortcuts',
            about: 'About',
        },

        errors: {
            stateInvalid: 'State is missing or wrong type',
            scheduleMissing: 'Schedule is missing from state',
            invalidYear: 'Input.year must be a valid year',
            invalidMonth: 'Month must be 1–12',
            noGroups: 'No groups selected. Select at least one group before generating.',
            noActivePeople: 'No active staff belongs to the selected groups.',
            demandMissing: 'Staffing demand is missing',
        },
    },
};
