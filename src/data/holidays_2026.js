/*
 * AO-04 — HOLIDAYS: Svenska helgdagar 2026
 */

const HOLIDAYS_2026 = {
    '2026-01-01': 'Nyårsdagen',
    '2026-01-06': 'Trettondedag jul',
    '2026-04-02': 'Skärtorsdagen',
    '2026-04-03': 'Långfredagen',
    '2026-04-05': 'Påskdagen',
    '2026-04-06': 'Annandag påsk',
    '2026-05-01': 'Första maj',
    '2026-05-14': 'Kristi himmelsfärd',
    '2026-06-06': 'Sveriges nationaldag',
    '2026-06-20': 'Midsommardagen',
    '2026-11-01': 'Alla helgons dag',
    '2026-12-24': 'Julafton',
    '2026-12-25': 'Juldagen',
    '2026-12-26': 'Annandag jul',
    '2026-12-31': 'Nyårsafton',
};

export function getHolidayName(dateStr) {
    return HOLIDAYS_2026[dateStr] || null;
}

export function isHoliday(dateStr) {
    return dateStr in HOLIDAYS_2026;
}

export function getAllHolidays() {
    return { ...HOLIDAYS_2026 };
}
