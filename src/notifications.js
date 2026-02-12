/*
 * AO-23 — NOTIFICATIONS: Notifikations-hantering och kö-logik
 */

import { sendPendingNotifications, generateSMSMessage } from './services/sms.js';

/**
 * Skapa en ny notifikation och lägg i queue
 */
export function createNotification(state, store, personId, notificationType, dayData, entryData) {
    const person = state.people.find((p) => p.id === personId);
    if (!person || !person.phone) {
        console.warn(`Kan inte skapa notifikation: person ${personId} saknar telefonnummer`);
        return null;
    }

    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const message = generateSMSMessage(
        {
            type: notificationType,
            id: notificationId,
        },
        person,
        {
            date: dayData,
            start: entryData?.start,
            end: entryData?.end,
            role: entryData?.role,
        }
    );

    const notification = {
        id: notificationId,
        personId,
        type: notificationType,
        message,
        phone: person.phone,
        date: dayData,
        status: 'PENDING',
        attempts: 0,
        createdAt: Date.now(),
        sentAt: null,
        lastError: null,
    };

    // Lägg i queue via store
    store.update((s) => {
        if (!s.notifications) {
            s.notifications = { queue: [], settings: {} };
        }
        if (!s.notifications.queue) {
            s.notifications.queue = [];
        }

        s.notifications.queue.push(notification);
        s.meta.updatedAt = Date.now();
        return s;
    });

    console.log(`📬 Notifikation skapad: ${notificationType} för ${person.firstName} ${person.lastName}`);
    return notification;
}

/**
 * Skicka alla väntande notifikationer
 */
export async function processPendingNotifications(store) {
    const state = store.getState();
    const result = await sendPendingNotifications(state, store);
    return result;
}

/**
 * Hämta notifikations-statistik
 */
export function getNotificationStats(state) {
    const queue = state.notifications?.queue || [];

    return {
        total: queue.length,
        pending: queue.filter((n) => n.status === 'PENDING').length,
        sent: queue.filter((n) => n.status === 'SENT').length,
        failed: queue.filter((n) => n.status === 'FAILED').length,
    };
}

/**
 * Uppdatera notifikations-inställningar
 */
export function updateNotificationSettings(state, store, newSettings) {
    store.update((s) => {
        if (!s.notifications) {
            s.notifications = { queue: [], settings: {} };
        }

        s.notifications.settings = {
            ...s.notifications.settings,
            ...newSettings,
        };

        s.meta.updatedAt = Date.now();
        return s;
    });

    console.log('📬 Notifikations-inställningar uppdaterade');
}

/**
 * Radera gamla notifikationer (äldre än N dagar)
 */
export function cleanupOldNotifications(state, store, daysToKeep = 30) {
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    store.update((s) => {
        if (!s.notifications || !s.notifications.queue) {
            return s;
        }

        const before = s.notifications.queue.length;
        s.notifications.queue = s.notifications.queue.filter((n) => n.createdAt > cutoff);
        const after = s.notifications.queue.length;

        if (before !== after) {
            console.log(`📬 Rensad ${before - after} gamla notifikationer`);
        }

        s.meta.updatedAt = Date.now();
        return s;
    });
}

/**
 * Hämta notifikations-queue
 */
export function getNotificationQueue(state) {
    return state.notifications?.queue || [];
}
