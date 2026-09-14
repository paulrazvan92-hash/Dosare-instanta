'use strict';

const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('\nAdauga aceste linii in fisierul .env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:adresa-ta@example.com\n');
