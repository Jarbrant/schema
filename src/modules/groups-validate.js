/*
 * GROUPS VALIDATION — Validering av grupper & grundpass
 */

/**
 * Validera grupp-namn
 */
export function validateGroupName(name) {
    if (!name || name.trim().length === 0) {
        return 'Grupp-namn är obligatoriskt';
    }
    if (name.length > 100) {
        return 'Grupp-namn kan max vara 100 tecken';
    }
    return null;
}

/**
 * Validera grundpass-tid
 */
export function validatePassTime(startTime, endTime) {
    if (!startTime || !endTime) {
        return 'Både start- och sluttid är obligatoriska';
    }
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    if (startMinutes >= endMinutes) {
        return 'Starttiden måste vara före sluttiden';
    }
    
    return null;
}

/**
 * Validera att minst en person är vald
 */
export function validateGroupMembers(members) {
    if (!members || members.length === 0) {
        return 'Du måste välja minst en person för gruppen';
    }
    return null;
}
