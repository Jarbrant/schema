/*
 * S3-04 — CSV/Excel-export av veckoschema
 * FIL: src/modules/export-csv.js
 *
 * Exporterar aktuell vecka (eller valfri period) som CSV-fil.
 * Kolumner: Datum, Veckodag, Grupp, Pass, Person, Start, Slut, Timmar, Status
 *
 * Användning från calendar.js:
 *   import { exportWeekCSV } from '../modules/export-csv.js';
 *   exportWeekCSV(store, weekDates);
 */

/* ============================================================
 * BLOCK 1 — CONSTANTS
 * ============================================================ */
const WEEKDAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const STATUS_LABELS = {
    A: 'Arbetar', L: 'Ledig', X: 'Övrigt', SEM: 'Semester',
    SJ: 'Sjuk', VAB: 'VAB', FÖR: 'Föräldraledig',
    TJL: 'Tjänstledig', PERM: 'Permission', UTB: 'Utbildning',
    EXTRA: 'Extrapass',
};

/* ============================================================
 * BLOCK 2 — HELPERS
 * ============================================================ */
function formatISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthIndex(ds) { return parseInt(ds.split('-')[1], 10) - 1; }
function getDayIndex(ds) { return parseInt(ds.split('-')[2], 10) - 1; }

function calcHours(shift, entry) {
    const st = entry?.startTime || shift?.startTime;
    const en = entry?.endTime || shift?.endTime;
    if (!st || !en) return 0;
    const [sh, sm] = st.split(':').map(Number);
    const [eh, em] = en.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // nattpass
    // Dra av rast
    const bs = entry?.breakStart || shift?.breakStart;
    const be = entry?.breakEnd || shift?.breakEnd;
    if (bs && be) {
        const [bsh, bsm] = bs.split(':').map(Number);
        const [beh, bem] = be.split(':').map(Number);
        mins -= (beh * 60 + bem) - (bsh * 60 + bsm);
    }
    return Math.max(0, mins / 60);
}

