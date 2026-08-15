import { describe, it, expect } from 'vitest'
import { analisiPrezziAOA, analisiPrezziFileName, fascicoloIndiceAOA, fascicoloSheetName, fascicoloFileName } from '../../src/tools/miu/engine'
import type { AnalisiPrezzi } from '../../src/tools/miu/engine'

const analisi: AnalisiPrezzi = {
  id: 'ap-test', codice: 'AP01', descrizioneBreve: 'Fornitura e posa cassetta',
  um: 'cad', speseGeneraliPct: 15, utileImpresaPct: 10,
  righe: [
    { tipo: 'manodopera', descrizione: 'Operaio specializzato', um: 'h', quantita: 2, prezzoUnitario: 33.03, fonte: { codice: 'VEN25-RU.01.02.a', regione: 'Veneto', anno: '2025' } },
    { tipo: 'materiale', descrizione: 'Cassetta da incasso', um: 'cad', quantita: 1, prezzoUnitario: 8.5 },
  ],
}

describe('analisiPrezziAOA', () => {
  it('produce una matrice con intestazione, sezioni e riepilogo', () => {
    const aoa = analisiPrezziAOA(analisi)
    const flat = aoa.map((r) => r.join('|')).join('\n')
    expect(flat).toContain('ANALISI PREZZI')
    expect(flat).toContain('AP01')
    expect(flat).toContain('MANODOPERA')
    expect(flat).toContain('MATERIALI')
    expect(flat).toContain('Operaio specializzato')
    expect(flat).toContain('VEN25-RU.01.02.a')
    expect(flat).toContain('QUADRO ECONOMICO')
  })

  it('non emette sezioni per tipi senza righe (noli/varie assenti qui)', () => {
    const aoa = analisiPrezziAOA(analisi)
    const flat = aoa.map((r) => r.join('|')).join('\n')
    expect(flat).not.toContain('NOLI')
    expect(flat).not.toContain('VARIE')
  })

  it('il prezzo unitario finale in tabella coincide con calcolaAnalisi', () => {
    const aoa = analisiPrezziAOA(analisi)
    const rigaFinale = aoa.find((r) => String(r[4] ?? '').startsWith('PREZZO DI APPLICAZIONE'))
    expect(rigaFinale).toBeDefined()
    // costo diretto = 2*33.03 + 8.5 = 74.56; SG15%=11.184->11.18; subtotale=85.74;
    // UI10%=8.574->8.57; prezzo=94.31 circa — nel quadro economico l'importo sta in colonna 5
    expect(rigaFinale![5] as number).toBeCloseTo(94.31, 1)
    // incidenza manodopera dichiarata (richiesta nei nuovi prezzi)
    expect(aoa.some((r) => String(r[4] ?? '') === 'Incidenza manodopera')).toBe(true)
  })

  it('ogni riga con fonte prezzario riporta codice/regione/anno', () => {
    const aoa = analisiPrezziAOA(analisi)
    // struttura tecnica: colonna 0 = Codice (fonte), colonna 1 = Descrizione (+regione anno)
    const riga = aoa.find((r) => r[0] === 'VEN25-RU.01.02.a')
    expect(riga).toBeDefined()
    expect(riga![1]).toContain('Operaio specializzato')
    expect(riga![1]).toContain('Veneto 2025')
  })
})

describe('analisiPrezziFileName', () => {
  it('genera un nome file slug + suffisso stabile', () => {
    expect(analisiPrezziFileName(analisi)).toBe('ap01-analisi-prezzi.xlsx')
  })
  it('senza codice ripiega su "analisi"', () => {
    expect(analisiPrezziFileName({ ...analisi, codice: '' })).toBe('analisi-analisi-prezzi.xlsx')
  })
})

describe('fascicolo multi-analisi (toolbar, mockup variante A)', () => {
  const seconda: AnalisiPrezzi = {
    id: 'ap-2', codice: '', descrizioneBreve: 'Gruppo frigorifero — Aermec NRK H',
    um: 'cad', speseGeneraliPct: 15, utileImpresaPct: 10,
    righe: [{ tipo: 'materiale', descrizione: 'Aermec NRK H', um: 'cad', quantita: 1, prezzoUnitario: 2500 }],
  }

  it("l'Indice elenca tutte le analisi con U.M. e prezzo unitario calcolato", () => {
    const aoa = fascicoloIndiceAOA([analisi, seconda])
    const flat = aoa.map((r) => r.join('|')).join('\n')
    expect(flat).toContain('FASCICOLO ANALISI PREZZI')
    expect(flat).toContain('Analisi contenute|2')
    expect(flat).toContain('AP01')
    expect(flat).toContain('Gruppo frigorifero — Aermec NRK H')
    // codice mancante ⇒ progressivo APnn, mai cella vuota
    expect(flat).toContain('AP02')
  })

  it('nomi foglio: unici, con progressivo, validi per Excel (≤31 char, niente []:*?/\\)', () => {
    expect(fascicoloSheetName(analisi, 0)).toBe('01 · AP01')
    const lungo = fascicoloSheetName({ ...seconda, descrizioneBreve: 'Gruppo frigorifero condensato ad aria con recupero [totale] a/b:c' }, 1)
    expect(lungo.length).toBeLessThanOrEqual(31)
    expect(lungo).not.toMatch(/[[\]:*?/\\]/)
    expect(lungo.startsWith('02 · ')).toBe(true)
  })

  it('nome file con data ISO (export ripetuti non si sovrascrivono)', () => {
    expect(fascicoloFileName(new Date('2026-07-08T12:00:00Z'))).toBe('fascicolo-analisi-prezzi-2026-07-08.xlsx')
  })
})
