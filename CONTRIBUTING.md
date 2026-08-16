# Contribuire a Open E.Hub

Grazie per l'interesse. Questa guida è per contributori umani; se stai usando un
assistente AI (Claude Code, Cursor, …) per contribuire, fagli leggere prima
[CLAUDE.md](CLAUDE.md) o [AGENTS.md](AGENTS.md) — coprono i percorsi/comandi concreti
per personalizzare prezzari, cartigli, branding e per aggiungere un tool.

Partecipando accetti il [codice di condotta](CODE_OF_CONDUCT.md). Se quello che hai
trovato è una **vulnerabilità di sicurezza**, non aprire una issue né una PR pubblica:
segui [SECURITY.md](SECURITY.md).

## Setup locale

```bash
git clone <url-del-tuo-fork>
cd Open-E.Hub
npm install
npm start          # rigenera i bundle (build:web) e avvia l'app desktop (Electron)
# oppure, senza Electron:
npm run build:web && npm run serve   # server statico locale su http://localhost:8080
```

Richiede **Node.js 24.15 o superiore** (è la linea LTS su cui gira la CI; c'è un
[`.nvmrc`](.nvmrc), quindi con nvm basta `nvm use`) e npm. Il minimo lo detta `jsdom`, usato
dai test per simulare il DOM: dalla 30 non supporta più Node 20. Tutto il resto (librerie
vendor, font) è già nel repo — la suite è pensata per funzionare offline.

