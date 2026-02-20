// I state.people[n]:
{
    id: 'person-1',
    firstName: 'Anna',
    lastName: 'Svensson',
    employmentPct: 80,           // 80% av heltid
    hourlyWage: 165,
    
    // NY: Beräkningsperioder
    calculationPeriods: [
        {
            id: 'cp-1',
            startDate: '2025-01-01',
            endDate: '2025-03-31',
            targetHours: 416,     // 80% × 40h × 13 veckor = 416h
            // ELLER: beräknas automatiskt: (employmentPct/100) × 40 × antalVeckor
        },
        {
            id: 'cp-2', 
            startDate: '2025-04-01',
            endDate: '2025-06-30',
            targetHours: 416,
        }
    ]
}

// ALTERNATIV: Global beräkningsperiod i state.settings
// (alla har samma perioder, enklare)
{
    settings: {
        calculationPeriodType: 'fixed',  // 'fixed' | 'rolling' | 'per-person'
        calculationPeriods: [
            { id: 'q1', name: 'Q1', startDate: '2025-01-01', endDate: '2025-03-31' },
            { id: 'q2', name: 'Q2', startDate: '2025-04-01', endDate: '2025-06-30' },
            { id: 'q3', name: 'Q3', startDate: '2025-07-01', endDate: '2025-09-30' },
            { id: 'q4', name: 'Q4', startDate: '2025-10-01', endDate: '2025-12-31' },
        ]
    }
}
