import { describe, it, expect } from 'vitest'
import { parseVda } from '../../src/tools/miu/engine/parsers/vda'

// Grid calibrata sui dati reali del prezzario Valle d'Aosta 2026 (capitoli
// Impianti Elettrici P60 e Opere Edili M/S): riga-titolo (capitolo/sezione),
// voce su 2 righe (codice+desc poi um+prezzo), voce a riga singola.
const grid: unknown[][] = [
  ['Codice', 'DESCRIZIONE', 'U.m.', '2026', '% MdO 2026'],
  ['', '', '', '', ''],
  ['', 'P60 - MATERIALI - IMPIANTI ELETTRICI', '', '', ''],
  ['', '', '', '', ''],
  ['P60.A01.001', 'Corda di rame nudo, classe2, da 6 a 120 mmq', '', '', ''],
  ['', '', 'kg', '19.46', ''],
  ['', '', '', '', ''],
  ['P60.A02', 'DISPERSORI', '', '', ''],
  ['', '', '', '', ''],
  ['P60.A02.001', 'Puntazza dispersore in acciaio zincato a croce L= 100 cm', '', '', ''],
  ['', '', 'cad', '15.88', '25,5'],
  ['', '', '', '', ''],
  ['M', 'MANODOPERA (RISORSE UMANE)', '', '', ''],
  ['', '', '', '', ''],
  ['M00.A00', 'Costo orario', '', '', ''],
  ['', '', '', '', ''],
  ['M00.A00.001', 'Operaio specializzato IV livello', '', '', ''],
  ['', '', '€/ora', '45.93', ''],
]

describe('parseVda — Valle d\'Aosta 2026 (elettrico+edile, gerarchia a profondità variabile)', () => {
  const res = parseVda(grid, { anno: '2026' })

  it('regione dal fallback, anno dal fallback', () => {
    expect(res.regione).toBe("Valle d'Aosta")
    expect(res.anno).toBe('2026')
  })

  it('salta la riga di intestazione colonne (il valore "2026" non è un prezzo)', () => {
    expect(res.rows.some(r => r.codice === 'Codice')).toBe(false)
  })

  it('una voce per ogni codice a 3 livelli con prezzo su riga seguente', () => {
    expect(res.rows.map(r => r.codice)).toEqual(['P60.A01.001', 'P60.A02.001', 'M00.A00.001'])
  })

  it('mappa prezzo, um, %MdO e capitolo/sezione in gerarchia', () => {
    const corda = res.rows[0]
    expect(corda.prezzo).toBeCloseTo(19.46, 2)
    expect(corda.um).toBe('kg')
    expect(corda.ru).toBe(0)
    expect(corda.liv1).toBe('P60 - MATERIALI - IMPIANTI ELETTRICI')
    expect(corda.desc_short).toContain('Corda di rame nudo')

    const puntazza = res.rows[1]
    expect(puntazza.prezzo).toBeCloseTo(15.88, 2)
    expect(puntazza.ru).toBeCloseTo(25.5, 1)
    expect(puntazza.liv1).toBe('P60 - MATERIALI - IMPIANTI ELETTRICI')
    expect(puntazza.liv2).toBe('DISPERSORI')
  })

  it('capitolo diverso (M — manodopera) resetta lo stack gerarchico', () => {
    const operaio = res.rows[2]
    expect(operaio.prezzo).toBeCloseTo(45.93, 2)
    expect(operaio.um).toBe('€/ora')
    expect(operaio.liv1).toBe('MANODOPERA (RISORSE UMANE)')
    expect(operaio.liv2).toBe('Costo orario')
  })
})
