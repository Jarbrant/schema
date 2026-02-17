/*
 * AO-06 — HOLIDAYS: Svenska helgdagar (flerdårs-stöd)
 *
 * Exporterar:
 *   isHoliday(dateStr)       — boolean
 *   getHolidayName(dateStr)  — string|null
 *   getAllHolidays(year)      — { [dateStr]: name }
 *   isRedDay(dateStr)        — boolean (helgdag ELLER söndag)
 *
 * Röda dagar = officiella helgdagar + alla söndagar.
 * Skärtorsdagen, julafton, nyårsafton är inte officiella röda dagar
 * men inkluderas ändå (branschpraxis HRF).
 */

/* ================================================================
 * STATIC HOLIDAYS (fasta datum — samma varje år)
 * ================================================================ */
const FIXED_HOLIDAYS = [
    { month: 1,  day: 1,  name: 'Nyårsdagen' },
    { month: 1,  day: 6,  name: 'Trettondedag jul' },
    { month: 5,  day: 1,  name: 'Första maj' },
    { month: 6,  day: 6,  name: 'Sveriges nationaldag' },
    { month: 12, day: 24, name: 'Julafton' },
    { month: 12, day: 25, name: 'Juldagen' },
    { month: 12, day: 26, name: 'Annandag jul' },
    { month: 12, day: 31, name: 'Nyårsafton' },
];

/* ================================================================
 * EASTER CALCULATION (Gauss/Meeus)
 * ================================================================ */
function calculateEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/* ================================================================
 * MIDSOMMAR: Lördag mellan 20–26 juni
 * ================================================================ */
function calculateMidsommarDay(year) {
    for (let d = 20; d <= 26; d++) {
        const date = new Date(year, 5, d); // juni = 5
        if (date.getDay() === 6) return date; // lördag
    }
    return new Date(year, 5, 20); // fallback
}

/* ================================================================
 * ALLA HELGONS DAG: Lördag mellan 31 okt – 6 nov
 * ================================================================ */
function calculateAllaHelgonsDag(year) {
    for (let d = 31; d <= 37; d++) {
        const actualDay = d <= 31 ? d : d - 31;
        const month = d <= 31 ? 9 : 10; // okt=9, nov=10
        const date = new Date(year, month, actualDay);
        if (date.getDay() === 6) return date; // lördag
    }
    return new Date(year, 10, 1); // fallback
}

/* ================================================================
 * BUILD HOLIDAYS FOR YEAR (cached)
 * ================================================================ */
const _cache = {};

function buildHolidaysForYear(year) {
    if (_cache[year]) return _cache[year];

    const holidays = {};

    // Fasta helgdagar
    FIXED_HOLIDAYS.forEach(h => {
        const dateStr = `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
        holidays[dateStr] = h.name;
    });

    // Påsk-baserade (rörliga)
    const easter = calculateEasterSunday(year);
    const easterDates = [
        { offset: -3, name: 'Skärtorsdagen' },
        { offset: -2, name: 'Långfredagen' },
        { offset: 0,  name: 'Påskdagen' },
        { offset: 1,  name: 'Annandag påsk' },
        { offset: 39, name: 'Kristi himmelsfärdsdag' },
        { offset: 49, name: 'Pingstdagen' },
    ];

    easterDates.forEach(({ offset, name }) => {
        holidays[formatDate(addDays(easter, offset))] = name;
    });

    // Midsommardagen
    holidays[formatDate(calculateMidsommarDay(year))] = 'Midsommardagen';

    // Alla helgons dag
    holidays[formatDate(calculateAllaHelgonsDag(year))] = 'Alla helgons dag';

    _cache[year] = holidays;
    return holidays;
}

/* ================================================================
 * PUBLIC API
 * ================================================================ */

/**
 * Hämta helgdagsnamn för datum (YYYY-MM-DD)
 */
export function getHolidayName(dateStr) {
    if (typeof dateStr !== 'string' || dateStr.length < 10) return null;
    const year = parseInt(dateStr.substring(0, 4), 10);
    if (!Number.isFinite(year)) return null;
    const holidays = buildHolidaysForYear(year);
    return holidays[dateStr] || null;
}

/**
 * Är dateStr en helgdag?
 */
export function isHoliday(dateStr) {
    return getHolidayName(dateStr) !== null;
}

/**
 * Är dateStr en "röd dag" (helgdag ELLER söndag)?
 * Branschpraxis: arbete på röd dag → extra-ledighet.
 */
export function isRedDay(dateStr) {
    if (isHoliday(dateStr)) return true;

    // Söndag?
    if (typeof dateStr !== 'string' || dateStr.length < 10) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
    const date = new Date(y, m - 1, d);
    return date.getDay() === 0; // söndag
}

/**
 * Alla helgdagar för ett år
 */
export function getAllHolidays(year) {
    if (!year) year = new Date().getFullYear();
    return { ...buildHolidaysForYear(year) };
}
