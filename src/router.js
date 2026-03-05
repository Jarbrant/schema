/* ============================================================
 * FIL: src/router.js  (HEL FIL) — AUTOPATCH v10 + AO-14 + SPRINT 1 + SPRINT 3
 * NAMN: ROUTER — Route Management & Navigation
 *
 * AO-06:  Route 'week-templates' → renderWeekTemplates
 * AO-07:  Route 'calendar'       → renderCalendar
 * AO-08:  Route 'control'        → renderControl
 * AO-09:  Route 'summary'        → renderSummary
 * AO-10:  Route 'rules'          → renderRules
 * AO-11:  Route 'export'         → renderExport
 * AO-14:  Route 'help'           → renderHelp
 * S1-01:  Route 'absence'        → renderAbsence
 * S3-07:  Route 'xdays'          → renderXdays
 *
 * ALLA ROUTES IMPLEMENTERADE — INGA PLACEHOLDERS KVAR
 * ============================================================ */

/* ============================================================
 * BLOCK 1 — Imports
 * ============================================================ */
import { renderHome } from './views/home.js';
import { renderPersonal } from './views/personal.js';
import { renderGroups } from './views/groups.js';
import { renderShifts } from './views/shifts.js';
import { renderWeekTemplates } from './views/week-templates.js';    // AO-06
import { renderCalendar } from './views/calendar.js';               // AO-07
import { renderControl } from './views/control.js';                 // AO-08
import { renderSummary } from './views/summary.js';                 // AO-09
import { renderRules } from './views/rules.js';                     // AO-10
import { renderExport } from './views/export.js';                   // AO-11
import { renderHelp } from './views/help.js';                       // AO-14
import { renderAbsence } from './views/absence.js';                 // S1-01
import { renderXdays } from './views/xdays.js';                     // S3-07
import { renderLogin } from './views/login-pin.js';
import { renderError, renderNavbar } from './ui.js';
import { reportError } from './diagnostics.js';

/* ============================================================
 * BLOCK 2 — DOM helpers (XSS-safe)
 * ============================================================ */
function safeClear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

/* ============================================================
 * BLOCK 3 — Route-map  (INGA PLACEHOLDERS KVAR!)
 * ============================================================ */
const routes = {
    // Public
    login: renderLogin,

    // Protected — alla implementerade
    home: renderHome,
    shifts: renderShifts,
    groups: renderGroups,
    'week-templates': renderWeekTemplates,                                         // AO-06
    personal: renderPersonal,
    calendar: renderCalendar,                                                      // AO-07
    control: renderControl,                                                        // AO-08
    summary: renderSummary,                                                        // AO-09
    rules: renderRules,                                                            // AO-10
    export: renderExport,                                                          // AO-11
    help: renderHelp,                                                              // AO-14
    absence: renderAbsence,                                                        // S1-01
    xdays: renderXdays,                                                            // S3-07
};
