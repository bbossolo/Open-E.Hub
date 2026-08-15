import { describe, it, expect } from 'vitest'
import { buildCoverDxf, buildAllCoverDxf, DELTA_DXF_LAYERS } from '../../src/tools/delta/engine/dxf-export'
import { flattenConstructPath } from '../../src/shared/dxf-from-pdf'
import type { PageVectors } from '../../src/shared/dxf-from-pdf'
import type { DeltaState, ResolvedField, Template } from '../../src/tools/delta/engine/types'

// OPS finti (numeri arbitrari ma coerenti) per testare l'interprete dei path.
const OPS = { moveTo: 1, lineTo: 2, curveTo: 3, curveTo2: 4, curveTo3: 5, rectangle: 6, closePath: 7 }

describe('δ dxf-from-pdf — flattenConstructPath', () => {
  it('rectangle → un sottopercorso chiuso di 4 punti', () => {
    const paths = flattenConstructPath([OPS.rectangle], [10, 20, 100, 50], OPS, [1, 0, 0, 1, 0, 0])
    expect(paths).toHaveLength(1)
    expect(paths[0].closed).toBe(true)
    expect(paths[0].pts).toEqual([[10, 20], [110, 20], [110, 70], [10, 70]])
  })
  it('moveTo/lineTo → polilinea aperta; closePath la chiude', () => {
    const open = flattenConstructPath([OPS.moveTo, OPS.lineTo, OPS.lineTo], [0, 0, 10, 0, 10, 10], OPS, [1, 0, 0, 1, 0, 0])
    expect(open[0].pts).toEqual([[0, 0], [10, 0], [10, 10]])
    expect(open[0].closed).toBe(false)
    const closed = flattenConstructPath([OPS.moveTo, OPS.lineTo, OPS.closePath], [0, 0, 10, 0], OPS, [1, 0, 0, 1, 0, 0])
    expect(closed[0].closed).toBe(true)
  })
  it('applica la CTM ai punti (scala 0.5 + traslazione)', () => {
    const paths = flattenConstructPath([OPS.moveTo, OPS.lineTo], [0, 0, 100, 0], OPS, [0.5, 0, 0, 0.5, 5, 7])
    expect(paths[0].pts).toEqual([[5, 7], [55, 7]])
  })
})

const TPL: Template = { dataUrl: 'data:image/png;base64,AA', w: 850, h: 1200, kind: 'pdf', name: 't.pdf', ptW: 595, ptH: 842 }
function base(): PageVectors {
  return {
    widthPt: 595, heightPt: 842,
    paths: [{ pts: [[0, 0], [595, 0], [595, 842], [0, 842]], closed: true }],
    texts: [{ x: 100, y: 700, h: 10, str: 'Committente:', rot: 0 }],
    images: [],
  }
}
const rf = (over: Partial<ResolvedField>): ResolvedField => ({ text: '', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.02, bold: false, ...over })

describe('δ dxf-export — buildCoverDxf', () => {
  const dxf = buildCoverDxf(base(), [rf({ text: 'A123', x: 0.7, y: 0.3 }), rf({ text: 'GEN-EL01a', x: 0.5, y: 0.8 })])

  it('contiene i valori compilati come TEXT e la cornice come LWPOLYLINE', () => {
    expect(dxf).toContain('A123')
    expect(dxf).toContain('GEN-EL01a')
    expect(dxf).toContain('Committente:')
    expect(dxf).toContain('LWPOLYLINE')
    expect(dxf).toContain('TEXT')
  })
  it('usa i layer del cartiglio (CORNICE/TESTO), niente layer brandizzati', () => {
    for (const l of DELTA_DXF_LAYERS) expect(dxf).toContain(l)
  })
  it('NESSUN riferimento/brand Open E.Hub né contorni-glifo', () => {
    expect(dxf).not.toContain('E.HUB')
    expect(dxf).not.toContain('TESTO_RICERCA')
    expect(dxf).not.toMatch(/CARTIGLIO/)   // niente banda cartiglio ε
    expect(dxf).not.toContain('AcDbBlockReference') // niente INSERT/brand
  })
  it('struttura R2004 completa (accettabile dai CAD rigidi)', () => {
    for (const tok of ['$HANDSEED', 'AC1018', 'OBJECTS', 'EOF']) expect(dxf).toContain(tok)
  })
})

describe('δ dxf-export — buildAllCoverDxf', () => {
  function state(rows: Record<string, string>[]): DeltaState {
    return {
      v: 1, template: TPL,
      fields: [{ id: 'f', kind: 'variable', label: 'Tavola', x: 0.5, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.02, expr: '{CODICE ELABORATO|tail}' }],
      elenco: { headers: ['CODICE ELABORATO'], rows, fileName: 'A123.xlsx' },
    }
  }
  it('un DXF per riga, nominato dalla colonna scelta', () => {
    const out = buildAllCoverDxf(state([{ 'CODICE ELABORATO': 'A123_E_EL_RT_GEN-EL01a' }, { 'CODICE ELABORATO': 'A123_E_MC_PL_EXT-GE01a' }]), base(), 'CODICE ELABORATO')
    expect(out.map(o => o.name)).toEqual(['A123_E_EL_RT_GEN-EL01a.dxf', 'A123_E_MC_PL_EXT-GE01a.dxf'])
    // il valore Tavola N° derivato (coda del codice) finisce nel DXF
    expect(out[0].dxf).toContain('GEN-EL01a')
    expect(out[1].dxf).toContain('EXT-GE01a')
  })
})
