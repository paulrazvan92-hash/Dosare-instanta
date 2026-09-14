# Registrul meu de dosare

Aplicație pentru monitorizarea automată a dosarelor din sistemul ECRIS
(portal.just.ro). Verifică dosarele tale la fiecare 30 de minute și te
anunță prin notificare push când:

- se stabilește un termen nou de judecată (dată + oră);
- se introduce o soluție la un termen deja avut;
- se schimbă stadiul procesual al dosarului;
- apare o cale de atac nouă.

Folosește serviciul web **oficial** al Ministerului Justiției
(`portalquery.just.ro/query.asmx`), documentat public la
https://portal.just.ro/SitePages/acces.aspx — nu se face "scraping" de
pagini HTML.

---

## 1. Ce conține proiectul

```
server.js              — serverul (API + servește aplicația)
src/soapClient.js       — interoghează portalul ECRIS
src/diff.js             — detectează ce s-a schimbat la un dosar
src/scheduler.js        — verificarea automată la 30 minute
src/push.js             — trimite notificările push
src/db.js               — stocare simplă, într-un fișier data/db.json
public/                 — aplicația web (PWA) pe care o deschizi pe iPhone
```

---

## 2. Configurare locală (opțional, doar dacă vrei să testezi pe calculator)

Ai nevoie de [Node.js](https://nodejs.org) instalat (versiunea 18 sau mai nouă).

```bash
npm install
npm run gen-vapid
```

Comanda a doua îți afișează două chei (VAPID). Creează un fișier numit
`.env` în folderul proiectului și lipește acolo ce ți-a afișat, de exemplu:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:adresa-ta@example.com
```

Apoi pornește serverul:

```bash
npm start
```

Deschide `http://localhost:3000` în browser.

---

## 3. Publicare pe internet cu Railway (recomandat, gratuit pentru acest volum)

Ca notificările să funcționeze și ca verificarea la 30 de minute să ruleze
non-stop, aplicația trebuie să stea pe un server care rulează tot timpul —
nu pe calculatorul tău personal. **Railway** e o platformă simplă, cu un
prag gratuit generos.

### Pas 1 — Cont
Intră pe https://railway.app și creează-ți un cont (poți folosi contul de GitHub).

### Pas 2 — Urcă proiectul pe GitHub
1. Creează un cont pe https://github.com dacă nu ai deja.
2. Creează un repository nou (buton "New repository"), de exemplu numit `dosare-monitor`.
3. Urcă folderul acestui proiect în acel repository. Cel mai simplu: pe
   pagina repository-ului, GitHub îți arată opțiunea "uploading an existing
   file" — poți trage direct toate fișierele din proiect acolo (păstrează
   structura de foldere: `src/`, `public/`, etc.).

### Pas 3 — Creează serviciul pe Railway
1. În Railway, apasă **New Project → Deploy from GitHub repo**.
2. Alege repository-ul `dosare-monitor`.
3. Railway detectează automat că e un proiect Node.js și îl pornește.

### Pas 4 — Variabilele de mediu
1. Pe calculatorul tău, rulează local `npm run gen-vapid` (ai nevoie de
   Node.js instalat doar pentru acest pas, o singură dată) — sau cere-mi
   să-ți generez eu cheile aici, în conversație.
2. În Railway, intră pe serviciul tău → tab **Variables** și adaugă:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` = `mailto:adresa-ta@example.com`

### Pas 5 — Volum persistent pentru date
Fără acest pas, lista de dosare se șterge la fiecare redeployment.
1. Pe serviciul tău din Railway → tab **Settings → Volumes → New Volume**.
2. Mount path: `/app/data`
3. Salvează. Railway repornește automat serviciul.

### Pas 6 — Domeniul public
1. Tab **Settings → Networking → Generate Domain**.
2. Railway îți dă un link de tipul `https://dosare-monitor-production.up.railway.app`.

### Pas 7 — Deschide pe iPhone
1. Deschide linkul de la Railway în **Safari** pe iPhone (trebuie Safari,
   nu Chrome, pentru pasul următor).
2. Apasă butonul **Distribuie** (pătratul cu săgeată în sus) → **Adaugă pe
   ecranul principal**.
3. Deschide aplicația de pe ecranul principal (nu din Safari) — abia atunci
   apasă **Activează notificările**, ca să funcționeze corect pe iOS.

---

## 4. Cum adaugi un dosar

Numărul de dosar trebuie să fie în formatul unic ECRIS, de exemplu:
`12345/3/2023`. Îl găsești pe orice citație sau pe portal.just.ro dacă ai
mai căutat dosarul o dată acolo.

Câmpul "Instanță" e opțional — ajută doar dacă există ambiguitate (foarte
rar, pentru că numărul de dosar e practic unic per instanță).

---

## 5. Limitări de care să ții cont

- Notificările push pe iPhone funcționează **doar** dacă ai adăugat
  aplicația pe ecranul principal (cerință impusă de Apple, din iOS 16.4+).
- Portalul ECRIS nu documentează public numele exact al câmpului pentru
  "soluție" — aplicația caută generic orice câmp nou apărut care conține
  cuvinte precum "solutie", "sumar" sau "minuta" în numele lui, ca să nu
  piardă informație chiar dacă denumirea exactă diferă puțin.
- Serviciul e furnizat de Ministerul Justiției "ca atare"; poate avea
  întreruperi ocazionale, caz în care aplicația reîncearcă automat la
  următoarea verificare.
