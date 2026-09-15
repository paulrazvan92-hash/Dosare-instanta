// Stocare in Postgres, oferit de Railway ca serviciu separat. Spre deosebire
// de un fisier local, datele NU se pierd la redeploy sau la repornirea
// serviciului aplicatiei.
'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Lipseste DATABASE_URL. Adauga un serviciu PostgreSQL pe Railway si leaga-l ' +
        'de acest serviciu (Variables -> New Variable -> Add Reference -> DATABASE_URL).'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('railway.internal') ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function init() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS dosare (
      id TEXT PRIMARY KEY,
      numar_dosar TEXT NOT NULL UNIQUE,
      institutie TEXT,
      label TEXT,
      snapshot JSONB,
      last_checked TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      dosar_id TEXT NOT NULL REFERENCES dosare(id) ON DELETE CASCADE,
      type TEXT,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      seen BOOLEAN NOT NULL DEFAULT false
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      endpoint TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `);
  console.log('[db] Schema Postgres verificata/creata.');
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

function rowToDosar(r) {
  if (!r) return null;
  return {
    id: r.id,
    numarDosar: r.numar_dosar,
    institutie: r.institutie,
    label: r.label,
    snapshot: r.snapshot,
    lastChecked: r.last_checked,
    lastError: r.last_error,
    createdAt: r.created_at,
  };
}

// ---------- Dosare ----------

async function listDosare() {
  const { rows } = await getPool().query('SELECT * FROM dosare ORDER BY created_at ASC');
  return rows.map(rowToDosar);
}

async function getDosar(idDosar) {
  const { rows } = await getPool().query('SELECT * FROM dosare WHERE id = $1', [idDosar]);
  return rowToDosar(rows[0]);
}

async function addDosar({ numarDosar, institutie, label }) {
  const existing = await getPool().query('SELECT * FROM dosare WHERE numar_dosar = $1', [numarDosar]);
  if (existing.rows[0]) return rowToDosar(existing.rows[0]);

  const newId = id();
  const { rows } = await getPool().query(
    `INSERT INTO dosare (id, numar_dosar, institutie, label) VALUES ($1, $2, $3, $4) RETURNING *`,
    [newId, numarDosar, institutie || null, label || null]
  );
  return rowToDosar(rows[0]);
}

async function removeDosar(idDosar) {
  await getPool().query('DELETE FROM dosare WHERE id = $1', [idDosar]);
}

async function updateDosarSnapshot(idDosar, snapshot, error) {
  if (error) {
    await getPool().query(
      'UPDATE dosare SET last_checked = now(), last_error = $2 WHERE id = $1',
      [idDosar, error]
    );
  } else {
    await getPool().query(
      'UPDATE dosare SET last_checked = now(), last_error = NULL, snapshot = $2 WHERE id = $1',
      [idDosar, JSON.stringify(snapshot)]
    );
  }
}

// ---------- Evenimente ----------

async function addEvent(dosarId, type, message) {
  const newId = id();
  const { rows } = await getPool().query(
    `INSERT INTO events (id, dosar_id, type, message) VALUES ($1, $2, $3, $4) RETURNING *`,
    [newId, dosarId, type, message]
  );
  const r = rows[0];
  return { id: r.id, dosarId: r.dosar_id, type: r.type, message: r.message, createdAt: r.created_at, seen: r.seen };
}

async function listEvents(dosarId) {
  const { rows } = dosarId
    ? await getPool().query('SELECT * FROM events WHERE dosar_id = $1 ORDER BY created_at DESC LIMIT 500', [dosarId])
    : await getPool().query('SELECT * FROM events ORDER BY created_at DESC LIMIT 500');
  return rows.map((r) => ({
    id: r.id, dosarId: r.dosar_id, type: r.type, message: r.message, createdAt: r.created_at, seen: r.seen,
  }));
}

// ---------- Abonamente Push ----------

async function addSubscription(sub) {
  await getPool().query(
    `INSERT INTO subscriptions (endpoint, data) VALUES ($1, $2)
     ON CONFLICT (endpoint) DO UPDATE SET data = EXCLUDED.data`,
    [sub.endpoint, JSON.stringify(sub)]
  );
}

async function removeSubscription(endpoint) {
  await getPool().query('DELETE FROM subscriptions WHERE endpoint = $1', [endpoint]);
}

async function listSubscriptions() {
  const { rows } = await getPool().query('SELECT data FROM subscriptions');
  return rows.map((r) => r.data);
}

module.exports = {
  init,
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
