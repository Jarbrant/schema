/* ========================================================================
 * S3-05 — PRINT CSS — Utskriftsvänlig veckovy
 * FIL: assets/css/print.css
 *
 * Ladda i index.html:
 *   <link rel="stylesheet" href="assets/css/print.css" media="print" />
 *
 * Döljer: navbar, knappar, modaler, sidebar, error-panel
 * Visar: schemagridet, grupprubriker, personkort
 * ======================================================================== */

@media print {

    /* ── Dölj allt som inte ska skrivas ut ── */
    #navbar,
    #error-panel,
    .cal-topbar-right,
    .cal-topbar button,
    .cal-add-btn,
    .cal-card-actions,
    .cal-card-edit,
    .cal-card-remove,
    .cal-modal-overlay,
    .cal-generate-preview,
    .cal-link-panel,
    .cal-vacancy-accept,
    .btn,
    .nav-link,
    .toast,
    .alert,
    [data-cal="toggle-link-panel"],
    [data-cal="generate"],
    [data-cal="lock-week"],
    [data-cal="unlock-week"],
    .no-print {
        display: none !important;
    }

    /* ── Grundläggande ── */
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }

    html, body {
        width: 100%;
        margin: 0;
        padding: 0;
        font-size: 10pt;
        line-height: 1.3;
        background: #fff !important;
        color: #000 !important;
    }

    main#app {
        padding: 0;
        margin: 0;
        max-width: 100%;
    }

    /* ── Topbar: visa bara veckonummer + datumintervall ── */
    .cal-topbar {
        display: flex !important;
        justify-content: center;
        padding: 8pt 0;
        border-bottom: 2pt solid #000;
        margin-bottom: 8pt;
        background: none !important;
    }

    .cal-topbar-left {
        display: none !important;
    }

    .cal-topbar-center {
        display: flex;
        align-items: center;
        gap: 8pt;
    }

    .cal-topbar-center button {
        display: none !important;
    }

    .cal-week-display {
        font-size: 14pt;
        font-weight: 700;
    }

    .cal-week-display strong {
        font-size: 16pt;
    }

    .cal-week-range {
        font-size: 10pt;
        color: #333 !important;
    }

    /* ── Veckoheader (dag-kolumner) ── */
    .cal-week-header {
        display: grid !important;
        grid-template-columns: 120pt repeat(7, 1fr);
        border-bottom: 1pt solid #999;
        padding-bottom: 4pt;
        margin-bottom: 4pt;
    }

    .cal-day-col-header {
        text-align: center;
        font-weight: 600;
        font-size: 9pt;
        padding: 2pt;
    }

    .cal-day-col-header.today {
        background: #e8e8e8 !important;
        border-radius: 4pt;
    }

    .cal-day-name {
        display: block;
        font-weight: 700;
    }

    .cal-day-date {
        display: block;
        font-size: 8pt;
        color: #555 !important;
    }

    /* ── Gruppheader ── */
    .cal-group-section {
        page-break-inside: avoid;
        margin-bottom: 8pt;
    }

    .cal-group-header {
        display: grid !important;
        grid-template-columns: 120pt repeat(7, 1fr);
        align-items: center;
        background: #f0f0f0 !important;
        padding: 4pt 6pt;
        border-left-width: 4pt !important;
        font-weight: 600;
    }

    .cal-group-toggle {
        display: none !important;
    }

    .cal-group-color {
        font-size: 10pt;
        padding: 2pt 6pt;
        border-radius: 3pt;
    }

    .cal-group-totals {
        font-size: 8pt;
        color: #555 !important;
    }

    .cal-day-summary-cell {
        text-align: center;
        font-size: 7pt;
    }

    /* ── Pass-rader ── */
    .cal-shift-section {
        page-break-inside: avoid;
    }

    .cal-shift-label {
        display: flex;
        align-items: center;
        padding: 2pt 4pt;
        font-size: 9pt;
        border-left-width: 3pt !important;
    }

    .cal-shift-toggle {
        display: none !important;
    }

    .cal-shift-dot {
        width: 8pt;
        height: 8pt;
        border-radius: 50%;
        margin-right: 4pt;
    }

    .cal-shift-days {
        display: grid !important;
        grid-template-columns: repeat(7, 1fr);
    }

    /* ── Dag-celler ── */
    .cal-day-cell {
        min-height: 24pt;
        padding: 2pt;
        border: 0.5pt solid #ddd;
        font-size: 8pt;
    }

    .cal-day-cell.saturday {
        background: #f5f5f5 !important;
    }

    .cal-day-cell.sunday {
        background: #eee !important;
    }

    /* ── Personkort ── */
    .cal-person-card {
        padding: 2pt 3pt;
        margin: 1pt 0;
        border-radius: 2pt;
        font-size: 7pt;
        border-left-width: 2pt !important;
        page-break-inside: avoid;
    }

    .cal-card-name {
        font-weight: 600;
        display: block;
    }

    .cal-card-time {
        display: block;
        font-size: 6pt;
        color: #555 !important;
    }

    /* ── Frånvarokort ── */
    .cal-absence-card {
        font-style: italic;
    }

    .cal-card-status {
        font-size: 6pt;
        font-weight: 600;
    }

    /* ── Vakanser ── */
    .cal-vacancy-card {
        border: 1pt dashed #999;
        background: #fff !important;
    }

    /* ── Varningar vid utskrift ── */
    .cal-warnings {
        border: 1pt solid #999;
        padding: 4pt;
        margin-bottom: 6pt;
        font-size: 8pt;
    }

    /* ── Footer med utskriftsdatum ── */
    @page {
        size: A4 landscape;
        margin: 10mm;
    }

    .cal-container::after {
        content: "Utskrivet: " attr(data-print-date, "");
        display: block;
        text-align: right;
        font-size: 7pt;
        color: #999;
        margin-top: 8pt;
        border-top: 0.5pt solid #ccc;
        padding-top: 4pt;
    }
}

/* ── Klass för element som ska döljas vid utskrift ── */
.no-print {
    /* Synlig normalt — döljs av @media print ovan */
}

/* ── Print-knapp styling (syns på skärm, döljs vid utskrift) ── */
.btn-print {
    background: #6c5ce7;
    color: #fff;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}

.btn-print:hover {
    background: #5a4bd1;
}
