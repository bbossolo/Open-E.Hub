# 04 — Aggiungere una Nuova App

Vuoi mettere un nuovo strumento nella suite (es. "γ Quadri", un calcolatore di quadri
elettrici)? Bastano pochi passi. La parte bella: **non devi toccare Electron**.

## Idea di fondo (ELI5)

Oggi i tool **non** sono HTML scritti a mano: si **sviluppano in `src/`** (TypeScript + CSS +
markup) e un **build** (Vite) genera l'HTML self-contained a nome **stabile** in root
(`Alfa.html`, `miu.html`, …). Un nuovo tool è quindi:
1. una **cartella sorgente** `src/tools/<tool>/` con il suo `index.html` + `main` + stili;
2. il tool aggiunto alle liste di build (vedi la **checklist** in fondo: sono cinque);
3. una **voce** nel registry del hub (`src/hub/data/registry.ts`), che punta al file HTML buildato
   e dichiara la cartella sorgente in `srcDir`.

Il hub fa il resto: trova il file, mostra la card, lo apre. La **versione** non sta nel nome file
ma in [versions.js](../versions.js) (fonte unica, vedi doc 03 §4).

## Passo 1 — Crea il sorgente del tool

Crea `src/tools/<tool>/` sul modello di uno esistente (es. `src/tools/miu/`):

```
src/tools/quadri/
  index.html        ← markup (deve funzionare anche aperto da solo nel browser)
  main.ts | main.js ← logica / wiring (modulo ES)
  styles/quadri.css ← CSS del tool
  data/  engine/    ← (consigliato) dati tipizzati + motore PURO testabile
```

Il **file HTML prodotto dal build** avrà un **nome stabile, senza versione**:

```
src/tools/quadri/  ──(vite build)──▶  Quadri.html   (in root)
```

### Convenzioni utili per il sorgente del tool
- Linka i **token condivisi** (`src/shared/ui/tokens.css`) e imposta `data-tool="quadri"`
  sull'`<html>` per l'accento dedicato; `data-theme` per chiaro/scuro.
- Per le librerie esterne, **usa i file in `vendor/`**, non i CDN (vedi doc 05). Esempio:
  ```html
  <script src="vendor/xlsx.full.min.js"></script>
  <link href="vendor/fonts.css" rel="stylesheet">
  ```
  I percorsi `vendor/...` restano esterni al singlefile e si risolvono rispetto alla cartella
  dell'app (offline invariato).

## Passo 2 — Aggiungi il tool al build

In [scripts/build-web.mjs](../scripts/build-web.mjs) aggiungi il tool all'array `TOOLS`:

```js
const TOOLS = ['phi', 'miu', 'lambda', 'hub', 'quadri']
```

(e, se vuoi uno script dedicato, una riga `"build:quadri": "TOOL=quadri vite build && node
scripts/place-builds.mjs"` in `package.json`, sul modello degli altri.) Il cutover
(`place-builds.mjs`) scrive l'HTML stabile in root.

## Passo 3 — Registra il tool nel hub

Apri [src/hub/data/registry.ts](../src/hub/data/registry.ts), trova `export const APP_REGISTRY`
e aggiungi una voce:

```ts
{
  id:      "quadri",                       // unico, minuscolo, senza spazi
  name:    "γ Quadri",                     // nome mostrato sulla card
  tagline: "Dimensionamento quadri elettrici",
  file:    "Quadri.html",                  // ← nome file STABILE prodotto dal build
  logoType:"default",                      // 'miu' | 'phi' | 'lc' | 'default' (vedi sotto)
  tags:    ["quadri","elettrico","calcolo"], // parole chiave per la ricerca
  status:  "beta"                          // 'stable' | 'beta'
}
```

