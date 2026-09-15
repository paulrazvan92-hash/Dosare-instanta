'use strict';

const webpush = require('web-push');
const db = require('./db');

function setup() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn(
      '[push] Lipsesc cheile VAPID din .env. Ruleaza "npm run gen-vapid" si adauga-le in .env.'
    );
    return;
  }
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:notificari@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

async function notifyAll(title, body, data = {}) {
  const subs = await db.listSubscriptions();
  const payload = JSON.stringify({ title, body, data });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        // abonament expirat/invalid -> il stergem
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.removeSubscription(sub.endpoint);
        } else {
          console.error('[push] eroare la trimitere:', err.message);
        }
      }
    })
  );
}

module.exports = { setup, notifyAll };
