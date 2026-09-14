// Compara starea veche (snapshot salvat) cu starea noua (proaspat preluata de la portal)
// si genereaza o lista de evenimente lizibile de om.
'use strict';

function fmtData(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function sedintaKey(s) {
  // cheie de potrivire intre termene vechi/noi: data (fara ora, ca sa reziste
  // la reformatari minore) - o sedinta noua la aceeasi data e f. improbabila
  const d = s && s.data ? new Date(s.data).toISOString().slice(0, 10) : 'necunoscuta';
  return d;
}

// Compara doua obiecte "plate" (fara array-uri) si intoarce campurile diferite
function diffFields(oldObj, newObj, ignore = []) {
  const changes = [];
  const keys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of keys) {
    if (ignore.includes(key)) continue;
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;
    if (Array.isArray(oldVal) || Array.isArray(newVal) || typeof oldVal === 'object' || typeof newVal === 'object') continue;
    const oldStr = oldVal === undefined || oldVal === null ? '' : String(oldVal).trim();
    const newStr = newVal === undefined || newVal === null ? '' : String(newVal).trim();
    if (oldStr !== newStr) {
      changes.push({ field: key, oldVal: oldStr, newVal: newStr });
    }
  }
  return changes;
}

const FIELD_LABELS = {
  stadiuProcesualNume: 'Stadiul procesual',
  stadiuProcesual: 'Stadiul procesual',
  obiect: 'Obiectul dosarului',
  categorieCazNume: 'Categoria cazului',
  departament: 'Secția / departamentul',
};

/**
 * @returns {Array<{type: string, message: string}>}
 */
function compareDosare(oldSnap, newSnap) {
  const events = [];
  if (!newSnap) return events;

  if (!oldSnap) {
    // prima preluare - doar stabilim baseline, fara notificare de "schimbare"
    return events;
  }

  // 1. Schimbari pe campurile principale ale dosarului
  const mainDiffs = diffFields(oldSnap, newSnap, [
    'parti', 'sedinte', 'caiAtac', 'dataModificare',
  ]);
  for (const c of mainDiffs) {
    if (!c.newVal) continue; // ignoram campuri care au disparut/gol
    const label = FIELD_LABELS[c.field];
    if (!label) continue; // ignoram campuri tehnice necunoscute la nivel principal
    if (c.field.startsWith('stadiuProcesual')) {
      events.push({
        type: 'stadiu',
        message: `Stadiul procesual s-a schimbat: "${c.oldVal || '—'}" → "${c.newVal}"`,
      });
    } else {
      events.push({
        type: 'info',
        message: `${label} a fost actualizat: "${c.oldVal || '—'}" → "${c.newVal}"`,
      });
    }
  }

  // 2. Termene (sedinte) - noi sau modificate
  const oldSedinte = Array.isArray(oldSnap.sedinte) ? oldSnap.sedinte : [];
  const newSedinte = Array.isArray(newSnap.sedinte) ? newSnap.sedinte : [];

  const oldByKey = new Map(oldSedinte.map((s) => [sedintaKey(s), s]));

  for (const s of newSedinte) {
    const key = sedintaKey(s);
    const old = oldByKey.get(key);
    const dataFormatata = fmtData(s.data);
    const ora = s.ora ? ` ora ${s.ora}` : '';
    const complet = s.complet ? ` (complet: ${s.complet})` : '';

    if (!old) {
      // termen complet nou
      events.push({
        type: 'termen_nou',
        message: `Termen nou stabilit: ${dataFormatata}${ora}${complet}`,
      });
      continue;
    }

    // termenul exista deja - verificam daca s-au completat campuri noi
    // (de ex. solutia, dupa ce s-a desfasurat sedinta)
    const fieldDiffs = diffFields(old, s, ['data']);
    for (const fd of fieldDiffs) {
      if (!fd.newVal) continue;
      const lower = fd.field.toLowerCase();
      if (lower.includes('solutie') || lower.includes('sumar') || lower.includes('minuta')) {
        events.push({
          type: 'solutie',
          message: `Soluție introdusă pentru termenul din ${dataFormatata}: ${fd.newVal}`,
        });
      } else if (lower === 'ora') {
        events.push({
          type: 'termen_modificat',
          message: `Ora ședinței din ${dataFormatata} a fost actualizată: ${fd.oldVal || '—'} → ${fd.newVal}`,
        });
      } else if (!fd.oldVal) {
        // camp nou completat, nume necunoscut - il aratam generic ca sa nu pierdem informatie
        events.push({
          type: 'info',
          message: `Informație nouă pentru termenul din ${dataFormatata} (${fd.field}): ${fd.newVal}`,
        });
      }
    }
  }

  // 3. Cai de atac noi
  const oldCai = Array.isArray(oldSnap.caiAtac) ? oldSnap.caiAtac : [];
  const newCai = Array.isArray(newSnap.caiAtac) ? newSnap.caiAtac : [];
  if (newCai.length > oldCai.length) {
    const added = newCai.slice(oldCai.length);
    for (const c of added) {
      const parts = Object.values(c || {}).filter(Boolean).join(' - ');
      events.push({ type: 'cale_atac', message: `Cale de atac nouă înregistrată: ${parts || 'detalii pe portal'}` });
    }
  }

  return events;
}

module.exports = { compareDosare, fmtData };