function escapeCSV(val) {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

/* ============================================================
 * BLOCK 3 — EXPORT WEEK CSV
 * ============================================================ */
/**
 * Exporterar ett veckoschema som CSV.
 * @param {Object} store - App store
 * @param {Date[]} weekDates - Array med 7 datum (mån-sön)
 * @param {Object} [options]
 * @param {string} [options.separator=';'] — Separator (';' för Excel-kompatibilitet)
 * @param {boolean} [options.includeEmpty=false] — Inkludera dagar utan tilldelningar
 */
export function exportWeekCSV(store, weekDates, options = {}) {
    const sep = options.separator || ';';
    const includeEmpty = options.includeEmpty || false;

    const state = store.getState();
    const groups = state.groups || {};
    const shifts = state.shifts || {};
    const shiftTemplates = state.shiftTemplates || {};
    const allShifts = { ...shifts, ...shiftTemplates };
    const people = Array.isArray(state.people) ? state.people : [];
    const schedule = state.schedule || {};

    // Header
    const headers = ['Datum', 'Veckodag', 'Grupp', 'Pass', 'Person', 'Anställningsnr', 'Start', 'Slut', 'Timmar', 'Status', 'Kostnad (kr)'];
    const rows = [headers.map(h => escapeCSV(h)).join(sep)];

    let totalHours = 0;
    let totalCost = 0;

    weekDates.forEach((date, dayIdx) => {
        const dateStr = formatISO(date);
        const weekday = WEEKDAY_NAMES[dayIdx];
        const mi = getMonthIndex(dateStr);
        const di = getDayIndex(dateStr);
        const dayData = schedule.months?.[mi]?.days?.[di];
        const entries = dayData?.entries || [];

        if (!entries.length && !includeEmpty) return;

        if (!entries.length && includeEmpty) {
            rows.push([dateStr, weekday, '', '', '', '', '', '', '0', '', '0'].map(v => escapeCSV(v)).join(sep));
            return;
        }

        entries.forEach(entry => {
            const group = groups[entry.groupId];
            const shift = allShifts[entry.shiftId];
            const person = people.find(p => p.id === entry.personId);

            const personName = person
                ? (person.firstName && person.lastName ? `${person.firstName} ${person.lastName}` : (person.name || person.id))
                : (entry.personId || 'Vakans');
            const empNum = person?.employeeNumber || person?.id || '';
            const groupName = group?.name || entry.groupId || '';
            const shiftName = shift?.name || entry.shiftId || '';
            const startTime = entry.startTime || shift?.startTime || '';
            const endTime = entry.endTime || shift?.endTime || '';
            const hours = calcHours(shift, entry);
            const status = STATUS_LABELS[entry.status] || entry.status || 'Arbetar';
            const hourlyWage = person?.hourlyWage || 0;
            const cost = hours * hourlyWage;

            totalHours += hours;
            totalCost += cost;

            rows.push([
                dateStr,
                weekday,
                groupName,
                shiftName,
                personName,
                empNum,
                startTime,
                endTime,
                hours.toFixed(1),
                status,
                Math.round(cost),
            ].map(v => escapeCSV(v)).join(sep));
        });
    });

    // Summary row
    rows.push('');
    rows.push(['SUMMA', '', '', '', '', '', '', '', totalHours.toFixed(1), '', Math.round(totalCost)].map(v => escapeCSV(v)).join(sep));

    // BOM + content
    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    const csvContent = bom + rows.join('\r\n');

    // Download
    const weekStart = formatISO(weekDates[0]);
    const weekEnd = formatISO(weekDates[6]);
    const filename = `schema_${weekStart}_${weekEnd}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { filename, rows: rows.length - 2, totalHours, totalCost };
}

/* ============================================================
 * BLOCK 4 — EXPORT PERIOD CSV (multi-week)
 * ============================================================ */
/**
 * Exporterar en hel period (fromDate → toDate) som CSV.
 */
export function exportPeriodCSV(store, fromDate, toDate, options = {}) {
    const allDates = [];
    const d = new Date(fromDate);
    while (d <= toDate) {
        allDates.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    // Dela upp i 7-dagars-chunks (behöver inte vara exakt veckor)
    // Men enklast: skicka alla dagar som en "vecka" till exportWeekCSV
    // Vi gör en anpassad export istället:

    const sep = options.separator || ';';
    const state = store.getState();
    const groups = state.groups || {};
    const shifts = state.shifts || {};
    const shiftTemplates = state.shiftTemplates || {};
    const allShifts = { ...shifts, ...shiftTemplates };
    const people = Array.isArray(state.people) ? state.people : [];
    const schedule = state.schedule || {};

    const WEEKDAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

    const headers = ['Datum', 'Veckodag', 'Grupp', 'Pass', 'Person', 'Anställningsnr', 'Start', 'Slut', 'Timmar', 'Status', 'Kostnad (kr)'];
    const rows = [headers.map(h => escapeCSV(h)).join(sep)];

    let totalHours = 0;
    let totalCost = 0;

    allDates.forEach(date => {
        const dateStr = formatISO(date);
        const weekday = WEEKDAYS[date.getDay()];
        const mi = getMonthIndex(dateStr);
        const di = getDayIndex(dateStr);
        const dayData = schedule.months?.[mi]?.days?.[di];
        const entries = dayData?.entries || [];

        entries.forEach(entry => {
            const group = groups[entry.groupId];
            const shift = allShifts[entry.shiftId];
            const person = people.find(p => p.id === entry.personId);
            const personName = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.id : 'Vakans';
            const empNum = person?.employeeNumber || person?.id || '';
            const hours = calcHours(shift, entry);
            const cost = hours * (person?.hourlyWage || 0);
            totalHours += hours;
            totalCost += cost;

            rows.push([
                dateStr, weekday, group?.name || '', shift?.name || '',
                personName, empNum,
                entry.startTime || shift?.startTime || '', entry.endTime || shift?.endTime || '',
                hours.toFixed(1), STATUS_LABELS[entry.status] || 'Arbetar', Math.round(cost),
            ].map(v => escapeCSV(v)).join(sep));
        });
    });

    rows.push('');
    rows.push(['SUMMA', '', '', '', '', '', '', '', totalHours.toFixed(1), '', Math.round(totalCost)].map(v => escapeCSV(v)).join(sep));

    const bom = '\uFEFF';
    const csvContent = bom + rows.join('\r\n');
    const filename = `schema_${formatISO(fromDate)}_${formatISO(toDate)}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { filename, rows: rows.length - 2, totalHours, totalCost };
}
