'use strict';

const el = (sel) => document.querySelector(sel);

const viewList = el('#view-list');
const viewDetail = el('#view-detail');
const viewCalendar = el('#view-calendar');
const mainTabs = el('#main-tabs');
const calGrid = el('#cal-grid');
const calMonthLabel = el('#cal-month-label');
const calDayPanel = el('#cal-day-panel');
const calDayTitle = el('#cal-day-title');
const calDayList = el('#cal-day-list');
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

let activeTab = 'list';
let returnToId = null; // id-ul dosarului din care s-a intrat in detaliu (din calendar sau lista)

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));

  viewDetail.classList.add('hidden');
  mainTabs.classList.remove('hidden');

  if (tab === 'calendar') {
    viewList.classList.add('hidden');
    viewCalendar.classList.remove('hidden');
    loadCalendar();
  } else {
    viewCalendar.classList.add('hidden');
    viewList.classList.remove('hidden');
    loadList();
  }
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

function showDetail(id) {
  viewList.classList.add('hidden');
  viewCalendar.classList.add('hidden');
  mainTabs.classList.add('hidden');
  viewDetail.classList.remove('hidden');
  loadDetail(id);
}

btnBack.addEventListener('click', () => switchTab(activeTab));

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

form
