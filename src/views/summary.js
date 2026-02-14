/*
 * SUMMARY.JS — Sammanställning med Kostnadsbild
 * 
 * Visar:
 * - Total månadskostnad
 * - Kostnad per grupp
 * - Breakdown: Lön + Arbetsgivaravgift
 * - Antal aktiva personer
 */

import {
    calculatePersonMonthlyCost,
    calculateTotalMonthlyCost,
    calculateCostPerGroup,
    formatCurrency
} from '../lib/cost-utils.js';

export function renderSummary(container, ctx) {
    const store = ctx?.store;
    if (!store) {
        container.innerHTML = '<div class="view-container"><h2>Fel</h2><p>Store saknas.</p></div>';
        return;
    }

    const state = store.getState();
    const people = state.people || [];
    const groups = state.groups || [];
    const activePeople = people.filter(p => p.isActive);
    
    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Create summary container
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'summary-container';

    // Header
    const header = document.createElement('div');
    header.className = 'summary-header';

    const title = document.createElement('h1');
    title.textContent = 'Sammanställning & Kostnadsbild';

    const subtitle = document.createElement('p');
    subtitle.className = 'summary-subtitle';
    subtitle.textContent = 'Översikt av personalkostnader och statistik';

    header.appendChild(title);
    header.appendChild(subtitle);
    summaryContainer.appendChild(header);

    // Calculate costs
    const totalCosts = calculateTotalMonthlyCost(activePeople);
    const groupCosts = calculateCostPerGroup(activePeople, groups);

    // Cost Overview Section
    const costOverview = document.createElement('div');
    costOverview.className = 'summary-section cost-overview';

    const costTitle = document.createElement('h2');
    costTitle.textContent = '💰 Total Månadskostnad';

    const costGrid = document.createElement('div');
    costGrid.className = 'cost-grid';

    // Total cost card
    const totalCard = createCostCard(
        'Total Kostnad',
        formatCurrency(totalCosts.totalCost),
        'Den totala kostnaden för alla aktiva anställda per månad',
        'total'
    );

    // Salary card
    const salaryCard = createCostCard(
        'Totala Löner',
        formatCurrency(totalCosts.totalSalary),
        'Summan av alla bruttoläner',
        'salary'
    );

    // Employer tax card
    const taxCard = createCostCard(
        'Arbetsgivaravgifter',
        formatCurrency(totalCosts.totalEmployerTax),
        'Arbetsgivaravgifter (inkl åldersreduktioner)',
        'tax'
    );

    // People count card
    const peopleCard = createCostCard(
        'Aktiva Personer',
        totalCosts.peopleCount.toString(),
        'Antal aktiva anställda',
        'people'
    );

    costGrid.appendChild(totalCard);
    costGrid.appendChild(salaryCard);
    costGrid.appendChild(taxCard);
    costGrid.appendChild(peopleCard);

    costOverview.appendChild(costTitle);
    costOverview.appendChild(costGrid);
    summaryContainer.appendChild(costOverview);

    // Group Costs Section
    if (groups.length > 0) {
        const groupSection = document.createElement('div');
        groupSection.className = 'summary-section group-costs';

        const groupTitle = document.createElement('h2');
        groupTitle.textContent = '👥 Kostnad per Grupp';

        groupSection.appendChild(groupTitle);

        if (Object.keys(groupCosts).length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = 'Inga personer är tilldelade till grupper ännu.';
            groupSection.appendChild(emptyMsg);
        } else {
            const groupTable = document.createElement('div');
            groupTable.className = 'group-cost-table';

            // Header row
            const headerRow = document.createElement('div');
            headerRow.className = 'group-cost-row header';
            headerRow.innerHTML = `
                <div class="col-group">Grupp</div>
                <div class="col-people">Personer</div>
                <div class="col-cost">Total Kostnad</div>
                <div class="col-avg">Snitt/Person</div>
            `;
            groupTable.appendChild(headerRow);

            // Data rows
            Object.entries(groupCosts).forEach(([groupId, cost]) => {
                const row = document.createElement('div');
                row.className = 'group-cost-row';

                const groupName = document.createElement('div');
                groupName.className = 'col-group';
                groupName.textContent = cost.groupName;

                const peopleCount = document.createElement('div');
                peopleCount.className = 'col-people';
                peopleCount.textContent = cost.peopleCount.toString();

                const totalCost = document.createElement('div');
                totalCost.className = 'col-cost';
                totalCost.textContent = formatCurrency(cost.totalCost);

                const avgCost = document.createElement('div');
                avgCost.className = 'col-avg';
                avgCost.textContent = formatCurrency(cost.averageCost);

                row.appendChild(groupName);
                row.appendChild(peopleCount);
                row.appendChild(totalCost);
                row.appendChild(avgCost);

                groupTable.appendChild(row);
            });

            groupSection.appendChild(groupTable);
        }

        summaryContainer.appendChild(groupSection);
    }

    // Person List Section
    if (activePeople.length > 0) {
        const personSection = document.createElement('div');
        personSection.className = 'summary-section person-list';

        const personTitle = document.createElement('h2');
        personTitle.textContent = '👤 Personalkostnader';

        personSection.appendChild(personTitle);

        const personTable = document.createElement('div');
        personTable.className = 'person-cost-table';

        // Header row
        const headerRow = document.createElement('div');
        headerRow.className = 'person-cost-row header';
        headerRow.innerHTML = `
            <div class="col-name">Namn</div>
            <div class="col-employment">Anst%</div>
            <div class="col-salary">Månadslön</div>
            <div class="col-tax">Arb.avg</div>
            <div class="col-total">Total</div>
        `;
        personTable.appendChild(headerRow);

        // Data rows
        activePeople.forEach(person => {
            const cost = calculatePersonMonthlyCost(person);

            const row = document.createElement('div');
            row.className = 'person-cost-row';

            const name = document.createElement('div');
            name.className = 'col-name';
            name.textContent = `${person.firstName} ${person.lastName}`;

            const employment = document.createElement('div');
            employment.className = 'col-employment';
            employment.textContent = `${person.employmentPct}%`;

            const salary = document.createElement('div');
            salary.className = 'col-salary';
            salary.textContent = formatCurrency(cost.adjustedSalary);

            const tax = document.createElement('div');
            tax.className = 'col-tax';
            tax.textContent = formatCurrency(cost.employerTax);

            const total = document.createElement('div');
            total.className = 'col-total';
            total.textContent = formatCurrency(cost.totalCost);

            row.appendChild(name);
            row.appendChild(employment);
            row.appendChild(salary);
            row.appendChild(tax);
            row.appendChild(total);

            personTable.appendChild(row);
        });

        personSection.appendChild(personTable);
        summaryContainer.appendChild(personSection);
    } else {
        const emptySection = document.createElement('div');
        emptySection.className = 'summary-section';
        emptySection.innerHTML = `
            <p class="empty-message">
                Inga aktiva personer ännu. Gå till <a href="#/personal">Personal</a> för att lägga till.
            </p>
        `;
        summaryContainer.appendChild(emptySection);
    }

    // Add to DOM
    container.appendChild(summaryContainer);
}

/**
 * Create a cost card element
 */
function createCostCard(title, value, description, type) {
    const card = document.createElement('div');
    card.className = `cost-card ${type}`;

    const cardTitle = document.createElement('h3');
    cardTitle.textContent = title;

    const cardValue = document.createElement('div');
    cardValue.className = 'card-value';
    cardValue.textContent = value;

    const cardDescription = document.createElement('p');
    cardDescription.className = 'card-description';
    cardDescription.textContent = description;

    card.appendChild(cardTitle);
    card.appendChild(cardValue);
    card.appendChild(cardDescription);

    return card;
}
