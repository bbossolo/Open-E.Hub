import { describe, it, expect } from 'vitest'
import { scomposizioneToRighe, indicePerCodice, hasScomposizione } from '../../src/tools/miu/engine/analisi-import'
import { calcolaAnalisi, DEFAULT_SPESE_GENERALI_PCT, DEFAULT_UTILE_IMPRESA_PCT } from '../../src/shared/compositore/analisi-prezzi'
import type { PriceRow } from '../../src/tools/miu/engine/types'

function row(over: Partial<PriceRow>): PriceRow {
  return {
    codice: '', declaratoria: '', desc_short: '', um: '', prezzo: 0, importo_netto: 0, ru: 0,
    liv1: '', liv2: '', liv3: '', liv4: '', materia: '', disciplina: '', sistema: '',
    attivita: '', settore: '', keywords: '', tipologia: '', regione: 'Lombardia', anno: '2026', ...over,
  }
}

const catalogoMat = row({ codice: 'L.RM.1', desc_short: 'Maniglione di risalita; fornitura: coppia', um: 'cad', prezzo: 231.00 })
const opera = row({
  codice: 'L.OC.1', desc_short: 'Maniglione in opera', um: 'cad', prezzo: 310.62,
  risorse: [
    { codice: 'L.RM.1', tipo: 'materiale', quantita: 1, prezzo: 229.62 },                     // risolve a catalogo
    { codice: 'X.ORFANO.9', tipo: 'manodopera', quantita: 0.55, prezzo: 28.96, um: 'h', descrizione: 'Operaio comune' }, // orfano
  ],
})

describe('scomposizioneToRighe', () => {
  const byCodice = indicePerCodice([catalogoMat, opera])
  const righe = scomposizioneToRighe(opera, byCodice)

  it('componente risolvibile: descrizione/um dal catalogo, PREZZO dalla scomposizione (costo netto ufficiale)', () => {
    expect(righe[0]).toEqual({
      tipo: 'materiale', descrizione: 'Maniglione di risalita; fornitura: coppia', um: 'cad',
      quantita: 1, prezzoUnitario: 229.62,
      fonte: { codice: 'L.RM.1', regione: 'Lombardia', anno: '2026' },
    })
  })

  it('componente orfano: fallback ai valori memorizzati nel pack', () => {
    expect(righe[1]).toEqual({
      tipo: 'manodopera', descrizione: 'Operaio comune', um: 'h',
      quantita: 0.55, prezzoUnitario: 28.96,
      fonte: { codice: 'X.ORFANO.9', regione: 'Lombardia', anno: '2026' },
    })
  })

  it('le righe importate quadrano in calcolaAnalisi (costo diretto = Σ qta×prezzo)', () => {
    const tot = calcolaAnalisi({
      id: 'x', codice: 'AP01', descrizioneBreve: 'test', um: 'cad', righe,
      speseGeneraliPct: DEFAULT_SPESE_GENERALI_PCT, utileImpresaPct: DEFAULT_UTILE_IMPRESA_PCT,
    })
    expect(tot.costoDiretto).toBeCloseTo(229.62 + 0.55 * 28.96, 2)
    expect(tot.totManodopera).toBeCloseTo(0.55 * 28.96, 2)
  })

  it('senza byCodice usa i fallback; senza risorse ritorna []; hasScomposizione coerente', () => {
    const senzaJoin = scomposizioneToRighe(opera)
    expect(senzaJoin[0].prezzoUnitario).toBe(229.62)
    expect(senzaJoin[0].descrizione).toBe('L.RM.1') // orfano di descrizione → codice
    expect(scomposizioneToRighe(catalogoMat)).toEqual([])
    expect(hasScomposizione(opera)).toBe(true)
    expect(hasScomposizione(catalogoMat)).toBe(false)
  })
})
