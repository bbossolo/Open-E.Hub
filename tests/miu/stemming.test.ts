import { describe, it, expect } from 'vitest'
import { normMisure, stemToken, stemText, normMatch, expandQuery } from '../../src/shared/compositore/thesaurus'

describe('stemToken — morfologia leggera conservativa', () => {
  it('tronca la vocale finale delle parole alfabetiche ≥ 5 lettere', () => {
    expect(stemToken('faretti')).toBe('farett')
    expect(stemToken('faretto')).toBe('farett')
    expect(stemToken('orientabili')).toBe('orientabil')
    expect(stemToken('orientabile')).toBe('orientabil')
    expect(stemToken('interruttore')).toBe('interruttor')
    expect(stemToken('zincata')).toBe('zincat')
  })
  it('NON tocca parole corte, sigle, misure e token con cifre', () => {
    expect(stemToken('led')).toBe('led')
    expect(stemToken('rame')).toBe('rame')
    expect(stemToken('tubo')).toBe('tubo')
    expect(stemToken('ip65')).toBe('ip65')
    expect(stemToken('3x2.5')).toBe('3x2.5')
    expect(stemToken('fg16or16')).toBe('fg16or16')
    expect(stemToken('mm2')).toBe('mm2')
    expect(stemToken('utp')).toBe('utp')
  })
  it('non tronca la u finale (sigle e prestiti)', () => {
    expect(stemToken('bblue')).toBe('bblue'.replace(/[aeio]$/, ''))
  })
})

describe('normMisure — canonicalizzazione misure dei prezzari', () => {
  it('virgola decimale → punto, ² → 2', () => {
    expect(normMisure('cavo 3x2,5 mm²')).toBe('cavo 3x2.5 mm2')
    expect(normMisure('sezione 7,7 mm²')).toBe('sezione 7.7 mm2')
  })
  it('collassa la formazione «3 x 2.5» e regge le catene', () => {
    expect(normMisure('3 x 2,5')).toBe('3x2.5')
    expect(normMisure('50 x 150 x 3')).toBe('50x150x3')
  })
  it('diametro/diam./Ø/⌀ N → øN', () => {
    expect(normMisure('ø 40')).toBe('ø40')
    expect(normMisure('diametro 30')).toBe('ø30')
    expect(normMisure('diam. 25')).toBe('ø25')
    expect(normMisure('tubo ⌀ 25 mm')).toBe('tubo ø25 mm')
  })
  it('è idempotente (applicata a query E haystack)', () => {
    for (const s of ['cavo 3 x 2,5 mm²', 'diametro 30', 'ø 40', 'passerella 50x150']) {
      const once = normMisure(s)
      expect(normMisure(once)).toBe(once)
    }
  })
  it('non tocca ciò che non è una misura', () => {
    expect(normMisure('cat 6')).toBe('cat 6')
    expect(normMisure('diametro variabile')).toBe('diametro variabile')
    expect(normMisure('norma uni 45')).toBe('norma uni 45')
  })
})

describe('normMatch / stemText', () => {
  it('pipeline completa: normQuery + normMisure + stem', () => {
    const m = normMatch('Faretti Orientabili Ø 90')
    expect(m.raw).toBe('faretti orientabili ø90')
    expect(m.stem).toBe('farett orientabil ø90')
  })
  it('stemText lascia intatti i token non alfabetici', () => {
    expect(stemText('plafoniera ip65 3x2.5')).toBe('plafonier ip65 3x2.5')
  })
})

// NOTA (Open E.Hub): FAMIGLIE_DATA arriva da `compositore-catalog:thesaurus`, che
// vite.config.ts alias-a allo stub vuoto (catalog-data-empty.ts) — Open E.Hub non
// distribuisce vocabolario proprietario. I test che verificavano il riconoscimento di
// famiglie REALI (caldaia, torretta, faretto orientabile…) sono stati rimossi: con
// FAMIGLIE=[] non c'è nulla da riconoscere. Resta il solo contratto content-indipendente:
// nessuna famiglia viene inventata quando il catalogo è vuoto.
describe('expandQuery — nessuna famiglia inventata a catalogo vuoto', () => {
  it('«porta blindata»: nessuna famiglia riconosciuta', () => {
    const e = expandQuery('porta blindata')
    expect(e.famiglie).toEqual([])
  })
})
