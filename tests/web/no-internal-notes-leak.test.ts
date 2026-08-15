import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guardia: le pagine servite pubblicamente (hub/login + tutti i tool) non
 * devono rivelare via view-source/DevTools note di backlog interno (US-xxx,
 * EP-xxx), nomi di persone/agenti o path a mockup interni — è successo, ed è
 * il tipo di leak che una minify JS/CSS non intercetta perché vive dentro
 * commenti HTML o dentro CSS iniettato come stringa JS (doc-css.ts).
 */

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

const SENSITIVE_PATTERNS: [RegExp, string][] = [
  [/\bUS-\d+/g, 'riferimento a user story (US-xxx)'],
  [/\bEP-\d+/g, 'riferimento a epic (EP-xxx)'],
  [/\b(Tonino|Livia|Furio|Saverio|Jonny)\b/g, 'nome di persona/agente interno'],
  [/docs\/mockups/g, 'path a mockup interno'],
]

const PUBLIC_HTML_FILES = [
  'src/hub/index.html',
  ...readdirSync(resolve(ROOT, 'src/tools')).map((tool) => `src/tools/${tool}/index.html`),
]

describe('nessun junk interno nelle pagine pubbliche (view-source/DevTools)', () => {
  for (const rel of PUBLIC_HTML_FILES) {
    it(`${rel} non contiene note di backlog/nomi/path interni`, () => {
      const html = read(rel)
      for (const [pattern, label] of SENSITIVE_PATTERNS) {
        const hits = html.match(pattern)
        expect(hits, `${label} trovato in ${rel}: ${hits?.join(', ')}`).toBeNull()
      }
    })
  }

  it('src/shared/doc/doc-css.ts (CSS condiviso stampa/anteprima, 6 tool) è pulito', () => {
    const css = read('src/shared/doc/doc-css.ts')
    for (const [pattern, label] of SENSITIVE_PATTERNS) {
      const hits = css.match(pattern)
      expect(hits, `${label} trovato in doc-css.ts: ${hits?.join(', ')}`).toBeNull()
    }
  })
})

/**
 * Seconda guardia, nata dalla preparazione della release open: il repo pubblico
 * non deve citare tool che NON fanno parte della distribuzione. Non è una
 * questione di stile — un commento che rimanda a `γ Circuit` o a `src/tools/pi/`
 * manda chi legge a cercare codice che non esiste, e una guida che li elenca
 * promette all'utente funzioni che non troverà.
 *
 * Le lettere restano legittime dove sono DATI (glifi DXF, subset del font,
 * `cos φ`, π matematico) o dove il testo dichiara l'esclusione di proposito:
 * per questo si guardano solo i file di prosa/UI, con le eccezioni qui sotto.
 */
const TOOL_ESCLUSI = /[πφωγτηκλσ]/g

/** File che nominano i tool esclusi DI PROPOSITO (dichiarano cosa non c'è, o usano i glifi come dati). */
const AMMESSI = [
  'src/shared/dxf-glyphs.ts',      // tracciati dei glifi: i caratteri SONO il dato
  'src/shared/dxf.ts',             // traslitterazione greco→ASCII per il DXF
  'src/shared/ui/tokens.css',      // subset unicode del font
  'src/shared/compositore/datasheet-profili.ts', // «cos φ» dei datasheet
]

const sorgentiUI = (): string[] => {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (/\.(ts|js|css|html)$/.test(e.name)) out.push(rel)
    }
  }
  walk('src')
  return out.filter(f => !AMMESSI.includes(f))
}

describe('il repo pubblico non cita tool fuori dalla distribuzione', () => {
  it('nessun sorgente in src/ nomina π/φ/ω/γ/τ/η/κ/λ/σ', () => {
    const colpevoli: string[] = []
    for (const rel of sorgentiUI()) {
      const hits = read(rel).match(TOOL_ESCLUSI)
      if (hits) colpevoli.push(`${rel} (${[...new Set(hits)].join('')})`)
    }
    expect(colpevoli, `sorgenti che citano tool inesistenti:\n  ${colpevoli.join('\n  ')}`).toEqual([])
  })
})