### Campi spiegati
| Campo | Obbligatorio | Cosa fa |
|---|---|---|
| `id` | ✅ | Identificatore interno unico. Usato anche nei messaggi (`hub:navigate`). |
| `name` | ✅ | Titolo sulla card. |
| `tagline` | ✅ | Sottotitolo descrittivo. |
| `file` | ✅ | **Nome file stabile** prodotto dal build. Il hub verifica che sia presente in cartella. |
| `logoType` | ✅ | Stile dell'icona: `miu`→μ, `alfa`→α, `beta`→β, `delta`→δ, `chi`→χ, qualsiasi altro→◇ |
| `tags` | consigliato | Parole chiave per la barra di ricerca. |
| `status` | consigliato | `stable` o `beta` (badge sulla card). |
| `note` | opzionale | Nota extra, es. `{ icon:"miu", text:"Integra con μ Prezzi", beta:true }` |

### Nuova icona personalizzata?
`logoType` gestisce solo gli stili già previsti. Per aggiungerne uno nuovo, modifica la
funzione `logoHTML(app, cls)` in [src/hub/main.js](../src/hub/main.js) aggiungendo un ramo:
```js
if (type === 'quadri') return `<div class="${cls}">γ</div>`;
```

## Passo 4 — Builda e provalo

```bash
npm run build:web     # builda tutti i tool + hub (genera gli HTML stabili in root)
npm start             # apre l'app
```
Dovresti vedere la nuova card nel hub. Cliccala: il tool si apre nell'iframe. Se non appare,
vedi "Problemi comuni" qui sotto.

## Passo 5 (opzionale) — Integrazione col bus di messaggi

Se vuoi che il tuo tool **comunichi** col hub o con gli altri tool, usa `postMessage`. Il
contratto completo è nel [doc 01 §7](01-Panoramica-e-Architettura.md#7-come-i-tool-parlano-tra-loro-bus-di-messaggi).
I due casi più utili:

**a) Reagire al cambio tema** (consigliato per ogni tool):
```js
window.addEventListener('message', function (ev) {
  var m = ev.data;
  if (m && m.type === 'hub:set-theme' && m.theme) {
    document.documentElement.setAttribute('data-theme', m.theme);
  }
});
```

**b) Dire al hub "sono pronto"** (nasconde l'overlay di caricamento):
```js
window.parent.postMessage({ type: 'app:ready' }, '*');
```

**c) Aprire un altro tool dal tuo:**
```js
window.parent.postMessage({ type: 'hub:navigate', appId: 'miu-price-list' }, '*');
```

## Passo 6 — Versionare e rilasciare

Il **nome file resta stabile** (`Quadri.html`): aggiornare il tool = modificarne il sorgente e
ribuildare, non rinominare. La versione è **una sola per tutta la suite** e si alza da sola alla release su `main`
(vedi doc 03 §4-5). Un tool nuovo è però un cambio di **identità del prodotto**: la major (X)
si alza a mano, una volta, con `npm run bump -- major "nasce il tool <nome>"`.