> `npm install` scarica anche SheetJS dal CDN ufficiale `cdn.sheetjs.com` e non dal registry
> npm: dalla 0.20 SheetJS non pubblica più su npm. È l'unica dipendenza fuori registry, ed è
> l'unica ragione per cui il primo `npm install` può fallire pur essendo tutto a posto —
> vedi [Docs/05 §A](Docs/05-Manutenzione-e-Troubleshooting.md#a-le-dipendenze-offline-vendor).

## Prima di aprire una PR

```bash
npm run typecheck     # tsc --noEmit — deve dare 0 errori
npx vitest run          # test unitari dei motori — deve essere tutto verde
npm run lint:css        # stylelint sul contratto UI (vedi CLAUDE.md §6)
npm run build:web       # se hai toccato sorgenti di un tool: rigenera i bundle .html
```

Se hai modificato `src/hub/data/registry.ts`, `src/shared/bus.ts` o
`scripts/docs-manifest.ts`, lancia anche `npm run sync:docs` e committa i doc
rigenerati (i blocchi `<!-- AUTO:...:START/END --> ` in README/Docs).

**Nota sui bundle**: i file `.html` in root (`EHub.html`, `miu.html`, `Delta.html`, …)
sono **artefatti di build, non sorgenti**, e sono gitignored — non vanno committati e non
compaiono nel diff della tua PR. Si rigenerano in locale con `npm run build:web` quando vuoi
provare le tue modifiche nell'app vera; la CI li ricostruisce da sé dai sorgenti a ogni PR
(è quel passo che ti dice se hai rotto la build). Gli installer pronti stanno nelle
[GitHub Releases](https://github.com/bbossolo/Open-E.Hub/releases).

## Convenzioni di commit

Il repo usa messaggi in stile `tipo(ambito): descrizione`, per esempio:

```
feat(miu): aggiunge il parser per il prezzario Puglia
fix(delta): il cartiglio non salvava il layout campi custom
docs(readme): aggiorna l'elenco dei tool
build: aggiorna pdf-lib in vendor/ alla 1.17.2
```

`ambito` è tipicamente il nome del tool (`miu`, `delta`, `beta`, `chi`,
`alfa`, `hub`) o un'area trasversale (`shared`, `docs`, `build`). Preferisci
messaggi che spiegano il **perché** oltre al cosa, quando non è ovvio dal diff.

## Stile del codice

- TypeScript strict (vedi `tsconfig.json`: `noUnusedLocals`, `noUnusedParameters`,
  niente `any` implicito). I motori di dominio (`engine/`) sono **puri**: nessun
  accesso diretto al DOM, testabili da Node/Vitest senza browser.
- Segui il Contratto UI per qualunque markup/CSS nuovo (vedi [CLAUDE.md](CLAUDE.md) §6):
  pulsanti solo `.ehb-btn*`/`.ehb-icon-btn`, colori solo da token CSS
  (`src/shared/ui/tokens.css`), mai un hex inline in un CSS di tool.
- Commenti solo dove il codice non parla da sé (perché una scelta è stata fatta,
  non cosa fa una riga ovvia). Il repo ha una convenzione diffusa di commenti di
  testa sui moduli che spiegano l'architettura del file — seguila per i file nuovi
  sotto `src/shared/` o `engine/`.
- Non introdurre nuove dipendenze CDN/di rete: tutte le librerie esterne vivono in
  `vendor/` (vedi [Docs/05-Manutenzione-e-Troubleshooting.md](Docs/05-Manutenzione-e-Troubleshooting.md)).

## Test

Un tool nuovo o una funzione nuova che tocca lo stato di progetto deve avere test per:
- import/export (round-trip dei dati che maneggia);
- interconnessione con l'hub (bus, `.ehub`) se pubblica/consuma stato condiviso.

Vedi `tests/<area>/` per gli esempi esistenti — un'area per tool più `hub/`, `shared/`,
`integration/`, `docs/`, `web/` (catene di build), `ui/` (coerenza del contratto UI).

## Proporre un tool nuovo

I tool di terze parti sono benvenuti. Il modo di condividerli, oggi, è una **pull request**:
lo strumento entra nel repo e arriva agli altri quando la suite viene ricompilata e
ridistribuita. Non c'è un marketplace da cui scaricarlo, né un modo di installarlo in
un'istanza già buildata — è un limite noto, non una dimenticanza.

**Apri prima una issue.** Non è burocrazia: un tool nuovo va registrato in quattro liste
(`src/hub/data/registry.ts`, `TOOL_INPUT` in `vite.config.ts`, `MAP` in
`scripts/place-builds.mjs`, `TOOLS` in `scripts/build-web.mjs`), e due proposte che arrivano
insieme si pestano esattamente sulle stesse righe. Meglio saperlo prima di scrivere il codice
che dopo il primo conflitto.

Il procedimento completo sta in [Docs/04 — Aggiungere una nuova app](Docs/04-Aggiungere-una-Nuova-App.md).
In sintesi: una cartella `src/tools/<nome>/` con il suo `index.html` (deve funzionare anche
aperto da solo in un browser), il motore puro sotto `engine/`, e una voce nel registry — dove
`srcDir` è obbligatorio, senza non compila.

Cosa ci si aspetta da uno strumento che entra nella suite:

- **offline-first**: nessun backend, nessun login, nessuna chiamata di rete; le librerie
  esterne vivono in `vendor/`;
- **coerente con la suite**: contratto UI, token colore condivisi, accento del tool via
  `data-tool`, e il bus dell'hub se scambia dati con gli altri;
- **testato**, secondo la sezione qui sopra.

La buona notizia è che quasi nulla di tutto questo va ricordato a memoria: le guardie
automatiche scoprono da sé ogni cartella sotto `src/tools/` con un `index.html` e dicono cosa
non torna. Se la CI è verde, il tool rispetta le convenzioni — vale per te come per un
assistente AI a cui hai delegato il lavoro.

## Documentazione

L'indice completo è in [Docs/README.md](Docs/README.md). Se aggiungi un file `.md`
sotto `Docs/`, registralo in `scripts/docs-manifest.ts` — un test
(`tests/docs/index.test.ts`) verifica che ogni doc su disco sia indicizzato e
viceversa.

## Licenza

Contribuendo accetti che il tuo contributo sia distribuito sotto licenza **MIT**
(vedi [LICENSE](LICENSE)), come il resto del progetto.
