/* ============================================================
 * FIL: src/views/personal.js
 * PERSONAL.JS — Personal Management with HR System
 * VERSION: COMPLETE v4 + AUTOPATCH v11 (STRUKTUR + INLINE KOMMENTARER)
 *
 * OBS:
 * - Ingen funktionalitet borttagen eller ändrad.
 * - Endast struktur/kommentarer för läsbarhet/underhåll.
 *
 * HUVUD-FLÖDE:
 * renderPersonal() bygger hela vyn (DOM) → binder events → renderSearchResults()
 * → add/save/delete uppdaterar store → rerenderPersonal()
 * ============================================================ */

import { showSuccess, showWarning } from '../ui.js';
import { reportError } from '../diagnostics.js';
import { getVacationDaysPerYear, calculateYearsEmployed } from '../hr-rules.js';
import { calculatePersonMonthlyCost, formatCurrency, formatCurrencyDetailed } from '../lib/cost-utils.js';

/* ============================================================
 * BLOCK 0 — Konstanter & in-memory UI-state
 * STATE:
 * - __personalUI ligger i minne (ingen storage-key) och styr sök + edit-läge.
 * ============================================================ */
const DAYS_OF_WEEK = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

/** P0: UI-state (sök + vald person) (in-memory, ingen storage-key) */
const __personalUI = {
  query: '',
  selectedPersonId: null,
};

/* ============================================================
 * BLOCK 1 — PUBLIC VIEW ENTRYPOINT
 * renderPersonal(container, ctx)
 *
 * IO:
 * - Input: container (DOM), ctx.store (state/store)
 * - Output: Renderad DOM för Personal-vyn
 *
 * GUARD:
 * - Fail-closed om container/store saknas → error + diagnostics
 * ============================================================ */
