import { describe, it, expect } from 'vitest'
import { packPrezzario, unpackPrezzario } from '../../src/tools/miu/engine/pack'
import type { PriceRow, PrezzarioMeta } from '../../src/tools/miu/engine/types'

function row(over: Partial<PriceRow>): PriceRow {
  return {
    codice: '', declaratoria: '', desc_short: '', um: '', prezzo: 0, importo_netto: 0, ru: 0,
    liv1: '', liv2: '', liv3: '', liv4: '', materia: '', disciplina: '', sistema: '',
    attivita: '', settore: '', keywords: '', tipologia: '', regione: '', anno: '', ...over,
  }
}

const meta: PrezzarioMeta = { regione: 'Veneto', anno: '2025', family: 'veneto', source: 'x.xml', count: 0 }

describe('pack/unpack — formato compatto', () => {
  const rows: PriceRow[] = [
    row({ codice: 'A.01', desc_short: 'Scavo', declaratoria: 'Scavo lungo…', um: 'm³', prezzo: 7.99, ru: 37.21, liv1: 'OPERE EDILI', settore: 'SCAVI', regione: 'Veneto', anno: '2025' }),
    row({ codice: 'A.02', desc_short: 'Rinterro', declaratoria: 'Rinterro…', um: 'm³', prezzo: 5.5, liv1: 'OPERE EDILI', settore: 'SCAVI', regione: 'Veneto', anno: '2025' }),
  ]

  it('roundtrip: unpack(pack(rows)) ≡ rows', () => {
    const packed = packPrezzario(meta, rows)
    const back = unpackPrezzario(packed)
    expect(back.rows).toEqual(rows)
    expect(back.meta.count).toBe(2)
  })

  it('deduplica i valori categoriali ripetuti nel dict', () => {
    const packed = packPrezzario(meta, rows)
    // 'OPERE EDILI' e 'SCAVI' e 'm³' compaiono una sola volta nel dict
    expect(packed.dict.filter(s => s === 'OPERE EDILI')).toHaveLength(1)
    expect(packed.dict.filter(s => s === 'SCAVI')).toHaveLength(1)
    expect(packed.dict.filter(s => s === 'm³')).toHaveLength(1)
  })

  it('regione/anno non sono nelle tuple ma ricostruiti da meta', () => {
    const packed = packPrezzario(meta, rows)
    expect(packed.inlineCols).not.toContain('regione')
    expect(packed.dictCols).not.toContain('regione')
    expect(unpackPrezzario(packed).rows[0].regione).toBe('Veneto')
  })
})

// ── Scomposizioni per componenti — campo ADDITIVO `componenti` ──
describe('pack/unpack — componenti (scomposizioni ufficiali)', () => {
  const opera = row({
    codice: 'L.OC.1', desc_short: 'Maniglione in opera', um: 'cad', prezzo: 310.62,
    risorse: [
      { codice: 'L.RM.1', tipo: 'materiale', quantita: 1, prezzo: 229.62, um: 'cad', descrizione: 'Maniglione (fornitura)' },
      { codice: 'X.ORFANO.9', tipo: 'manodopera', quantita: 0.55, prezzo: 28.96, um: 'h', descrizione: 'Operaio comune' },
    ],
  })
  const materiale = row({ codice: 'L.RM.1', desc_short: 'Maniglione (fornitura)', um: 'cad', prezzo: 229.62 })

  it('roundtrip: risorse ricostruite; um/desc scartati per i codici che risolvono a catalogo', () => {
    const back = unpackPrezzario(packPrezzario(meta, [opera, materiale]))
    const r = back.rows[0].risorse!
    expect(r).toHaveLength(2)
    // L.RM.1 è nel catalogo → um/desc NON viaggiano nel pack (si risolvono a runtime)
    expect(r[0]).toEqual({ codice: 'L.RM.1', tipo: 'materiale', quantita: 1, prezzo: 229.62 })
    // codice orfano → um/desc conservati come fallback
    expect(r[1]).toEqual({ codice: 'X.ORFANO.9', tipo: 'manodopera', quantita: 0.55, prezzo: 28.96, um: 'h', descrizione: 'Operaio comune' })
    expect(back.rows[1].risorse).toBeUndefined()
  })

  it('retro-compat: senza risorse il payload non ha `componenti` e resta schema 1', () => {
    const packed = packPrezzario(meta, [materiale])
    expect(packed.componenti).toBeUndefined()
    expect(packed.schema).toBe(1)
    // e un pack CON componenti resta consumabile ignorando il campo (schema invariato)
    expect(packPrezzario(meta, [opera, materiale]).schema).toBe(1)
  })
})
