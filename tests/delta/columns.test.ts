import { describe, it, expect } from 'vitest'
import {
  normalizeHeaderText, detectHeaderRow, elencoConfidence, scoreHeaderRow, matchColumn, suggestFieldColumn,
  transposeGrid, detectOrientation,
} from '../../src/tools/delta/engine/columns'
import { parseElenco, mergeSheets, mergeElencos } from '../../src/tools/delta/engine/csv-map'

// Griglia calibrata su una struttura reale osservata (elenco elaborati
// Progetti): 3 righe di preambolo (Commessa/Cliente/Impianto) + 1 vuota +
// l'intestazione vera, prima dei dati.
const REAL_GRID: unknown[][] = [
  ['Commessa', 'CENTRO DEMO LOGISTICO'],
  ['Cliente', 'STUDIO DEMO COSTRUZIONI S.P.A.'],
  ['Impianto', 'ELETTRICO', null, null, ' '],
  [],
  ['CODICE COMMESSA', 'FASE PROGETTO', 'Disciplina', 'TIPO DI ELABORATO', 'EDIFICIO, ZONA o AMBITO', 'TIPO IMPIANTO', 'PROGRESSIVO', 'REVISIONE', 'CODICE ELABORATO', 'TITOLO  CARTIGLIO', 'SCALA', 'DATA', 'FORMATO', 'STATO'],
  ['A123', 'E', 'EL', 'RT', 'GEN', 'EL', '01', 'a', 'A123_E_EL_RT_GEN-EL01a', 'RELAZIONE TECNICA IMPIANTI ELETTRICI', '-', '4/17/26', 'A4', '100%'],
  ['A123', 'E', 'EL', 'PL', 'EXT', 'DR', '01', 'a', 'A123_E_EL_PL_EXT-DR01a', 'PLANIMETRIA GENERALE', '1:250', '4/17/26', 'A0', '10%'],
]

describe('δ columns — normalizeHeaderText', () => {
  it('minuscole, senza accenti/punteggiatura, spazi collassati', () => {
    expect(normalizeHeaderText('TITOLO  CARTIGLIO')).toBe('titolo cartiglio')
    expect(normalizeHeaderText('Commessa n°')).toBe('commessa n')
    expect(normalizeHeaderText('EDIFICIO, ZONA o AMBITO')).toBe('edificio zona o ambito')
    expect(normalizeHeaderText('')).toBe('')
    expect(normalizeHeaderText(null)).toBe('')
  })
})

describe('δ columns — detectHeaderRow', () => {
  it('trova la riga di intestazione vera oltre il preambolo (Commessa/Cliente/Impianto)', () => {
    expect(detectHeaderRow(REAL_GRID)).toBe(4)
  })
  it('elenco già pulito (riga 0 = intestazione) → resta 0', () => {
    const grid = [['Codice', 'Titolo'], ['E-01', 'Pianta']]
    expect(detectHeaderRow(grid)).toBe(0)
  })
  it('nessuna riga riconoscibile → fallback a 0', () => {
    const grid = [['Foo', 'Bar', 'Baz'], ['1', '2', '3']]
    expect(detectHeaderRow(grid)).toBe(0)
  })
  it('griglia vuota → 0', () => {
    expect(detectHeaderRow([])).toBe(0)
  })
})

describe('δ columns — elencoConfidence', () => {
  it('alta confidenza su un vero elenco elaborati', () => {
    expect(elencoConfidence(REAL_GRID)).toBeGreaterThan(0.8)
  })
  it('bassa/nulla confidenza su un foglio non tabellare (es. PAGINA INIZIALE)', () => {
    const grid = [['ELENCO ELABORATI', 'STUDIO DEMO COSTRUZIONI S.P.A.'], [], ['COMMESSA'], ['A123']]
    expect(elencoConfidence(grid)).toBeLessThan(0.5)
  })
})

describe('δ columns — parseElenco con headerRowIndex rilevato', () => {
  it('salta il preambolo e legge le righe dati vere', () => {
    const headerRow = detectHeaderRow(REAL_GRID)
    const e = parseElenco(REAL_GRID, 'A123.xlsx', headerRow)
    expect(e.headers).toContain('CODICE ELABORATO')
    expect(e.headers).toContain('TITOLO  CARTIGLIO')
    expect(e.rows).toHaveLength(2)
    expect(e.rows[0]['CODICE ELABORATO']).toBe('A123_E_EL_RT_GEN-EL01a')
    expect(e.rows[0]['TITOLO  CARTIGLIO']).toBe('RELAZIONE TECNICA IMPIANTI ELETTRICI')
  })
})