export function renderPersonal(container, ctx) {
  try {
    if (!container || !ctx?.store) {
      throw new Error('Container eller store missing');
    }

    /* ----------------------------
     * BLOCK 1.1 — Läs state
     * ---------------------------- */
    const store = ctx.store;
    const state = store.getState();
    const people = state.people || [];

    // P0: groups kan vara array (gammalt) eller objekt/map (nytt store.js). Normalisera till array.
    const groupsRaw = state.groups;
    const groups = Array.isArray(groupsRaw) ? groupsRaw : Object.values(groupsRaw || {});

    /* ----------------------------
     * BLOCK 1.2 — Clear container (render från scratch)
     * WHY: undviker stale listeners/DOM
     * ---------------------------- */
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    /* ----------------------------
     * BLOCK 1.3 — Root wrapper
     * ---------------------------- */
    const viewContainer = document.createElement('div');
    viewContainer.className = 'view-container';

    /* ============================================================
     * BLOCK 2 — HEADER (titel + subtitle)
     * ============================================================ */
    const header = document.createElement('div');
    header.className = 'section-header';

    const title = document.createElement('h1');
    title.textContent = '👤 Personal';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Hantera personal, semesterdagar, löner, sektor och tillgänglighet';

    header.appendChild(title);
    header.appendChild(subtitle);

    /* ============================================================
     * BLOCK 3 — STATUS ROW (totalt personal)
     * ============================================================ */
    const statusRow = document.createElement('div');
    statusRow.className = 'control-status';

    const statusItem = document.createElement('div');
    statusItem.className = 'status-item';

    const statusLabel = document.createElement('span');
    statusLabel.className = 'status-label';
    statusLabel.textContent = 'Totalt personal:';

    const statusValue = document.createElement('span');
    statusValue.className = 'status-value';
    statusValue.textContent = String(people.length);

    statusItem.appendChild(statusLabel);
    statusItem.appendChild(statusValue);
    statusRow.appendChild(statusItem);

    /* ============================================================
     * BLOCK 4 — SEARCH ROW (query + actions + results)
     * STATE:
     * - __personalUI.query och __personalUI.selectedPersonId styr vad som visas.
     * ============================================================ */
    const searchRow = document.createElement('div');
    searchRow.style.marginTop = '1rem';
    searchRow.style.display = 'flex';
    searchRow.style.gap = '0.75rem';
    searchRow.style.alignItems = 'stretch';
    searchRow.style.flexWrap = 'wrap';

    const searchBox = document.createElement('div');
    searchBox.style.flex = '1';
    searchBox.style.minWidth = '280px';

    const searchLabel = document.createElement('div');
    searchLabel.textContent = 'Sök personal';
    searchLabel.style.fontWeight = '600';
    searchLabel.style.marginBottom = '0.35rem';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'personal-search';
    searchInput.className = 'form-control';
    searchInput.placeholder = 'Sök på namn eller e-post...';
    searchInput.value = __personalUI.query || '';
    ensureEditableInput(searchInput); // GUARD: tvinga skrivbarhet

    const searchHint = document.createElement('div');
    searchHint.style.fontSize = '0.85rem';
    searchHint.style.color = '#666';
    searchHint.style.marginTop = '0.35rem';
    searchHint.textContent = 'Klicka på en person i listan för att redigera i formuläret.';

    searchBox.appendChild(searchLabel);
    searchBox.appendChild(searchInput);
    searchBox.appendChild(searchHint);

    const searchActions = document.createElement('div');
    searchActions.style.display = 'flex';
    searchActions.style.gap = '0.5rem';
    searchActions.style.alignItems = 'end';

    const clearSearchBtn = document.createElement('button');
    clearSearchBtn.type = 'button';
    clearSearchBtn.className = 'btn btn-secondary';
    clearSearchBtn.textContent = 'Rensa sök';
    clearSearchBtn.onclick = (e) => {
      e.preventDefault();
      // STATE RESET: query + edit-läge
      __personalUI.query = '';
      __personalUI.selectedPersonId = null;
      rerenderPersonal(ctx, container);
    };

    const cancelEditBtn = document.createElement('button');
    cancelEditBtn.type = 'button';
    cancelEditBtn.className = 'btn btn-secondary';
    cancelEditBtn.textContent = 'Avbryt redigering';
    cancelEditBtn.onclick = (e) => {
      e.preventDefault();
      // STATE RESET: lämna edit-läge men behåll ev query via input event
      __personalUI.selectedPersonId = null;
      rerenderPersonal(ctx, container);
    };

    // UI: visa “Avbryt redigering” bara om vi faktiskt redigerar någon
    if (!__personalUI.selectedPersonId) {
      cancelEditBtn.style.display = 'none';
    }

    searchActions.appendChild(clearSearchBtn);
    searchActions.appendChild(cancelEditBtn);

    searchRow.appendChild(searchBox);
    searchRow.appendChild(searchActions);

    const resultsWrap = document.createElement('div');
    resultsWrap.id = 'personal-search-results';
    resultsWrap.style.marginTop = '0.75rem';
    resultsWrap.style.background = '#fff';
    resultsWrap.style.border = '1px solid #ddd';
    resultsWrap.style.borderRadius = '8px';
    resultsWrap.style.padding = '0.75rem';
    resultsWrap.style.display = 'none'; // visas när query finns eller om edit är aktiv

    /* ============================================================
     * BLOCK 5 — FORM SECTION (title + form root)
     * ============================================================ */
    const formSection = document.createElement('div');
    formSection.className = 'section-header';
    formSection.style.marginTop = '2rem';

    const formTitle = document.createElement('h2');
    formTitle.textContent = __personalUI.selectedPersonId ? '✏️ Redigera personal' : '➕ Lägg till ny personal';
    formSection.appendChild(formTitle);

    // Form root
    const form = document.createElement('form');
    form.id = 'personal-form';
    form.style.background = '#f9f9f9';
    form.style.padding = '1.5rem';
    form.style.borderRadius = '8px';

    /* ============================================================
     * BLOCK 6 — BASIC INFO (name/email/phone)
     * ============================================================ */
    const basicInfo = document.createElement('fieldset');
    basicInfo.style.border = 'none';
    basicInfo.style.marginBottom = '1.5rem';
    basicInfo.style.padding = '1rem';
    basicInfo.style.background = '#fff';
    basicInfo.style.borderRadius = '6px';

    const basicLegend = document.createElement('legend');
    basicLegend.textContent = 'Grundinformation';
    basicLegend.style.fontWeight = '600';
    basicLegend.style.marginBottom = '1rem';
    basicInfo.appendChild(basicLegend);

    const nameGroup = createFormGroup('personal-name', 'Namn *', 'text', 'Ex: Anna Ström');
    ensureEditableInput(nameGroup.querySelector('input'));
    basicInfo.appendChild(nameGroup);

    const emailGroup = createFormGroup('personal-email', 'E-post *', 'email', 'anna@example.com');
    ensureEditableInput(emailGroup.querySelector('input'));
    basicInfo.appendChild(emailGroup);

    const phoneGroup = createFormGroup('personal-phone', 'Telefon', 'tel', '+46 70 123 45 67');
    ensureEditableInput(phoneGroup.querySelector('input'));
    basicInfo.appendChild(phoneGroup);

    form.appendChild(basicInfo);

    /* ============================================================
     * BLOCK 7 — EMPLOYMENT INFO (startDate, degree, workdays)
     * ============================================================ */
    const employmentInfo = document.createElement('fieldset');
    employmentInfo.style.border = 'none';
    employmentInfo.style.marginBottom = '1.5rem';
    employmentInfo.style.padding = '1rem';
    employmentInfo.style.background = '#fff';
    employmentInfo.style.borderRadius = '6px';

    const employmentLegend = document.createElement('legend');
    employmentLegend.textContent = 'Anställningsinformation';
    employmentLegend.style.fontWeight = '600';
    employmentLegend.style.marginBottom = '1rem';
    employmentInfo.appendChild(employmentLegend);

    const startDateGroup = createFormGroup('personal-start-date', 'Startdatum *', 'date', '');
    ensureEditableInput(startDateGroup.querySelector('input'));
    employmentInfo.appendChild(startDateGroup);

    const degreeGroup = createFormGroup('personal-degree', 'Tjänstgöringsgrad (%) *', 'number', '100');
    const degreeInput = degreeGroup.querySelector('input');
    ensureEditableInput(degreeInput);
    degreeInput.min = '10';
    degreeInput.max = '100';
    degreeInput.value = degreeInput.value || '100';
    degreeInput.step = '1';
    employmentInfo.appendChild(degreeGroup);

    const workdaysGroup = createFormGroup('personal-workdays', 'Arbetsdagar per vecka *', 'number', '5');
    const workdaysInput = workdaysGroup.querySelector('input');
    ensureEditableInput(workdaysInput);
    workdaysInput.min = '1';
    workdaysInput.max = '7';
    workdaysInput.value = workdaysInput.value || '5';
    workdaysInput.step = '1';
    employmentInfo.appendChild(workdaysGroup);

    form.appendChild(employmentInfo);

    /* ============================================================
     * BLOCK 8 — SECTOR SELECTION (private/municipal)
     * STATE:
     * - radio[name="sector"] styr vacation calc + cost calc
     * GUARD:
     * - init-styling triggas direkt (dispatch change)
     * ============================================================ */
    const sectorInfo = document.createElement('fieldset');
    sectorInfo.style.border = 'none';
    sectorInfo.style.marginBottom = '1.5rem';
    sectorInfo.style.padding = '1rem';
    sectorInfo.style.background = '#fff';
    sectorInfo.style.borderRadius = '6px';

    const sectorLegend = document.createElement('legend');
    sectorLegend.textContent = 'Sektor *';
    sectorLegend.style.fontWeight = '600';
    sectorLegend.style.marginBottom = '1rem';
    sectorInfo.appendChild(sectorLegend);

    const sectorContainer = document.createElement('div');
    sectorContainer.style.display = 'grid';
    sectorContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    sectorContainer.style.gap = '1rem';

    // --- Private sector card ---
    const privateLabel = document.createElement('label');
    privateLabel.style.display = 'flex';
    privateLabel.style.alignItems = 'center';
    privateLabel.style.gap = '0.5rem';
    privateLabel.style.cursor = 'pointer';
    privateLabel.style.padding = '0.75rem';
    privateLabel.style.border = '2px solid #ddd';
    privateLabel.style.borderRadius = '6px';
    privateLabel.style.transition = 'all 0.2s';

    const privateRadio = document.createElement('input');
    privateRadio.type = 'radio';
    privateRadio.name = 'sector';
    privateRadio.value = 'private';
    privateRadio.checked = true; // DEFAULT
    privateRadio.id = 'sector-private';
    privateRadio.style.cursor = 'pointer';

    const privateSpan = document.createElement('span');
    // SCOPE: statisk text ok som innerHTML (ingen användardata)
    privateSpan.innerHTML = '<strong>Privat sektor</strong><br><small>25/28/31 dagar</small>';

    privateLabel.appendChild(privateRadio);
    privateLabel.appendChild(privateSpan);

    privateLabel.onmouseover = () => {
      privateLabel.style.borderColor = '#667eea';
      privateLabel.style.background = '#f9f9f9';
    };
    privateLabel.onmouseout = () => {
      privateLabel.style.borderColor = privateRadio.checked ? '#667eea' : '#ddd';
      privateLabel.style.background = privateRadio.checked ? '#f0f4ff' : 'transparent';
    };

    sectorContainer.appendChild(privateLabel);

    // --- Municipal sector card ---
    const municipalLabel = document.createElement('label');
    municipalLabel.style.display = 'flex';
    municipalLabel.style.alignItems = 'center';
    municipalLabel.style.gap = '0.5rem';
    municipalLabel.style.cursor = 'pointer';
    municipalLabel.style.padding = '0.75rem';
    municipalLabel.style.border = '2px solid #ddd';
    municipalLabel.style.borderRadius = '6px';
    municipalLabel.style.transition = 'all 0.2s';

    const municipalRadio = document.createElement('input');
    municipalRadio.type = 'radio';
    municipalRadio.name = 'sector';
    municipalRadio.value = 'municipal';
    municipalRadio.id = 'sector-municipal';
    municipalRadio.style.cursor = 'pointer';

    const municipalSpan = document.createElement('span');
    // SCOPE: statisk text ok som innerHTML (ingen användardata)
    municipalSpan.innerHTML = '<strong>Kommunal sektor</strong><br><small>28/30/32 dagar</small>';

    municipalLabel.appendChild(municipalRadio);
    municipalLabel.appendChild(municipalSpan);

    municipalLabel.onmouseover = () => {
      municipalLabel.style.borderColor = '#667eea';
      municipalLabel.style.background = '#f9f9f9';
    };
    municipalLabel.onmouseout = () => {
      municipalLabel.style.borderColor = municipalRadio.checked ? '#667eea' : '#ddd';
      municipalLabel.style.background = municipalRadio.checked ? '#f0f4ff' : 'transparent';
    };

    sectorContainer.appendChild(municipalLabel);

    // EVENTS: radio change behavior (måste sättas efter båda finns)
    privateRadio.onchange = () => {
      privateLabel.style.borderColor = '#667eea';
      privateLabel.style.background = '#f0f4ff';
      municipalLabel.style.borderColor = '#ddd';
      municipalLabel.style.background = 'transparent';
      updateCostDisplay(form); // P0: live
    };
    municipalRadio.onchange = () => {
      municipalLabel.style.borderColor = '#667eea';
      municipalLabel.style.background = '#f0f4ff';
      privateLabel.style.borderColor = '#ddd';
      privateLabel.style.background = 'transparent';
      updateCostDisplay(form); // P0: live
    };

    // P2: trigga initial styling direkt så default blir markerad utan klick
    try {
      if (privateRadio.checked) privateRadio.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // ignore
    }

    sectorInfo.appendChild(sectorContainer);
    form.appendChild(sectorInfo);

    /* ============================================================
     * BLOCK 9 — SALARY & VACATION INPUTS (salary + saved days)
     * EVENTS:
     * - salary input → updateCostDisplay(form)
     * ============================================================ */
    const salaryInfo = document.createElement('fieldset');
    salaryInfo.style.border = 'none';
    salaryInfo.style.marginBottom = '1.5rem';
    salaryInfo.style.padding = '1rem';
    salaryInfo.style.background = '#fff';
    salaryInfo.style.borderRadius = '6px';

    const salaryLegend = document.createElement('legend');
    salaryLegend.textContent = 'Lön & Semesterdagar';
    salaryLegend.style.fontWeight = '600';
    salaryLegend.style.marginBottom = '1rem';
    salaryInfo.appendChild(salaryLegend);

    const salaryGroup = createFormGroup('personal-salary', 'Månadslön (SEK)', 'number', '25000');
    const salaryInput = salaryGroup.querySelector('input');
    ensureEditableInput(salaryInput);
    salaryInput.step = '1';
    salaryInput.addEventListener('input', () => updateCostDisplay(form)); // P0: live
    salaryInfo.appendChild(salaryGroup);

    const savedVacationGroup = createFormGroup('personal-saved-vacation', 'Sparade semesterdagar', 'number', '0');
    const savedVacationInput = savedVacationGroup.querySelector('input');
    ensureEditableInput(savedVacationInput);
    savedVacationInput.step = '1';
    salaryInfo.appendChild(savedVacationGroup);

    const savedLeaveGroup = createFormGroup('personal-saved-leave', 'Sparade ledighetsdagar', 'number', '0');
    const savedLeaveInput = savedLeaveGroup.querySelector('input');
    ensureEditableInput(savedLeaveInput);
    savedLeaveInput.step = '1';
    salaryInfo.appendChild(savedLeaveGroup);

    form.appendChild(salaryInfo);

    /* ============================================================
     * BLOCK 10 — COST DISPLAY (P0 live view)
     * XSS:
     * - updateCostDisplay använder textContent/DOM-noder
     * ============================================================ */
    const costDisplay = document.createElement('div');
    costDisplay.id = 'personal-cost-display';
    costDisplay.style.marginTop = '1.5rem';
    costDisplay.style.padding = '1rem';
    costDisplay.style.background = '#f5f5f5';
    costDisplay.style.borderRadius = '8px';
    costDisplay.style.border = '1px solid #ddd';
    costDisplay.textContent = '💰 Månadskostnad: (Fyll i lön för att beräkna)';
    form.appendChild(costDisplay);

    /* ============================================================
     * BLOCK 11 — GROUPS (checkboxes + create inline)
     * IO:
     * - Läser state.groups (array/map) och bygger checkboxar
     * - Skapar grupp via createGroupFromPersonal()
     * ============================================================ */
    const groupsInfo = document.createElement('fieldset');
    groupsInfo.style.border = 'none';
    groupsInfo.style.marginBottom = '1.5rem';
    groupsInfo.style.padding = '1rem';
    groupsInfo.style.background = '#fff';
    groupsInfo.style.borderRadius = '6px';

    const groupsLegend = document.createElement('legend');
    groupsLegend.textContent = 'Arbetgrupper *';
    groupsLegend.style.fontWeight = '600';
    groupsLegend.style.marginBottom = '1rem';
    groupsInfo.appendChild(groupsLegend);

    // P0: skapa ny grupp inline
    const createGroupRow = document.createElement('div');
    createGroupRow.style.display = 'flex';
    createGroupRow.style.gap = '0.75rem';
    createGroupRow.style.alignItems = 'center';
    createGroupRow.style.marginBottom = '1rem';

    const newGroupInput = document.createElement('input');
    newGroupInput.type = 'text';
    newGroupInput.id = 'personal-new-group';
    newGroupInput.className = 'form-control';
    newGroupInput.placeholder = 'Ny grupp (ex: Bar, Kök, Servering)';
    ensureEditableInput(newGroupInput);
    newGroupInput.style.flex = '1';

    const createGroupBtn = document.createElement('button');
    createGroupBtn.type = 'button';
    createGroupBtn.className = 'btn btn-secondary';
    createGroupBtn.textContent = '➕ Skapa grupp';
    createGroupBtn.onclick = (e) => {
      e.preventDefault();
      createGroupFromPersonal(newGroupInput.value, store, ctx, container);
    };

    createGroupRow.appendChild(newGroupInput);
    createGroupRow.appendChild(createGroupBtn);
    groupsInfo.appendChild(createGroupRow);

    const groupsContainer = document.createElement('div');
    groupsContainer.id = 'personal-groups';
    groupsContainer.style.display = 'grid';
    groupsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    groupsContainer.style.gap = '1rem';

    if (groups.length === 0) {
      const noGroupsMsg = document.createElement('p');
      noGroupsMsg.textContent = 'Ingen grupper definierade. Skapa en grupp ovan.';
      noGroupsMsg.style.color = '#999';
      noGroupsMsg.style.fontStyle = 'italic';
      groupsContainer.appendChild(noGroupsMsg);
    } else {
      groups.forEach((group) => {
        const checkbox = document.createElement('label');
        checkbox.style.display = 'flex';
        checkbox.style.alignItems = 'center';
        checkbox.style.gap = '0.5rem';
        checkbox.style.cursor = 'pointer';
        checkbox.style.padding = '0.5rem';
        checkbox.style.border = '1px solid #ddd';
        checkbox.style.borderRadius = '6px';
        checkbox.style.transition = 'all 0.2s';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'group-checkbox';
        input.value = group.id;
        input.style.cursor = 'pointer';

        const span = document.createElement('span');
        // XSS-safe: textContent
        span.textContent = group.name;

        checkbox.appendChild(input);
        checkbox.appendChild(span);

        checkbox.onmouseover = () => {
          checkbox.style.background = '#f9f9f9';
        };
        checkbox.onmouseout = () => {
          checkbox.style.background = 'transparent';
        };

        groupsContainer.appendChild(checkbox);
      });
    }

    groupsInfo.appendChild(groupsContainer);
    form.appendChild(groupsInfo);

    /* ============================================================
     * BLOCK 12 — AVAILABILITY (week checkboxes Mon-Sun)
     * DEFAULT:
     * - Mån–Fre = checked
     * ============================================================ */
    const availabilityInfo = document.createElement('fieldset');
    availabilityInfo.style.border = 'none';
    availabilityInfo.style.marginBottom = '1.5rem';
    availabilityInfo.style.padding = '1rem';
    availabilityInfo.style.background = '#fff';
    availabilityInfo.style.borderRadius = '6px';

    const availabilityLegend = document.createElement('legend');
    availabilityLegend.textContent = 'Tillgänglighet (vecka)';
    availabilityLegend.style.fontWeight = '600';
    availabilityLegend.style.marginBottom = '1rem';
    availabilityInfo.appendChild(availabilityLegend);

    const availabilityContainer = document.createElement('div');
    availabilityContainer.id = 'personal-availability';
    availabilityContainer.style.display = 'flex';
    availabilityContainer.style.gap = '0.5rem';
    availabilityContainer.style.flexWrap = 'wrap';

    DAYS_OF_WEEK.forEach((day, index) => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '0.5rem';
      label.style.cursor = 'pointer';
      label.style.padding = '0.5rem 1rem';
      label.style.background = '#f0f0f0';
      label.style.borderRadius = '6px';
      label.style.transition = 'all 0.2s';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'availability-checkbox';
      checkbox.value = String(index);
      checkbox.checked = index < 5; // Mån-Fre as default
      checkbox.style.cursor = 'pointer';

      const span = document.createElement('span');
      span.textContent = day;

      label.appendChild(checkbox);
      label.appendChild(span);

      label.onmouseover = () => {
        label.style.background = '#e0e0e0';
      };
      label.onmouseout = () => {
        label.style.background = checkbox.checked ? '#d4e6ff' : '#f0f0f0';
      };

      checkbox.onchange = () => {
        label.style.background = checkbox.checked ? '#d4e6ff' : '#f0f0f0';
      };

      availabilityContainer.appendChild(label);
    });

    availabilityInfo.appendChild(availabilityContainer);
    form.appendChild(availabilityInfo);

    /* ============================================================
     * BLOCK 13 — CALCULATION PERIOD (AO-12)
     * NOTE:
     * - Denna sektion var inklistrad senare i filen; ingen logik ändras här.
     * - För närvarande skapas select + default Q1.
     * - (Om du vill att detta ska sparas/läsas in i add/edit behöver vi koppla det i addPerson/saveEditedPerson/loadPersonIntoForm — men DET vore funktionell ändring, inte gjort här.)
     * ============================================================ */
    // === CALCULATION PERIOD (AO-12) ===
    const calcPeriodInfo = document.createElement('fieldset');
    calcPeriodInfo.style.border = 'none';
    calcPeriodInfo.style.marginBottom = '1.5rem';
    calcPeriodInfo.style.padding = '1rem';
    calcPeriodInfo.style.background = '#fff';
    calcPeriodInfo.style.borderRadius = '6px';

    const calcPeriodLegend = document.createElement('legend');
    calcPeriodLegend.textContent = 'Beräkningsperiod (HRF)';
    calcPeriodLegend.style.fontWeight = '600';
    calcPeriodLegend.style.marginBottom = '1rem';
    calcPeriodInfo.appendChild(calcPeriodLegend);

    const calcPeriodDesc = document.createElement('p');
    calcPeriodDesc.style.fontSize = '0.85rem';
    calcPeriodDesc.style.color = '#666';
    calcPeriodDesc.style.marginBottom = '1rem';
    calcPeriodDesc.textContent =
      'Välj vilken kvartal personen börjar sin beräkningsperiod. Timmar balanseras inom varje kvartal enligt HRF (40h/vecka heltid).';
    calcPeriodInfo.appendChild(calcPeriodDesc);

    const calcPeriodSelect = document.createElement('select');
    calcPeriodSelect.id = 'personal-calc-period';
    calcPeriodSelect.className = 'form-control';
    calcPeriodSelect.style.maxWidth = '300px';

    const periodOptions = [
      { value: 'q1', label: 'Q1 — Januari–Mars (standard)' },
      { value: 'q2', label: 'Q2 — April–Juni' },
      { value: 'q3', label: 'Q3 — Juli–September' },
      { value: 'q4', label: 'Q4 — Oktober–December' },
    ];
    periodOptions.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === 'q1') option.selected = true; // DEFAULT
      calcPeriodSelect.appendChild(option);
    });

    ensureEditableInput(calcPeriodSelect);
    calcPeriodInfo.appendChild(calcPeriodSelect);

    form.appendChild(calcPeriodInfo);

    /* ============================================================
     * BLOCK 14 — BUTTONS + ERROR AREA + FORM EVENTS
     * EVENTS:
     * - submit: addPerson() eller saveEditedPerson()
     * - reset: robust edit-mode reload
     * ============================================================ */
    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.gap = '1rem';
    buttonGroup.style.marginTop = '1.5rem';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = __personalUI.selectedPersonId ? '💾 Spara ändringar' : '➕ Lägg till';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'reset';
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = __personalUI.selectedPersonId ? '↩️ Återställ formulär' : '🔄 Rensa';

    buttonGroup.appendChild(submitBtn);
    buttonGroup.appendChild(resetBtn);
    form.appendChild(buttonGroup);

    // Error message container (renderas via displayError)
    const errorDiv = document.createElement('div');
    errorDiv.id = 'personal-error';
    errorDiv.style.marginTop = '1rem';
    form.appendChild(errorDiv);

    // submit handler
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (__personalUI.selectedPersonId) {
        saveEditedPerson(form, errorDiv, store, ctx, container, __personalUI.selectedPersonId);
      } else {
        addPerson(form, errorDiv, store, ctx, container);
      }
    });

    // P0: RESET robusthet i edit-läge -> ladda om vald person istället för att rensa
    form.addEventListener('reset', () => {
      try {
        if (!__personalUI.selectedPersonId) {
          // add-läge: uppdatera cost display direkt (tomt)
          setTimeout(() => updateCostDisplay(form), 0);
          return;
        }
        const st = store.getState();
        const ppl = st.people || [];
        const selected = ppl.find((p) => p?.id === __personalUI.selectedPersonId);
        if (selected) {
          // queue så reset hinner rensa DOM först
          setTimeout(() => loadPersonIntoForm(selected), 0);
        }
      } catch (e) {
        console.warn('⚠️ reset(edit) reload failed', e);
      }
    });

    /* ============================================================
     * BLOCK 15 — PEOPLE LIST (cards)
     * ============================================================ */
    const listSection = document.createElement('div');
    listSection.className = 'section-header';
    listSection.style.marginTop = '2rem';

    const listTitle = document.createElement('h2');
    listTitle.textContent = `👥 Personal (${people.length})`;
    listSection.appendChild(listTitle);

    const list = document.createElement('div');
    list.id = 'personal-list';
    list.style.marginTop = '1rem';

    if (people.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'Ingen personal.';
      emptyMsg.style.color = '#999';
      emptyMsg.style.fontStyle = 'italic';
      list.appendChild(emptyMsg);
    } else {
      people.forEach((person) => {
        const card = createPersonCard(person, store, ctx, container, groups);
        list.appendChild(card);
      });
    }

    /* ============================================================
     * BLOCK 16 — Assemble page + bind search + live updates + init
     * ============================================================ */
    viewContainer.appendChild(header);
    viewContainer.appendChild(statusRow);
    viewContainer.appendChild(searchRow);
    viewContainer.appendChild(resultsWrap);
    viewContainer.appendChild(formSection);
    viewContainer.appendChild(form);
    viewContainer.appendChild(listSection);
    viewContainer.appendChild(list);

    container.appendChild(viewContainer);

    // Bind search input → uppdatera __personalUI.query och rendera resultat
    searchInput.addEventListener('input', () => {
      __personalUI.query = (searchInput.value || '').trim();
      renderSearchResults(resultsWrap, people, store, ctx, container);
    });

    // Live uppdatering cost om degree ändras (P0)
    degreeInput.addEventListener('input', () => updateCostDisplay(form));

    // Render initial results (om query finns eller om edit är aktiv)
    renderSearchResults(resultsWrap, people, store, ctx, container);

    // Init cost display (P0)
    updateCostDisplay(form);

    // Om vald person finns -> ladda i formulär efter DOM finns
    if (__personalUI.selectedPersonId) {
      const selected = people.find((p) => p?.id === __personalUI.selectedPersonId);
      if (selected) {
        loadPersonIntoForm(selected);
      } else {
        // fail-closed: personen finns inte längre
        __personalUI.selectedPersonId = null;
      }
    }

    console.log('✓ Personal view rendered');
  } catch (err) {
    console.error('❌ Error rendering personal:', err);
    reportError('PERSONAL_RENDER_ERROR', 'PERSONAL_VIEW', 'src/views/personal.js', err.message);
  }
}

