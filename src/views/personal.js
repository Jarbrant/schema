/*
 * PERSONAL.JS — Personal Management with HR System (COMPLETE v4 + AUTOPATCH v7)
 *
 * Patch i denna version:
 * - P0: Normaliserar state.groups (map -> array) så Personal inte kraschar (groups.forEach).
 * - P0: Alla group-uppslag i kort/lista använder normaliserad groups-array.
 *
 * Features:
 * - Add/Edit/Delete person
 * - Sector selection (Private/Municipal)
 * - Start date → Auto vacation calc
 * - Employment record with dates
 * - Salary, saved vacation days, saved leave days
 * - Employment degree (%), workdays per week
 * - Multi-group assignment
 * - Availability calendar (Mon-Sun)
 *
 * FAS 3.3: Cost display added
 */

import { showSuccess, showWarning } from '../ui.js';
import { reportError } from '../diagnostics.js';
import {
  getVacationDaysPerYear,
  calculateYearsEmployed,
  getPersonVacationYearInfo,
  SECTOR_TYPES
} from '../hr-rules.js';
import { calculatePersonMonthlyCost, formatCurrency, formatCurrencyDetailed } from '../lib/cost-utils.js';

const DAYS_OF_WEEK = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export function renderPersonal(container, ctx) {
  try {
    if (!container || !ctx?.store) {
      throw new Error('Container eller store missing');
    }

    const store = ctx.store;
    const state = store.getState();
    const people = state.people || [];

    // P0: groups kan vara array (gammalt) eller objekt/map (nytt store.js). Normalisera till array.
    const groupsRaw = state.groups;
    const groups = Array.isArray(groupsRaw) ? groupsRaw : Object.values(groupsRaw || {});

    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Create page structure
    const viewContainer = document.createElement('div');
    viewContainer.className = 'view-container';

    // === HEADER ===
    const header = document.createElement('div');
    header.className = 'section-header';

    const title = document.createElement('h1');
    title.textContent = '👤 Personal';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Hantera personal, semesterdagar, löner, sektor och tillgänglighet';

    header.appendChild(title);
    header.appendChild(subtitle);

    // === STATUS ROW ===
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

    // === FORM SECTION ===
    const formSection = document.createElement('div');
    formSection.className = 'section-header';
    formSection.style.marginTop = '2rem';

    const formTitle = document.createElement('h2');
    formTitle.textContent = '➕ Lägg till ny personal';

    formSection.appendChild(formTitle);

    // Form
    const form = document.createElement('form');
    form.id = 'personal-form';
    form.style.background = '#f9f9f9';
    form.style.padding = '1.5rem';
    form.style.borderRadius = '8px';

    // === BASIC INFO ===
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
    basicInfo.appendChild(nameGroup);

    const emailGroup = createFormGroup('personal-email', 'E-post *', 'email', 'anna@example.com');
    basicInfo.appendChild(emailGroup);

    const phoneGroup = createFormGroup('personal-phone', 'Telefon', 'tel', '+46 70 123 45 67');
    basicInfo.appendChild(phoneGroup);

    form.appendChild(basicInfo);

    // === EMPLOYMENT INFO ===
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
    employmentInfo.appendChild(startDateGroup);

    const degreeGroup = createFormGroup('personal-degree', 'Tjänstgöringsgrad (%) *', 'number', '100');
    const degreeInput = degreeGroup.querySelector('input');
    degreeInput.min = '10';
    degreeInput.max = '100';
    degreeInput.value = '100';
    employmentInfo.appendChild(degreeGroup);

    const workdaysGroup = createFormGroup('personal-workdays', 'Arbetsdagar per vecka *', 'number', '5');
    const workdaysInput = workdaysGroup.querySelector('input');
    workdaysInput.min = '1';
    workdaysInput.max = '7';
    workdaysInput.value = '5';
    employmentInfo.appendChild(workdaysGroup);

    form.appendChild(employmentInfo);

    // === SECTOR SELECTION ===
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

    // Private sector
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
    privateRadio.checked = true;
    privateRadio.id = 'sector-private';
    privateRadio.style.cursor = 'pointer';

    const privateSpan = document.createElement('span');
    // statisk text ok som innerHTML (ingen användardata)
    privateSpan.innerHTML = '<strong>Privat sektor</strong><br><small>25/28/31 dagar</small>';

    privateLabel.appendChild(privateRadio);
    privateLabel.appendChild(privateSpan);

    privateLabel.onmouseover = () => {
      privateLabel.style.borderColor = '#667eea';
      privateLabel.style.background = '#f9f9f9';
    };
    privateLabel.onmouseout = () => {
      privateLabel.style.borderColor = privateRadio.checked ? '#667eea' : '#ddd';
      privateLabel.style.background = 'transparent';
    };

    sectorContainer.appendChild(privateLabel);

    // Municipal sector
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
    // statisk text ok som innerHTML (ingen användardata)
    municipalSpan.innerHTML = '<strong>Kommunal sektor</strong><br><small>28/30/32 dagar</small>';

    municipalLabel.appendChild(municipalRadio);
    municipalLabel.appendChild(municipalSpan);

    municipalLabel.onmouseover = () => {
      municipalLabel.style.borderColor = '#667eea';
      municipalLabel.style.background = '#f9f9f9';
    };
    municipalLabel.onmouseout = () => {
      municipalLabel.style.borderColor = municipalRadio.checked ? '#667eea' : '#ddd';
      municipalLabel.style.background = 'transparent';
    };

    sectorContainer.appendChild(municipalLabel);

    // Radio change behavior (måste sättas efter båda finns)
    privateRadio.onchange = () => {
      privateLabel.style.borderColor = '#667eea';
      privateLabel.style.background = '#f0f4ff';
      municipalLabel.style.borderColor = '#ddd';
      municipalLabel.style.background = 'transparent';
    };
    municipalRadio.onchange = () => {
      municipalLabel.style.borderColor = '#667eea';
      municipalLabel.style.background = '#f0f4ff';
      privateLabel.style.borderColor = '#ddd';
      privateLabel.style.background = 'transparent';
    };

    sectorInfo.appendChild(sectorContainer);
    form.appendChild(sectorInfo);

    // === SALARY & VACATION ===
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
    salaryInfo.appendChild(salaryGroup);

    const savedVacationGroup = createFormGroup('personal-saved-vacation', 'Sparade semesterdagar', 'number', '0');
    salaryInfo.appendChild(savedVacationGroup);

    const savedLeaveGroup = createFormGroup('personal-saved-leave', 'Sparade ledighetsdagar', 'number', '0');
    salaryInfo.appendChild(savedLeaveGroup);

    form.appendChild(salaryInfo);

    // === GROUPS ===
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

    const groupsContainer = document.createElement('div');
    groupsContainer.id = 'personal-groups';
    groupsContainer.style.display = 'grid';
    groupsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    groupsContainer.style.gap = '1rem';

    if (groups.length === 0) {
      const noGroupsMsg = document.createElement('p');
      noGroupsMsg.textContent = 'Ingen grupper definierade. Skapa grupper först.';
      noGroupsMsg.style.color = '#999';
      noGroupsMsg.style.fontStyle = 'italic';
      groupsContainer.appendChild(noGroupsMsg);
    } else {
      groups.forEach(group => {
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

    // === AVAILABILITY ===
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

    // === BUTTONS ===
    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.gap = '1rem';
    buttonGroup.style.marginTop = '1.5rem';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = '➕ Lägg till';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'reset';
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = '🔄 Rensa';

    buttonGroup.appendChild(submitBtn);
    buttonGroup.appendChild(resetBtn);
    form.appendChild(buttonGroup);

    // Error message
    const errorDiv = document.createElement('div');
    errorDiv.id = 'personal-error';
    errorDiv.style.marginTop = '1rem';
    form.appendChild(errorDiv);

    // Setup form listener
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      addPerson(form, errorDiv, store, ctx, container);
    });

    // === PEOPLE LIST ===
    const listSection = document.createElement('div');
    listSection.className = 'section-header';
    listSection.style.marginTop = '2rem';

    const listTitle = document.createElement('h2');
    listTitle.textContent = `👥 Personal (${people.length})`;
    listSection.appendChild(listTitle);

    // People list
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
      people.forEach(person => {
        const card = createPersonCard(person, store, ctx, container, groups);
        list.appendChild(card);
      });
    }

    // Assemble page
    viewContainer.appendChild(header);
    viewContainer.appendChild(statusRow);
    viewContainer.appendChild(formSection);
    viewContainer.appendChild(form);
    viewContainer.appendChild(listSection);
    viewContainer.appendChild(list);

    container.appendChild(viewContainer);

    console.log('✓ Personal view rendered');

  } catch (err) {
    console.error('❌ Error rendering personal:', err);
    reportError(
      'PERSONAL_RENDER_ERROR',
      'PERSONAL_VIEW',
      'src/views/personal.js',
      err.message
    );
  }
}

