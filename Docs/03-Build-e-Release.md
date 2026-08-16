# 03 — Build e Release

Qui impari a **creare gli installer** e a **pubblicare una nuova versione**. "Build" =
trasformare i file del progetto in un'app installabile.

## 0. Prerequisiti (una volta sola)

Serve **Node.js** (include `npm`). Scaricalo da https://nodejs.org e installalo. Verifica:

```bash
node -v
npm -v
```

Poi, dentro la cartella del progetto, installa le dipendenze di sviluppo:

```bash
npm install
```

> Questo crea la cartella `node_modules/` (pesante, ma è git-ignored: non finisce su git).

## 1. Provare l'app SENZA buildare (modo veloce)

```bash
npm start
```

Apre l'app in una finestra, usando i file così come sono. Ideale mentre sviluppi: modifichi
un HTML, chiudi, rilanci, vedi il risultato.

## 2. Buildare per macOS (in locale)

```bash
npm run build:mac
```

Risultato in `dist/`, per l'architettura del Mac su cui stai buildando:
- `Open E.Hub-<versione>-<arch>.dmg` — l'installer da aprire
- `Open E.Hub-<versione>-<arch>.zip` — versione zippata

dove `<arch>` è `arm64` (Apple Silicon) o `x64` (Intel). L'architettura è **sempre** nel nome:
è il `artifactName` in `package.json` → `build.mac`. Senza, electron-builder lascerebbe
l'artefatto Intel senza suffisso (`Open E.Hub-1.0.0.dmg`) e le due build sarebbero
distinguibili solo a occhio.

Per produrle entrambe da una sola macchina (è quello che fa la CI di release):
```bash
npm run build:mac -- --arm64 --x64
```

