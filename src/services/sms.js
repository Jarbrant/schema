/*
 * AO-23 — SMS: SMS-tjänst med Twilio + Mock-support
 */

/**
 * Skicka SMS via Twilio
 */
async function sendTwilioSMS(notification, settings) {
    const { twilioAccountSid, twilioAuthToken, twilioFromNumber } = settings;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
        throw new Error('Twilio-credentials saknas');
    }

    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', twilioFromNumber);
    formData.append('To', notification.phone);
    formData.append('Body', notification.message);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Twilio error: ${error.message}`);
    }

    const data = await response.json();
    return data;
}

/**
 * Mock SMS (skriver till console)
 */
function sendMockSMS(notification) {
    console.log(`
╔════════════════════════════════════════════════════════╗
║ 📱 MOCK SMS SKICKAT                                   ║
╠════════════════════════════════════════════════════════╣
║ Till:     ${notification.phone.padEnd(40)}║
║ Datum:    ${new Date(notification.createdAt).toLocaleString('sv-SE').padEnd(40)}║
║ Meddelande:                                           ║
║ ${notification.message.substring(0, 50).padEnd(50)}║
╚════════════════════════════════════════════════════════╝
    `);
    return { sid: `MOCK-${Date.now()}` };
}

/**
 * Skicka en notifikation
 */
export async function sendNotification(notification, settings) {
    if (!settings.enabled) {
        throw new Error('SMS-notifikationer är inaktiverade');
    }

    if (settings.provider === 'mock') {
        return sendMockSMS(notification);
    } else if (settings.provider === 'twilio') {
        return await sendTwilioSMS(notification, settings);
    } else {
        throw new Error(`Okänd SMS-provider: ${settings.provider}`);
    }
}

/**
 * Skicka alla väntande notifikationer
 */
export async function sendPendingNotifications(state, store) {
    const queue = state.notifications?.queue || [];
    const settings = state.notifications?.settings || {};

    if (!settings.enabled) {
        return { sent: 0, failed: 0, skipped: queue.filter(n => n.status === 'PENDING').length };
    }

    const pending = queue.filter((n) => n.status === 'PENDING');
    let sentCount = 0;
    let failedCount = 0;

    for (const notif of pending) {
        try {
            await sendNotification(notif, settings);
            notif.status = 'SENT';
            notif.sentAt = Date.now();
            sentCount++;
        } catch (err) {
            console.error(`SMS-fel för ${notif.personId}:`, err);
            notif.status = 'FAILED';
            notif.attempts = (notif.attempts || 0) + 1;
            notif.lastError = err.message;
            failedCount++;
        }
    }

    // Spara uppdaterad queue
    if (sentCount > 0 || failedCount > 0) {
        store.update((s) => {
            s.notifications.queue = queue;
            s.meta.updatedAt = Date.now();
            return s;
        });
    }

    return {
        sent: sentCount,
        failed: failedCount,
        total: pending.length,
    };
}

/**
 * Generera SMS-meddelande baserat på typ
 */
export function generateSMSMessage(notification, person, dayData) {
    const date = new Date(dayData).toLocaleDateString('sv-SE');
    const time = dayData.start ? `${dayData.start}-${dayData.end}` : '(tider TBD)';
    const role = dayData.role ? ` på ${dayData.role}` : '';

    switch (notification.type) {
        case 'SCHEDULE_ADDED':
            return `Hej ${person.firstName}! Du är nu schemalad för ${date} ${time}${role}. Bekräfta: https://schema.app/confirm/${notification.id}`;

        case 'SCHEDULE_REMOVED':
            return `Hej ${person.firstName}! Din schemaläggning för ${date} har tagits bort.`;

        case 'SCHEDULE_CHANGED':
            return `Hej ${person.firstName}! Din schemaläggning för ${date} har ändrats till ${time}${role}.`;

        default:
            return `Hej ${person.firstName}! Du har en uppdatering i Schema-Program.`;
    }
}

/**
 * Test-SMS (för UI-testning)
 */
export async function sendTestSMS(phone, settings) {
    const testNotif = {
        id: `test-${Date.now()}`,
        phone,
        message: 'Test-meddelande från Schema-Program. Om du ser detta fungerar SMS-integreringen! 📱',
        createdAt: Date.now(),
    };

    return await sendNotification(testNotif, settings);
}
