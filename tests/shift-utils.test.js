/*
 * Unit-tests för shift-utils
 * Testa: isValidShiftId, normalizeColor, isValidColor, createShiftCard
 */

import { 
    isValidShiftId, 
    normalizeColor, 
    isValidColor, 
    getColorOrDefault,
    createShiftCard,
    createDetailRow
} from '../src/lib/shift-utils.js';

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (err) {
        console.error(`✗ ${name}`, err.message);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// ========================================================================
// TESTS
// ========================================================================

test('isValidShiftId: accepterar genererade ID', () => {
    const id = `shift-${Date.now()}-abc123def`;
    assert(isValidShiftId(id), 'Bör acceptera genererat ID');
});

test('isValidShiftId: rejecterar konstiga ID', () => {
    assert(!isValidShiftId('shift-123'), 'Bör reject för kort ID');
    assert(!isValidShiftId('foo-bar-baz'), 'Bör reject för fel format');
    assert(!isValidShiftId(''), 'Bör reject för tomt ID');
});

test('normalizeColor: gör lowercase till uppercase', () => {
    assert(normalizeColor('#ffd93d') === '#FFD93D', 'Bör normalize till uppercase');
});

test('normalizeColor: returnerar fallback för null', () => {
    assert(normalizeColor(null) === '#667EEA', 'Bör returnera default för null');
    assert(normalizeColor('') === '#667EEA', 'Bör returnera default för tom sträng');
});

test('isValidColor: accepterar giltiga färger', () => {
    assert(isValidColor('#FFD93D'), 'Bör acceptera gyldig färg');
    assert(isValidColor('#ffd93d'), 'Bör acceptera lowercase');
    assert(isValidColor('#0984E3'), 'Bör acceptera annan gyldig färg');
});

test('isValidColor: rejecterar ogiltiga färger', () => {
    assert(!isValidColor('#999999'), 'Bör reject för ej whitelistade färg');
    assert(!isValidColor('red'), 'Bör reject för RGB-namn');
    assert(!isValidColor(''), 'Bör reject för tom sträng');
});

test('getColorOrDefault: returnerar färg om giltig', () => {
    assert(getColorOrDefault('#FFD93D') === '#FFD93D', 'Bör returnera gyldig färg');
});

test('getColorOrDefault: returnerar default om ogiltig', () => {
    assert(getColorOrDefault('#999999') === '#667EEA', 'Bör returnera default för ogiltig');
    assert(getColorOrDefault('') === '#667EEA', 'Bör returnera default för tom');
});

test('createDetailRow: skapar DOM-element', () => {
    const row = createDetailRow('Test Label', 'Test Value');
    assert(row.className === 'detail-row', 'Bör ha rätt klassnamn');
    assert(row.querySelector('.label').textContent === 'Test Label', 'Bör ha label');
    assert(row.querySelector('.value').textContent === 'Test Value', 'Bör ha value');
});

test('createShiftCard: accepterar gyldig shift', () => {
    const id = `shift-${Date.now()}-abc123def`;
    const shift = {
        name: 'Test Pass',
        shortName: 'T',
        color: '#FFD93D',
        description: 'Test beskrivning',
        startTime: '09:00',
        endTime: '17:00',
    };
    const card = createShiftCard(id, shift);
    assert(card.className === 'shift-card', 'Bör skapa kort');
    assert(card.querySelector('h3').textContent === 'Test Pass', 'Bör innehålla namn');
});

test('createShiftCard: fail-closed för ogiltigt ID', () => {
    const badId = 'invalid-id-format';
    const shift = { name: 'Test', shortName: 'T', color: '#FFD93D' };
    const card = createShiftCard(badId, shift);
    assert(card.querySelector('.shift-card-corrupt'), 'Bör visa korrupt-meddelande');
});

test('createShiftCard: fail-closed för ogiltig färg', () => {
    const id = `shift-${Date.now()}-abc123def`;
    const shift = {
        name: 'Test',
        shortName: 'T',
        color: '#999999',  // Ogiltig
        description: '',
        startTime: '09:00',
        endTime: '17:00',
    };
    const card = createShiftCard(id, shift);
    const header = card.querySelector('.shift-card-header');
    // Bör använda fallback-färgen
    assert(header.style.backgroundColor === '#667EEA' || header.style.backgroundColor === 'rgb(102, 126, 234)', 'Bör använda fallback-färg');
});

console.log('\n✓ Alla shift-utils tests körda!');
