'use strict';

const el = (sel) => document.querySelector(sel);

const viewList = el('#view-list');
const viewDetail = el('#view-detail');
const dosareListEl = el('#dosare-list');
const emptyStateEl = el('#empty-state');
const formAdd = el('#form-add');
const formError = el('#form-error');
const btnBack = el('#btn-back');
const btnNotify = el('#btn-notify');
const detailContent = el('#detail-content');
const bannerStandalone = el('#banner-standalone');
const toastEl = el('#toast');

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3200);
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function fmtDateTime(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(d);
  }
}

// ---------- Navigare intre ecrane ----------

function showList() {
  viewDetail.classList.add('hidden');
  viewList.classList.remove('hidden');
  loadList();
}

function showDetail(id) {
  viewList.classList.add('hidden');
  viewDetail.classList.remove('hidden');
  loadDetail(id);
}

btnBack.addEventListener('click', showList);

// ---------- Lista de dosare ----------

async function loadList() {
  const res = await fetch('/api/dosare');
  const dosare = await res.json();

  dosareListEl.innerHTML = '';
  emptyStateEl.classList.toggle('hidden', dosare.length > 0);

  for (const d of dosare) {
    const li = document.createElement('li');
    li.className = 'dosar-row';
    li.addEventListener('click', () => showDetail(d.id));

    const snap = d.snapshot;
    let tag = '<span class="tag tag-ok">La zi</span>';
    if (d.lastError) tag = '<span class="tag tag-error">Eroare</span>';
    else if (!d.lastChecked) tag = '<span class="tag tag-new">Nou</span>';

    const stadiu = snap ? (snap.stadiuProcesualNume || snap.stadiuProcesual || '') : '';
    const instanta = snap ? (snap.institutie || '') : (d.institutie || '');

    li.innerHTML = `
      <div class="dosar-main">
        <div class="numar">${escapeHtml(d.numarDosar)}</div>
        ${d.label ? `<div class="label">${escapeHtml(d.label)}</div>` : ''}
        <div class="meta">${escapeHtml(instanta)}${stadiu ? ' · ' + escapeHtml(stadiu) : ''}</div>
      </div>
      ${tag}
    `;
    dosareListEl.appendChild(li);
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

// ---------- Adaugare dosar ----------

formAdd.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');

  const numarDosar = el('#input-numar').value.trim();
  const label = el('#input-label').value.trim();
  const institutie = el('#input-institutie').value.trim();

  if (!numarDosar) return;

  const submitBtn = formAdd.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Se verifică pe portal...';

  try {
    const res = await fetch('/api/dosare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numarDosar, label, institutie }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Eroare necunoscută');

    if (!data.checkResult || !data.checkResult.ok) {
      toast('Dosar adăugat, dar nu a putut fi găsit acum pe portal. Va fi reîncercat automat.');
    } else {
      toast('Dosar adăugat și verificat.');
    }

    formAdd.reset();
    loadList();
  } catch (err) {
    formError.textContent = err.message;
    formError.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Adaugă și verifică acum';
  }
});

// ---------- Detaliu dosar ----------

