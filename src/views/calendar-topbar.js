/*
 * AO-07 — Calendar Top Bar, Warnings & Generate Preview
 * FIL: src/views/calendar-topbar.js
 */

import { escapeHtml, sanitizeColor, formatDateShort } from './calendar-helpers.js';

/* ============================================================
 * TOP BAR
 * ============================================================ */
export function renderTopBar(cal, weekNum, weekDates, isLocked, linkedTemplate, weekTemplates, weekKey) {
    return `
        <div class="cal-topbar">
            <div class="cal-topbar-left">
                ${linkedTemplate
                    ? `<span class="cal-template-badge" title="Kopplad veckomall">📋 ${escapeHtml(linkedTemplate.name)}</span>`
                    : `<span class="cal-template-badge cal-no-template">Ingen veckomall kopplad</span>`
                }
            </div>
            <div class="cal-topbar-center">
                <button class="btn btn-secondary" data-cal="prev-week" title="Föregående vecka">◀</button>
                <div class="cal-week-display">
                    <strong>Vecka ${weekNum}</strong>
                    <span class="cal-week-range">${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[6])}</span>
                </div>
                <button class="btn btn-secondary" data-cal="next-week" title="Nästa vecka">▶</button>
                <button class="btn btn-secondary btn-sm" data-cal="today" title="Idag">Idag</button>
            </div>
            <div class="cal-topbar-right">
                ${!isLocked && linkedTemplate ? `
                    <button class="btn btn-primary btn-sm" data-cal="generate" title="Föreslå schema baserat på veckomall">
                        🤖 Generera schema
                    </button>
                ` : ''}
                ${isLocked
                    ? `<button class="btn btn-sm cal-locked-badge" data-cal="unlock-week" title="Lås upp veckan">🔒 Låst — klicka för att låsa upp</button>`
                    : `<button class="btn btn-secondary btn-sm" data-cal="lock-week" title="Lås veckan">🔓 Lås vecka</button>`
                }
            </div>
        </div>
    `;
}

/* ============================================================
 * WARNINGS BANNER
 * ============================================================ */
export function renderWarnings(warnings) {
    const errors = warnings.filter(w => w.severity === 'error');
    const warns = warnings.filter(w => w.severity === 'warning');

    return `
        <div class="cal-warnings">
            ${errors.length > 0 ? `
                <div class="cal-warning-section cal-warning-error">
                    <strong>❌ ${errors.length} fel:</strong>
                    ${errors.slice(0, 5).map(w => `<span class="cal-warning-item">${escapeHtml(w.message)} (${escapeHtml(w.date)})</span>`).join('')}
                    ${errors.length > 5 ? `<span class="cal-warning-more">+${errors.length - 5} till...</span>` : ''}
                </div>
            ` : ''}
            ${warns.length > 0 ? `
                <div class="cal-warning-section cal-warning-warn">
                    <strong>⚠️ ${warns.length} varningar:</strong>
                    ${warns.slice(0, 3).map(w => `<span class="cal-warning-item">${escapeHtml(w.message)}</span>`).join('')}
                    ${warns.length > 3 ? `<span class="cal-warning-more">+${warns.length - 3} till...</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/* ============================================================
 * GENERATE PREVIEW
 * ============================================================ */
export function renderGeneratePreview(preview, people, groups, shifts, shiftTemplates) {
    const { suggestions, vacancySuggestions } = preview;
    const allShifts = { ...(shifts || {}), ...(shiftTemplates || {}) };

    return `
        <div class="cal-generate-preview">
            <div class="cal-preview-header">
                <h3>🤖 Genererat schemaförslag</h3>
                <div class="cal-preview-actions">
                    <button class="btn btn-primary btn-sm" data-cal="apply-generate">✓ Tillämpa alla (${suggestions.length})</button>
                    <button class="btn btn-secondary btn-sm" data-cal="cancel-generate">✕ Avbryt</button>
                </div>
            </div>
            <div class="cal-preview-stats">
                <span class="cal-preview-stat cal-preview-ok">✅ ${suggestions.length} tilldelningar</span>
                ${vacancySuggestions.length > 0
                    ? `<span class="cal-preview-stat cal-preview-vacancy">⚠️ ${vacancySuggestions.length} vakanser (ej tillräckligt folk)</span>`
                    : `<span class="cal-preview-stat cal-preview-ok">✅ Inga vakanser</span>`
                }
            </div>
            <div class="cal-preview-list">
                ${suggestions.slice(0, 20).map(s => {
                    const person = people.find(p => p.id === s.personId);
                    const personName = person ? `${person.firstName} ${person.lastName}` : s.personId;
                    const group = groups[s.groupId];
                    const shift = allShifts[s.shiftId];
                    const timeStr = shift?.startTime && shift?.endTime ? `${shift.startTime}–${shift.endTime}` : 'Flex';

                    return `
                        <div class="cal-preview-item">
                            <span class="cal-preview-date">${escapeHtml(s.date)}</span>
                            <span class="cal-preview-badge" style="background: ${sanitizeColor(group?.color)}; color: ${sanitizeColor(group?.textColor || '#fff')}">${escapeHtml(group?.name || s.groupId)}</span>
                            <span>${escapeHtml(shift?.name || s.shiftId)} (${escapeHtml(timeStr)})</span>
                            <strong>${escapeHtml(personName)}</strong>
                        </div>
                    `;
                }).join('')}
                ${suggestions.length > 20 ? `<p class="cal-preview-more">+${suggestions.length - 20} fler tilldelningar...</p>` : ''}
            </div>
        </div>
    `;
}
