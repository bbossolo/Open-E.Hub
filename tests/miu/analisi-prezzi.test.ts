import { describe, it, expect } from 'vitest'
import { calcolaAnalisi, DEFAULT_SPESE_GENERALI_PCT, DEFAULT_UTILE_IMPRESA_PCT, isNoloRow, isMaterialeRow, type AnalisiPrezzi, type AnalisiRiga, type PriceRow } from '../../src/tools/miu/engine'

function analisi(righe: AnalisiRiga[], overrides: Partial<AnalisiPrezzi> = {}): AnalisiPrezzi {
  return {
    id: 'ap-test', codice: 'AP01', descrizioneBreve: 'Voce di test', um: 'cad',
    righe, speseGeneraliPct: DEFAULT_SPESE_GENERALI_PCT, utileImpresaPct: DEFAULT_UTILE_IMPRESA_PCT,
    ...overrides,
  }
}

describe('calcolaAnalisi — scomposizione prezzo (manodopera/materiale/noli/varie + SG%/UI%)', () => {
  it('nessuna riga → tutti i totali a zero', () => {
    const t = calcolaAnalisi(analisi([]))
    expect(t.costoDiretto).toBe(0)
    expect(t.speseGenerali).toBe(0)
    expect(t.utileImpresa).toBe(0)
    expect(t.prezzoUnitario).toBe(0)
  })

  it('una sola riga di manodopera: costo diretto = qty×prezzo, SG e UI in sequenza sul giusto importo', () => {
    // 2h × 34.94 = 69.88 costo diretto
    const t = calcolaAnalisi(analisi([
      { tipo: 'manodopera', descrizione: 'Operaio 4° livello edile', um: 'h', quantita: 2, prezzoUnitario: 34.94 },
    ]))
    expect(t.totManodopera).toBe(69.88)
    expect(t.totMateriali).toBe(0)
    expect(t.costoDiretto).toBe(69.88)
    // SG 15% su 69.88 = 10.482 → 10.48
    expect(t.speseGenerali).toBeCloseTo(10.48, 2)
    // subtotale = 69.88 + 10.48 = 80.36 (arrotondato)
    const subtotaleAtteso = 69.88 + 69.88 * 0.15
    expect(t.subtotale).toBeCloseTo(subtotaleAtteso, 2)
    // UI 10% sul subtotale (NON sul solo costo diretto)
    const utileAtteso = subtotaleAtteso * 0.10
    expect(t.utileImpresa).toBeCloseTo(utileAtteso, 2)
    expect(t.prezzoUnitario).toBeCloseTo(subtotaleAtteso + utileAtteso, 2)
  })

  it('righe multiple per ciascuno dei 4 tipi si sommano nel rispettivo subtotale', () => {
    const t = calcolaAnalisi(analisi([
      { tipo: 'manodopera', descrizione: 'Op. specializzato', um: 'h', quantita: 1, prezzoUnitario: 33.03 },
      { tipo: 'manodopera', descrizione: 'Op. comune', um: 'h', quantita: 1, prezzoUnitario: 27.33 },
      { tipo: 'materiale', descrizione: 'Cavo FG16', um: 'm', quantita: 10, prezzoUnitario: 1.5 },
      { tipo: 'materiale', descrizione: 'Guaina', um: 'm', quantita: 10, prezzoUnitario: 0.8 },
      { tipo: 'nolo', descrizione: 'Nolo piattaforma', um: 'h', quantita: 2, prezzoUnitario: 12 },
      { tipo: 'varie', descrizione: 'Trasporto', um: 'a corpo', quantita: 1, prezzoUnitario: 20 },
    ], { speseGeneraliPct: 0, utileImpresaPct: 0 }))
    expect(t.totManodopera).toBeCloseTo(33.03 + 27.33, 2)
    expect(t.totMateriali).toBeCloseTo(15 + 8, 2)
    expect(t.totNoli).toBeCloseTo(24, 2)
    expect(t.totVarie).toBeCloseTo(20, 2)
    expect(t.costoDiretto).toBeCloseTo(33.03 + 27.33 + 15 + 8 + 24 + 20, 2)
    // SG/UI a 0% → prezzo unitario coincide col costo diretto
    expect(t.prezzoUnitario).toBeCloseTo(t.costoDiretto, 2)
  })

  it('SG% e UI% a zero: il prezzo unitario è esattamente il costo diretto', () => {
    const t = calcolaAnalisi(analisi([
      { tipo: 'materiale', descrizione: 'X', um: 'cad', quantita: 3, prezzoUnitario: 10 },
    ], { speseGeneraliPct: 0, utileImpresaPct: 0 }))
    expect(t.costoDiretto).toBe(30)
    expect(t.speseGenerali).toBe(0)
    expect(t.utileImpresa).toBe(0)
    expect(t.prezzoUnitario).toBe(30)
  })

  it('il prezzo unitario è sempre arrotondato a 2 decimali', () => {
    const t = calcolaAnalisi(analisi([
      { tipo: 'materiale', descrizione: 'X', um: 'cad', quantita: 3, prezzoUnitario: 10.333 },
    ]))
    expect(Number.isInteger(t.prezzoUnitario * 100)).toBe(true)
  })
})

describe('filtri sezioni B/C — solo righe PERTINENTI dai prezzari (rilievo utente)', () => {
  const riga = (desc: string, um = 'cad', declaratoria = ''): Pick<PriceRow, 'um' | 'desc_short' | 'codice' | 'declaratoria'> =>
    ({ um, desc_short: desc, codice: 'X', declaratoria })

  it('noli: passa solo il capitolo noleggi (NOLO/NOLEGGIO in testa)', () => {
    expect(isNoloRow(riga('NOLO di escavatore cingolato con operatore', 'h'))).toBe(true)
    expect(isNoloRow(riga('Noleggio piattaforma aerea autocarrata', 'giorno'))).toBe(true)
    // opera compiuta che CITA un nolo nel corpo: fuori
    expect(isNoloRow(riga('Scavo a sezione obbligata, compreso nolo del mezzo', 'm³'))).toBe(false)
    expect(isNoloRow(riga('Operaio specializzato', 'h'))).toBe(false)
  })

  it('materiali: costi elementari — escluse opere «in opera», manodopera e noli', () => {
    expect(isMaterialeRow(riga('Tubo in PVC rigido ⌀ 25 mm', 'm'))).toBe(true)
    expect(isMaterialeRow(riga('Cassetta da incasso 503', 'cad'))).toBe(true)
    // opera compiuta (comprende già la manodopera): fuori dalle componenti elementari
    expect(isMaterialeRow(riga('Fornitura e posa in opera di tubo in PVC', 'm'))).toBe(false)
    expect(isMaterialeRow(riga('Tubo corrugato', 'm', 'dato in opera a regola d\'arte'))).toBe(false)
    expect(isMaterialeRow(riga('OPERAIO SPECIALIZZATO', 'h'))).toBe(false)
    expect(isMaterialeRow(riga('NOLO di autogru', 'h'))).toBe(false)
  })
})
