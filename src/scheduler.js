/*
 * SCHEDULER.JS — Schema-genererings logik (UPDATED med regelmotor)
 */

import { reportError } from './diagnostics.js';
import {
    canPersonWorkShift,
    getEligiblePersonsForShift,
    validatePersonForScheduling,
    getShiftDuration,
    getHoursWorkedThisWeek,
    isRedDay
} from './rules-engine.js';

export function generateSchedule(params) {
    try {
        console.log('🔄 Genererar schema med regler...', params);

        const { mode, year, month, fromDate, toDate, groups, passes, demands, people } = params;

        // Validera inputs
        if (!mode || !['month', 'period'].includes(mode)) {
            throw new Error('Ogiltigt läge');
        }

        if (!groups || groups.length === 0) {
            throw new Error('Inga grupper definierade');
        }

        if (!passes || passes.length === 0) {
            throw new Error('Inga grundpass definierade');
        }

        if (!people || people.length === 0) {
            throw new Error('Ingen personal definierad');
        }

        // Validera alla personer för schemagenerering
        const validationErrors = [];
        people.forEach(person => {
            const validation = validatePersonForScheduling(person);
            if (!validation.valid) {
                validationErrors.push(`${person.name}: ${validation.errors.join(', ')}`);
            }
        });

        if (validationErrors.length > 0) {
            throw new Error(`Validering misslyckades:\n${validationErrors.join('\n')}`);
        }

        // Beräkna datumintervall
        let startDate, endDate;

        if (mode === 'month') {
            if (!year || !month) throw new Error('År och månad krävs');
            const monthNum = parseInt(month, 10);
            if (monthNum < 1 || monthNum > 12) throw new Error(`Ogiltigt månadsnummer: ${monthNum}`);
            
            startDate = new Date(year, monthNum - 1, 1);
            endDate = new Date(year, monthNum, 0);
        } else if (mode === 'period') {
            if (!fromDate || !toDate) throw new Error('från-datum och till-datum krävs');

            startDate = new Date(fromDate);
            endDate = new Date(toDate);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Ogiltiga datum');
            }

            if (endDate < startDate) {
                throw new Error('Till-datum måste vara efter från-datum');
            }

            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 93) {
                throw new Error(`Period kan max vara 93 dagar (du valde ${daysDiff} dagar)`);
            }
        }

        console.log(`✓ Datumintervall: ${startDate.toLocaleDateString('sv')} → ${endDate.toLocaleDateString('sv')}`);

        // Generera shifts med intelligent person-matching
        const generatedShifts = [];
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        for (let i = 0; i < daysDiff; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + i);
            const dateStr = formatDate(currentDate);

            // För varje grupp + pass
            groups.forEach(group => {
                passes.forEach(pass => {
                    const demandKey = `${group.id}_${pass.id}`;
                    const demand = demands.find(d => d.key === demandKey);

                    if (demand && demand.count > 0) {
                        // Hitta de mest lämpade personerna
                        const eligible = getEligiblePersonsForShift(
                            people,
                            pass,
                            group,
                            dateStr,
                            generatedShifts
                        );

                        if (eligible.length === 0) {
                            console.warn(`⚠️ Ingen lämplig person för ${group.name} ${pass.name} på ${dateStr}`);
                            return;
                        }

                        // Ta de top N personerna enligt demand
                        for (let j = 0; j < Math.min(demand.count, eligible.length); j++) {
                            const { person } = eligible[j];

                            generatedShifts.push({
                                id: `generated_${dateStr}_${group.id}_${pass.id}_${j}`,
                                date: dateStr,
                                startTime: pass.startTime,
                                endTime: pass.endTime,
                                personId: person.id,
                                personName: person.name,
                                groupId: group.id,
                                groupName: group.name,
                                passId: pass.id,
                                passName: pass.name,
                                isRedDay: isRedDay(dateStr),
                                degree: person.degree,
                                hours: getShiftDuration(pass),
                                generatedAt: new Date().toISOString()
                            });

                            console.log(`✓ ${person.name} tillagd: ${group.name} ${pass.name} ${dateStr}`);
                        }
                    }
                });
            });
        }

        console.log(`✓ Genererade ${generatedShifts.length} skift`);

        return {
            success: true,
            shifts: generatedShifts,
            message: `✓ Schema genererat för ${generatedShifts.length} skift`,
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
            errors: [err.message || 'Ett okänt fel uppstod']
        };
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
