/* ============================================================
 * AO-09 — Summary View CSS
 * Månadssammanställning: timmar, kostnader, per person/grupp
 * ============================================================ */

/* ── Container ── */
.sum-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 1rem 1.5rem 2rem;
}

.sum-error {
    padding: 2rem;
    text-align: center;
    color: #721c24;
    background: #ffe8e8;
    border-radius: 12px;
    margin: 2rem;
}

/* ── TOP BAR ── */
.sum-topbar {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    padding: 0.75rem 1.5rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.sum-topbar-center {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.sum-month-display {
    text-align: center;
    min-width: 180px;
}

.sum-month-display strong {
    display: block;
    font-size: 1.3rem;
    color: #333;
}

.sum-month-sub {
    font-size: 0.85rem;
    color: #666;
}

/* ── SUMMARY CARDS ── */
.sum-cards-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.sum-card {
    background: #fff;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.sum-card-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    font-weight: 600;
}

.sum-card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #333;
}

.sum-card-sub {
    font-size: 0.78rem;
    color: #999;
}

.sum-card.c-blue { border-left: 4px solid #2196f3; }
.sum-card.c-green { border-left: 4px solid #4caf50; }
.sum-card.c-orange { border-left: 4px solid #ff9800; }
.sum-card.c-purple { border-left: 4px solid #9c27b0; }
.sum-card.c-red { border-left: 4px solid #f44336; }

/* ── SECTIONS ── */
.sum-sections {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.sum-section {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;
}

.sum-section.full-width {
    grid-column: 1 / -1;
}

.sum-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    background: #f9fafb;
    border-bottom: 1px solid #e8e8e8;
    cursor: pointer;
    user-select: none;
}

.sum-section-header:hover {
    background: #f0f2f5;
}

.sum-section-header h3 {
    margin: 0;
    font-size: 0.95rem;
    color: #333;
}

.sum-section-toggle {
    font-size: 0.75rem;
    color: #999;
}

.sum-section-body {
    padding: 0.75rem 1.25rem;
    max-height: 500px;
    overflow-y: auto;
}

.sum-empty {
    color: #999;
    font-style: italic;
    font-size: 0.85rem;
    padding: 0.5rem 0;
}

/* ── PERSON TABLE ── */
.sum-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
}

.sum-table th {
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-bottom: 2px solid #e0e0e0;
    color: #555;
    font-weight: 600;
    font-size: 0.75rem;
    white-space: nowrap;
}

.sum-table th.right {
    text-align: right;
}

.sum-table td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
}

.sum-table td.right {
    text-align: right;
    font-variant-numeric: tabular-nums;
}

.sum-table tr:hover {
    background: #f9fafb;
}

.sum-table tr.sum-total-row {
    font-weight: 700;
    border-top: 2px solid #e0e0e0;
    background: #fafbfc;
}

.sum-table tr.sum-total-row td {
    border-bottom: none;
    padding-top: 0.6rem;
}

/* ── BARS ── */
.sum-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.sum-bar-track {
    flex: 1;
    height: 6px;
    background: #eee;
    border-radius: 3px;
    overflow: hidden;
    min-width: 50px;
}

.sum-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
}

.sum-bar-pct {
    font-size: 0.7rem;
    color: #888;
    min-width: 32px;
    text-align: right;
}

/* ── DAY DISTRIBUTION ── */
.sum-day-dist {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.sum-day-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 55px;
}

.sum-day-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
}

.sum-day-bar-v {
    width: 32px;
    background: #eee;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column-reverse;
    position: relative;
}

.sum-day-fill-v {
    width: 100%;
    border-radius: 0 0 4px 4px;
    transition: height 0.3s;
}

.sum-day-val {
    font-size: 0.7rem;
    font-weight: 600;
    color: #555;
}

/* ── EXPORT BUTTON ── */
.sum-export-btn {
    margin-left: auto;
}

/* ── RESPONSIVE ── */
@media (max-width: 900px) {
    .sum-sections {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 600px) {
    .sum-container {
        padding: 0.5rem;
    }
    .sum-topbar {
        flex-direction: column;
        gap: 0.5rem;
    }
    .sum-cards-row {
        grid-template-columns: repeat(2, 1fr);
    }
}
