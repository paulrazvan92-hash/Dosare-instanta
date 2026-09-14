'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./src/db');
const push = require('./src/push');
const scheduler = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ----------

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Abonament invalid' });
  db.addSubscription(sub);
  res.json({ ok: true });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.removeSubscription(endpoint);
  res.json({ ok: true });
});

app.get('/api/dosare', (req, res) => {
  res.json(db.listDosare());
});

app.post('/api/dosare', async (req, res) => {
  const { numarDosar, institutie, label } = req.body;
  if (!numarDosar || !numarDosar.trim()) {
    return res.status(400).json({ error: 'Numărul dosarului este obligatoriu (ex: 12345/3/2023).' });
  }
  const dosar = db.addDosar({ numarDosar: numarDosar.trim(), institutie, label });

  // facem imediat o prima verificare, ca utilizatorul sa vada datele pe loc
  const result = await scheduler.checkDosar(dosar);
  res.json({ dosar: db.getDosar(dosar.id), checkResult: result });
});

app.delete('/api/dosare/:id', (req, res) => {
  db.removeDosar(req.params.id);
  res.json({ ok: true });
});

app.post('/api/dosare/:id/refresh', async (req, res) => {
  const dosar = db.getDosar(req.params.id);
  if (!dosar) return res.status(404).json({ error: 'Dosar inexistent' });
  const result = await scheduler.checkDosar(dosar);
  res.json({ dosar: db.getDosar(dosar.id), checkResult: result });
});

app.get('/api/dosare/:id/events', (req, res) => {
  res.json(db.listEvents(req.params.id));
});

app.get('/api/events', (req, res) => {
  res.json(db.listEvents());
});

// ---------- Pornire ----------

push.setup();
scheduler.start();

app.listen(PORT, () => {
  console.log(`Server pornit pe portul ${PORT}`);
});
