# 📚 Documentazione Open E.Hub

Questa cartella contiene **tutto il contesto del progetto**: com'è fatto, come si usa,
come si aggiorna e come si aggiungono nuove app. Se torni sul progetto fra sei mesi (o
se qualcun altro ci mette mano), parti da qui.

## Indice

<!-- AUTO:docs:index:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: scripts/docs-manifest.ts) — NON editare a mano -->
| Doc | A cosa serve | Quando leggerlo |
|---|---|---|
| [00 — Perché Open E.Hub](00-Perche-Open-E.Hub.md) | Pagina di presentazione: perché open source, i 5 strumenti, confronto onesto con una versione customizzata | Per chi sta decidendo se scaricare Open E.Hub |
| [01 — Panoramica e Architettura](01-Panoramica-e-Architettura.md) | Cos'è Open E.Hub, come sono incastrati i pezzi e **perché** sono fatti così | Per capire il "big picture" |
| [02 — Guida Utente (ELI5)](02-Guida-Utente.md) | Come usare l'app tutti i giorni, spiegato semplice | Uso quotidiano |
| [03 — Build e Release](03-Build-e-Release.md) | Come creare gli installer macOS/Windows, versioni, tag, CI | Quando vuoi distribuire una nuova versione |
| [04 — Aggiungere una Nuova App](04-Aggiungere-una-Nuova-App.md) | Tutorial passo-passo per inserire un nuovo tool nella suite | Quando crei un nuovo strumento |
| [05 — Manutenzione e Troubleshooting](05-Manutenzione-e-Troubleshooting.md) | Aggiornare librerie, errori comuni, blocchi macOS/Windows | Quando qualcosa non va |
<!-- AUTO:docs:index:END -->

## TL;DR in 30 secondi

Open E.Hub è una **suite di strumenti** per illuminotecnica e impiantistica. Ogni strumento
è un **singolo file HTML** autonomo a nome stabile (es. `Alfa.html`), generato dal build a
partire da `src/tools/`. Un file "hub" (`EHub.html`) fa da menu/lanciatore:
scopre gli altri tool e li apre dentro di sé.

Tutto questo è **impacchettato in un'app desktop** (Electron) per macOS e Windows, così
gira come un programma normale, anche **offline**. La stessa base gira anche come build web
statica.

```
Doppio click su Open E.Hub  →  si apre il hub  →  scegli un tool  →  ci lavori
```

- **Aggiungere un tool** = creare un sorgente in `src/tools/` + una riga nel registry. Vedi doc 04.
- **Nuova versione** = cambiare un numero + creare un tag git. Vedi doc 03.
- **Non funziona** = vedi doc 05.

## Una fonte di verità per fatto

La regola che tiene in piedi questa documentazione: **ogni fatto ha un solo posto dove
è scritto**, e i documenti lo leggono da lì invece di ricopiarlo.

| Fatto | Fonte di verità |
|---|---|
| Catalogo dei tool, cartelle sorgente, stato beta/stabile | [src/hub/data/registry.ts](../src/hub/data/registry.ts) |
| Messaggi scambiati fra hub e tool | [src/shared/bus.ts](../src/shared/bus.ts) |
| Comandi disponibili | [package.json](../package.json) |
| Numero di versione | [versions.js](../versions.js) |
| Elenco dei documenti | [scripts/docs-manifest.ts](../scripts/docs-manifest.ts) |

Le parti di questi documenti racchiuse fra marker `<!-- AUTO:…:START -->` e
`<!-- AUTO:…:END -->` sono **generate** da quelle fonti con `npm run sync:docs`:
non vanno modificate a mano — la modifica verrebbe sovrascritta, e nel frattempo
[tests/docs/](../tests/docs/) fa fallire `npm test` se un blocco è fuori sync.