/* ============================================================
 * BLOCK 17 — Search helpers
 * renderSearchResults(resultsWrap, people, ...)
 * ============================================================ */
function renderSearchResults(resultsWrap, people, store, ctx, container) {
  try {
    if (!resultsWrap) return;

    // Töm
    while (resultsWrap.firstChild) resultsWrap.removeChild(resultsWrap.firstChild);

    const q = (__personalUI.query || '').toLowerCase();
    const show = q.length > 0 || !!__personalUI.selectedPersonId;
    resultsWrap.style.display = show ? 'block' : 'none';
    if (!show) return;

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.gap = '0.75rem';
    header.style.marginBottom = '0.5rem';

    const h = document.createElement('div');
    h.style.fontWeight = '700';
    h.textContent = q.length ? 'Sökresultat' : 'Vald person';

    const hint = document.createElement('div');
    hint.style.fontSize = '0.85rem';
    hint.style.color = '#666';
    hint.textContent = 'Klicka för att ladda i formuläret.';

    header.appendChild(h);
    header.appendChild(hint);
    resultsWrap.appendChild(header);

    const matches = q.length
      ? people.filter((p) => {
          const name = String(p?.name || '').toLowerCase();
          const email = String(p?.email || '').toLowerCase();
          const fn = String(p?.firstName || '').toLowerCase();
          const ln = String(p?.lastName || '').toLowerCase();
          return name.includes(q) || email.includes(q) || fn.includes(q) || ln.includes(q);
        })
      : __personalUI.selectedPersonId
        ? people.filter((p) => p?.id === __personalUI.selectedPersonId)
        : [];

    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#999';
      empty.style.fontStyle = 'italic';
      empty.textContent = q.length ? 'Inga träffar.' : 'Ingen vald person.';
      resultsWrap.appendChild(empty);
      return;
    }

    const ul = document.createElement('div');
    ul.style.display = 'grid';
    ul.style.gap = '0.5rem';

    matches.slice(0, 20).forEach((p) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'btn btn-secondary';
      row.style.textAlign = 'left';
      row.style.padding = '0.65rem 0.75rem';
      row.style.borderRadius = '8px';
      row.style.background = p.id === __personalUI.selectedPersonId ? '#eef3ff' : '#fff';
      row.style.border = p.id === __personalUI.selectedPersonId ? '2px solid #667eea' : '1px solid #ddd';

      const top = document.createElement('div');
      top.style.fontWeight = '700';
      top.textContent = p?.name || `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || '(namn saknas)';

      const sub = document.createElement('div');
      sub.style.fontSize = '0.85rem';
      sub.style.color = '#555';
      sub.textContent = p?.email || '-';

      row.appendChild(top);
      row.appendChild(sub);

      row.onclick = (e) => {
        e.preventDefault();
        __personalUI.selectedPersonId = p.id;
        // STATE: behåll query så man kan byta person snabbt
        rerenderPersonal(ctx, container);
      };

      ul.appendChild(row);
    });

    resultsWrap.appendChild(ul);
  } catch (e) {
    console.warn('⚠️ renderSearchResults failed', e);
  }
}

/* ============================================================
 * BLOCK 18 — Load selected person into form (edit-mode)
 * loadPersonIntoForm(person)
 * ============================================================ */
function loadPersonIntoForm(person) {
  try {
    // Basic
    const nameEl = document.getElementById('personal-name');
    const emailEl = document.getElementById('personal-email');
    const phoneEl = document.getElementById('personal-phone');

    if (nameEl) nameEl.value = person?.name || '';
    if (emailEl) emailEl.value = person?.email || '';
    if (phoneEl) phoneEl.value = person?.phone == null ? '' : String(person.phone);

    // Employment
    const startEl = document.getElementById('personal-start-date');
    const degreeEl = document.getElementById('personal-degree');
    const workdaysEl = document.getElementById('personal-workdays');

    if (startEl) startEl.value = person?.startDate || '';
    if (degreeEl) degreeEl.value = String(person?.degree ?? person?.employmentPct ?? 100);
    if (workdaysEl) workdaysEl.value = String(person?.workdaysPerWeek ?? 5);

    // Salary/vacation/leave
    const salaryEl = document.getElementById('personal-salary');
    const svEl = document.getElementById('personal-saved-vacation');
    const slEl = document.getElementById('personal-saved-leave');

    if (salaryEl) salaryEl.value = String(person?.salary ?? 0);
    if (svEl) svEl.value = String(person?.savedVacationDays ?? 0);
    if (slEl) slEl.value = String(person?.savedLeaveDays ?? 0);

    // Sector (ROBUST): trigga bara den radio som är checked
    const sector = person?.sector === 'municipal' ? 'municipal' : 'private';
    const priv = document.getElementById('sector-private');
    const mun = document.getElementById('sector-municipal');
    if (priv && mun) {
      priv.checked = sector === 'private';
      mun.checked = sector === 'municipal';

      const target = priv.checked ? priv : mun;
      try {
        target.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        /* ignore */
      }
    }

    // Groups checkboxes
    const gids = Array.isArray(person?.groupIds) ? person.groupIds : Array.isArray(person?.groups) ? person.groups : [];
    const groupChecks = Array.from(document.querySelectorAll('.group-checkbox'));
    groupChecks.forEach((cb) => {
      cb.checked = gids.includes(cb.value);
    });

    // Availability
    const avail = Array.isArray(person?.availability) ? person.availability : null;
    const avChecks = Array.from(document.querySelectorAll('.availability-checkbox'));
    avChecks.forEach((cb, idx) => {
      cb.checked = avail ? !!avail[idx] : idx < 5;
      // uppdatera label-färg genom att trigga change
      try {
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        /* ignore */
      }
    });

    // P0: uppdatera cost display efter att vi laddat värden
    const form = document.getElementById('personal-form');
    if (form) updateCostDisplay(form);
  } catch (e) {
    console.warn('⚠️ loadPersonIntoForm failed', e);
  }
}

/* ============================================================
 * BLOCK 19 — UI Guard: ensureEditableInput
 * WHY:
 * - Fail-closed mot global CSS/JS som råkat göra inputs readOnly/disabled
 * ============================================================ */
function ensureEditableInput(input) {
  if (!input) return;
  try {
    input.disabled = false;
    input.readOnly = false;
    input.tabIndex = 0;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.pointerEvents = 'auto';
    input.style.userSelect = 'text';
    input.style.webkitUserSelect = 'text';
    input.style.touchAction = 'manipulation';
  } catch {
    // ignore
  }
}

/* ============================================================
 * BLOCK 20 — Cost display updater (P0)
 * XSS:
 * - endast textContent / createElement (ingen innerHTML)
 * ============================================================ */
function updateCostDisplay(form) {
  try {
    const costEl = document.getElementById('personal-cost-display');
    if (!costEl) return;

    const salary = parseInt(form?.querySelector('#personal-salary')?.value || 0);
    const degree = parseInt(form?.querySelector('#personal-degree')?.value || 100);

    // Töm
    while (costEl.firstChild) costEl.removeChild(costEl.firstChild);

    if (!salary || salary <= 0) {
      costEl.textContent = '💰 Månadskostnad: (Fyll i lön för att beräkna)';
      return;
    }

    // NOTE: calculatePersonMonthlyCost förväntar salary + employmentPct-ish
    const personForCalc = { salary, employmentPct: degree };
    const costs = calculatePersonMonthlyCost(personForCalc);

    const line1 = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `💰 Månadskostnad: ${formatCurrency(costs.totalCost)}`;
    line1.appendChild(strong);

    const line2 = document.createElement('div');
    line2.style.marginTop = '0.35rem';
    line2.style.fontSize = '0.9rem';
    line2.style.color = '#555';
    line2.textContent = `Lön: ${formatCurrency(costs.adjustedSalary)} + Arb.avg (${(costs.employerTaxRate * 100).toFixed(
      1
    )}%): ${formatCurrency(costs.employerTax)}`;

    costEl.appendChild(line1);
    costEl.appendChild(line2);
  } catch (e) {
    console.warn('⚠️ updateCostDisplay failed', e);
  }
}

/* ============================================================
 * BLOCK 21 — Create group inline from Personal
 * IO:
 * - Input: nameRaw, store/state
 * - Output: store.setState() uppdaterar groups (array eller map)
 * ============================================================ */
function createGroupFromPersonal(nameRaw, store, ctx, container) {
  try {
    const name = (nameRaw || '').trim();
    if (name.length < 2) {
      showWarning('⚠️ Gruppnamn måste vara minst 2 tecken');
      return;
    }

    const state = store.getState();
    const groupsRaw = state.groups;

    const groupsArr = Array.isArray(groupsRaw) ? groupsRaw : Object.values(groupsRaw || {});
    const exists = groupsArr.some((g) => (g?.name || '').toLowerCase() === name.toLowerCase());
    if (exists) {
      showWarning('⚠️ Gruppen finns redan');
      return;
    }

    const newGroup = { id: `group_${Date.now()}`, name };

    let nextGroups;
    if (Array.isArray(groupsRaw)) {
      nextGroups = [...groupsRaw, newGroup];
    } else {
      // map/object
      nextGroups = { ...(groupsRaw || {}) };
      nextGroups[newGroup.id] = newGroup;
    }

    store.setState({ ...state, groups: nextGroups });
    showSuccess('✓ Grupp skapad');

    rerenderPersonal(ctx, container);
  } catch (err) {
    console.error('❌ createGroupFromPersonal failed', err);
    showWarning(`⚠️ Kunde inte skapa grupp: ${err?.message || err}`);
  }
}

/* ============================================================
 * BLOCK 22 — Form helpers (pure DOM factories)
 * ============================================================ */
function createFormGroup(id, label, type, placeholder) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const labelEl = document.createElement('label');
  labelEl.setAttribute('for', id);
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.className = 'form-control';
  input.placeholder = placeholder;

  group.appendChild(labelEl);
  group.appendChild(input);

  return group;
}

function createSectionTitle(text) {
  const h = document.createElement('h4');
  h.style.margin = '0 0 0.75rem 0';
  h.style.color = '#333';
  h.textContent = text;
  return h;
}

function createInfoLine(label, value, opts = {}) {
  const p = document.createElement('p');
  p.style.margin = opts.margin ?? '0 0 0.5rem 0';
  p.style.fontSize = opts.fontSize ?? '0.9rem';
  if (opts.color) p.style.color = opts.color;

  const strong = document.createElement('strong');
  strong.textContent = label;

  const span = document.createElement('span');
  span.textContent = ` ${value}`;

  p.appendChild(strong);
  p.appendChild(span);
  return p;
}

function createDivider() {
  const div = document.createElement('div');
  div.style.borderTop = '1px solid #f0f0f0';
  div.style.paddingTop = '0.5rem';
  div.style.marginTop = '0.5rem';
  return div;
}

/* ============================================================
 * BLOCK 23 — Person card renderer (list view)
 * XSS:
 * - all user data via textContent / createInfoLine
 * ============================================================ */
function createPersonCard(person, store, ctx, container, groups) {
  const card = document.createElement('div');
  card.style.background = '#fff';
  card.style.border = '1px solid #ddd';
  card.style.borderRadius = '8px';
  card.style.padding = '1.5rem';
  card.style.marginBottom = '1rem';

  // Header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'start';
  header.style.marginBottom = '1rem';
  header.style.paddingBottom = '1rem';
  header.style.borderBottom = '2px solid #f0f0f0';

  const name = document.createElement('h3');
  name.style.margin = '0';
  name.textContent = person?.name || '-';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '0.5rem';

  const editBtn = document.createElement('button');
  editBtn.textContent = '✏️ Redigera';
  editBtn.className = 'btn btn-secondary';
  editBtn.style.padding = '0.5rem 0.75rem';
  editBtn.style.fontSize = '0.85rem';
  editBtn.onclick = (e) => {
    e.preventDefault();
    __personalUI.selectedPersonId = person.id;
    rerenderPersonal(ctx, container);
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '🗑️ Ta bort';
  deleteBtn.className = 'btn btn-secondary';
  deleteBtn.style.padding = '0.5rem 0.75rem';
  deleteBtn.style.fontSize = '0.85rem';
  deleteBtn.style.background = '#f8d7da';
  deleteBtn.style.color = '#721c24';
  deleteBtn.onclick = (e) => {
    e.preventDefault();
    deletePerson(person.id, store, ctx, container);
  };

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(name);
  header.appendChild(actions);
  card.appendChild(header);

  // Content grid
  const content = document.createElement('div');
  content.style.display = 'grid';
  content.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
  content.style.gap = '1.5rem';

  // Kontakt
  const basicSection = document.createElement('div');
  basicSection.appendChild(createSectionTitle('Kontakt'));
  basicSection.appendChild(createInfoLine('E-post:', person?.email || '-', { margin: '0 0 0.5rem 0' }));
  basicSection.appendChild(createInfoLine('Telefon:', person?.phone || '-', { margin: '0', fontSize: '0.9rem' }));
  content.appendChild(basicSection);

  // Anställning
  const employmentSection = document.createElement('div');
  const sector = person?.sector === 'municipal' ? 'municipal' : 'private';
  const yearsEmployed = calculateYearsEmployed(person.startDate, sector);
  const vacationDays = getVacationDaysPerYear(yearsEmployed, person.degree || person.employmentPct || 100, sector);

  employmentSection.appendChild(createSectionTitle('Anställning'));
  employmentSection.appendChild(createInfoLine('Startdatum:', formatDate(person.startDate)));
  employmentSection.appendChild(createInfoLine('År:', String(yearsEmployed)));
  employmentSection.appendChild(createInfoLine('Tjänstgöringsgrad:', `${person.degree || person.employmentPct || 100}%`));
  employmentSection.appendChild(createInfoLine('Arbetsdagar/vecka:', String(person.workdaysPerWeek || 5)));

  // AO-12: Beräkningsperiod i kortet
  const periodLabels = { q1: 'Q1 (Jan–Mar)', q2: 'Q2 (Apr–Jun)', q3: 'Q3 (Jul–Sep)', q4: 'Q4 (Okt–Dec)' };
  const cpStart = person?.calculationPeriodStart || 'q1';
  employmentSection.appendChild(createInfoLine('Beräkningsperiod:', periodLabels[cpStart] || cpStart, { margin: '0' }));

  content.appendChild(employmentSection);

  // Löner & kostnader
  const salarySection = document.createElement('div');
  const sectorName = sector === 'municipal' ? 'Kommunal' : 'Privat';

  const costs = calculatePersonMonthlyCost(person);

  salarySection.appendChild(createSectionTitle('Löner & Kostnader'));
  salarySection.appendChild(createInfoLine('Sektor:', sectorName));
  salarySection.appendChild(createInfoLine('Månadslön:', `${(person.salary || 0).toLocaleString('sv')} SEK`));

  // Total cost highlight
  const totalCostP = document.createElement('p');
  totalCostP.style.margin = '0 0 0.5rem 0';
  totalCostP.style.fontSize = '0.9rem';
  totalCostP.style.color = '#667eea';
  const totalStrong = document.createElement('strong');
  totalStrong.textContent = '💰 Total Månadskostnad:';
  const totalSpan = document.createElement('span');
  totalSpan.textContent = ` ${formatCurrency(costs.totalCost)}`;
  totalCostP.appendChild(totalStrong);
  totalCostP.appendChild(totalSpan);
  salarySection.appendChild(totalCostP);

  // Breakdown line
  const breakdownP = document.createElement('p');
  breakdownP.style.margin = '0 0 0.5rem 0';
  breakdownP.style.fontSize = '0.85rem';
  breakdownP.style.color = '#999';
  breakdownP.textContent = `Lön: ${formatCurrency(costs.adjustedSalary)} + Arb.avg (${(costs.employerTaxRate * 100).toFixed(
    1
  )}%): ${formatCurrency(costs.employerTax)}`;
  salarySection.appendChild(breakdownP);

  // Hourly line
  const hourlyP = document.createElement('p');
  hourlyP.style.margin = '0 0 0.5rem 0';
  hourlyP.style.fontSize = '0.85rem';
  hourlyP.style.color = '#666';
  hourlyP.textContent = `Timlön: ${formatCurrencyDetailed(costs.hourlyRate)}/h | Timkostnad: ${formatCurrencyDetailed(
    costs.hourlyCost
  )}/h`;
  salarySection.appendChild(hourlyP);

  // Divider + vacation/leave
  const divider = createDivider();
  divider.appendChild(createInfoLine('Sparade semesterdagar:', String(person.savedVacationDays || 0)));
  divider.appendChild(createInfoLine('Nya semesterdagar:', String(vacationDays)));
  divider.appendChild(createInfoLine('Sparade ledighetsdagar:', String(person.savedLeaveDays || 0), { margin: '0' }));
  salarySection.appendChild(divider);

  content.appendChild(salarySection);

  // Grupper
  const groupsSection = document.createElement('div');
  const personGroups =
    (person.groupIds || [])
      .map((gid) => groups.find((g) => g.id === gid)?.name)
      .filter(Boolean)
      .join(', ') || '-';

  groupsSection.appendChild(createSectionTitle('Arbetgrupper'));
  const groupsP = document.createElement('p');
  groupsP.style.margin = '0';
  groupsP.style.fontSize = '0.9rem';
  const groupsStrong = document.createElement('strong');
  groupsStrong.textContent = personGroups;
  groupsP.appendChild(groupsStrong);
  groupsSection.appendChild(groupsP);
  content.appendChild(groupsSection);

  // Tillgänglighet
  const availabilitySection = document.createElement('div');
  const availableDays =
    (person.availability || [])
      .map((available, i) => (available ? DAYS_OF_WEEK[i] : null))
      .filter(Boolean)
      .join(', ') || '-';

  availabilitySection.appendChild(createSectionTitle('Tillgänglig'));
  const availP = document.createElement('p');
  availP.style.margin = '0';
  availP.style.fontSize = '0.9rem';
  const availStrong = document.createElement('strong');
  availStrong.textContent = availableDays;
  availP.appendChild(availStrong);
  availabilitySection.appendChild(availP);
  content.appendChild(availabilitySection);

  card.appendChild(content);
  return card;
}

/* ============================================================
 * BLOCK 24 — Date helper
 * ============================================================ */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('sv');
  } catch {
    return dateStr;
  }
}

/* ============================================================
 * BLOCK 25 — Re-render helper (fail-closed)
 * WHY:
 * - används av submit/delete/search/edit flows
 * ============================================================ */
function rerenderPersonal(ctx, container) {
  try {
    const target = container || document.getElementById('app') || document.querySelector('#app');
    if (target && ctx) renderPersonal(target, ctx);
  } catch (e) {
    console.warn('⚠️ rerenderPersonal failed', e);
  }
}

/* ============================================================
 * BLOCK 26 — CRUD: Add person
 * IO:
 * - form → read values → validate → compute derived fields → store.setState()
 * ============================================================ */
function addPerson(form, errorDiv, store, ctx, container) {
  try {
    while (errorDiv.firstChild) {
      errorDiv.removeChild(errorDiv.firstChild);
    }

    // Read values (IO: DOM → JS)
    const name = (form.querySelector('#personal-name')?.value || '').trim();
    const email = (form.querySelector('#personal-email')?.value || '').trim();
    const phone = (form.querySelector('#personal-phone')?.value || '').trim();
    const startDate = form.querySelector('#personal-start-date')?.value;
    const degree = parseInt(form.querySelector('#personal-degree')?.value || 100);
    const workdaysPerWeek = parseInt(form.querySelector('#personal-workdays')?.value || 5);
    const salary = parseInt(form.querySelector('#personal-salary')?.value || 0);
    const savedVacation = parseInt(form.querySelector('#personal-saved-vacation')?.value || 0);
    const savedLeave = parseInt(form.querySelector('#personal-saved-leave')?.value || 0);
    const sector = document.querySelector('input[name="sector"]:checked')?.value || 'private';

    // AO-12: Beräkningsperiod
    const calculationPeriodStart = document.getElementById('personal-calc-period')?.value || 'q1';

    // Selected groups
    const groupIds = Array.from(document.querySelectorAll('.group-checkbox:checked')).map((cb) => cb.value);

    // Availability
    const availability = Array.from(document.querySelectorAll('.availability-checkbox')).map((cb) => cb.checked);

    // Validate (fail-closed)
    if (!name || name.length < 2) throw new Error('Namn krävs (min 2 tecken)');
    if (!email || !email.includes('@')) throw new Error('Giltigt e-postadress krävs');
    if (!startDate) throw new Error('Startdatum krävs');

    // Split name → first/last (compat)
    const nameParts = name.split(' ').filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

    const state = store.getState();
    const people = state.people || [];

    // Duplicate email guard
    if (people.some((p) => (p.email || '').toLowerCase() === email.toLowerCase())) {
      throw new Error('E-postadressen finns redan');
    }

    // Derived: hourlyWage from salary (167 hours per month standard)
    const hourlyWage = salary > 0 ? salary / 167 : 0;

    // P0: deterministisk semester-beräkning
    const yearsEmployed = calculateYearsEmployed(startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, degree, sector);

    // Create person (schema)
    const newPerson = {
      id: `person_${Date.now()}`,

      // Compat fields (äldre flöden)
      firstName,
      lastName,
      hourlyWage,
      employmentPct: degree,
      isActive: true,
      vacationDaysPerYear,
      extraDaysStartBalance: savedVacation,
      groups: groupIds,

      // HR fields
      name,
      email,
      phone: phone || null,
      startDate,
      degree,
      workdaysPerWeek,
      salary,
      savedVacationDays: savedVacation,
      savedLeaveDays: savedLeave,
      sector,
      groupIds,
      availability,
      usedVacationDays: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // AO-12: Beräkningsperiod
      calculationPeriodStart,
    };

    // Persist to store
    store.setState({
      ...state,
      people: [...people, newPerson],
    });

    console.log('✓ Person tillagd:', newPerson);
    showSuccess('✓ Personal tillagd');
    form.reset();

    rerenderPersonal(ctx, container);
  } catch (err) {
    console.error('❌ Error adding person:', err);
    displayError(errorDiv, err.message);
    showWarning(`⚠️ ${err.message}`);
  }
}
/* ============================================================
 * BLOCK 27 — CRUD: Save edited person
 * ============================================================ */
function saveEditedPerson(form, errorDiv, store, ctx, container, personId) {
  try {
    while (errorDiv.firstChild) {
      errorDiv.removeChild(errorDiv.firstChild);
    }

    const name = (form.querySelector('#personal-name')?.value || '').trim();
    const email = (form.querySelector('#personal-email')?.value || '').trim();
    const phone = (form.querySelector('#personal-phone')?.value || '').trim();
    const startDate = form.querySelector('#personal-start-date')?.value;
    const degree = parseInt(form.querySelector('#personal-degree')?.value || 100);
    const workdaysPerWeek = parseInt(form.querySelector('#personal-workdays')?.value || 5);
    const salary = parseInt(form.querySelector('#personal-salary')?.value || 0);
    const savedVacation = parseInt(form.querySelector('#personal-saved-vacation')?.value || 0);
    const savedLeave = parseInt(form.querySelector('#personal-saved-leave')?.value || 0);
    const sector = document.querySelector('input[name="sector"]:checked')?.value || 'private';

    // AO-12: Beräkningsperiod
    const calculationPeriodStart = document.getElementById('personal-calc-period')?.value || 'q1';

    const groupIds = Array.from(document.querySelectorAll('.group-checkbox:checked')).map((cb) => cb.value);
    const availability = Array.from(document.querySelectorAll('.availability-checkbox')).map((cb) => cb.checked);

    if (!name || name.length < 2) throw new Error('Namn krävs (min 2 tecken)');
    if (!email || !email.includes('@')) throw new Error('Giltigt e-postadress krävs');
    if (!startDate) throw new Error('Startdatum krävs');

    const state = store.getState();
    const people = state.people || [];
    const existing = people.find((p) => p?.id === personId);
    if (!existing) throw new Error('Personen hittades inte längre (kanske borttagen).');

    // Duplicate email guard (exclude current)
    if (people.some((p) => (p.email || '').toLowerCase() === email.toLowerCase() && p.id !== personId)) {
      throw new Error('E-postadressen finns redan');
    }

    const nameParts = name.split(' ').filter(Boolean);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

    const hourlyWage = salary > 0 ? salary / 167 : 0;

    // P0: deterministisk semester-beräkning
    const yearsEmployed = calculateYearsEmployed(startDate, sector);
    const vacationDaysPerYear = getVacationDaysPerYear(yearsEmployed, degree, sector);

    const updatedPeople = people.map((p) => {
      if (p.id !== personId) return p;
      return {
        ...p,

        // Compat
        firstName,
        lastName,
        hourlyWage,
        employmentPct: degree,
        vacationDaysPerYear,

        // HR-fält
        name,
        email,
        phone: phone ? phone : null,
        startDate,
        degree,
        workdaysPerWeek,
        salary,
        savedVacationDays: savedVacation,
        savedLeaveDays: savedLeave,
        sector,
        groupIds,
        groups: groupIds,
        availability,
        updatedAt: new Date().toISOString(),

        // AO-12: Beräkningsperiod
        calculationPeriodStart,
      };
    });

    store.setState({ ...state, people: updatedPeople });
    showSuccess('✓ Ändringar sparade');

    // STATE: tillbaka till add-läge
    __personalUI.selectedPersonId = null;
    rerenderPersonal(ctx, container);
  } catch (err) {
    console.error('❌ saveEditedPerson failed:', err);
    displayError(errorDiv, err.message);
    showWarning(`⚠️ ${err.message}`);
  }
}

/* ============================================================
 * BLOCK 28 — CRUD: Delete person
 * ============================================================ */
function deletePerson(personId, store, ctx, container) {
  try {
    if (!confirm('Är du säker på att du vill ta bort denna person?')) return;

    const state = store.getState();
    store.setState({
      ...state,
      people: (state.people || []).filter((p) => p.id !== personId),
    });

    // STATE: om vi råkar redigera samma person -> lämna edit-läge
    if (__personalUI.selectedPersonId === personId) {
      __personalUI.selectedPersonId = null;
    }

    console.log('✓ Person borttagen');
    showSuccess('✓ Personal borttagen');

    rerenderPersonal(ctx, container);
  } catch (err) {
    console.error('❌ Error deleting person:', err);
    showWarning(`⚠️ ${err.message}`);
  }
}

/* ============================================================
 * BLOCK 29 — Error renderer (UI)
 * XSS:
 * - message sätts med textContent
 * ============================================================ */
function displayError(container, message) {
  if (!container) return;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-danger';

  const msg = document.createElement('p');
  msg.textContent = `Fel: ${message}`;
  msg.style.margin = '0';

  errorDiv.appendChild(msg);
  container.appendChild(errorDiv);
}

/* ============================================================
 * BLOCK 30 — Legacy compat: editPerson(prompt) (behålls)
 * NOTE:
 * - Används inte längre i UI-flödet, men kvar för externa anrop.
 * ============================================================ */
function editPerson(person, store, ctx, container) {
  try {
    __personalUI.selectedPersonId = person?.id || null;
    rerenderPersonal(ctx, container);
  } catch (err) {
    console.error('❌ Error editing person:', err);
    showWarning(`⚠️ ${err.message}`);
  }
}