describe('δ columns — matchColumn', () => {
  const headers = REAL_GRID[4] as string[]
  it('trova la colonna reale per una chiave standard', () => {
    expect(matchColumn(headers, 'CODICE_COMMESSA')).toBe('CODICE COMMESSA')
    expect(matchColumn(headers, 'TITOLO_CARTIGLIO')).toBe('TITOLO  CARTIGLIO')
    expect(matchColumn(headers, 'SCALA')).toBe('SCALA')
    expect(matchColumn(headers, 'STATO')).toBe('STATO')
  })
  it('chiave ignota → null', () => {
    expect(matchColumn(headers, 'NON_ESISTE')).toBeNull()
  })
  it('nessun header combacia → null', () => {
    expect(matchColumn(['Foo', 'Bar'], 'SCALA')).toBeNull()
  })
})

describe('δ columns — suggestFieldColumn', () => {
  const headers = REAL_GRID[4] as string[]
  it('etichette tipiche del cartiglio trovano la colonna giusta', () => {
    expect(suggestFieldColumn('Commessa n°', headers)).toBe('CODICE COMMESSA')
    expect(suggestFieldColumn('Titolo Tavola', headers)).toBe('TITOLO  CARTIGLIO')
    expect(suggestFieldColumn('Tavola N°', headers)).toBe('CODICE ELABORATO')
    expect(suggestFieldColumn('Protocollo Tavola', headers)).toBe('CODICE ELABORATO')
    expect(suggestFieldColumn('Data di Emissione', headers)).toBe('DATA')
    expect(suggestFieldColumn('Scala', headers)).toBe('SCALA')
    expect(suggestFieldColumn('Revisione', headers)).toBe('REVISIONE')
    expect(suggestFieldColumn('Stato del Progetto', headers)).toBe('STATO')
  })
  it('«Committente»/«Oggetto»: metadati di progetto, non colonne per-riga → nessun suggerimento', () => {
    expect(suggestFieldColumn('Committente', headers)).toBeNull()
    expect(suggestFieldColumn('Oggetto', headers)).toBeNull()
  })
  it('etichetta libera che combacia testualmente con un header presente', () => {
    expect(suggestFieldColumn('disciplina', headers)).toBe('Disciplina')
  })
  it('etichetta senza alcun riscontro → null', () => {
    expect(suggestFieldColumn('Numero di telefono', headers)).toBeNull()
  })
})

describe('δ csv-map — mergeSheets', () => {
  const MECC_GRID: unknown[][] = [
    ['Commessa', 'CENTRO DEMO LOGISTICO'],
    ['Cliente', 'STUDIO DEMO COSTRUZIONI S.P.A.'],
    ['Impianto', 'MECCANICO'],
    [],
    ['CODICE COMMESSA', 'FASE PROGETTO', 'Disciplina', 'TIPO DI ELABORATO', 'EDIFICIO, ZONA o AMBITO', 'TIPO IMPIANTO', 'PROGRESSIVO', 'REVISIONE', 'CODICE ELABORATO', 'TITOLO  CARTIGLIO', 'SCALA', 'DATA', 'FORMATO', 'STATO'],
    ['A123', 'E', 'MC', 'RT', 'GEN', 'MC', '01', 'a', 'A123_E_MC_RT_GEN-MC01a', 'RELAZIONE TECNICA IMPIANTI MECCANICI', '-', '4/17/26', 'A4', '10%'],
  ]
  it('unisce più fogli in un solo elenco con colonna Foglio di provenienza', () => {
    const e = mergeSheets([{ name: 'E.E. ELETTRICO', grid: REAL_GRID }, { name: 'E.E. MECCANICO', grid: MECC_GRID }], 'A123.xlsx')
    expect(e.rows).toHaveLength(3) // 2 righe elettrico + 1 riga meccanico
    expect(e.headers).toContain('Foglio')
    expect(e.rows[0].Foglio).toBe('E.E. ELETTRICO')
    expect(e.rows[2].Foglio).toBe('E.E. MECCANICO')
    expect(e.rows[2]['CODICE ELABORATO']).toBe('A123_E_MC_RT_GEN-MC01a')
    expect(e.sheetName).toBe('E.E. ELETTRICO, E.E. MECCANICO')
  })

  it('mergeElencos ottiene lo stesso risultato di mergeSheets, partendo da Elenco già risolti', () => {
    const viaSheets = mergeSheets([{ name: 'E.E. ELETTRICO', grid: REAL_GRID }, { name: 'E.E. MECCANICO', grid: MECC_GRID }], 'A123.xlsx')
    const viaElencos = mergeElencos([
      { name: 'E.E. ELETTRICO', elenco: parseElenco(REAL_GRID, 'A123.xlsx', detectHeaderRow(REAL_GRID)) },
      { name: 'E.E. MECCANICO', elenco: parseElenco(MECC_GRID, 'A123.xlsx', detectHeaderRow(MECC_GRID)) },
    ], 'A123.xlsx')
    expect(viaElencos).toEqual(viaSheets)
  })
})

