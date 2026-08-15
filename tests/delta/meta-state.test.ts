import { describe, it, expect } from 'vitest'
import { parseProjectMeta } from '../../src/tools/delta/engine/csv-map'
import { parseState } from '../../src/tools/delta/engine/state'
import { resolveCover } from '../../src/tools/delta/engine/cover-model'
import type { DeltaState, Template } from '../../src/tools/delta/engine/types'

const TPL: Template = { dataUrl: 'data:image/png;base64,AA', w: 850, h: 1200, kind: 'pdf', name: 't.pdf', ptW: 595, ptH: 842 }

describe('δ csv-map — parseProjectMeta (foglio PAGINA INIZIALE)', () => {
  const grid = [
    ['ELENCO ELABORATI', 'STUDIO DEMO COSTRUZIONI S.P.A.', 'CENTRO DEMO LOGISTICO'],
    [],
    ['PROGETTO ESECUTIVO - AMPLIAMENTO CENTRO LOGISTICO'],
    ['COMUNE DI MANTOVA'],
    ['', 'COMMESSA'],
    ['', 'A123'],
    ['', 'Data'],
    ['', '4/17/26'],
  ]
  const meta = parseProjectMeta(grid)

  it('Commessa e Data da coppia etichetta/valore (sotto)', () => {
    expect(meta.Commessa).toBe('A123')
    expect(meta.Data).toBe('4/17/26')
  })
  it('Committente per euristica S.p.A.', () => {
    expect(meta.Committente).toBe('STUDIO DEMO COSTRUZIONI S.P.A.')
  })
  it('Oggetto per euristica «PROGETTO…»', () => {
    expect(meta.Oggetto).toBe('PROGETTO ESECUTIVO - AMPLIAMENTO CENTRO LOGISTICO')
  })
})

describe('δ state — round-trip di expr/maxWidthFrac/meta', () => {
  it('conserva expr e maxWidthFrac sui campi, e meta sull\'elenco', () => {
    const state: DeltaState = {
      v: 1,
      template: TPL,
      fields: [
        { id: 'f1', kind: 'variable', label: 'Tavola N°', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.03, expr: '{CODICE ELABORATO|tail}' },
        { id: 'f2', kind: 'variable', label: 'Titolo', x: 0.1, y: 0.8, anchor: 'tl', align: 'left', fontFrac: 0.03, column: 'TITOLO CARTIGLIO', maxWidthFrac: 0.4, maxHeightFrac: 0.06 },
      ],
      elenco: { headers: ['CODICE ELABORATO', 'TITOLO CARTIGLIO'], rows: [], fileName: 'e.xlsx', meta: { Committente: 'X S.P.A.' } },
    }
    const back = parseState(JSON.stringify(state))
    expect(back.fields[0].expr).toBe('{CODICE ELABORATO|tail}')
    expect(back.fields[1].maxWidthFrac).toBeCloseTo(0.4, 5)
    expect(back.fields[1].maxHeightFrac).toBeCloseTo(0.06, 5)
    // retrocompatibilità: campo salvato SENZA maxHeightFrac resta senza (nessun default)
    expect(back.fields[0].maxHeightFrac).toBeUndefined()
    expect(back.elenco?.meta?.Committente).toBe('X S.P.A.')
  })
})

describe('δ cover-model — resolveCover con expr + meta', () => {
  it('risolve i campi derivati e i metadati progetto sulla riga corrente', () => {
    const state: DeltaState = {
      v: 1,
      template: TPL,
      fields: [
        { id: 'a', kind: 'variable', label: 'Tavola', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.03, expr: '{CODICE ELABORATO|tail}' },
        { id: 'b', kind: 'variable', label: 'Committente', x: 0.1, y: 0.1, anchor: 'tl', align: 'left', fontFrac: 0.03, expr: '{@Committente}' },
      ],
      elenco: {
        headers: ['CODICE ELABORATO'], fileName: 'e.xlsx',
        rows: [{ 'CODICE ELABORATO': 'A123_E_EL_QE_CAB4-EL01a' }],
        meta: { Committente: 'IMMOBILIARE CINQUERRE S.P.A.' },
      },
    }
    const cover = resolveCover(state, 0)!
    expect(cover.fields[0].text).toBe('CAB4-EL01a')
    expect(cover.fields[1].text).toBe('IMMOBILIARE CINQUERRE S.P.A.')
  })
})
