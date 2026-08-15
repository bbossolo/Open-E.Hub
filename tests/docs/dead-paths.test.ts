import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DOCS } from '../../scripts/docs-manifest'
import { ROOT } from './_links'

/**
 * Un documento **vivo** non può citare un file del repo che non esiste più.
 *
 * È il caso reale che ha motivato questa guardia: dopo la rimozione di un tool, i
 * doc continuavano a citarne l'HTML e la cartella sorgente come se esistessero.
 * Chi leggeva andava a cercare file fantasma.
 *
 * Perimetro volutamente STRETTO, perché una guardia che grida al lupo viene
 * spenta:
 *  - solo i doc `stato: 'vivo'` — l'archivio racconta il passato ed è suo diritto
 *    nominare file rimossi;
 *  - solo i token dentro **backtick** che hanno forma di path (`src/…`, `tests/…`,
 *    `qualcosa.html`): la prosa che racconta una rimozione resta legittima;
 *  - fuori dai blocchi di codice, che sono esempi didattici (Docs/04, Docs/01 §5).
 */

/**
 * Citazioni storiche volute in doc vivi: nominano il passato di proposito, e il
 * documento lo dichiara nel testo. Ogni voce va motivata, altrimenti l'elenco
 * diventa il tappeto sotto cui si nasconde la deriva vera.
 */
const CONSENTITI_PREFIX = [
  'src/tools/phi/', // Docs/08 e PRD: epiche pre-fusione, il doc lo dichiara in testa
  'tests/phi/',
  'src/tools/omega/',
]
/**
 * Artefatti GENERATI dal build: assenti da un checkout pulito (sono in .gitignore),
 * ma i doc hanno tutto il diritto di descriverli — anzi, devono. Senza questo
 * elenco la guardia darebbe esiti diversi sulla macchina di chi sviluppa (dove il
 * build è già girato) e in CI: è esattamente così che è fallita la prima volta.
 */
const GENERATI = [
  'prezzari/_bundle/', // wrapper .js dei prezzari, rigenerati da bundle-prezzari.mjs
  'dist/', // installer electron-builder
]

const CONSENTITI = new Set<string>([
  'phi_v6_14.html', // Docs/01: esempio di come NON si chiamano più i file
  'Quadri.html', // Docs/04: tool immaginario del tutorial «aggiungi una nuova app»
  'preview.html', // Docs/UI-CONTRACT: nome generico in un esempio
  'index.html', // nome del sorgente di OGNI tool (src/tools/<tool>/index.html), non un file a root
  // Bundle HTML a root: GENERATI da `npm run build:web`, mai committati (vedi
  // .gitignore) — su un checkout pulito non esistono finché non si builda.
  'EHub.html', 'Alfa.html', 'miu.html', 'Delta.html', 'Beta.html', 'Chi.html',
])

/**
 * Token che sembrano path del repo, presi solo dai code-span (fuori dai blocchi
 * di codice). Serve un `/` con estensione o una barra finale: così `Docs/11`,
 * che è un riferimento discorsivo a un documento e non un path, non entra.
 */
function citedPaths(md: string): string[] {
  const out = new Set<string>()
  const senzaBlocchi = md.replace(/```[\s\S]*?```/g, '')
  for (const m of senzaBlocchi.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim()
    if (CONSENTITI.has(t)) continue
    if ([...CONSENTITI_PREFIX, ...GENERATI].some((p) => t.startsWith(p))) continue
    const dentroCartella = /^(src|tests|scripts|Docs|api|vendor|prezzari)\/[\w./-]+(\.\w+|\/)$/.test(t)
    const htmlARoot = /^[\w-]+\.html$/.test(t)
    if (dentroCartella || htmlARoot) out.add(t)
  }
  return [...out]
}

describe('nessun doc vivo cita file inesistenti', () => {
  const vivi = DOCS.filter((d) => d.stato === 'vivo').map((d) => `Docs/${d.file}`).concat('README.md')

  for (const rel of vivi) {
    it(`${rel} — i path citati esistono`, () => {
      const md = readFileSync(resolve(ROOT, rel), 'utf8')
      const morti = citedPaths(md).filter((p) => !existsSync(resolve(ROOT, p.replace(/\/$/, ''))))
      expect(
        morti,
        `${rel} cita path inesistenti: ${morti.join(', ')} — aggiorna il testo, oppure archivia il doc, oppure aggiungi il termine a CONSENTITI se è una citazione storica voluta`,
      ).toEqual([])
    })
  }
})
