/*
 * AO-07 — Calendar Helpers
 * FIL: src/views/calendar-helpers.js
 *
 * Delade konstanter och hjälpfunktioner för kalendervyn.
 * Inga DOM-operationer, inga side-effects.
 */

/* ============================================================
 * CONSTANTS
 * ============================================================ */
export const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

export const MONTH_NAMES = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

export const ABSENCE_LABELS = {
    SEM: 'Semester', SJ: 'Sjuk', VAB: 'VAB', FÖR: 'Föräldraledig',
    PERM: 'Permission', UTB: 'Utbildning', TJL: 'Tjänstledig',
};

export const ABSENCE_COLORS = {
    SEM:  { bg: '#fff9c4', text: '#f57f17',  border: '#fbc02d' },
    SJ:   { bg: '#ffcdd2', text: '#b71c1c',  border: '#ef5350' },
    VAB:  { bg: '#ffe0b2', text: '#e65100',  border: '#ff9800' },
    FÖR:  { bg: '#f8bbd0', text: '#880e4f',  border: '#ec407a' },
    PERM: { bg: '#b2dfdb', text: '#004d40',  border: '#26a69a' },
    UTB:  { bg: '#e1bee7', text: '#4a148c',  border: '#ab47bc' },
    TJL:  { bg: '#b2dfdb', text: '#004d40',  border: '#26a69a' },
};

export const STATUS_COLORS = {
    A:     { bg: '#c8e6c9', text: '#1b5e20',  border: '#66bb6a' },
    L:     { bg: '#f0f0f0', text: '#424242',  border: '#bdbdbd' },
    X:     { bg: '#bbdefb', text: '#0d47a1',  border: '#42a5f5' },
    EXTRA: { bg: '#424242', text: '#ffeb3b',  border: '#616161' },
};

/* ============================================================
 * DATE FUNCTIONS
 * ============================================================ */

/** Vecka-datum: returnerar Date[7] (mån–sön) för year + weekOffset */
export function getWeekDates(year, weekOffset) {
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const daysToMonday = jan1Day === 0 ? -6 : 1 - jan1Day;
    const firstMonday = new Date(year, 0, 1 + daysToMonday);

    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + weekOffset * 7);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/** ISO veckonummer */
export function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/** Date → "YYYY-MM-DD" */
export function formatISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Date → "16 feb" */
export function formatDateShort(date) {
    const d = date.getDate();
    const m = MONTH_NAMES[date.getMonth()].toLowerCase().slice(0, 3);
    return `${d} ${m}`;
}

/** Date → "16/2" */
export function formatDayMonth(date) {
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

/** Är det idag? */
export function isDateToday(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
}

/** "YYYY-MM-DD" → månadsindex (0-baserat) */
export function getMonthIndex(dateStr) {
    return parseInt(dateStr.split('-')[1], 10) - 1;
}

/** "YYYY-MM-DD" → dagindex (0-baserat) */
export function getDayIndex(dateStr) {
    return parseInt(dateStr.split('-')[2], 10) - 1;
}

/** Kontrollera om absence gäller för ett datum */
export function isAbsenceOnDate(absence, dateStr) {
    if (!absence || !dateStr) return false;
    if (absence.pattern === 'single') return absence.date === dateStr;
    if (absence.pattern === 'range') {
        return dateStr >= (absence.startDate || '') && dateStr <= (absence.endDate || '9999-12-31');
    }
    if (absence.pattern === 'recurring') {
        if (dateStr < (absence.startDate || '') || dateStr > (absence.endDate || '9999-12-31')) return false;
        if (!Array.isArray(absence.days)) return false;
        return absence.days.includes(new Date(dateStr).getDay());
    }
    return false;
}

/* ============================================================
 * FORMAT FUNCTIONS
 * ============================================================ */

/** Kronor-formatering */
export function formatCurrency(amount) {
    if (!amount || !Number.isFinite(amount)) return '0 kr';
    return Math.round(amount).toLocaleString('sv-SE') + ' kr';
}

/** Statusfärg-lookup */
export function getStatusStyle(status) {
    if (ABSENCE_COLORS[status]) return ABSENCE_COLORS[status];
    if (STATUS_COLORS[status]) return STATUS_COLORS[status];
    return STATUS_COLORS.A;
}

/* ============================================================
 * XSS HELPERS
 * ============================================================ */
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)|hsl\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\)|hsla\(\s*\d{1,3}\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+\s*\)|[a-zA-Z]{1,20})$/;

export function sanitizeColor(input) {
    if (typeof input !== 'string') return '#777';
    const trimmed = input.trim();
    return SAFE_COLOR_RE.test(trimmed) ? trimmed : '#777';
}

export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
