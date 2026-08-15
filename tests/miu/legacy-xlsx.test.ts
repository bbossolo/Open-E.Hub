import { describe, it, expect } from 'vitest'
import { parseXlsxRows } from '../../src/tools/miu/engine/legacy-xlsx'
import type { CellRow } from '../../src/tools/miu/engine/types'

describe('parseXlsxRows — baseline euristica (caratterizzazione)', () => {
  it('formato gerarchico piatto (stile Veneto): righe-capitolo senza prezzo, categorie derivate', () => {
    const raw: CellRow[] = [
      ['Codice', 'Descrizione', 'UM', 'Prezzo'],
      ['VEN25-01', 'OPERE EDILI', '', ''],          // capitolo (no prezzo)
      ['VEN25-01.02', 'SCAVI', '', ''],             // capitolo (no prezzo)
      ['VEN25-01.02.01', 'Scavo di pulizia generale', 'm²', '3,40'], // voce
    ]
    const { rows, regione } = parseXlsxRows(raw)
    expect(rows).toHaveLength(1)            // le righe-capitolo (prezzo 0) sono scartate
    const r = rows[0]
    expect(r.codice).toBe('VEN25-01.02.01')
    expect(r.prezzo).toBeCloseTo(3.4, 6)    // virgola decimale → punto
    expect(r.um).toBe('m²')
    expect(regione).toBe('Veneto')          // prefisso codice VEN → Veneto
    expect(r.regione).toBe('Veneto')
    // categorie derivate dall'albero capitoli: disciplina = radice, settore = ultimo padre
    expect(r.disciplina).toBe('OPERE EDILI')
    expect(r.settore).toBe('SCAVI')
    expect(r.sistema).toBe('')              // solo 2 livelli → sistema vuoto
  })

  it('colonne categoria esplicite (stile Lombardia): nessuna derivazione, UM ripulita, netto/man', () => {
    const raw: CellRow[] = [
      ['Codice', 'Declaratoria', 'Desum', 'Prezzo', 'Disciplina', 'Sistema', 'Settore', 'Importo netto', 'Man'],
      ['LOM261.A.01', 'Tubo PVC', '1 m', '12,50', 'Idraulica', 'Smaltimento', 'Tubi', '10,00', '34,97'],
    ]
    const { rows, regione } = parseXlsxRows(raw)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(regione).toBe('Lombardia')
    expect(r.um).toBe('m')                  // prefisso numerico "1 " rimosso
    expect(r.prezzo).toBeCloseTo(12.5, 6)
    expect(r.importo_netto).toBeCloseTo(10, 6)
    expect(r.ru).toBeCloseTo(34.97, 6)
    expect(r.disciplina).toBe('Idraulica') // colonne esplicite, non derivate
    expect(r.sistema).toBe('Smaltimento')
    expect(r.settore).toBe('Tubi')
  })

  it('rileva la riga di intestazione anche se preceduta da righe di titolo', () => {
    const raw: CellRow[] = [
      ['Prezzario Regionale 2025', '', '', ''],     // titolo
      ['', '', '', ''],                             // riga vuota
      ['Codice', 'Descrizione', 'UM', 'Prezzo'],    // vera intestazione (riga 2)
      ['CAL25_01', 'Voce di prova', 'cad', '5,00'],
    ]
    const { rows } = parseXlsxRows(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0].codice).toBe('CAL25_01')
    expect(rows[0].prezzo).toBeCloseTo(5, 6)
  })

  it('input vuoto o senza dati → nessuna riga', () => {
    expect(parseXlsxRows([]).rows).toEqual([])
    expect(parseXlsxRows([['Codice', 'Prezzo']]).rows).toEqual([])
  })
})