Quando sei pronto a distribuire, alza la versione dell'**app** e fai un tag: vedi
[doc 03 §5](03-Build-e-Release.md#5-pubblicare-una-nuova-versione-procedura-completa).

## I documenti si aggiornano da soli

Il **registry** ([src/hub/data/registry.ts](../src/hub/data/registry.ts)) è la **fonte unica** del
catalogo tool (nome, tagline, stato, categoria, integrazioni `notes`). I blocchi marcati
`<!-- AUTO:tools:… -->` / `<!-- AUTO:flow:… -->` nei doc (README, [01](01-Panoramica-e-Architettura.md),
[02](02-Guida-Utente.md)) sono **rigenerati** da
[scripts/sync-docs.ts](../scripts/sync-docs.ts):

- **In automatico** a ogni release su `main` (lo chiama `scripts/release.mjs`).
- **A mano** quando vuoi: `npm run sync:docs`.
- **Garanzia anti-drift**: il test [tests/docs/docs-in-sync.test.ts](../tests/docs/docs-in-sync.test.ts)
  (parte di `npm test` → `npm run build`) **fallisce** se un blocco AUTO è disallineato dal registry.

Quindi, quando aggiungi/modifichi un tool nel registry, **non serve editare i doc a mano**: lancia
`npm run sync:docs` (o lascia fare alla release). Non toccare il testo fra i marker `AUTO:…:START/END`.

## Checklist — un tool nuovo che non lascia indietro niente

Le liste che devono conoscere il tool sono quattro, e in passato dimenticarne una ha prodotto bug
scoperti solo in produzione (un tool assente dalla home, un altro che dava 404). Oggi ognuna ha la sua
guardia, ma l'ordine giusto è questo:

- [ ] **Sorgente** `src/tools/<tool>/index.html` + `main` + `styles/`.
- [ ] **Registry** ([src/hub/data/registry.ts](../src/hub/data/registry.ts)): voce con `file` (nome
      a root) e **`srcDir`** (la cartella appena creata). `srcDir` è obbligatorio: senza, non compila.
- [ ] **[vite.config.ts](../vite.config.ts)** → `TOOL_INPUT`, per compilarlo.
- [ ] **[scripts/place-builds.mjs](../scripts/place-builds.mjs)** → copia dell'artefatto a root.
- [ ] **[scripts/build-web.mjs](../scripts/build-web.mjs)** → `TOOLS`, build web/desktop.
- [ ] *(facoltativo)* **tour guidato** in `src/tools/<tool>/data/tour.ts`, registrato in `TOURS`
      dentro [scripts/sync-docs.ts](../scripts/sync-docs.ts) → compare da solo nella Guida Utente.
- [ ] **`npm run sync:docs`** → README e Docs si riallineano da soli.
- [ ] **`npm test`** → [tests/web/deploy-completo.test.ts](../tests/web/deploy-completo.test.ts)
      verifica che nessuna delle catene di build sia rimasta indietro.

## La regola generale: una fonte di verità per fatto

Prima di scrivere un fatto in un documento, chiediti **dove vive davvero**:

| Fatto | Fonte di verità | Come arriva nei doc |
|---|---|---|
| Catalogo tool, cartelle, stato beta | [registry.ts](../src/hub/data/registry.ts) | `AUTO:tools:*`, `AUTO:files:root`, `AUTO:flow:_` |
| Messaggi hub↔tool | [bus.ts](../src/shared/bus.ts) | `AUTO:bus:messages` |
| Comandi disponibili | [package.json](../package.json) | `AUTO:scripts:npm` |
| Moduli condivisi | commenti di testa in [src/shared/](../src/shared/) | `AUTO:shared:layer` |
| Passi del tour | `data/tour.ts` | `AUTO:guide:<tool>`, `AUTO:tours:coverage` |
| Elenco dei documenti | [scripts/docs-manifest.ts](../scripts/docs-manifest.ts) | `AUTO:docs:index` |

Se un fatto non è in questa tabella e lo stai scrivendo a mano, è **destinato a divergere**: o lo
si genera, o lo si presidia con un test in [tests/docs/](../tests/docs/).

## Problemi comuni

| Sintomo | Causa probabile | Rimedio |
|---|---|---|
| La card non appare | `file` nel registry non combacia con l'HTML buildato in root | Controlla che `file:` sia **esattamente** il nome prodotto dal build |
| `npm test` fallisce su `docs-in-sync` | Hai cambiato il registry ma non i doc | Lancia `npm run sync:docs` e ri-committa |
| Il tool non viene buildato | Tool assente da `TOOLS` in `build-web.mjs` | Aggiungilo all'array (Passo 2) e rilancia `npm run build:web` |
| Il tool si apre ma è "spoglio" / errori | Usa CDN invece di `vendor/` | Sostituisci i link esterni con quelli locali (doc 05) |
| Icona sbagliata | `logoType` non riconosciuto | Usa un `logoType` già gestito (`miu`, `pi`, `lc`, `gamma`, …) o aggiungi un ramo in `logoHTML` |
| `sync:docs` dice «registry incoerente col filesystem» | `srcDir` non combacia con la cartella vera | Correggi `srcDir` nel registry |

---

➡️ Prossimo: [05 — Manutenzione e Troubleshooting](05-Manutenzione-e-Troubleshooting.md)