/**
 * Create a form group helper
 */
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

/**
 * Create person card with all info including sector (XSS-safe)
 */
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
    editPerson(person, store, ctx, container);
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

  // Basic info
  const basicSection = document.createElement('div');
  basicSection.appendChild(createSectionTitle('Kontakt'));
  basicSection.appendChild(createInfoLine('E-post:', person?.email || '-', { margin: '0 0 0.5rem 0' }));
  basicSection.appendChild(createInfoLine('Telefon:', person?.phone || '-', { margin: '0', fontSize: '0.9rem' }));
  content.appendChild(basicSection);

  // Employment info
  const employmentSection = document.createElement('div');
  const yearsEmployed = calculateYearsEmployed(person.startDate, person.sector || 'private');
  const vacationDays = getVacationDaysPerYear(yearsEmployed, person.degree || 100, person.sector || 'private');

  employmentSection.appendChild(createSectionTitle('Anställning'));
  employmentSection.appendChild(createInfoLine('Startdatum:', formatDate(person.startDate)));
  employmentSection.appendChild(createInfoLine('År:', String(yearsEmployed)));
  employmentSection.appendChild(createInfoLine('Tjänstgöringsgrad:', `${person.degree || 100}%`));
  employmentSection.appendChild(createInfoLine('Arbetsdagar/vecka:', String(person.workdaysPerWeek || 5), { margin: '0' }));
  content.appendChild(employmentSection);

  // Salary & Costs
  const salarySection = document.createElement('div');
  const sectorName = person.sector === 'municipal' ? 'Kommunal' : 'Privat';

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
  breakdownP.textContent =
    `Lön: ${formatCurrency(costs.adjustedSalary)} + Arb.avg (${(costs.employerTaxRate * 100).toFixed(1)}%): ${formatCurrency(costs.employerTax)}`;
  salarySection.appendChild(breakdownP);

  // Hourly line
  const hourlyP = document.createElement('p');
  hourlyP.style.margin = '0 0 0.5rem 0';
  hourlyP.style.fontSize = '0.85rem';
  hourlyP.style.color = '#666';
  hourlyP.textContent =
    `Timlön: ${formatCurrencyDetailed(costs.hourlyRate)}/h | Timkostnad: ${formatCurrencyDetailed(costs.hourlyCost)}/h`;
  salarySection.appendChild(hourlyP);

  // Divider + vacation/leave
  const divider = createDivider();
  divider.appendChild(createInfoLine('Sparade semesterdagar:', String(person.savedVacationDays || 0)));
  divider.appendChild(createInfoLine('Nya semesterdagar:', String(vacationDays)));
  divider.appendChild(createInfoLine('Sparade ledighetsdagar:', String(person.savedLeaveDays || 0), { margin: '0' }));
  salarySection.appendChild(divider);

  content.appendChild(salarySection);

  // Groups
  const groupsSection = document.createElement('div');
  const personGroups = (person.groupIds || [])
    .map(gid => groups.find(g => g.id === gid)?.name)
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

  // Availability
  const availabilitySection = document.createElement('div');
  const availableDays = (person.availability || [])
    .map((available, i) => available ? DAYS_OF_WEEK[i] : null)
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

