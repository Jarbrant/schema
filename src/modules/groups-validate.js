/*
 * AO-04 — GROUPS VALIDATION — Validering av grupper & grundpass
 * PATCH v2: Stöd nattpass (start > end), members ej obligatoriskt
 */

/**
 * Validera grupp-namn
 */
export function validateGroupName(name) {
  if (!name || name.trim().length === 0) {
    return 'Grupp-namn är obligatoriskt';
  }
  if (name.trim().length > 100) {
    return 'Grupp-namn kan max vara 100 tecken';
  }
  return null;
}

/**
 * Validera grupp-ID (skapa unikt uppercase ID)
 */
export function validateGroupId(id, existingGroups) {
  if (!id || id.trim().length === 0) {
    return 'Grupp-ID är obligatoriskt';
  }
  const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!cleanId) {
    return 'Grupp-ID måste innehålla bokstäver eller siffror';
  }
  if (existingGroups && existingGroups[cleanId]) {
    return `Grupp-ID "${cleanId}" finns redan`;
  }
  return null;
}

/**
 * Validera grundpass-tid
 * Stöd för nattpass: start > end är tillåtet (t.ex. 23:00 → 07:00)
 */
export function validatePassTime(startTime, endTime) {
  if (!startTime || !endTime) {
    return 'Både start- och sluttid är obligatoriska';
  }

  const hhmmRe = /^\d{2}:\d{2}$/;
  if (!hhmmRe.test(startTime)) {
    return 'Starttid måste vara i format HH:MM';
  }
  if (!hhmmRe.test(endTime)) {
    return 'Sluttid måste vara i format HH:MM';
  }

  // start === end är ogiltigt (0 timmars pass)
  if (startTime === endTime) {
    return 'Start- och sluttid kan inte vara samma';
  }

  // Nattpass (start > end) är tillåtet
  return null;
}

/**
 * Validera shift-namn
 */
export function validateShiftName(name) {
  if (!name || name.trim().length === 0) {
    return 'Pass-namn är obligatoriskt';
  }
  if (name.trim().length > 100) {
    return 'Pass-namn kan max vara 100 tecken';
  }
  return null;
}

/**
 * Validera shift-ID
 */
export function validateShiftId(id, existingShifts) {
  if (!id || id.trim().length === 0) {
    return 'Pass-ID är obligatoriskt';
  }
  const cleanId = id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!cleanId) {
    return 'Pass-ID måste innehålla bokstäver eller siffror';
  }
  if (existingShifts && existingShifts[cleanId]) {
    return `Pass-ID "${cleanId}" finns redan`;
  }
  return null;
}

/**
 * (Valfri) Validera gruppmedlemmar
 * AO-04: members ej obligatoriskt, så default = null (ingen validering)
 * Behåll funktionen om någon annan kod importerar den.
 */
export function validateGroupMembers(_members) {
  return null;
}
