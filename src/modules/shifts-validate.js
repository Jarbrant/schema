/*
 * SHIFTS VALIDATION — Regel-kontroll
 */

import { calculateHours } from './shifts-utils.js';

/**
 * Validera skift mot HRF-avtalsregler
 * @param {object} shift - Skift-objekt
 * @param {object} state - App-state
 * @returns {array} Lista med överträdelser
 */
export function validateShift(shift, state) {
    const violations = [];
    
    // Regel 1: Maximal längd på skift
    const hours = calculateHours(shift.startTime, shift.endTime);
    
    if (hours > 12) {
        violations.push('Skiftet överstiger 12 timmar');
    }
    
    // Regel 2: Minimal längd på skift
    if (hours < 4) {
        violations.push('Skiftet är kortare än 4 timmar');
    }
    
    // Regel 3: Viloperiod mellan skift (exempel)
    const personShifts = (state.shifts || []).filter(s => s.personId === shift.personId);
    if (personShifts.length > 0) {
        // Kan utökas senare
    }
    
    return violations;
}

/**
 * Validera alla skift
 * @param {array} shifts - Alla skift
 * @param {object} state - App-state
 * @returns {object} Rapport med violations per skift
 */
export function validateAllShifts(shifts, state) {
    return shifts.map((shift, i) => ({
        index: i,
        violations: validateShift(shift, state)
    }));
}
