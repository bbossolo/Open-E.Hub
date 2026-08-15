import { describe, it, expect } from 'vitest'
import { emptyState, parseState } from '../../src/tools/delta/engine/state'
import { resolveCover, buildCoverDoc, fieldText, anchorTranslate, fieldBoxWidthFrac, firstBaselineOffset, CAP_HEIGHT_FRAC } from '../../src/tools/delta/engine/cover-model'
import { coverDocHTML } from '../../src/tools/delta/engine/cover-html'
import { parseElenco, normalizeHeaders } from '../../src/tools/delta/engine/csv-map'
import type { DeltaState, CoverField } from '../../src/tools/delta/engine/types'

const TPL = { dataUrl: 'data:image/png;base64,AAAA', w: 800, h: 1131, kind: 'image' as const, name: 'cop.png' }

function field(over: Partial<CoverField>): CoverField {
  return { id: 'f1', kind: 'fixed', label: 'C', x: 0.5, y: 0.5, anchor: 'mc', align: 'center', fontFrac: 0.03, ...over }
}

describe('δ csv-map — parseElenco', () => {
  it('prima riga = header, righe dati come oggetti', () => {
    const e = parseElenco([['Codice', 'Titolo'], ['E-01', 'Pianta'], ['E-02', 'Sezioni']], 'x.xlsx')
    expect(e.headers).toEqual(['Codice', 'Titolo'])
    expect(e.rows).toHaveLength(2)
    expect(e.rows[0]).toEqual({ Codice: 'E-01', Titolo: 'Pianta' })
  })
  it('salta le righe interamente vuote', () => {
    const e = parseElenco([['A'], ['x'], ['  '], [''], ['y']])
    expect(e.rows.map(r => r.A)).toEqual(['x', 'y'])
  })
  it('celle mancanti → stringa vuota', () => {
    const e = parseElenco([['A', 'B'], ['solo-a']])
    expect(e.rows[0]).toEqual({ A: 'solo-a', B: '' })
  })
  it('normalizeHeaders deduplica e riempie i vuoti', () => {
    expect(normalizeHeaders(['Titolo', '', 'Titolo'])).toEqual(['Titolo', 'Colonna 2', 'Titolo (2)'])
  })
  it('griglia vuota → elenco vuoto', () => {
    expect(parseElenco([]).rows).toHaveLength(0)
  })
})