/**
 * Format date to Swedish format
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('sv');
  } catch {
    return dateStr;
  }
}

function rerenderPersonal(ctx, container) {
  // Fail-closed: använd render-container om möjligt, annars fallback till #app.
  try {
    const target = container || document.getElementById('app') || document.querySelector('#app');
    if (target && ctx) renderPersonal(target, ctx);
  } catch (e) {
    console.warn('⚠️ rerenderPersonal failed', e);
  }
}

/**
 * Add new person
 */
function addPerson(form, errorDiv, store, ctx, container) {
  try {
    while (errorDiv.firstChild) {
      errorDiv.removeChild(errorDiv.firstChild);
    }

    // Get values
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

    // Get selected groups
    const groupIds = Array.from(document.querySelectorAll('.group-checkbox:checked'))
      .map(cb => cb.value);

    // Get availability
    const availability = Array.from(document.querySelectorAll('.availability-checkbox'))
      .map(cb => cb.checked);

    // Validate
    if (!name || name.length < 2) {
      throw new Error('Namn krävs (min 2 tecken)');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Giltigt e-postadress krävs');
    }
    if (!startDate) {
      throw new Error('Startdatum krävs');
    }

    // Split name into firstName and lastName
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0]; // If only one name, use it for both

    const state = store.getState();
    const people = state.people || [];

    // Check duplicate email
    if (people.some(p => (p.email || '').toLowerCase() === email.toLowerCase())) {
      throw new Error('E-postadressen finns redan');
    }

    // Calculate hourlyWage from salary (167 hours per month standard)
    const hourlyWage = salary > 0 ? salary / 167 : 0;

    // Create person with correct schema
    const newPerson = {
      id: `person_${Date.now()}`,
      firstName,
      lastName,
      hourlyWage,
      employmentPct: degree,
      isActive: true,
      vacationDaysPerYear: 25, // Default
      extraDaysStartBalance: savedVacation,
      groups: groupIds,
      // Additional fields for HR system
      name, // Keep for display
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
      updatedAt: new Date().toISOString()
    };

    store.setState({
      ...state,
      people: [...people, newPerson]
    });

    console.log('✓ Person tillagd:', newPerson);
    showSuccess('✓ Personal tillagd');
    form.reset();

    // Re-render the personal view (stabilt)
    rerenderPersonal(ctx, container);

  } catch (err) {
    console.error('❌ Error adding person:', err);
    displayError(errorDiv, err.message);
    showWarning(`⚠️ ${err.message}`);
  }
}

