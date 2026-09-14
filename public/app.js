```javascript
/* =========================================================
   REGISTRUL MEU DE DOSARE
   Front-end logic
   ========================================================= */

const API_BASE = ""; // API-ul va fi apelat din aceeași aplicație

const STORAGE_KEY = "dosare-monitor-v1";

let state = {
  dosare: [],
  activeTab: "list",
  selectedDosarId: null,
  calendarDate: new Date(),
  selectedCalendarDay: null
};

/* =========================================================
   HELPERS
   ========================================================= */

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (parsed && typeof parsed === "object") {
        state = {
          ...state,
          ...parsed,
          calendarDate: new Date()
        };
      }
    }
  } catch (err) {
    console.error("Nu s-au putut încărca datele:", err);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      dosare: state.dosare,
      activeTab: state.activeTab
    })
  );
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}

function generateId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 9)
  );
}

/* =========================================================
   API
   ========================================================= */

/*
  IMPORTANT:

  Browserul NU trebuie să acceseze direct portal.just.ro.

  Site-ul portal.just.ro trebuie interogat de serverul nostru,
  iar aplicația iPhone/web primește rezultatul de la API.

  Endpoint-urile așteptate:

  GET  /api/dosar?numar=12345%2F3%2F2023&institutie=...
  POST /api/dosar

  Răspunsul trebuie să aibă aproximativ forma:

  {
    "success": true,
    "dosar": {
      "numar": "...",
      "institutie": "...",
      "categorie": "...",
      "dataUltimeiModificari": "...",
      "parti": [],
      "sedinte": [],
      "solutii": [],
      "evenimente": []
    }
  }
*/

async function apiGetDosar(numar, institutie = "") {
  const params = new URLSearchParams();

  params.set("numar", numar);

  if (institutie) {
    params.set("institutie", institutie);
  }

  const response = await fetch(
    `${API_BASE}/api/dosar?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Serverul a răspuns cu codul ${response.status}.`
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      data.message || "Dosarul nu a putut fi identificat."
    );
  }

  return data.dosar;
}

/* =========================================================
   NORMALIZARE DATE
   ========================================================= */

function normalizeDosar(data, existing = null) {
  return {
    id: existing?.id || generateId(),

    numar:
      data.numar ||
      existing?.numar ||
      "",

    label:
      existing?.label ||
      data.label ||
      "",

    institutie:
      data.institutie ||
      existing?.institutie ||
      "",

    categorie:
      data.categorie ||
      existing?.categorie ||
      "",

    obiect:
      data.obiect ||
      existing?.obiect ||
      "",

    parti:
      Array.isArray(data.parti)
        ? data.parti
        : existing?.parti || [],

    sedinte:
      Array.isArray(data.sedinte)
        ? data.sedinte
        : existing?.sedinte || [],

    solutii:
      Array.isArray(data.solutii)
        ? data.solutii
        : existing?.solutii || [],

    evenimente:
      Array.isArray(data.evenimente)
        ? data.evenimente
        : existing?.evenimente || [],

    dataUltimeiModificari:
      data.dataUltimeiModificari ||
      existing?.dataUltimeiModificari ||
      null,

    ultimaVerificare:
      new Date().toISOString(),

    status:
      data.status ||
      existing?.status ||
      "ok",

    modificariNoi:
      existing?.modificariNoi || 0,

    snapshot:
      data.snapshot ||
      existing?.snapshot ||
      null
  };
}

/* =========================================================
   COMPARARE MODIFICĂRI
   ========================================================= */

function createComparableSnapshot(dosar) {
  return JSON.stringify({
    institutie: dosar.institutie,
    categorie: dosar.categorie,
    obiect: dosar.obiect,
    parti: dosar.parti,
    sedinte: dosar.sedinte,
    solutii: dosar.solutii,
    evenimente: dosar.evenimente
  });
}

function detectChanges(oldDosar, newDosar) {
  const changes = [];

  if (!oldDosar) {
    return changes;
  }

  if (
    JSON.stringify(oldDosar.sedinte || []) !==
    JSON.stringify(newDosar.sedinte || [])
  ) {
    changes.push("Au fost modificate ședințele/termenele.");
  }

  if (
    JSON.stringify(oldDosar.solutii || []) !==
    JSON.stringify(newDosar.solutii || [])
  ) {
    changes.push("A fost introdusă sau modificată o soluție.");
  }

  if (
    JSON.stringify(oldDosar.evenimente || []) !==
    JSON.stringify(newDosar.evenimente || [])
  ) {
    changes.push("Au fost adăugate modificări în istoricul dosarului.");
  }

  if (
    JSON.stringify(oldDosar.parti || []) !==
    JSON.stringify(newDosar.parti || [])
  ) {
    changes.push("Au fost modificate părțile dosarului.");
  }

  return changes;
}

/* =========================================================
   ADAUGARE DOSAR
   ========================================================= */

async function addDosar(event) {
  event.preventDefault();

  const numarInput = document.getElementById("input-numar");
  const labelInput = document.getElementById("input-label");
  const institutieInput = document.getElementById("input-institutie");
  const errorBox = document.getElementById("form-error");

  const numar = numarInput.value.trim();
  const label = labelInput.value.trim();
  const institutie = institutieInput.value.trim();

  errorBox.classList.add("hidden");
  errorBox.textContent = "";

  if (!numar) {
    errorBox.textContent = "Introdu numărul dosarului.";
    errorBox.classList.remove("hidden");
    return;
  }

  const existing = state.dosare.find(
    d => d.numar.toLowerCase() === numar.toLowerCase()
  );

  if (existing) {
    errorBox.textContent =
      "Acest dosar este deja în lista de monitorizare.";
    errorBox.classList.remove("hidden");
    return;
  }

  const button = event.submitter;

  if (button) {
    button.disabled = true;
    button.textContent = "Se verifică...";
  }

  try {
    const data = await apiGetDosar(numar, institutie);

    const dosar = normalizeDosar(data);

    dosar.label = label;

    dosar.snapshot = createComparableSnapshot(dosar);

    state.dosare.unshift(dosar);

    saveState();
    renderList();

    numarInput.value = "";
    labelInput.value = "";
    institutieInput.value = "";

    showToast("Dosarul a fost adăugat și verificat.");

  } catch (error) {
    console.error(error);

    errorBox.textContent =
      error.message ||
      "Nu am putut verifica dosarul.";

    errorBox.classList.remove("hidden");

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Adaugă și verifică acum";
    }
  }
}

/* =========================================================
   VERIFICARE DOSAR
   ========================================================= */

async function refreshDosar(dosar, silent = false) {
  try {
    const oldSnapshot =
      dosar.snapshot ||
      createComparableSnapshot(dosar);

    const data = await apiGetDosar(
      dosar.numar,
      dosar.institutie
    );

    const updated = normalizeDosar(data, dosar);

    const changes = detectChanges(dosar, updated);

    updated.snapshot = createComparableSnapshot(updated);

    if (changes.length > 0) {
      updated.modificariNoi =
        (dosar.modificariNoi || 0) + changes.length;

      updated.lastChanges = changes;

      if (!silent) {
        showToast(
          `${dosar.numar}: ${changes[0]}`
        );
      }

      sendNotification(
        dosar,
        changes
      );
    } else {
      updated.modificariNoi =
        dosar.modificariNoi || 0;
    }

    const index = state.dosare.findIndex(
      d => d.id === dosar.id
    );

    if (index !== -1) {
      state.dosare[index] = updated;
    }

    saveState();

    renderList();

    if (state.selectedDosarId === dosar.id) {
      renderDetail(updated);
    }

    return {
      changed: changes.length > 0,
      changes
    };

  } catch (error) {
    console.error(
      `Eroare la verificarea dosarului ${dosar.numar}:`,
      error
    );

    dosar.status = "error";
    dosar.ultimaVerificare =
      new Date().toISOString();

    saveState();
    renderList();

    if (!silent) {
      showToast(
        `Nu s-a putut verifica ${dosar.numar}.`
      );
    }

    return {
      changed: false,
      error
    };
  }
}

/* =========================================================
   VERIFICARE TOATE DOSARELE
   ========================================================= */

async function refreshAllDosare() {
  if (!state.dosare.length) {
    return;
  }

  console.log(
    "Începe verificarea automată a dosarelor..."
  );

  for (const dosar of [...state.dosare]) {
    await refreshDosar(dosar, true);

    /*
      O mică pauză între solicitări pentru a evita
      trimiterea simultană a foarte multor cereri.
    */
    await sleep(1000);
  }

  console.log(
    "Verificarea tuturor dosarelor s-a terminat."
  );
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/* =========================================================
   NOTIFICĂRI
   ========================================================= */

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast(
      "Acest browser nu suportă notificări."
    );
    return;
  }

  try {
    const permission =
      await Notification.requestPermission();

    if (permission === "granted") {
      showToast(
        "Notificările au fost activate."
      );

      updateNotificationButton();

    } else {
      showToast(
        "Notificările nu au fost permise."
      );
    }

  } catch (error) {
    console.error(error);
  }
}

function sendNotification(dosar, changes) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const title =
    dosar.label ||
    `Dosar ${dosar.numar}`;

  const body =
    changes.length === 1
      ? changes[0]
      : `${changes.length} modificări noi în dosar.`;

  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png"
    });
  } catch (error) {
    console.error(
      "Notificarea nu a putut fi afișată:",
      error
    );
  }
}

function updateNotificationButton() {
  const button =
    document.getElementById("btn-notify");

  if (!button) return;

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    button.textContent =
      "Notificările sunt active";
  }
}

/* =========================================================
   LISTĂ DOSARE
   ========================================================= */

function renderList() {
  const list =
    document.getElementById("dosare-list");

  const empty =
    document.getElementById("empty-state");

  if (!state.dosare.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  list.innerHTML = state.dosare
    .map(dosar => {

      let tag = "";

      if (dosar.status === "error") {
        tag =
          '<span class="tag tag-error">Eroare</span>';
      } else if ((dosar.modificariNoi || 0) > 0) {
        tag =
          `<span class="tag tag-new">+${dosar.modificariNoi} nou</span>`;
      } else {
        tag =
          '<span class="tag tag-ok">Monitorizat</span>';
      }

      const nextHearing =
        getNextHearing(dosar);

      return `
        <li
          class="dosar-row"
          data-id="${escapeHtml(dosar.id)}"
        >
          <div class="dosar-main">

            <div class="numar">
              ${escapeHtml(dosar.numar)}
            </div>

            ${
              dosar.label
                ? `<div class="label">
                    ${escapeHtml(dosar.label)}
                   </div>`
                : ""
            }

            <div class="meta">
              ${
                escapeHtml(
                  dosar.institutie || "Instanță necunoscută"
                )
              }

              ${
                nextHearing
                  ? ` · Următor termen:
                     ${formatDateTime(
                       nextHearing.data || nextHearing.date
                     )}`
                  : ""
              }
            </div>

          </div>

          ${tag}

        </li>
      `;
    })
    .join("");

  list
    .querySelectorAll(".dosar-row")
    .forEach(row => {
      row.addEventListener("click", () => {
        openDetail(row.dataset.id);
      });
    });
}

/* =========================================================
   TERMEN URMĂTOR
   ========================================================= */

function getNextHearing(dosar) {
  if (!Array.isArray(dosar.sedinte)) {
    return null;
  }

  const now = new Date();

  const future = dosar.sedinte
    .filter(s => {
      const date =
        new Date(
          s.data ||
          s.date ||
          s.dataSedinta
        );

      return (
        !Number.isNaN(date.getTime()) &&
        date >= now
      );
    })
    .sort((a, b) => {
      const dateA = new Date(
        a.data ||
        a.date ||
        a.dataSedinta
      );

      const dateB = new Date(
        b.data ||
        b.date ||
        b.dataSedinta
      );

      return dateA - dateB;
    });

  return future[0] || null;
}

/* =========================================================
   DETALII DOSAR
   ========================================================= */

function openDetail(id) {
  state.selectedDosarId = id;

  const dosar =
    state.dosare.find(d => d.id === id);

  if (!dosar) return;

  document
    .getElementById("view-list")
    .classList.add("hidden");

  document
    .getElementById("view-calendar")
    .classList.add("hidden");

  document
    .getElementById("view-detail")
    .classList.remove("hidden");

  renderDetail(dosar);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function renderDetail(dosar) {
  const container =
    document.getElementById("detail-content");

  const nextHearing =
    getNextHearing(dosar);

  container.innerHTML = `
    <div class="detail-header">

      <div class="numar">
        ${escapeHtml(dosar.numar)}
      </div>

      ${
        dosar.label
          ? `<div class="label">
              ${escapeHtml(dosar.label)}
             </div>`
          : ""
      }

    </div>

    <div class="detail-grid">

      <div class="row">
        <span class="k">Instanță</span>
        <span class="v">
          ${escapeHtml(dosar.institutie || "—")}
        </span>
      </div>

      <div class="row">
        <span class="k">Categorie</span>
        <span class="v">
          ${escapeHtml(dosar.categorie || "—")}
        </span>
      </div>

      <div class="row">
        <span class="k">Obiect</span>
        <span class="v">
          ${escapeHtml(dosar.obiect || "—")}
        </span>
      </div>

      <div class="row">
        <span class="k">Ultima modificare</span>
        <span class="v">
          ${formatDateTime(
            dosar.dataUltimeiModificari
          )}
        </span>
      </div>

      <div class="row">
        <span class="k">Ultima verificare</span>
        <span class="v">
          ${formatDateTime(
            dosar.ultimaVerificare
          )}
        </span>
      </div>

    </div>

    ${
      nextHearing
        ? renderNextHearing(nextHearing)
        : ""
    }

    ${renderParti(dosar)}

    ${renderSedinte(dosar)}

    ${renderSolutii(dosar)}

    ${renderTimeline(dosar)}

    <div class="actions-row">

      <button
        type="button"
        class="btn-secondary"
        id="btn-refresh-detail"
      >
        Verifică acum
      </button>

      <button
        type="button"
        class="btn-secondary btn-danger"
        id="btn-delete-detail"
      >
        Șterge din monitorizare
      </button>

    </div>
  `;

  document
    .getElementById("btn-refresh-detail")
    ?.addEventListener("click", async () => {

      const button =
        document.getElementById(
          "btn-refresh-detail"
        );

      button.disabled = true;
      button.textContent = "Se verifică...";

      await refreshDosar(dosar);

      button.disabled = false;
      button.textContent = "Verifică acum";
    });

  document
    .getElementById("btn-delete-detail")
    ?.addEventListener("click", () => {
      deleteDosar(dosar.id);
    });
}

function renderNextHearing(hearing) {
  const date =
    hearing.data ||
    hearing.date ||
    hearing.dataSedinta;

  return `
    <h3 class="events-title">
      Următorul termen
    </h3>

    <div class="card">

      <strong>
        ${formatDate(date)}
      </strong>

      ${
        hearing.ora
          ? `<div>
              Ora: ${escapeHtml(hearing.ora)}
             </div>`
          : ""
      }

      ${
        hearing.complet
          ? `<div>
              Complet: ${escapeHtml(
                hearing.complet
              )}
             </div>`
          : ""
      }

      ${
        hearing.sala
          ? `<div>
              Sala: ${escapeHtml(
                hearing.sala
              )}
             </div>`
          : ""
      }

      ${
        hearing.materie
          ? `<div>
              Materie: ${escapeHtml(
                hearing.materie
              )}
             </div>`
          : ""
      }

    </div>
  `;
}

/* =========================================================
   PĂRȚI
   ========================================================= */

function renderParti(dosar) {
  if (!Array.isArray(dosar.parti) ||
      !dosar.parti.length) {
    return "";
  }

  return `
    <h3 class="parti-title">
      Părți
    </h3>

    <div class="parti-list">

      ${dosar.parti
        .map(part => {

          if (typeof part === "string") {
            return `
              <div>
                ${escapeHtml(part)}
              </div>
            `;
          }

          return `
            <div>
              ${
                part.calitate
                  ? `<strong>
                      ${escapeHtml(
                        part.calitate
                      )}:
                     </strong> `
                  : ""
              }

              ${escapeHtml(
                part.nume ||
                part.name ||
                ""
              )}
            </div>
          `;
        })
        .join("")}

    </div>
  `;
}

/* =========================================================
   ȘEDINȚE / TERMENE
   ========================================================= */

function renderSedinte(dosar) {
  if (!Array.isArray(dosar.sedinte) ||
      !dosar.sedinte.length) {
    return "";
  }

  const sedinte =
    [...dosar.sedinte].sort((a, b) => {

      const da = new Date(
        a.data ||
        a.date ||
        a.dataSedinta
      );

      const db = new Date(
        b.data ||
        b.date ||
        b.dataSedinta
      );

      return db - da;
    });

  return `
    <h3 class="events-title">
      Termene de judecată
    </h3>

    <ul class="events-list">

      ${sedinte
        .map(sedinta => {

          const date =
            sedinta.data ||
            sedinta.date ||
            sedinta.dataSedinta;

          return `
            <li>

              <strong>
                ${formatDate(date)}
              </strong>

              ${
                sedinta.ora
                  ? ` · Ora:
                     ${escapeHtml(
                       sedinta.ora
                     )}`
                  : ""
              }

              ${
                sedinta.complet
                  ? `<div>
                      Complet:
                      ${escapeHtml(
                        sedinta.complet
                      )}
                     </div>`
                  : ""
              }

              ${
                sedinta.sala
                  ? `<div>
                      Sala:
                      ${escapeHtml(
                        sedinta.sala
                      )}
                     </div>`
                  : ""
              }

              ${
                sedinta.materie
                  ? `<div>
                      ${escapeHtml(
                        sedinta.materie
                      )}
                     </div>`
                  : ""
              }

              ${
                sedinta.solutie
                  ? `<div>
                      Soluție:
                      ${escapeHtml(
                        sedinta.solutie
                      )}
                     </div>`
                  : ""
              }

              <span class="e-date">
                ${
                  sedinta.actualizatLa
                    ? `Actualizat:
                       ${formatDateTime(
                         sedinta.actualizatLa
                       )}`
                    : ""
                }
              </span>

            </li>
          `;
        })
        .join("")}

    </ul>
  `;
}

/* =========================================================
   SOLUȚII
   ========================================================= */

function renderSolutii(dosar) {
  if (!Array.isArray(dosar.solutii) ||
      !dosar.solutii.length) {
    return "";
  }

  const solutii =
    [...dosar.solutii].sort((a, b) => {

      const da = new Date(
        a.data ||
        a.date
      );

      const db = new Date(
        b.data ||
        b.date
      );

      return db - da;
    });

  return `
    <h3 class="events-title">
      Soluții
    </h3>

    <ul class="timeline">

      ${solutii
        .map(solutie => {

          const date =
            solutie.data ||
            solutie.date;

          return `
            <li>

              <div class="t-date">
                ${formatDate(date)}
              </div>

              ${
                solutie.complet
                  ? `<div class="t-complet">
                      Complet:
                      ${escapeHtml(
                        solutie.complet
                      )}
                     </div>`
                  : ""
              }

              <div class="t-solutie">
                ${escapeHtml(
                  solutie.text ||
                  solutie.solutie ||
                  solutie.descriere ||
                  ""
                )}
              </div>

            </li>
          `;
        })
        .join("")}

    </ul>
  `;
}

/* =========================================================
   ISTORIC
   ========================================================= */

function renderTimeline(dosar) {
  if (!Array.isArray(dosar.evenimente) ||
      !dosar.evenimente.length) {
    return "";
  }

  return `
    <h3 class="timeline-title">
      Istoric modificări
    </h3>

    <ul class="timeline">

      ${dosar.evenimente
        .map(event => {

          return `
            <li>

              <div class="t-date">
                ${formatDateTime(
                  event.data ||
                  event.date
                )}
              </div>

              <div class="t-complet">
                ${escapeHtml(
                  event.tip ||
                  event.type ||
                  "Modificare"
                )}
              </div>

              ${
                event.text ||
                event.descriere
                  ? `<div class="t-solutie">
                      ${escapeHtml(
                        event.text ||
                        event.descriere
                      )}
                     </div>`
                  : ""
              }

            </li>
          `;
        })
        .join("")}

    </ul>
  `;
}

/* =========================================================
   ȘTERGERE DOSAR
   ========================================================= */

function deleteDosar(id) {
  const dosar =
    state.dosare.find(d => d.id === id);

  if (!dosar) return;

  const confirmed =
    window.confirm(
      `Ștergi dosarul ${dosar.numar} din lista de monitorizare?`
    );

  if (!confirmed) return;

  state.dosare =
    state.dosare.filter(
      d => d.id !== id
    );

  state.selectedDosarId = null;

  saveState();

  document
    .getElementById("view-detail")
    .classList.add("hidden");

  document
    .getElementById("view-list")
    .classList.remove("hidden");

  renderList();

  showToast("Dosarul a fost eliminat.");
}

/* =========================================================
   TABS
   ========================================================= */

function switchTab(tab) {
  state.activeTab = tab;

  const listView =
    document.getElementById("view-list");

  const calendarView =
    document.getElementById("view-calendar");

  const detailView =
    document.getElementById("view-detail");

  const tabs =
    document.querySelectorAll(".tab");

  detailView.classList.add("hidden");

  tabs.forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === tab
    );
  });

  if (tab === "calendar") {
    listView.classList.add("hidden");
    calendarView.classList.remove("hidden");
    renderCalendar();
  } else {
    calendarView.classList.add("hidden");
    listView.classList.remove("hidden");
  }

  saveState();
}

/* =========================================================
   CALENDAR
   ========================================================= */

function renderCalendar() {
  const grid =
    document.getElementById("cal-grid");

  const label =
    document.getElementById(
      "cal-month-label"
    );

  const date =
    state.calendarDate;

  const year =
    date.getFullYear();

  const month =
    date.getMonth();

  label.textContent =
    date.toLocaleDateString(
      "ro-RO",
      {
        month: "long",
        year: "numeric"
      }
    );

  const firstDay =
    new Date(
      year,
      month,
      1
    );

  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );

  /*
    JavaScript:
    0 = duminică

    Calendarul nostru:
    Luni = prima zi
  */

  let startingDay =
    firstDay.getDay();

  startingDay =
    startingDay === 0
      ? 6
      : startingDay - 1;

  let html = "";

  for (let i = 0; i < startingDay; i++) {
    html += `
      <div class="cal-day empty"></div>
    `;
  }

  const today =
    new Date();

  for (
    let day = 1;
    day <= lastDay.getDate();
    day++
  ) {

    const current =
      new Date(
        year,
        month,
        day
      );

    const events =
      getCalendarEvents(current);

    const isToday =
      current.toDateString() ===
      today.toDateString();

    const isSelected =
      state.selectedCalendarDay ===
      current.toISOString().substring(0, 10);

    html += `
      <button
        type="button"
        class="cal-day
          ${events.length ? "has-events" : ""}
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
        "
        data-date="${current
          .toISOString()
          .substring(0, 10)}"
      >
        <span>${day}</span>

        ${
          events.length
            ? `<span class="cal-dot"></span>`
            : ""
        }
      </button>
    `;
  }

  grid.innerHTML = html;

  grid
    .querySelectorAll(
      ".cal-day.has-events"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.selectedCalendarDay =
            button.dataset.date;

          renderCalendarDay(
            new Date(
              `${button.dataset.date}T00:00:00`
            )
          );

          renderCalendar();
        }
      );
    });
}

function getCalendarEvents(date) {
  const result = [];

  for (const dosar of state.dosare) {

    if (!Array.isArray(dosar.sedinte)) {
      continue;
    }

    for (const sedinta of dosar.sedinte) {

      const value =
        sedinta.data ||
        sedinta.date ||
        sedinta.dataSedinta;

      if (!value) continue;

      const hearingDate =
        new Date(value);

      if (
        Number.isNaN(
          hearingDate.getTime()
        )
      ) {
        continue;
      }

      if (
        hearingDate.getFullYear() ===
          date.getFullYear() &&
        hearingDate.getMonth() ===
          date.getMonth() &&
        hearingDate.getDate() ===
          date.getDate()
      ) {
        result.push({
          dosar,
          sedinta
        });
      }
    }
  }

  return result;
}

function renderCalendarDay(date) {
  const panel =
    document.getElementById(
      "cal-day-panel"
    );

  const title =
    document.getElementById(
      "cal-day-title"
    );

  const list =
    document.getElementById(
      "cal-day-list"
    );

  const events =
    getCalendarEvents(date);

  if (!events.length) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");

  title.textContent =
    date.toLocaleDateString(
      "ro-RO",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );

  list.innerHTML =
    events
      .map(event => {

        const dosar =
          event.dosar;

        const sedinta =
          event.sedinta;

        return `
          <li
            class="dosar-row"
            data-id="${escapeHtml(
              dosar.id
            )}"
          >

            <div class="dosar-main">

              <div class="numar">
                ${escapeHtml(
                  dosar.numar
                )}
              </div>

              ${
                dosar.label
                  ? `<div class="label">
                      ${escapeHtml(
                        dosar.label
                      )}
                     </div>`
                  : ""
              }

              <div class="meta">

                ${
                  sedinta.ora
                    ? `Ora:
                       ${escapeHtml(
                         sedinta.ora
                       )}`
                    : ""
                }

                ${
                  sedinta.complet
                    ? ` · Complet:
                       ${escapeHtml(
                         sedinta.complet
                       )}`
                    : ""
                }

                ${
                  sedinta.sala
                    ? ` · Sala:
                       ${escapeHtml(
                         sedinta.sala
                       )}`
                    : ""
                }

              </div>

            </div>

          </li>
        `;
      })
      .join("");

  list
    .querySelectorAll(".dosar-row")
    .forEach(row => {

      row.addEventListener(
        "click",
        () => {
          openDetail(
            row.dataset.id
          );
        }
      );

    });
}

/* =========================================================
   INSTALARE PWA
   ========================================================= */

function isStandalone() {
  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true
  );
}

function updateStandaloneBanner() {
  const banner =
    document.getElementById(
      "banner-standalone"
    );

  if (!banner) return;

  if (
    !isStandalone() &&
    /iPhone|iPad|iPod/i.test(
      navigator.userAgent
    )
  ) {
    banner.classList.remove(
      "hidden"
    );
  } else {
    banner.classList.add(
      "hidden"
    );
  }
}

/* =========================================================
   SERVICE WORKER
   ========================================================= */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register(
      "/service-worker.js"
    );

    console.log(
      "Service Worker înregistrat."
    );

  } catch (error) {
    console.error(
      "Service Worker error:",
      error
    );
  }
}

/* =========================================================
   EVENIMENTE UI
   ========================================================= */

function bindEvents() {

  document
    .getElementById("form-add")
    ?.addEventListener(
      "submit",
      addDosar
    );

  document
    .getElementById("btn-notify")
    ?.addEventListener(
      "click",
      requestNotifications
    );

  document
    .getElementById("btn-back")
    ?.addEventListener(
      "click",
      () => {

        state.selectedDosarId =
          null;

        document
          .getElementById(
            "view-detail"
          )
          .classList.add("hidden");

        if (
          state.activeTab ===
          "calendar"
        ) {
          document
            .getElementById(
              "view-calendar"
            )
            .classList.remove(
              "hidden"
            );

          renderCalendar();

        } else {
          document
            .getElementById(
              "view-list"
            )
            .classList.remove(
              "hidden"
            );
        }

      }
    );

  document
    .querySelectorAll(".tab")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {
          switchTab(
            button.dataset.tab
          );
        }
      );

    });

  document
    .getElementById("cal-prev")
    ?.addEventListener(
      "click",
      () => {

        state.calendarDate =
          new Date(
            state.calendarDate.getFullYear(),
            state.calendarDate.getMonth() - 1,
            1
          );

        state.selectedCalendarDay =
          null;

        renderCalendar();

        document
          .getElementById(
            "cal-day-panel"
          )
          .classList.add("hidden");
      }
    );

  document
    .getElementById("cal-next")
    ?.addEventListener(
      "click",
      () => {

        state.calendarDate =
          new Date(
            state.calendarDate.getFullYear(),
            state.calendarDate.getMonth() + 1,
            1
          );

        state.selectedCalendarDay =
          null;

        renderCalendar();

        document
          .getElementById(
            "cal-day-panel"
          )
          .classList.add("hidden");
      }
    );
}

/* =========================================================
   AUTO REFRESH
   ========================================================= */

/*
   Verificarea din 30 în 30 minute.

   IMPORTANT:
   JavaScript-ul unei pagini web NU poate garanta
   executarea la fiecare 30 minute dacă aplicația este
   închisă sau suspendată de iOS.

   Verificarea reală la 30 minute trebuie făcută de
   server / cron / GitHub Actions / alt serviciu backend.

   Acest interval este util când aplicația este deschisă.
*/

const REFRESH_INTERVAL =
  30 * 60 * 1000;

function startAutoRefresh() {

  setInterval(
    async () => {

      console.log(
        "Verificare automată..."
      );

      await refreshAllDosare();

    },
    REFRESH_INTERVAL
  );
}

/* =========================================================
   PORNIRE APLICAȚIE
   ========================================================= */

async function init() {

  loadState();

  bindEvents();

  renderList();

  updateStandaloneBanner();

  updateNotificationButton();

  await registerServiceWorker();

  if (
    state.activeTab ===
    "calendar"
  ) {
    switchTab("calendar");
  }

  /*
    Verifică imediat dosarele când aplicația
    este deschisă.
  */

  if (state.dosare.length) {
    refreshAllDosare();
  }

  startAutoRefresh();
}

document.addEventListener(
  "DOMContentLoaded",
  init
);
```