describe('δ cover-model — risoluzione campi', () => {
  it('campo fisso porta il suo valore letterale', () => {
    expect(fieldText(field({ kind: 'fixed', value: 'Studio X' }), null)).toBe('Studio X')
  })
  it('campo variabile prende il valore dalla colonna mappata', () => {
    const f = field({ kind: 'variable', column: 'Titolo', value: undefined })
    expect(fieldText(f, { Titolo: 'Pianta piano terra' })).toBe('Pianta piano terra')
  })
  it('campo variabile orfano (colonna assente) → vuoto', () => {
    const f = field({ kind: 'variable', column: 'Mancante' })
    expect(fieldText(f, { Titolo: 'x' })).toBe('')
  })
  it('fieldBoxWidthFrac: senza maxWidthFrac la casella arriva al bordo secondo l\'ancora', () => {
    // margine 1.5% di default
    expect(fieldBoxWidthFrac('ml', 0.2)).toBeCloseTo(0.785, 5)  // 1 - 0.015 - 0.2
    expect(fieldBoxWidthFrac('mr', 0.2)).toBeCloseTo(0.185, 5)  // 0.2 - 0.015
    expect(fieldBoxWidthFrac('mc', 0.2)).toBeCloseTo(0.37, 5)   // 2×0.2 - 2×0.015
    expect(fieldBoxWidthFrac('mc', 0.9)).toBeCloseTo(0.17, 5)   // limitata dal bordo più vicino
  })
  it('fieldBoxWidthFrac: con maxWidthFrac la casella è quella dichiarata', () => {
    expect(fieldBoxWidthFrac('tl', 0.05, 0.3)).toBe(0.3)
    expect(fieldBoxWidthFrac('tl', 0.05, 0)).toBeCloseTo(0.935, 5) // 0 = automatica
  })

  it('firstBaselineOffset: l\'ancoraggio verticale si misura sulle MAIUSCOLE', () => {
    const cap = CAP_HEIGHT_FRAC * 10
    // riga singola: t = cima delle maiuscole sul punto, m = maiuscole centrate, b = baseline sul punto
    expect(firstBaselineOffset('tl', 10)).toBeCloseTo(cap, 5)
    expect(firstBaselineOffset('ml', 10)).toBeCloseTo(cap / 2, 5)
    expect(firstBaselineOffset('bl', 10)).toBeCloseTo(0, 5)
  })
  it('firstBaselineOffset: il blocco multi-riga si ancora nel suo insieme', () => {
    const lineH = 1.2 * 10
    expect(firstBaselineOffset('tl', 10, 3)).toBeCloseTo(CAP_HEIGHT_FRAC * 10, 5) // dall'alto: invariato
    expect(firstBaselineOffset('bl', 10, 3)).toBeCloseTo(-2 * lineH, 5)           // l'ultima riga siede sul punto
    expect(firstBaselineOffset('ml', 10, 3)).toBeCloseTo(CAP_HEIGHT_FRAC * 5 - lineH, 5)
  })
  it('firstBaselineOffset NON dipende dal font: due campi con testi diversi restano allineati', () => {
    // È il punto della convenzione: il template può non coprire tutti i glifi e far
    // ripiegare un campo su Helvetica — la quota della baseline non deve cambiare.
    expect(firstBaselineOffset('ml', 12)).toBe(firstBaselineOffset('mr', 12))
  })

  it('anchorTranslate mappa i 9 ancoraggi in translate CSS', () => {
    expect(anchorTranslate('tl')).toEqual({ tx: '0', ty: '0' })
    expect(anchorTranslate('mc')).toEqual({ tx: '-50%', ty: '-50%' })
    expect(anchorTranslate('br')).toEqual({ tx: '-100%', ty: '-100%' })
  })
})

describe('δ cover-model — buildCoverDoc', () => {
  const base: DeltaState = {
    v: 1, template: TPL,
    fields: [
      field({ id: 'a', kind: 'fixed', value: 'Comune di Roma' }),
      field({ id: 'b', kind: 'variable', column: 'Titolo', value: undefined }),
    ],
    elenco: { headers: ['Titolo'], rows: [{ Titolo: 'Tav 1' }, { Titolo: 'Tav 2' }], fileName: 'e.csv' },
  }
  it('una copertina per riga dell\'elenco', () => {
    const doc = buildCoverDoc(base)
    expect(doc.pages).toHaveLength(2)
    expect(doc.pages[0].fields[1].text).toBe('Tav 1')
    expect(doc.pages[1].fields[1].text).toBe('Tav 2')
    expect(doc.pages[0].fields[0].text).toBe('Comune di Roma') // fisso uguale su entrambe
  })
  it('senza elenco → una sola copertina coi soli fissi', () => {
    const doc = buildCoverDoc({ ...base, elenco: null })
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0].fields[1].text).toBe('') // variabile senza fonte
  })
  it('senza template → nessuna pagina', () => {
    expect(buildCoverDoc({ ...base, template: null }).pages).toHaveLength(0)
  })
  it('resolveCover con rowIndex fuori range non esplode: nessuna riga reale → segnaposto, come per rowIndex=-1', () => {
    const p = resolveCover(base, 99)
    expect(p!.fields[1].text).toBe('‹Titolo›')
  })
  it('resolveCover(-1) con elenco già caricato mostra comunque il segnaposto sui variabili (anteprima "a vuoto", non riga vuota)', () => {
    const p = resolveCover(base, -1)
    expect(p!.fields[0].text).toBe('Comune di Roma') // fisso: valore vero, non un segnaposto
    expect(p!.fields[1].text).toBe('‹Titolo›')
  })
})

