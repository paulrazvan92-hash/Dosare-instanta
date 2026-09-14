// Stocare simpla pe fisier (JSON). Suficienta pentru uz personal, cu
// putini utilizatori si verificari la fiecare 30 min - nu justifica un SGBD.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureReady() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ dosare: [], subscriptions: [], events: [] }, null, 2));
  }
}

function read() {
  ensureReady();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function write(data) {
  // scriere atomica: scriem intr-un fisier temporar apoi redenumim
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------- Dosare ----------

function listDosare() {
  return read().dosare;
}

function getDosar(idDosar) {
  return read().dosare.find((d) => d.id === idDosar) || null;
}

function addDosar({ numarDosar, institutie, label }) {
  const data = read();
  const exists = data.dosare.find((d) => d.numarDosar === numarDosar);
  if (exists) return exists;

  const dosar = {
    id: id(),
    numarDosar,
    institutie: institutie || null,
    label: label || null,
    snapshot: null, // ultima stare cunoscuta de la portal
    lastChecked: null,
    lastError: null,
    createdAt: new Date().toISOString(),
  };
  data.dosare.push(dosar);
  write(data);
  return dosar;
}

function removeDosar(idDosar) {
  const data = read();
  data.dosare = data.dosare.filter((d) => d.id !== idDosar);
  data.events = data.events.filter((e) => e.dosarId !== idDosar);
  write(data);
}

function updateDosarSnapshot(idDosar, snapshot, error) {
  const data = read();
  const dosar = data.dosare.find((d) => d.id === idDosar);
  if (!dosar) return;
  dosar.lastChecked = new Date().toISOString();
  if (error) {
    dosar.lastError = error;
  } else {
    dosar.lastError = null;
    dosar.snapshot = snapshot;
  }
  write(data);
}

// ---------- Evenimente (istoric notificari) ----------

function addEvent(dosarId, type, message) {
  const data = read();
  const event = {
    id: id(),
    dosarId,
    type,
    message,
    createdAt: new Date().toISOString(),
    seen: false,
  };
  data.events.unshift(event);
  // pastram maxim 500 evenimente ca fisierul sa nu creasca la nesfarsit
  data.events = data.events.slice(0, 500);
  write(data);
  return event;
}

function listEvents(dosarId) {
  const data = read();
  if (dosarId) return data.events.filter((e) => e.dosarId === dosarId);
  return data.events;
}

// ---------- Abonamente Push ----------

function addSubscription(sub) {
  const data = read();
  const exists = data.subscriptions.find((s) => s.endpoint === sub.endpoint);
  if (!exists) {
    data.subscriptions.push(sub);
    write(data);
  }
}

function removeSubscription(endpoint) {
  const data = read();
  data.subscriptions = data.subscriptions.filter((s) => s.endpoint !== endpoint);
  write(data);
}

function listSubscriptions() {
  return read().subscriptions;
}

module.exports = {
  listDosare,
  getDosar,
  addDosar,
  removeDosar,
  updateDosarSnapshot,
  addEvent,
  listEvents,
  addSubscription,
  removeSubscription,
  listSubscriptions,
};