async function loadDetail(id) {
  detailContent.innerHTML = '<p>Se încarcă...</p>';

  const [dosare, events] = await Promise.all([
    fetch('/api/dosare').then((r) => r.json()),
    fetch(`/api/dosare/${id}/events`).then((r) => r.json()),
  ]);

  const d = dosare.find((x) => x.id === id);
  if (!d) {
    detailContent.innerHTML = '<p>Dosarul nu mai există.</p>';
    return;
  }

  const s = d.snapshot || {};
  const sedinte = Array.isArray(s.sedinte) ? s.sedinte : [];
  const parti = Array.isArray(s.parti) ? s.parti : [];

  let timelineHtml = '<p style="font-size:0.85rem;color:#9A9385;">Niciun termen preluat încă.</p>';
  if (sedinte.length) {
    timelineHtml = '<ul class="timeline">' + sedinte.map((sd) => {
      const solutie = findSolutieField(sd);
      return `
        <li>
          <div class="t-date">${fmtDate(sd.data)}${sd.ora ? ' · ora ' + escapeHtml(sd.ora) : ''}</div>
          ${sd.complet ? `<div class="t-complet">Complet: ${escapeHtml(sd.complet)}</div>` : ''}
          ${solutie ? `<div class="t-solutie">${escapeHtml(solutie)}</div>` : ''}
        </li>
      `;
    }).join('') + '</ul>';
  }

  let partiHtml = '<p style="font-size:0.85rem;color:#9A9385;">Fără informații despre părți.</p>';
  if (parti.length) {
    partiHtml = '<div class="parti-list">' + parti.map((p) => {
      const nume = p.nume || p.numeParte || Object.values(p).find((v) => typeof v === 'string') || '—';
      const calitate = p.calitateParte || p.calitate || '';
      return `${escapeHtml(nume)}${calitate ? ' — ' + escapeHtml(calitate) : ''}`;
    }).join('<br>') + '</div>';
  }

  let eventsHtml = '<p style="font-size:0.85rem;color:#9A9385;">Niciun eveniment încă.</p>';
  if (events.length) {
    eventsHtml = '<ul class="events-list">' + events.map((e) => `
      <li>${escapeHtml(e.message)}<span class="e-date">${fmtDateTime(e.createdAt)}</span></li>
    `).join('') + '</ul>';
  }

  detailContent.innerHTML = `
    <div class="detail-header">
      <div class="numar">${escapeHtml(d.numarDosar)}</div>
      ${d.label ? `<div class="label">${escapeHtml(d.label)}</div>` : ''}
    </div>

    <div class="detail-grid">
      <div class="row"><span class="k">Instanță</span><span class="v">${escapeHtml(s.institutie || d.institutie || '—')}</span></div>
      <div class="row"><span class="k">Obiect</span><span class="v">${escapeHtml(s.obiect || '—')}</span></div>
      <div class="row"><span class="k">Stadiu procesual</span><span class="v">${escapeHtml(s.stadiuProcesualNume || s.stadiuProcesual || '—')}</span></div>
      <div class="row"><span class="k">Categorie</span><span class="v">${escapeHtml(s.categorieCazNume || s.categorieCaz || '—')}</span></div>
      <div class="row"><span class="k">Ultima verificare</span><span class="v">${fmtDateTime(d.lastChecked)}</span></div>
      ${d.lastError ? `<div class="row"><span class="k">Eroare</span><span class="v" style="color:#A6432D">${escapeHtml(d.lastError)}</span></div>` : ''}
    </div>

    <h3 class="timeline-title">Termene</h3>
    ${timelineHtml}

    <h3 class="parti-title">Părți</h3>
    ${partiHtml}

    <h3 class="events-title">Istoric notificări</h3>
    ${eventsHtml}

    <div class="actions-row">
      <button class="btn-secondary" id="btn-refresh">Verifică acum</button>
      <button class="btn-secondary btn-danger" id="btn-delete">Șterge dosarul</button>
    </div>
  `;

  el('#btn-refresh').addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    ev.target.textContent = 'Se verifică...';
    const res = await fetch(`/api/dosare/${id}/refresh`, { method: 'POST' });
    const data = await res.json();
    const n = data.checkResult && data.checkResult.events ? data.checkResult.events.length : 0;
    toast(n > 0 ? `${n} modificare(i) găsită(e).` : 'Nicio modificare nouă.');
    loadDetail(id);
  });

  el('#btn-delete').addEventListener('click', async () => {
    if (!confirm('Ștergi acest dosar din listă? Nu mai primești notificări pentru el.')) return;
    await fetch(`/api/dosare/${id}`, { method: 'DELETE' });
    toast('Dosar șters.');
    showList();
  });
}

// cauta generic un camp ce pare sa contina solutia, indiferent de numele exact
// al proprietatii intoarse de portal (portalul nu documenteaza public schema exacta)
function findSolutieField(sedinta) {
  for (const [key, val] of Object.entries(sedinta || {})) {
    if (typeof val !== 'string' || !val.trim()) continue;
    const k = key.toLowerCase();
    if (k.includes('solutie') || k.includes('sumar') || k.includes('minuta')) return val;
  }
  return null;
}

// ---------- Notificari push ----------

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function enableNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Browserul acesta nu suportă notificări push.');
    return;
  }

  if (!isStandalone()) {
    bannerStandalone.classList.remove('hidden');
    toast('Adaugă mai întâi aplicația pe ecranul principal (vezi instrucțiunile de mai sus).');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast('Nu ai permis notificările. Le poți activa oricând din Setări.');
    return;
  }

  const reg = await navigator.serviceWorker.ready;
  const keyRes = await fetch('/api/vapid-public-key');
  const { key } = await keyRes.json();

  if (!key) {
    toast('Serverul nu are configurate cheile de notificare (VAPID). Vezi ghidul de configurare.');
    return;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  });

  btnNotify.textContent = 'Notificări active ✓';
  toast('Notificările sunt active pe acest dispozitiv.');
}

btnNotify.addEventListener('click', enableNotifications);

// ---------- Pornire ----------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => console.error('SW error', err));
}

if (!isStandalone()) {
  bannerStandalone.classList.remove('hidden');
}

showList();
