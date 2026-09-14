'use strict';

const cron = require('node-cron');
const db = require('./db');
const { cautaDosar } = require('./soapClient');
const { compareDosare } = require('./diff');
const push = require('./push');

/**
 * Verifica un singur dosar: il interogheaza pe portal, compara cu starea
 * anterioara, salveaza evenimentele noi si trimite notificari push.
 */
async function checkDosar(dosar) {
  try {
    const fresh = await cautaDosar(dosar.numarDosar, dosar.institutie);

    if (!fresh) {
      db.updateDosarSnapshot(dosar.id, null, 'Dosarul nu a fost gasit pe portal.just.ro');
      return { ok: false, events: [] };
    }

    const events = compareDosare(dosar.snapshot, fresh);
    db.updateDosarSnapshot(dosar.id, fresh, null);

    const label = dosar.label || dosar.numarDosar;
    for (const ev of events) {
      db.addEvent(dosar.id, ev.type, ev.message);
      await push.notifyAll(`Dosar ${label}`, ev.message, { dosarId: dosar.id });
    }

    return { ok: true, events };
  } catch (err) {
    console.error(`[scheduler] Eroare la verificarea dosarului ${dosar.numarDosar}:`, err.message);
    db.updateDosarSnapshot(dosar.id, null, err.message);
    return { ok: false, events: [], error: err.message };
  }
}

async function checkAll() {
  const dosare = db.listDosare();
  console.log(`[scheduler] Verific ${dosare.length} dosar(e)...`);
  for (const dosar of dosare) {
    await checkDosar(dosar);
    // mica pauza intre interogari, ca sa nu suprasolicitam serviciul portalului
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('[scheduler] Verificare completa.');
}

function start() {
  // la fiecare 30 de minute
  cron.schedule('*/30 * * * *', () => {
    checkAll().catch((err) => console.error('[scheduler] eroare generala:', err));
  });
  console.log('[scheduler] Planificator pornit: verificare la fiecare 30 de minute.');
}

module.exports = { start, checkAll, checkDosar };
