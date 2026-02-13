/*
 * APP.JS — State Management (Store)
 * 
 * Globalt state för hela appen.
 * Alla views och modules läser/skriver via denna store.
 */

/**
 * Skapa app-store (state management)
 * @param {object} initialState - Initial state
 * @returns {object} Store med getState, setState, subscribe
 */
export function createStore(initialState) {
    let state = { ...initialState };
    const listeners = [];
    
    return {
        /**
         * Hämta aktuellt state
         * @returns {object} Current state
         */
        getState() {
            return state;
        },
        
        /**
         * Uppdatera state
         * @param {object} newState - Ny state (merges med gammal)
         */
        setState(newState) {
            state = { ...state, ...newState };
            // Notifiera alla subscribers
            listeners.forEach(listener => listener(state));
            console.log('📊 State uppdaterad:', state);
        },
        
        /**
         * Subscribe till state-ändringar
         * @param {function} listener - Callback när state ändras
         * @returns {function} Unsubscribe-funktion
         */
        subscribe(listener) {
            listeners.push(listener);
            console.log(`📡 Listener registrerad (totalt: ${listeners.length})`);
            
            // Returnera unsubscribe-funktion
            return () => {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                    console.log(`📡 Listener borttagen (kvar: ${listeners.length})`);
                }
            };
        }
    };
}

/**
 * DEFAULT INITIAL STATE
 * Exporteras för referens
 */
export const DEFAULT_STATE = {
    // Authentication
    user: null,
    isLoggedIn: false,
    
    // Data
    people: [],
    shifts: [],
    groups: [],
    passes: [],
    
    // Schedule info
    schedule: {
        year: new Date().getFullYear(),
        startDate: null,
        endDate: null
    },
    
    // App metadata
    meta: {
        appVersion: '1.0.0',
        appName: 'Schema-Program',
        lastUpdated: new Date().toISOString()
    }
};
