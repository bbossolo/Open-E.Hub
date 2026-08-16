# Open E.Hub

**Open E.Hub** è una suite open source (MIT) di tool per progettazione elettrica e impiantistica, pensata per essere scaricata e usata da uno studio tecnico **interamente in locale**: nessun account, nessun cloud, nessun dato che lascia il computer. Ogni tool è un singolo file HTML autonomo; un file "hub" (`EHub.html`) li scopre e li apre al suo interno.

È una **piattaforma bianca**: arriva senza prezzari, cataloghi o marchi di terzi incorporati — è lo studio che porta i propri dati (prezzari, cartigli, modelli documentali) e la personalizza. Vedi [Licenza](#licenza).

La suite è impacchettata come **app desktop (Electron) per macOS e Windows**, con tutte le librerie incluse in locale ([vendor/](vendor/)) e nessun servizio esterno richiesto a runtime. Resta utilizzabile anche aprendo i singoli HTML in un browser o servendo la web build.

> **In English** — Open E.Hub is an offline-first, MIT-licensed desktop suite (Electron, macOS + Windows) of five tools for Italian electrical/building-services design practices: price-list lookup and bills of quantities, public-works accounting (SAL, measurement books, payment certificates), drawing cover sheets and title blocks, DXF layer remapping, and an admin console. Everything runs locally — no account, no cloud, no network calls at all (enforced by a CSP with no `http:`/`https:` scheme). It ships as a *blank platform*: no price lists, catalogues or third-party branding are bundled — you bring your own data. Documentation, UI and code comments are in **Italian**, since the domain (Italian public-procurement accounting, regional price lists, PriMus/DEI/METEL interchange formats) is Italian-specific.

---

## 🧭 Prima volta? Non sei uno sviluppatore? Inizia qui

Open E.Hub si distribuisce come **codice sorgente**, non come un programma già pronto da
scaricare e installare con un doppio click. Serve un piccolo passaggio di "costruzione"
(**build**) prima di poterlo usare. Non è complicato, ma se non hai mai usato un terminale
queste righe sono per te — se sei del mestiere (sviluppatore/IT), salta pure a
["Come si usa"](#come-si-usa) qui sotto.

### Cosa ti serve
Un Mac o un PC Windows, e [**Node.js**](https://nodejs.org) installato — versione **24.15 o
superiore**: scarica quella indicata come "LTS", installala come un programma qualsiasi
(Avanti, Avanti, Fine).

### I passaggi (con il terminale)
1. Su questa pagina GitHub, in alto, clicca il pulsante verde **"Code" → "Download ZIP"** ed
   estrai la cartella dove preferisci. (In alternativa, se conosci git: `git clone`.)
2. Apri il **Terminale** (macOS: cerca "Terminale" con Spotlight `⌘+Spazio`) o il **Prompt dei
   comandi/PowerShell** (Windows: cercalo nel menu Start), e spostati dentro la cartella appena
   estratta — il modo più semplice è scrivere `cd ` (con lo spazio, senza premere invio) e poi
   **trascinare la cartella** dentro la finestra del terminale: il percorso si scrive da solo.
   Premi invio.
3. Scrivi questo comando e premi invio (va fatto **una sola volta**, installa le librerie —
   richiede una connessione internet solo per questo passaggio):
   ```bash
   npm install
   ```
4. Per **provare subito l'app** senza creare un installer:
   ```bash
   npm start
   ```
   La prima volta impiega qualche secondo in più: `npm start` costruisce da sé i file
   dell'app (i tool sono generati dai sorgenti, non stanno pronti nel repo) e poi apre
   la finestra.
   Per **creare un'app vera e propria** con la sua icona (installer):
   ```bash
   npm run build:mac      # su macOS
   npm run build:win      # su Windows
   ```
   L'installer compare nella cartella `dist/`. Non essendo firmato digitalmente (costa e non
   c'è un'azienda dietro questo progetto), al primo avvio macOS/Windows mostreranno un avviso
   di sicurezza — è normale, vedi [qui come sbloccarlo](Docs/03-Build-e-Release.md#8-app-non-firmata).

### Non hai voglia di usare il terminale? Fatti aiutare da un agente AI
Se hai già un assistente AI per programmazione (**Claude Code**, **Cursor**, **GitHub
Copilot**, ecc.), aprigli semplicemente la cartella del progetto e incollagli questo messaggio:

> Questa è la cartella di "Open E.Hub", un'app Node.js/Electron. Voglio usarla sul mio
> computer. Installa le dipendenze e poi buildala per il mio sistema operativo (macOS o
> Windows), spiegandomi ogni comando che lanci in parole semplici. Se un avviso di sicurezza
> blocca l'app all'apertura, dimmi esattamente come sbloccarla.

L'agente farà tutto al posto tuo — comprese le eventuali istruzioni per sbloccare l'avviso di
sicurezza sul tuo sistema operativo specifico.

### Alternativa senza build: usarlo dentro un browser
Se anche solo `npm install`/`npm start` ti sembrano troppo, puoi comunque provare l'app senza
creare un vero installer: dopo il passo 3, esegui anche `npm run build:web` e poi
`npm run serve`, quindi apri l'indirizzo che compare nel terminale con un browser qualsiasi
(Chrome, Firefox, Safari, Edge). Funziona allo stesso modo, ma va riavviato ogni volta dal
terminale invece di aprirsi come un'app normale.

---

## 📚 Documentazione

Stai decidendo se scaricarlo? Parti da [**Perché Open E.Hub**](Docs/00-Perche-Open-E.Hub.md) —
presentazione, i 5 tool, confronto onesto con una versione customizzata.

Tutto il resto — architettura, guida d'uso, build/release, come aggiungere nuovi tool e
troubleshooting — è in **[Docs/](Docs/)**. Parti da [Docs/README.md](Docs/README.md).

---

## Tool inclusi

<!-- AUTO:tools:list:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->
Strumenti: **5** (Open E.Hub v1.0.1).

- **μ Prezzi** — Prezzari e computo metrico _(stabile)_
- **δ Copertine** — Copertine degli elaborati _(stabile)_
- **β Contabilità** — Contabilità lavori pubblici _(stabile)_
- **χ Refs** — Basi DXF esterne come xref _(stabile)_
- **α Alfa** — Centro di controllo dell'hub _(stabile)_
<!-- AUTO:tools:list:END -->

### μ Prezzi
Consultazione prezzari da file **Excel/XLSX**, con ricerca a parola esatta sempre attiva e un
motore di ricerca "in linguaggio naturale" (riconoscimento sinonimi) pronto ma **a vocabolario
vuoto** — lo studio lo popola nel codice, vedi [00 — Perché Open E.Hub](Docs/00-Perche-Open-E.Hub.md#piattaforma-bianca-come-si-personalizza).  
Permette di caricare uno o più prezzari (portati dall'utente — non inclusi), confrontare prezzi tra archivi diversi, comporre descrizioni per voci di computo e visualizzare il dettaglio di ogni voce in un pannello laterale ridimensionabile. La sidebar è collassabile per guadagnare spazio.

### β Contabilità
Contabilità dei **lavori pubblici** in corso d'opera.  
Dal computo di μ produce libretto delle misure, registro di contabilità, **SAL**, stati di avanzamento e certificati di pagamento, per lavori a misura e a corpo. Redige inoltre i **verbali e le comunicazioni del Direttore dei Lavori** (consegna, sospensione, ripresa).

### δ Copertine
Copertine e frontespizi degli **elaborati** di progetto.  
Prende un template (PDF o immagine) come sfondo, vi sovrappone i campi del cartiglio e, da un elenco di elaborati, genera in un colpo solo uno **ZIP di PDF** — uno per elaborato. Riconosce da sé i campi dei cartigli ricorrenti dello studio; esporta anche in DXF.

### χ Refs
Smista i layer di una base **DXF esterna** (di un collaboratore) sullo standard di studio.  
Riconosce automaticamente i layer di un DXF non tuo e li rimappa sui nomi/colori dello studio, così le planimetrie dei collaboratori si integrano senza doverle ridisegnare a mano.

### α Alfa
Centro di controllo dell'hub, visibile **solo agli amministratori**.  
Gestisce utenti e studi e mostra le statistiche d'uso della suite.

### Versioni correnti

<!-- VERSIONS:START — auto-generato da versions.js (`npm run sync:readme`). NON editare a mano. -->
**Open E.Hub v1.0.1**
<!-- VERSIONS:END -->

> Fonte di verità: [versions.js](versions.js). Lo storico delle modifiche resta nei commit/tag
> git. Questa tabella viene **rigenerata automaticamente** a ogni release — non modificarla a mano.

---

## Come si usa

**Come app desktop (uso normale):** avvia Open E.Hub; il hub rileva da solo i tool e li mostra
nella griglia. Clicca un tool per aprirlo. Vedi la [Guida Utente](Docs/02-Guida-Utente.md).

**In sviluppo / esecuzione locale senza build:** `npm start` (richiede Node.js — vedi [Build e Release](Docs/03-Build-e-Release.md)).

**Nel browser (uso secondario):** gli HTML a root sono file statici; `npm run serve` avvia un
server locale (zero dipendenze, solo `127.0.0.1`) e apre `EHub.html` — aprirlo direttamente da
`file://` non carica i tool per via delle restrizioni CORS dei browser sui moduli caricati via
`fetch`.

---

## Architettura

Tutti i tool comunicano con l'hub tramite `window.postMessage`. Il contratto è tipizzato in
[src/shared/bus.ts](src/shared/bus.ts) — la tabella qui sotto ne è generata:

<!-- AUTO:bus:messages:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/shared/bus.ts) — NON editare a mano -->
**Hub → Tool**

| Messaggio | Dati | Cosa fa |
|---|---|---|
| `hub:set-theme` | `theme`, `palette?` | Push esplicito del tema dal picker dell'hub (il tema resta per-tool, con override locale). |
| `hub:set-palette` | `palette` | Palette di suite (ORTOGONALE al tema): propagata sempre a tutti i tool. |
| `hub:set-font` | `font` | Font di suite (ORTOGONALE a tema/palette): propagato sempre a tutti i tool. |
| `hub:set-text-size` | `size`, `scale?` | Dimensione testo di suite (ORTOGONALE alle altre): propagata sempre a tutti i tool. |
| `hub:set-motion` | `motion` | Riduci animazioni (ORTOGONALE alle altre): propagato sempre a tutti i tool. |
| `hub:set-shadow` | `shadow` | Intensità ombre (ORTOGONALE alle altre): propagata sempre a tutti i tool. |
| `hub:project-state` | `source`, `project` | Risposta a `app:request-state`: lo stato pubblicato da un altro tool (es. il computo di μ letto da β). |
| `hub:collect-state` | — | "Progetto Open E.Hub": l'hub chiede al tool il suo stato pieno serializzabile. |
| `hub:restore-state` | `appId?`, `state` | "Progetto Open E.Hub": l'hub chiede al tool di ripristinare uno stato salvato. |
| `hub:set-company` | `company` | Intestazione azienda per le stampe (null = nessuna, es. admin). |
| `hub:shared-plan` | `plan`, `replay?`, `deleted?` | Planimetria unica di Progetto + geometrie condivise, relayata a tutti i tool. |

**Tool → Hub**

| Messaggio | Dati | Cosa fa |
|---|---|---|
| `app:ready` | — | Il tool ha finito di caricare: l'hub può togliere l'overlay di caricamento. |
| `app:theme` | `theme`, `palette?` | Il tool ha cambiato tema da sé: l'hub allinea l'interfaccia intorno all'iframe. |
| `app:request-state` | `want?` | Il tool chiede lo stato condiviso di un altro tool (`want` = quale). |
| `app:project-update` | `appId`, `project` | Il tool pubblica il proprio stato corrente, così gli altri possono consumarlo. |
| `app:full-state` | `appId`, `state` | Risposta a `hub:collect-state`: stato pieno del tool per il progetto Open E.Hub. |
| `app:shared-plan-update` | `origin`, `dxf?`, `cavidotti?`, `circuiti?`, `scale?`, `deleted?` | Pool UNICO: `cavidotti`/`circuiti` sono UPSERT (per id) nel pool condiviso; `deleted` rimuove per id. |
| `hub:navigate` | `appId` | Il tool chiede all'hub di aprire un altro tool (i "ponti" fra strumenti). |
| `hub:go-home` | — | Il tool chiede all'hub di tornare alla schermata iniziale. |

<!-- AUTO:bus:messages:END -->

> La direzione segue la **sezione** del contratto, non il prefisso del nome:
> `hub:navigate` e `hub:go-home` sono richieste del **tool verso l'hub**.

**Dove vive lo stato.** Le preferenze d'aspetto (tema, palette, font) sono persistite e
ritrasmesse a tutti i frame attivi. Lo **stato di lavoro** invece no: vive in memoria e si
salva esplicitamente nel file **Progetto Open E.Hub** (`.ehub`), raccolto dai tool via
`hub:collect-state` → `app:full-state` e ripristinato con `hub:restore-state`. Così "Nuovo
progetto" azzera davvero. La sessione di login sta in `sessionStorage` (scade chiudendo il
browser e dopo 30 minuti di inattività), mai in `localStorage`.

---

## Struttura del repository

```
Open E.Hub/
├── src/                     # SORGENTI: hub (src/hub/), tool (src/tools/), condiviso (src/shared/)
├── *.html                   # artefatti di build a nome stabile (tabella qui sotto) — non versionati
├── main.js                  # Electron: finestra + menu
├── preload.js               # Electron: bridge nativo (salvataggio file, XREF DXF)
├── package.json             # config + ricette di build
├── scripts/                 # build, release, sincronizzazione dei doc, CLI
├── tests/                   # test dei motori, dei contratti e della documentazione
├── prezzari/                # SOLO la pipeline: nessun prezzario incluso, li importi tu
├── vendor/                  # librerie offline (xlsx, jszip, three, pdf.js, font)
├── assets/                  # icona app
├── .github/workflows/       # CI: typecheck, lint, test, build
└── Docs/                    # documentazione completa
```

Gli HTML a root hanno **nome stabile**: l'hub li scopre per nome esatto e la versione è unica,
in [versions.js](versions.js).

<!-- AUTO:files:root:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->
| File a root (aperto dall'hub) | Sorgente | Strumento |
|---|---|---|
| `EHub.html` | [`src/hub/`](src/hub/) | Open E.Hub — il lanciatore |
| `miu.html` | [`src/tools/miu/`](src/tools/miu/) | μ Prezzi |
| `Delta.html` | [`src/tools/delta/`](src/tools/delta/) | δ Copertine |
| `Beta.html` | [`src/tools/beta/`](src/tools/beta/) | β Contabilità |
| `Chi.html` | [`src/tools/chi/`](src/tools/chi/) | χ Refs |
| `Alfa.html` | [`src/tools/alfa/`](src/tools/alfa/) | α Alfa |

I file a root sono **artefatti di build** (rigenerati da `npm run build:web`): si modifica il sorgente, mai l'HTML a root.
<!-- AUTO:files:root:END -->

Per aggiungere un tool vedi [Docs/04](Docs/04-Aggiungere-una-Nuova-App.md).

---

## Requisiti

- **Uso (app desktop):** macOS o Windows. Nessuna dipendenza esterna: tutto è incluso in locale.
- **Sviluppo/build:** [Node.js](https://nodejs.org). Le librerie esterne (SheetJS/xlsx, JSZip, pdf.js, pdf-lib, fontkit) e i font sono **inclusi in locale** in [vendor/](vendor/), non via CDN — versioni e licenze in [NOTICE.md](NOTICE.md).
- **Uso nel browser:** un browser moderno qualsiasi, servendo gli HTML da un server locale (vedi sopra).

---

## Licenza

Distribuito sotto **licenza MIT** — vedi [LICENSE](LICENSE). Puoi usarlo, modificarlo,
distribuirlo e rivenderlo liberamente, anche a fini commerciali, senza garanzia.

Open E.Hub non include prezzari, cataloghi o marchi di terzi: alcuni nomi di formati (es.
METEL, DEI) sono citati solo a fini di interoperabilità — vedi [NOTICE.md](NOTICE.md) per
le librerie di terze parti incluse in [vendor/](vendor/).

---

## Contribuire, e segnalare

Le pull request sono benvenute: percorsi, comandi e regole della casa stanno in
[CONTRIBUTING.md](CONTRIBUTING.md). La partecipazione segue il
[codice di condotta](CODE_OF_CONDUCT.md).

Hai trovato una **vulnerabilità**? Non aprire una issue pubblica: segui
[SECURITY.md](SECURITY.md), che spiega anche com'è difesa la suite (nessuna rete, renderer
isolato, PDF di terzi trattati come non fidati).