/**
 * Edit person
 */
function editPerson(person, store, ctx, container) {
  try {
    console.log('✏️ Redigerar person:', person.id);
    const newName = prompt('Namn:', person.name);
    if (newName === null) return;

    const newEmail = prompt('E-post:', person.email);
    if (newEmail === null) return;

    if (!newName || newName.length < 2) throw new Error('Namn krävs');
    if (!newEmail || !newEmail.includes('@')) throw new Error('Giltigt e-postadress krävs');

    const state = store.getState();
    const people = state.people || [];

    if (people.some(p => (p.email || '').toLowerCase() === newEmail.toLowerCase() && p.id !== person.id)) {
      throw new Error('E-postadressen finns redan');
    }

    // Split name into firstName and lastName
    const nameParts = newName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];

    const updatedPeople = people.map(p =>
      p.id === person.id ? {
        ...p,
        firstName,
        lastName,
        name: newName,
        email: newEmail,
        updatedAt: new Date().toISOString()
      } : p
    );

    store.setState({ ...state, people: updatedPeople });
    console.log('✓ Person uppdaterad');
    showSuccess('✓ Personal uppdaterad');

    // Re-render the personal view (stabilt)
    rerenderPersonal(ctx, container);

  } catch (err) {
    console.error('❌ Error editing person:', err);
    showWarning(`⚠️ ${err.message}`);
  }
}

/**
 * Delete person
 */
function deletePerson(personId, store, ctx, container) {
  try {
    if (!confirm('Är du säker på att du vill ta bort denna person?')) return;

    const state = store.getState();
    store.setState({
      ...state,
      people: (state.people || []).filter(p => p.id !== personId)
    });

    console.log('✓ Person borttagen');
    showSuccess('✓ Personal borttagen');

    // Re-render the personal view (stabilt)
    rerenderPersonal(ctx, container);

  } catch (err) {
    console.error('❌ Error deleting person:', err);
    showWarning(`⚠️ ${err.message}`);
  }
}

/**
 * Display error
 */
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