> **Perché mac si builda solo in locale?** Un `.dmg` non firmato, se **scaricato** da
> internet, viene marcato da macOS come "danneggiato" (Gatekeeper). Costruendolo in locale e
> aprendolo da lì, non passa da un download, quindi nessun blocco. Vedi
> [doc 05](05-Manutenzione-e-Troubleshooting.md#mac).

## 3. Buildare per Windows

Due strade:

### A) In locale (sul tuo terminale Windows) — consigliata, zero avvisi
Sulla macchina Windows, con Node installato e dentro la cartella del progetto:

```powershell
npm install
npm run build:win
```
Esce in `dist\` l'installer `Open E.Hub Setup <versione>.exe`. Essendo creato in locale, parte
senza l'avviso SmartScreen.

### B) Automatica con GitHub Actions (alla pubblicazione di una release)
È configurata in [.github/workflows/release.yml](../.github/workflows/release.yml). Si avvia
alla **creazione di un tag `vX.Y.Z`** (vedi §5) e builda **sia** l'installer macOS che quello
Windows dai sorgenti, allegandoli alla GitHub Release corrispondente. Le build sono **non
firmate** (vedi §8): la release ne riporta l'avviso.

## 4. Capire le versioni (convenzione Open E.Hub)

C'è **UN SOLO numero di versione per tutta la suite**: i tool non hanno numeri propri. Vive
in [versions.js](../versions.js) (fonte unica), replicato in `package.json` e nel lockfile. I
nomi file sono stabili (`Alfa.html`, `miu.html`, …): la versione **non** sta nel nome.

```
   X . Y . Z
   │   │   └── PATCH — automatico: la modifica tocca SOLO un tool (src/tools/…)
   │   └────── MINOR — automatico: tocca l'hub, il livello condiviso o la shell Electron
   │                   (src/hub, src/shared, main.js)
   └────────── MAJOR — versione maggiore del prodotto: si muove RARO e A MANO,
               per una riscrittura o una rottura di compatibilità
```

La **1.0.0 è la prima release pubblica open source**. Nella storia privata del progetto la X
contava i tool disponibili: convenzione lasciata cadere col rilascio open, dove un numero di
versione che salta da solo a ogni tool nuovo dice poco a chi installa.

X non si alza mai da solo: `release.mjs` calcola solo Y e Z. Per alzarlo:

```bash
npm run bump -- major "nasce il tool <nome>"
```

## 5. Pubblicare una nuova versione (procedura reale, automatica)

Si lavora e si pusha direttamente su `main`. **Versione e tag NON si alzano a mano**: un hook
`pre-push` ([.githooks/pre-push](../.githooks/pre-push)) lancia
[scripts/release.mjs](../scripts/release.mjs) a ogni push su `main`.

```bash
git push origin main
```

`release.mjs` **calcola da solo** major/minor/patch dai prefissi dei commit (`feat`/`fix`/`perf`
→ release; solo `chore`/`refactor`/`test`/`docs` → nessuna release), aggiorna `versions.js` +
`package.json`, crea in automatico un commit `release: Open E.Hub vX.Y.Z` e il **tag annotato**
`vX.Y.Z`, poi **interrompe il push** con un messaggio che chiede di ripeterlo:

```bash
git push origin main   # ora invia anche il commit di release + il tag
```

Il push del tag fa partire [release.yml](../.github/workflows/release.yml): dopo qualche
minuto, su **GitHub → Releases**, la release `vX.Y.Z` ha allegati sia il `.dmg`/`.zip` macOS
che l'`.exe` Windows, pronti da scaricare.

> 💡 **Override esplicito**: `node scripts/release.mjs major|minor|patch` forza il tipo di bump
> (serve solo per la **X** dell'app, che segna il numero di tool e non si alza mai da sola).
> `npm run bump -- <tool> <major|minor|patch> "voce changelog"` resta per bump manuali una tantum.

## 6. Controlli automatici (CI)

Tre pipeline GitHub Actions, con scopi diversi:

| Workflow | Quando parte | Cosa fa |
|---|---|---|
| **CI** ([ci.yml](../.github/workflows/ci.yml)) | ogni push su `main`, e ogni PR | `typecheck` → `lint:css` → `test` → `build:web` (verifica che hub e tool compilino dai sorgenti) |
| **Release** ([release.yml](../.github/workflows/release.yml)) | alla creazione di un tag `vX.Y.Z` (vedi §5) | builda gli installer macOS + Windows e li allega alla GitHub Release |
| **Trivy** ([trivy.yml](../.github/workflows/trivy.yml)) | mensile + manuale | scansione vulnerabilità/segreti (non blocca) |

Fra i test della CI ci sono anche le **guardie della documentazione**
([tests/docs/](../tests/docs/)): se un blocco `AUTO:` è fuori sync con la sua fonte, o un doc cita
un file che non esiste, `npm test` fallisce. La documentazione non può invecchiare in silenzio.

Gli stessi controlli in locale:

```bash
npm run typecheck && npm run lint:css && npm test
```

## 7. Riepilogo comandi

```bash
# sviluppo
npm install            # una volta (e dopo ogni aggiornamento di dipendenze)
npm start              # prova l'app al volo
npm run typecheck      # controllo dei tipi TypeScript (come la CI)
npm test               # test dei motori di calcolo (come la CI)

# build
npm run build:mac      # → dist/*.dmg, *.zip   (in locale, su Mac)
npm run build:win      # → dist/*.exe          (in locale, su Windows)

# release (automatica: push su main, l'hook pre-push crea versione+tag da solo)
git checkout main && git merge dev && git push origin main   # ripetere il push se l'hook lo richiede
```

Tutti i comandi disponibili, generati da [package.json](../package.json):

<!-- AUTO:scripts:npm:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: package.json) — NON editare a mano -->
| Scopo | Comando | Cosa esegue |
|---|---|---|
| Qualità | `npm run typecheck` | `tsc --noEmit` |
| Qualità | `npm run lint:css` | `stylelint "src/tools/**/styles/*.css"` |
| Qualità | `npm run test` | `vitest run` |
| Qualità | `npm run test:watch` | `vitest` |
| Build | `npm run build` | `npm run build:web` |
| Build | `npm run build:web` | `node scripts/build-web.mjs` |
| Build | `npm run build:miu` | `TOOL=miu vite build && node scripts/place-builds.mjs` |
| Build | `npm run build:alfa` | `TOOL=alfa vite build && node scripts/place-builds.mjs` |
| Build | `npm run build:chi` | `TOOL=chi vite build && node scripts/place-builds.mjs` |
| Build | `npm run build:delta` | `TOOL=delta vite build && node scripts/place-builds.mjs` |
| Build | `npm run build:beta` | `TOOL=beta vite build && node scripts/place-builds.mjs` |
| Build | `npm run build:hub` | `TOOL=hub vite build && node scripts/place-builds.mjs` |
| Build | `npm run build:prezzari` | `vite-node scripts/build-prezzari.ts` |
| Build | `npm run build:dxf-glyphs` | `vite-node scripts/build-dxf-glyphs.ts` |
| Build | `npm run build:mac` | `electron-builder --mac` |
| Build | `npm run build:win` | `electron-builder --win` |
| Build | `npm run build:all` | `electron-builder --mac --win` |
| Dati e asset | `npm run validate:dxf` | `python3 scripts/dxf-validate.py` |
| Dati e asset | `npm run bundle:prezzari` | `node scripts/bundle-prezzari.mjs` |
| CLI e batch | `npm run ehub` | `vite-node scripts/cli/ehub.run.ts` |
| Versioni e documentazione | `npm run bump` | `node scripts/bump.mjs` |
| Versioni e documentazione | `npm run release` | `node scripts/release.mjs` |
| Versioni e documentazione | `npm run sync:versions` | `node scripts/bump.mjs --sync` |
| Versioni e documentazione | `npm run sync:readme` | `node scripts/sync-readme.mjs` |
| Versioni e documentazione | `npm run sync:docs` | `vite-node scripts/sync-docs.run.ts` |
| Avvio | `npm run start` | `electron .` |
<!-- AUTO:scripts:npm:END -->

---

## 8. App non firmata

Il `.exe`/dmg desktop è **non firmato** (nessun certificato Apple/Microsoft): è il prezzo di
un progetto open source senza budget per la firma del codice. L'app Electron mostra all'avvio
il toast *"uso interno · build non firmata"* (`UNSIGNED_NOTICE` in
[`src/shared/edition.ts`](../src/shared/edition.ts)); la build servita in browser (`npm run
serve`) non lo mostra. Al primo avvio:
- **macOS**: Gatekeeper segnala l'app come "danneggiata" — Impostazioni di Sistema → Privacy
  e sicurezza → **Apri comunque**.
- **Windows**: SmartScreen avvisa dell'app non riconosciuta — **Ulteriori informazioni → Esegui
  comunque**.

Costruire l'installer in locale (§2-3) evita entrambi gli avvisi, perché non passa da un
download da internet.

### Cosa c'è al posto della firma

Non firmare è legale (la firma è un meccanismo di fiducia di Apple/Microsoft, non un obbligo
di legge), ma lascia l'utente senza un modo per capire se il file che ha scaricato è quello
giusto. Il workflow di release colma il vuoto con due cose, entrambe gratuite:

- **Attestazione di provenienza** (`actions/attest-build-provenance`, Sigstore): lega ogni
  installer al commit e al workflow che l'hanno prodotto. Si verifica con
  `gh attestation verify <file> --repo bbossolo/Open-E.Hub`.
- **`SHA256SUMS-macos.txt` / `SHA256SUMS-windows.txt`** allegati alla release, per il
  controllo di integrità (`shasum -a 256 -c`).

Le attestation richiedono un repository **pubblico**: sui repo privati lo step si salta da sé
(`if: !github.event.repository.private`) invece di far fallire un job che ha già pubblicato
gli installer. Dettagli e istruzioni per chi scarica: [SECURITY.md](../SECURITY.md).

---

➡️ Prossimo: [04 — Aggiungere una Nuova App](04-Aggiungere-una-Nuova-App.md)
