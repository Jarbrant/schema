/*
 * SCHEDULER.JS — Schema-genererings logik
 * 
 * Innehåller algoritmer för att generera schema baserat på:
 * - Grupper
 * - Grundpass
 * - Bemanningsbehov
 * - Datumintervall (månad eller period)
 */

import { reportError } from './diagnostics.js';

/**
 * Generera schema för given period
 * 
 * @param {object} params - Konfiguration
 * @param {string} params.mode - 'month' eller 'period'
 * @param {number} params.year - År (för month-mode)
 * @param {number} params.month - Månad 1-12 (för month-mode)
 * @param {string} params.fromDate - Startdatum YYYY-MM-DD (för period-mode)
 * @param {string} params.toDate - Slutdatum YYYY-MM-DD (för period-mode)
 * @param {array} params.groups - Grupper från state
 * @param {array} params.passes - Grundpass från state
 * @param {array} params.demands - Bemanningsbehov från state
 * @param {array} params.people - Personallista från state
 * 
 * @returns {object} { success, shifts, message, errors }
 */
export function generateSchedule(params) {
    try {
        console.log('🔄 Genererar schema...', params);

        const {
            mode,
            year,
            month,
            fromDate,
            toDate,
            groups,
            passes,
            demands,
            people
        } = params;

        // Validera inputs
        if (!mode || !['month', 'period'].includes(mode)) {
            throw new Error('Ogiltigt läge (mode)');
        }

        if (!groups || groups.length === 0) {
            throw new Error('Inga grupper definierade');
        }

        if (!passes || passes.length === 0) {
            throw new Error('Inga grundpass definierade');
        }

        // Beräkna datumintervall
        let startDate, endDate;

        if (mode === 'month') {
            if (!year || !month) {
                throw new Error('År och månad krävs för month-mode');
            }
            const monthNum = parseInt(month, 10);
            if (monthNum < 1 || monthNum > 12) {
                throw new Error(`Ogiltigt månadsnummer: ${monthNum}`);
            }
            
            startDate = new Date(year, monthNum - 1, 1);
            endDate = new Date(year, monthNum, 0); // Sista dagen i månaden
        } else if (mode === 'period') {
            if (!fromDate || !toDate) {
                throw new Error('från-datum och till-datum krävs för period-mode');
            }

            startDate = new Date(fromDate);
            endDate = new Date(toDate);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Ogiltiga datum');
            }

            if (endDate < startDate) {
                throw new Error('Till-datum måste vara efter från-datum');
            }

            // Validera max antal dagar (93 = ~3 månader)
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 93) {
                throw new Error(`Period kan max vara 93 dagar (du valde ${daysDiff} dagar)`);
            }
        }

        console.log(`✓ Datumintervall: ${startDate.toLocaleDateString('sv')} → ${endDate.toLocaleDateString('sv')}`);

        // Generera shifts för intervallet
        const generatedShifts = [];
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        for (let i = 0; i < daysDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + i);
            const dateStr = formatDate(currentDate);

            // För varje grupp, föreslå shifts baserat på bemanningsbehov
            groups.forEach(group => {
                passes.forEach(pass => {
                    // Hämta bemanningsbehov för denna grupp + pass
                    const demandKey = `${group.id}_${pass.id}`;
                    const demand = demands.find(d => d.key === demandKey);

                    if (demand && demand.count > 0) {
                        // Föreslå shifts för denna grupp på denna dag/pass
                        const personCount = Math.min(demand.count, group.members.length);

                        for (let j = 0; j < personCount; j++) {
                            const person = group.members[j % group.members.length];
                            const personObj = people.find(p => p.id === person);

                            if (personObj) {
                                generatedShifts.push({
                                    id: `generated_${dateStr}_${group.id}_${pass.id}_${j}`,
                                    date: dateStr,
                                    startTime: pass.startTime,
                                    endTime: pass.endTime,
                                    personId: personObj.id,
                                    personName: personObj.name,
                                    groupId: group.id,
                                    groupName: group.name,
                                    passId: pass.id,
                                    passName: pass.name,
                                    role: 'staff',
                                    location: pass.workplace || '-',
                                    generatedAt: new Date().toISOString()
                                });
                            }
                        }
                    }
                });
            });
        }

        console.log(`✓ Genererade ${generatedShifts.length} skift`);

        return {
            success: true,
            shifts: generatedShifts,
            message: `✓ Schema genererat för ${generatedShifts.length} skift (${startDate.toLocaleDateString('sv')} → ${endDate.toLocaleDateString('sv')})`,
            errors: []
        };

    } catch (err) {
        console.error('❌ Fel vid schemagenerering:', err);

        reportError(
            'SCHEDULE_GENERATION_FAILED',
            'SCHEDULER',
            'src/scheduler.js',
            err.message || 'Schema kunde inte genereras'
        );

        return {
            success: false,
            shifts: [],
            message: null,
            errors: [err.message || 'Ett okänt fel uppstod vid schemagenerering']
        };
    }
}

/**
 * Formatera datum till YYYY-MM-DD
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Hämta månadernas namn
 */
export const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Maj' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Augusti' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
];

/**
 * Hämta åren som är tillgängliga
 */
export function getAvailableYears(currentYear = new Date().getFullYear()) {
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 2; i++) {
        years.push(i);
    }
    return years;
}
