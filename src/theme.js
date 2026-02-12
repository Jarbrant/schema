/*
 * AO-16 — THEME: Central färgkarta för statusar
 */

const DEFAULT_THEME = {
    statusColors: {
        A: '#c8e6c9',
        L: '#f0f0f0',
        X: '#bbdefb',
        SEM: '#fff9c4',
        SJ: '#ffcdd2',
        VAB: '#ffe0b2',
        PERM: '#b2dfdb',
        UTB: '#e1bee7',
        EXTRA: '#424242',
    },
    statusTextColors: {
        A: '#1b5e20',
        L: '#424242',
        X: '#0d47a1',
        SEM: '#f57f17',
        SJ: '#b71c1c',
        VAB: '#e65100',
        PERM: '#004d40',
        UTB: '#4a148c',
        EXTRA: '#ffeb3b',
    },
};

export function getThemeFromState(state) {
    if (state && state.settings && state.settings.theme) {
        return state.settings.theme;
    }
    return DEFAULT_THEME;
}

export function getStatusStyle(status, state) {
    const theme = getThemeFromState(state);

    if (!status || status === '') {
        return {
            bg: '#ffffff',
            fg: '#cccccc',
            label: 'Tom',
            colorClass: 'status-empty',
        };
    }

    const bg = theme.statusColors?.[status] || DEFAULT_THEME.statusColors[status] || '#e0e0e0';
    const fg = theme.statusTextColors?.[status] || DEFAULT_THEME.statusTextColors[status] || '#666666';

    return {
        bg,
        fg,
        label: getStatusLabel(status),
        colorClass: `status-${status.toLowerCase()}`,
    };
}

function getStatusLabel(status) {
    const labels = {
        A: 'Arbete',
        L: 'Ledighet',
        X: 'Uttag extra',
        SEM: 'Semester',
        SJ: 'Sjuk',
        VAB: 'VAB',
        PERM: 'Permission',
        UTB: 'Utbildning',
        EXTRA: 'EXTRA PERSONAL',
    };
    return labels[status] || `Okänd (${status})`;
}

export function getStatusLegend(state) {
    const theme = getThemeFromState(state);
    const statuses = ['A', 'L', 'X', 'SEM', 'SJ', 'VAB', 'PERM', 'UTB', 'EXTRA'];

    return statuses.map((code) => ({
        code,
        bg: theme.statusColors?.[code] || DEFAULT_THEME.statusColors[code],
        fg: theme.statusTextColors?.[code] || DEFAULT_THEME.statusTextColors[code],
        label: getStatusLabel(code),
        colorClass: `status-${code.toLowerCase()}`,
    }));
}

export function getStatusClassName(status) {
    return `status-${status.toLowerCase()}`;
}

export function getDefaultTheme() {
    return { ...DEFAULT_THEME };
}
