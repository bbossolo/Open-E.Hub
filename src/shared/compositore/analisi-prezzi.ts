/**
 * ANALISI PREZZI — scomposizione di un prezzo unitario in manodopera, materiale,
 * noli e varie, con Spese Generali % e Utile d'Impresa % (schema standard dei
 * capitolati di lavori pubblici: costo diretto → +SG% → subtotale → +UI% →
 * prezzo unitario). Le righe si pescano dalla STESSA ricerca prezzario del
 * resto di μ (ogni prezzario regionale ha già un capitolo di tariffe orarie
 * manodopera, es. Veneto "RU" — nessuna fonte dati nuova) oppure sono custom.
 *
 * Modulo PURO (nessun DOM), condiviso accanto a `cart-item.ts`/`libreria.ts`.
 */

export type AnalisiRigaTipo = 'manodopera' | 'materiale' | 'nolo' | 'varie'

export interface AnalisiRiga {
  tipo: AnalisiRigaTipo
  descrizione: string
  um: string
  quantita: number
  prezzoUnitario: number
  /** presente solo se la riga è stata pescata da un prezzario reale (tracciabilità). */
  fonte?: { codice: string; regione: string; anno: string }
}

export interface AnalisiPrezzi {
  /** id stabile (kebab), come VocePronta.id */
  id: string
  /** codice utente, es. "AP01" */
  codice: string
  descrizioneBreve: string
  descrizioneEstesa?: string
  /** unità di misura del prezzo unitario finale (es. "mq", "cad") */
  um: string
  /** opzionale: FK a FRASARIO, per ricalcolare la descrizione col motore componi.ts */
  famigliaId?: string
  righe: AnalisiRiga[]
  /** Spese Generali %, default 15 — editabile per singola analisi. */
  speseGeneraliPct: number
  /** Utile d'Impresa %, default 10 — editabile per singola analisi. */
  utileImpresaPct: number
  note?: string
}

export interface AnalisiTotali {
  totManodopera: number
  totMateriali: number
  totNoli: number
  totVarie: number
  costoDiretto: number
  speseGenerali: number
  subtotale: number
  utileImpresa: number
  /** costoDiretto + speseGenerali + utileImpresa, arrotondato a 2 decimali. */
  prezzoUnitario: number
}

export const DEFAULT_SPESE_GENERALI_PCT = 15
export const DEFAULT_UTILE_IMPRESA_PCT = 10

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const importoRiga = (r: AnalisiRiga): number => (r.quantita || 0) * (r.prezzoUnitario || 0)

const sommaTipo = (righe: AnalisiRiga[], tipo: AnalisiRigaTipo): number =>
  righe.filter((r) => r.tipo === tipo).reduce((s, r) => s + importoRiga(r), 0)

/**
 * Calcolo puro: costo diretto = Σ(quantità×prezzoUnitario) di tutte le righe;
 * Spese Generali % sul costo diretto; Utile d'Impresa % sul subtotale
 * (costo diretto + SG) — schema standard dei capitolati di lavori pubblici.
 */
export function calcolaAnalisi(a: AnalisiPrezzi): AnalisiTotali {
  const righe = a.righe || []
  const totManodopera = sommaTipo(righe, 'manodopera')
  const totMateriali = sommaTipo(righe, 'materiale')
  const totNoli = sommaTipo(righe, 'nolo')
  const totVarie = sommaTipo(righe, 'varie')
  const costoDiretto = totManodopera + totMateriali + totNoli + totVarie
  const speseGenerali = costoDiretto * ((a.speseGeneraliPct || 0) / 100)
  const subtotale = costoDiretto + speseGenerali
  const utileImpresa = subtotale * ((a.utileImpresaPct || 0) / 100)
  const prezzoUnitario = round2(subtotale + utileImpresa)
  return {
    totManodopera: round2(totManodopera),
    totMateriali: round2(totMateriali),
    totNoli: round2(totNoli),
    totVarie: round2(totVarie),
    costoDiretto: round2(costoDiretto),
    speseGenerali: round2(speseGenerali),
    subtotale: round2(subtotale),
    utileImpresa: round2(utileImpresa),
    prezzoUnitario,
  }
}

/** Incidenza % della manodopera sul prezzo unitario finale — dato richiesto nei nuovi prezzi. */
export const incidenzaManodopera = (t: AnalisiTotali): number =>
  t.prezzoUnitario > 0 ? round2((t.totManodopera / t.prezzoUnitario) * 100) : 0
