/**
 * INDICE della documentazione Open E.Hub — fonte unica di `Docs/README.md`.
 *
 * Ogni file `.md` sotto `Docs/` deve comparire qui, e ogni voce qui deve esistere
 * su disco: la biiezione è verificata da [tests/docs/index.test.ts]. È il modo per
 * cui un doc nuovo non può restare fuori dall'indice e un doc cancellato non può
 * restare linkato — la deriva diventa un test rosso, non una scoperta a caso.
 *
 * Solo Node (script e test): non importarlo mai dal browser.
 */

export type DocStato = 'vivo'

export interface DocEntry {
  /** Path relativo a `Docs/` (es. '01-Panoramica-e-Architettura.md', 'archivio/06-….md'). */
  file: string
  /** Titolo mostrato nell'indice. */
  title: string
  /** A cosa serve. */
  purpose: string
  /** Quando leggerlo (vuoto per gli archiviati). */
  when: string
  stato: DocStato
}

/**
 * Ruolo delle sottocartelle di `src/shared/` che NON hanno un `index.ts` con
 * commento di testa (da cui il generatore prende la descrizione da sé). Se ne
 * nasce una senza né l'uno né l'altro, `npm run sync:docs` fallisce: nessuna
 * area condivisa può restare senza spiegazione.
 */
export const SHARED_AREAS: Record<string, string> = {
  data: 'Dati condivisi: database cavi CPR',
  ui: 'Design system: token, componenti, marchio ε, guida F1, tour guidato',
}

/** Aree di test (`tests/<dir>/`) e loro ruolo — niente numeri: cambiano a ogni commit. */
export const TEST_AREAS: Record<string, string> = {
  alfa: 'α — pannello di controllo, utenti e statistiche',
  beta: 'β — contabilità lavori pubblici (SAL, certificati, verbali)',
  chi: 'χ — smistamento dei layer di una base DXF esterna sullo standard di studio',
  cli: 'CLI unificata «ehub»: invarianti del registry, parser argv, dispatch, smoke dei comandi',
  delta: 'δ — copertine elaborati, cartigli, campi',
  docs: 'Documentazione: blocchi AUTO in sync, indice, link, path citati',
  hub: 'Hub: registry, resolve/search, visibilità, contratto bus',
  integration: 'Interconnessione fra tool e golden `.ehub` reali',
  miu: 'μ — parser prezzari, ricerca, computo, export Primus',
  shared: 'Layer condiviso: bus, progetto `.ehub`, tema, documenti, compositore',
  ui: 'Coerenza del design system (contratto UI)',
  web: 'Catene di build e deploy: nessun tool resta indietro',
}

export const DOCS: DocEntry[] = [
  {
    file: 'README.md',
    title: 'Indice',
    purpose: 'Questa pagina: mappa di tutta la documentazione',
    when: 'Punto di partenza',
    stato: 'vivo',
  },
  {
    file: '00-Perche-Open-E.Hub.md',
    title: '00 — Perché Open E.Hub',
    purpose: 'Pagina di presentazione: perché open source, i 5 strumenti, confronto onesto con una versione customizzata',
    when: 'Per chi sta decidendo se scaricare Open E.Hub',
    stato: 'vivo',
  },
  {
    file: '01-Panoramica-e-Architettura.md',
    title: '01 — Panoramica e Architettura',
    purpose: 'Cos\'è Open E.Hub, come sono incastrati i pezzi e **perché** sono fatti così',
    when: 'Per capire il "big picture"',
    stato: 'vivo',
  },
  {
    file: '02-Guida-Utente.md',
    title: '02 — Guida Utente (ELI5)',
    purpose: 'Come usare l\'app tutti i giorni, spiegato semplice',
    when: 'Uso quotidiano',
    stato: 'vivo',
  },
  {
    file: '03-Build-e-Release.md',
    title: '03 — Build e Release',
    purpose: 'Come creare gli installer macOS/Windows, versioni, tag, CI',
    when: 'Quando vuoi distribuire una nuova versione',
    stato: 'vivo',
  },
  {
    file: '04-Aggiungere-una-Nuova-App.md',
    title: '04 — Aggiungere una Nuova App',
    purpose: 'Tutorial passo-passo per inserire un nuovo tool nella suite',
    when: 'Quando crei un nuovo strumento',
    stato: 'vivo',
  },
  {
    file: '05-Manutenzione-e-Troubleshooting.md',
    title: '05 — Manutenzione e Troubleshooting',
    purpose: 'Aggiornare librerie, errori comuni, blocchi macOS/Windows',
    when: 'Quando qualcosa non va',
    stato: 'vivo',
  },
]