describe('δ cover-html — coverDocHTML', () => {
  const doc = buildCoverDoc({
    v: 1, template: TPL,
    fields: [field({ id: 'a', kind: 'fixed', value: 'A & B <x>' })],
    elenco: { headers: ['T'], rows: [{ T: '1' }, { T: '2' }], fileName: 'e.csv' },
  })
  it('genera una section per copertina, auto-stampante', () => {
    const html = coverDocHTML(doc, 'Test')
    expect(html).toContain('window.print()')
    expect((html.match(/class="d-page"/g) || []).length).toBe(2)
    expect(html).toContain('page-break-after: always')
  })
  it('esce l\'HTML del testo dei campi (niente injection)', () => {
    const html = coverDocHTML(doc)
    expect(html).toContain('A &amp; B &lt;x&gt;')
    expect(html).not.toContain('A & B <x>')
  })
  it('landscape se il template è più largo che alto', () => {
    const wide = buildCoverDoc({ v: 1, template: { ...TPL, w: 1131, h: 800 }, fields: [], elenco: null })
    expect(coverDocHTML(wide)).toContain('size: A4 landscape')
  })
})

describe('δ state — parseState (round-trip .ehub difensivo)', () => {
  it('emptyState è uno stato valido vuoto', () => {
    const s = emptyState()
    expect(s).toEqual({ v: 1, template: null, fields: [], elenco: null })
  })
  it('round-trip conserva template, campi ed elenco', () => {
    const s: DeltaState = {
      v: 1, template: TPL,
      fields: [field({ id: 'a', kind: 'variable', column: 'Titolo', value: undefined })],
      elenco: { headers: ['Titolo'], rows: [{ Titolo: 'x' }], fileName: 'e.csv' },
    }
    const back = parseState(JSON.stringify(s))
    expect(back.template!.w).toBe(800)
    expect(back.fields[0].kind).toBe('variable')
    expect(back.fields[0].column).toBe('Titolo')
    expect(back.elenco!.rows[0].Titolo).toBe('x')
  })
  it('scarta dati corrotti senza esplodere', () => {
    expect(parseState('non-json')).toEqual(emptyState())
    expect(parseState({ fields: 'no', template: { w: -1 } }).template).toBeNull()
  })
  it('normalizza x/y fuori range e fontFrac invalida', () => {
    const back = parseState({ fields: [{ id: 'a', kind: 'fixed', x: 5, y: -2, fontFrac: 0 }] })
    expect(back.fields[0].x).toBe(1)
    expect(back.fields[0].y).toBe(0)
    expect(back.fields[0].fontFrac).toBeGreaterThan(0)
  })
  it('conserva font incorporati e dimensioni fisiche del template', () => {
    const s: DeltaState = {
      v: 1,
      template: { ...TPL, kind: 'pdf', ptW: 595, ptH: 842, fontName: 'Arial', fontRegularB64: 'UkVH', fontBoldB64: 'Qk9MRA==' },
      fields: [], elenco: null,
    }
    const back = parseState(JSON.stringify(s))
    expect(back.template!.kind).toBe('pdf')
    expect(back.template!.ptW).toBe(595)
    expect(back.template!.ptH).toBe(842)
    expect(back.template!.fontName).toBe('Arial')
    expect(back.template!.fontRegularB64).toBe('UkVH')
    expect(back.template!.fontBoldB64).toBe('Qk9MRA==')
  })
  it('conserva filenameColumn se la colonna esiste, la scarta altrimenti', () => {
    const base: DeltaState = {
      v: 1, template: TPL, fields: [],
      elenco: { headers: ['CODICE'], rows: [{ CODICE: 'A01' }], fileName: 'e.csv' },
    }
    expect(parseState(JSON.stringify({ ...base, filenameColumn: 'CODICE' })).filenameColumn).toBe('CODICE')
    expect(parseState(JSON.stringify({ ...base, filenameColumn: 'ASSENTE' })).filenameColumn).toBeUndefined()
  })
})
