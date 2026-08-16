# 05 — Manutenzione e Troubleshooting

Tutto ciò che serve per **tenere in salute** il progetto e **risolvere** i problemi più comuni.

---

## A. Le dipendenze offline (`vendor/`)

Le librerie usate dai tool (Excel, 3D, PDF, font) sono salvate in `vendor/` per funzionare
**senza internet**. Negli HTML i riferimenti puntano lì, non ai CDN.

| File in `vendor/` | Libreria | Usata da |
|---|---|---|
| `xlsx.full.min.js` | SheetJS xlsx 0.20.3 (Excel) | μ Prezzi, β Contabilità, δ Copertine |
| `jszip.min.js` | JSZip 3.10.1 (zip) | μ Prezzi, β Contabilità, δ Copertine |
| `pdf.min.js` + `pdf.worker.min.js` | pdf.js 3.11.174 (lettura PDF) | μ Prezzi, δ Copertine |
| `pdf-lib.min.js` | pdf-lib 1.17.x (generazione PDF) | δ Copertine |
| `fontkit.min.js` | fontkit 1.1.x (metriche font per l'export PDF) | δ Copertine |
| `fonts.css` + `fonts/*.woff2` | Inter + JetBrains Mono | tutti |

Il caricamento passa da [src/shared/vendor.ts](../src/shared/vendor.ts) (`loadXLSX`,
`loadJSZip`, `loadPDF`, `loadPdfLib`, `loadFontkit`): gli script restano **file esterni**
caricati a runtime, non inglobati nel bundle singlefile, ed è lì che si vede chi carica cosa.

> Questa tabella e [NOTICE.md](../NOTICE.md) devono restare d'accordo: NOTICE è la fonte
> legale (licenza + versione ridistribuita), qui c'è il taglio operativo (chi la usa).
> Se aggiorni una libreria, aggiorna **entrambi**.

### Aggiornare una libreria
1. Scarica la nuova versione **dal sito ufficiale della libreria** nella stessa posizione.
   Non dare per scontato che stia su un CDN generico: SheetJS, per esempio, ha lasciato npm
   e cdnjs e si prende solo da `cdn.sheetjs.com` (vedi il riquadro qui sotto).
2. Se il **nome file** resta uguale, non devi toccare gli HTML. Se cambia, aggiorna i tag
   `<script src="vendor/…">` nei file che la usano.
3. Aggiorna versione e licenza in [NOTICE.md](../NOTICE.md) e nella tabella qui sopra.
4. Prova con `npm start` che tutto funzioni ancora, poi `npx vitest run`.

> **SheetJS (`xlsx`) non viene dal registry npm.** In [package.json](../package.json) è
> pinnata all'URL del tarball ufficiale (`https://cdn.sheetjs.com/xlsx-0.20.3/…`), perché
> dalla 0.20 SheetJS non pubblica più su npm. Due conseguenze pratiche:
> `npm ci` — quindi anche la CI e il primo `npm install` di un contributore — dipende
> dall'uptime di quel CDN; e né `npm audit` né Dependabot vedono quel pacchetto, quindi gli
> avvisi di sicurezza su SheetJS vanno seguiti a mano dal
> [CHANGELOG upstream](https://cdn.sheetjs.com/). Vale sia per la copia in `vendor/` (che
> l'app spedisce) sia per la dipendenza di build usata dagli script sui prezzari.

### Regola d'oro per i nuovi tool
**Mai** lasciare riferimenti a CDN (`https://…`) negli HTML: l'app deve girare offline. Scarica
la libreria in `vendor/` e punta lì. Per verificare che non sia rimasto niente di esterno:
```bash
grep -rnE 'https?://(cdnjs|fonts\.googleapis|fonts\.gstatic|unpkg|jsdelivr)' *.html
# non deve stampare nulla
```

> Attenzione: alcune librerie vengono caricate **dinamicamente** via JavaScript (un
> `sc.src = 'https://…'` iniettato a runtime), quindi il grep sopra potrebbe non bastare. Cerca anche:
> ```bash
> grep -rnE "\.src *= *['\"]https?://" *.html
> ```

---

## B. Aggiornare Electron

La versione di Electron è in [package.json](../package.json) (`devDependencies`). Per aggiornarla:
```bash
npm install electron@latest --save-dev
npm start    # verifica che l'app parta ancora
```
Poi ricostruisci gli installer (doc 03). Aggiornamenti maggiori di Electron possono cambiare i
default di sicurezza: se il hub smette di aprire i tool, ricontrolla `webPreferences` in
[main.js](../main.js) (`contextIsolation`, `sandbox`, `nodeIntegration`) — vedi
[doc 01 §6](01-Panoramica-e-Architettura.md#6-il-pezzo-magico-preloadjs-perché-esiste).

---

## C. La pipeline di build automatica (CI)

File: [.github/workflows/release.yml](../.github/workflows/release.yml).
- Si attiva su **push di un tag `v*`** (creato in automatico da `scripts/release.mjs`, doc 03 §5).
- Builda **sia macOS che Windows** (job separati, `macos-latest`/`windows-latest`) e allega
  gli installer alla **GitHub Release** del tag.
- Le build restano **non firmate** (§E): la release ne riporta l'avviso.

### Se la build CI fallisce
- **403 / "Resource not accessible by integration"** allo step Build → electron-builder sta
  provando a pubblicare una release. Assicurati che il comando abbia `--publish never` e che
  non sia impostata la variabile `GH_TOKEN`. (È già a posto nel workflow attuale.)
- **"Electron failed to install correctly"** → il download del binario Electron non è andato a
  buon fine; di solito basta rilanciare la run. (Vedi anche §F, è lo stesso problema visto in
  locale.)

---

## D. Capire i numeri di versione (riassunto)

La **fonte di verità** di tutte le versioni è [versions.js](../versions.js) (rigenerato da
`npm run bump` / dalla release automatica). Da lì derivano `package.json`, la tabella in
[README.md](../README.md) (via `npm run sync:readme`) e il changelog dell'hub.

Ci sono **due** numerazioni indipendenti, non confonderle:
- **App** → `versions.js` (`app.version`) → `X.Y.Z` (es. `3.6.0`), sincronizzata su `package.json`. Decide il nome dei file in `dist/`.
- **Versione** → [versions.js](../versions.js): UNA per tutta la suite (i tool non hanno numeri propri dalla v4). I nomi file sono stabili (`Alfa.html`, `miu.html`, …). Decide cosa mostra il hub.

---

## E. Blocchi all'avvio dell'app (firma digitale)

L'app **non è firmata** (la firma richiede abbonamenti a pagamento), quindi i sistemi
operativi avvisano l'utente. **Non è un difetto del codice.**

<a id="mac"></a>
### 🍎 macOS — "Open E.Hub.app è danneggiato e non può essere aperto"
Succede quando scarichi un `.dmg`/`.zip` non firmato: macOS gli mette la "quarantena".

**Soluzioni:**
1. **Build locale** (la più pulita): `npm run build:mac`, poi apri il `.app` da `dist/` — non
   essendo scaricato, non ha quarantena.
2. **Togliere la quarantena** a un'app scaricata: copiala in `/Applications`, poi:
   ```bash
   xattr -cr "/Applications/Open E.Hub.app"
   open "/Applications/Open E.Hub.app"
   ```

<a id="windows"></a>
### 🪟 Windows — SmartScreen "Windows ha protetto il PC"
Avviso (non blocco) per app non firmate scaricate.

**Soluzioni:**
1. **Esegui comunque:** clicca *Ulteriori informazioni → Esegui comunque*.
2. **Sblocca il file** prima di aprirlo (PowerShell, nella cartella dell'`.exe`):
   ```powershell
   Unblock-File ".\Open E.Hub Setup 1.2.0.exe"
   ```
3. **Build locale** sul terminale Windows (doc 03 §3A): nessun avviso.

### Vuoi eliminare gli avvisi per sempre?
Serve la firma + notarizzazione:
- **macOS:** Apple Developer ID (account a pagamento) → si configura `electron-builder` per
  firmare e notarizzare.
- **Windows:** certificato di code-signing.

---

## F. Problemi di ambiente in locale (storici, utili da sapere)

Durante il setup iniziale, su questo Mac sono emersi tre intoppi **non del progetto** ma
dell'ambiente. Documentati qui per non riscoprirli da capo:

1. **`npm` blocca i postinstall ("allow-scripts")** → il binario di Electron non veniva
   scaricato (`npm start` dava "Electron failed to install correctly"). Rimedio: eseguire il
   postinstall manualmente o approvare lo script.
2. **`extract-zip` di Electron sbagliava l'estrazione** del framework (symlink) su macOS,
   lasciando un binario incompleto. Rimedio usato: estrarre con `ditto` il pacchetto da
   `~/Library/Caches/electron/.../electron-*.zip` dentro `node_modules/electron/dist`.
3. **`ELECTRON_RUN_AS_NODE=1`** impostata dall'ambiente (VS Code) impediva alla GUI di
   avviarsi. Rimedio: lanciare con `env -u ELECTRON_RUN_AS_NODE npm start`.

> Questi tre punti riguardano una specifica macchina/ambiente: su un'installazione Node pulita
> (e in CI) di norma non si presentano.

---

## G. Checklist "prima di rilasciare"

- [ ] `npm start` apre l'app e tutti i tool funzionano
- [ ] Nessun riferimento a CDN negli HTML (vedi §A)
- [ ] Versione aggiornata in `package.json`
- [ ] Modifiche committate su `dev` e pushate
- [ ] `dev` mergiato in `main`
- [ ] Tag `vX.Y.Z` creato e pushato (avvia la build Windows)
- [ ] `.dmg` mac buildato in locale (`npm run build:mac`)
- [ ] Artifact Windows scaricato da Actions e testato

---

⬅️ Torna all'[indice della documentazione](README.md)
