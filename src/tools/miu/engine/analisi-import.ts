/**
 * Import della scomposizione UFFICIALE di una voce di prezzario nell'Analisi
 * Prezzi del compositore — motore puro, senza DOM.
 *
 * Le voci in opera di Lombardia/EASY portano `PriceRow.risorse` (componenti con
 * codice, tipo, quantità, prezzo). I testi correnti si risolvono a RUNTIME col
 * join per codice sul catalogo caricato (le risorse sono a loro volta righe del
 * prezzario); i valori memorizzati nel componente sono il fallback per i codici
 * orfani. Ogni riga importata porta la `fonte` per la tracciabilità.
 */
import type { AnalisiRiga } from '../../../shared/compositore/analisi-prezzi'
import type { PriceRow } from './types'

/** Indice codice → riga del catalogo (per il join delle risorse). */
export function indicePerCodice(rows: PriceRow[]): Map<string, PriceRow> {
  const m = new Map<string, PriceRow>()
  for (const r of rows) if (r.codice && !m.has(r.codice)) m.set(r.codice, r)
  return m
}

/**
 * Converte la scomposizione di `row` in righe di Analisi Prezzi.
 * Descrizione/um dalla riga di catalogo se il codice risolve, altrimenti dai
 * valori memorizzati nel pack (fallback finale descrizione = codice). Il PREZZO
 * resta quello della scomposizione: è il costo NETTO ufficiale usato dalla
 * regione (il prezzo di catalogo è LORDO di SG+utile — usandolo l'analisi li
 * conterebbe due volte; verificato su Lombardia: Σ netti × 1,15 × 1,10 = prezzo
 * di listino esatto). Il catalogo copre solo i componenti senza prezzo.
 * Ritorna [] se la voce non ha scomposizione.
 */
export function scomposizioneToRighe(row: PriceRow, byCodice?: Map<string, PriceRow>): AnalisiRiga[] {
  if (!row.risorse?.length) return []
  return row.risorse.map(c => {
    const cat = byCodice?.get(c.codice)
    return {
      tipo: c.tipo,
      descrizione: (cat?.desc_short || c.descrizione || c.codice).trim(),
      um: (cat?.um || c.um || '').trim(),
      quantita: c.quantita,
      prezzoUnitario: c.prezzo || cat?.importo_netto || cat?.prezzo || 0,
      fonte: {
        codice: c.codice,
        regione: cat?.regione || row.regione || '',
        anno: cat?.anno || row.anno || '',
      },
    }
  })
}

/** True se la voce porta una scomposizione importabile (badge/affordance UI). */
export function hasScomposizione(row: Pick<PriceRow, 'risorse'>): boolean {
  return !!row.risorse?.length
}
