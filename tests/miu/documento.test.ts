import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDocumento } from '../../src/tools/miu/engine/parsers/documento'

const xml = readFileSync(resolve(__dirname, 'fixtures/documento-sample.xml'), 'utf-8')

describe('parseDocumento — famiglia Documento/six (golden su dati reali FVG)', () => {
  const res = parseDocumento(xml, { regione: 'Friuli V.G.', anno: '2026' })

  it('usa regione/anno dal fallback (non nel contenuto)', () => {
    expect(res.regione).toBe('Friuli V.G.')
    expect(res.anno).toBe('2026')
  })

  it('emette solo i prodotto con prezzo (i nodi-categoria valore=0 sono scartati)', () => {
    expect(res.rows.map(r => r.codice)).toEqual(['01.1.AB1.01.A', '01.1.AB1.01.B'])
  })

  it('mappa prezzo, UM (da tabella), manodopera e gerarchia da prefissi prdId', () => {
    const r = res.rows[0]
    expect(r.prezzo).toBeCloseTo(27.32, 2)
    expect(r.um).toBe('m²')                 // unitaDiMisuraId 62 → simbolo
    expect(r.ru).toBeCloseTo(29.13, 2)      // incidenzaManodopera
    expect(r.desc_short).toContain('Puntellazione di travi')
    expect(r.disciplina).toBe('OPERE PROVVISIONALI')   // prefisso "01"
    expect(r.settore).toBe('PUNTELLAZIONI')            // prefisso "01.1"
    expect(r.regione).toBe('Friuli V.G.')
  })

  it('risolve unità di misura diverse dalla tabella', () => {
    expect(res.rows[1].um).toBe('CDM')      // unitaDiMisuraId 44
    expect(res.rows[1].prezzo).toBeCloseTo(9.80, 2)
  })
})
