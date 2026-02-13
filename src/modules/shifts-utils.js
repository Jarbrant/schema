/*
 * SHIFTS UTILITIES — Hämtar timmar och roller
 */

/**
 * Beräkna timmar mellan två tider
 * @param {string} startTime - "HH:MM"
 * @param {string} endTime - "HH:MM"
 * @returns {number} Timmar
 */
export function calculateHours(startTime, endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    return (endMinutes - startMinutes) / 60;
}

/**
 * Få label för roll
 * @param {string} role - "staff" | "foreman" | "chairman"
 * @returns {string} Visningsnamn
 */
export function getRoleLabel(role) {
    const roles = {
        'staff': 'Personal',
        'foreman': 'Befälhavare',
        'chairman': 'Ordförande'
    };
    return roles[role] || role;
}