describe('δ columns — transposeGrid', () => {
  it('scambia righe e colonne', () => {
    const grid = [['a', 'b', 'c'], ['1', '2', '3']]
    expect(transposeGrid(grid)).toEqual([['a', '1'], ['b', '2'], ['c', '3']])
  })
  it('celle mancanti diventano stringa vuota (righe di lunghezza diversa)', () => {
    const grid = [['a', 'b'], ['1']]
    expect(transposeGrid(grid)).toEqual([['a', '1'], ['b', '']])
  })
  it('griglia vuota → []', () => {
    expect(transposeGrid([])).toEqual([])
  })
})

describe('δ columns — extraSynonyms (dizionario per-studio)', () => {
  it('detectHeaderRow riconosce una riga con sigle custom SOLO se insegnate', () => {
    const grid = [
      ['CMS', 'FS', 'DISC', 'TIT'],
      ['A123', 'E', 'IE', 'Quadro QE1'],
    ]
    expect(detectHeaderRow(grid)).toBe(0) // fallback storico: nessuna colonna nota, ma è l'unica riga
    expect(elencoConfidence(grid)).toBe(0) // senza dizionario, zero colonne riconosciute
    const extra = { cms: 'CODICE_COMMESSA', fs: 'FASE_PROGETTO', disc: 'DISCIPLINA' }
    expect(elencoConfidence(grid, extra)).toBeGreaterThan(0) // con l'alias insegnato, riconosciuta
  })
  it('matchColumn/suggestFieldColumn usano il dizionario per-studio prima di quello fisso', () => {
    const headers = ['CMS', 'Titolo']
    expect(matchColumn(headers, 'CODICE_COMMESSA')).toBeNull() // "CMS" non è un sinonimo fisso
    expect(matchColumn(headers, 'CODICE_COMMESSA', { cms: 'CODICE_COMMESSA' })).toBe('CMS')
    expect(suggestFieldColumn('Commessa n°', headers, { cms: 'CODICE_COMMESSA' })).toBe('CMS')
  })
})

describe('δ columns — detectOrientation', () => {
  it('elenco standard per righe → orientation rows', () => {
    const g = detectOrientation(REAL_GRID)
    expect(g.orientation).toBe('rows')
    expect(g.headerIndex).toBe(4)
  })
  it('stesso elenco trasposto (etichette in prima colonna) → orientation columns', () => {
    const transposed = transposeGrid(REAL_GRID)
    const g = detectOrientation(transposed)
    expect(g.orientation).toBe('columns')
    // detectOrientation ritrasporrà `transposed` per valutare l'ipotesi "colonne": la
    // ritrasposizione riporta all'indice di riga originale (4) dell'intestazione vera.
    expect(g.headerIndex).toBe(4)
  })
  it('griglia ambigua (nessuna colonna nota in nessun senso) → pareggio, vince rows', () => {
    const grid = [['x', 'y'], ['1', '2']]
    expect(detectOrientation(grid).orientation).toBe('rows')
  })
})

describe('δ columns — scoreHeaderRow', () => {
  it('punteggio di una riga specifica, coerente con elencoConfidence sulla riga rilevata', () => {
    const headerRow = REAL_GRID[detectHeaderRow(REAL_GRID)]
    expect(scoreHeaderRow(headerRow)).toBe(elencoConfidence(REAL_GRID))
  })
  it('riga vuota/non-array → 0', () => {
    expect(scoreHeaderRow([])).toBe(0)
    expect(scoreHeaderRow(undefined as unknown as unknown[])).toBe(0)
  })
})
