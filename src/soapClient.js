// Client pentru serviciul web oficial ECRIS: http://portalquery.just.ro/query.asmx
// Documentatie publica: https://portal.just.ro/SitePages/acces.aspx
'use strict';

const { XMLParser } = require('fast-xml-parser');

const ENDPOINT = 'http://portalquery.just.ro/query.asmx';

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
});

function escapeXml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEnvelope(numarDosar, institutie) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CautareDosare2 xmlns="portalquery.just.ro">
      <numarDosar>${escapeXml(numarDosar)}</numarDosar>
      <obiectDosar></obiectDosar>
      <numeParte></numeParte>
      ${institutie ? `<institutie>${escapeXml(institutie)}</institutie>` : ''}
    </CautareDosare2>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Interogheaza un dosar dupa numarul unic (format: 12345/3/2023).
 * @param {string} numarDosar
 * @param {string} [institutie] optional, restrange cautarea la o singura instanta
 * @returns {Promise<object|null>} obiectul Dosar normalizat, sau null daca nu exista
 */
async function cautaDosar(numarDosar, institutie) {
  const body = buildEnvelope(numarDosar, institutie);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'portalquery.just.ro/CautareDosare2',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Portal ECRIS a raspuns cu status ${res.status}`);
  }

  const text = await res.text();
  const parsed = parser.parse(text);

  const envelope = parsed.Envelope;
  if (!envelope) throw new Error('Raspuns SOAP neasteptat de la portal.just.ro');

  const result =
    envelope.Body &&
    envelope.Body.CautareDosare2Response &&
    envelope.Body.CautareDosare2Response.CautareDosare2Result;

  if (!result || !result.Dosar) return null;

  // Poate fi un singur Dosar (obiect) sau mai multe (array)
  const dosare = Array.isArray(result.Dosar) ? result.Dosar : [result.Dosar];

  // Cautam potrivire exacta pe numarul dosarului (portalul poate intoarce mai multe rezultate apropiate)
  const exact = dosare.find((d) => d && d.numar === numarDosar);
  return normalizeDosar(exact || dosare[0]);
}

function toArray(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

// Curata structura, asigura ca listele (parti, sedinte, caiAtac) sunt mereu array-uri,
// si elimina intrarile goale/nil generate de xsi:nil.
function normalizeDosar(d) {
  if (!d) return null;
  const clean = { ...d };

  clean.parti = toArray(d.parti && d.parti.DosarParte).filter(Boolean);
  clean.sedinte = toArray(d.sedinte && d.sedinte.DosarSedinta).filter(Boolean);
  clean.caiAtac = toArray(d.caiAtac && d.caiAtac.DosarCaleAtac).filter(Boolean);

  // sedintele le sortam cronologic dupa data, daca exista camp `data`
  clean.sedinte.sort((a, b) => {
    const da = a && a.data ? new Date(a.data).getTime() : 0;
    const db_ = b && b.data ? new Date(b.data).getTime() : 0;
    return da - db_;
  });

  return clean;
}

module.exports = { cautaDosar };
