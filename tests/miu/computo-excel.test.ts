import { describe, it, expect } from 'vitest'
import { computoMetricoAOA, computoMetricoFileName } from '../../src/tools/miu/engine'
import type { ComputoExcelRiga } from '../../src/tools/miu/engine/computo-excel'

const righe: ComputoExcelRiga[] = [
  { codice: 'VEN26-EL.01.001', descrizione: 'Tubo corrugato', categoria: 'Impianti elettrici · Tubazioni', um: 'm', quantita: 100, prezzoUnitario: 2.5 },
  { codice: 'NP.001', descrizione: 'Quadro composto a mano', um: 'cad', quantita: 1, prezzoUnitario: 450 },
]

describe('computoMetricoAOA', () => {
  it('produce intestazione, una riga per voce e il totale', () => {
    const aoa = computoMetricoAOA(righe)
    const flat = aoa.map((r) => r.join('|')).join('\n')
    expect(flat).toContain('COMPUTO METRICO')
    expect(flat).toContain('Codice|Descrizione|Categoria|U.M.|Quantità|Prezzo unitario|Importo')
    expect(flat).toContain('VEN26-EL.01.001')
    expect(flat).toContain('Tubo corrugato')
    expect(flat).toContain('Impianti elettrici · Tubazioni')
    expect(flat).toContain('NP.001')
  })

  it('calcola importo = quantità × prezzo per riga e il totale finale', () => {
    const aoa = computoMetricoAOA(righe)
    const rigaTubo = aoa.find((r) => r[0] === 'VEN26-EL.01.001')
    expect(rigaTubo![6]).toBe(250) // 100 * 2.5
    const rigaTotale = aoa.find((r) => r[5] === 'Totale computo')
    expect(rigaTotale![6]).toBe(700) // 250 + 450
  })

  it('categoria assente ⇒ stringa vuota, non un crash', () => {
    const aoa = computoMetricoAOA(righe)
    const rigaComposta = aoa.find((r) => r[0] === 'NP.001')
    expect(rigaComposta![2]).toBe('')
  })

  it('array vuoto ⇒ solo intestazione e totale a zero', () => {
    const aoa = computoMetricoAOA([])
    const rigaTotale = aoa.find((r) => r[5] === 'Totale computo')
    expect(rigaTotale![6]).toBe(0)
  })
})

describe('computoMetricoFileName', () => {
  it('include la data ISO', () => {
    const name = computoMetricoFileName(new Date('2026-08-11T10:00:00Z'))
    expect(name).toBe('computo-metrico-2026-08-11.xlsx')
  })
})
