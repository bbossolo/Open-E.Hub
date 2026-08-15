/** Tipi di dominio condivisi dal motore di Price (puro, senza DOM). */

import type { AnalisiRigaTipo } from '../../../shared/compositore/analisi-prezzi'

/**
 * Componente della scomposizione UFFICIALE di una voce in opera:
 * le analisi per componenti che Lombardia (`<risorse>`) ed EASY (`vocedettaglio`)
 * portano nel grezzo. `um`/`descrizione` sono presenti SOLO quando il codice non
 * risolve a una riga del catalogo stesso (orfano) — altrimenti si risolvono a
 * runtime col join per codice, senza duplicare i testi nel pack.
 */
export interface RisorsaComponente {
  codice: string
  /** Già mappato al vocabolario delle analisi prezzi (sezioni A/B/C/D). */
  tipo: AnalisiRigaTipo
  quantita: number
  /** Prezzo unitario dal grezzo: fallback quando il codice non risolve a catalogo. */
  prezzo: number
  um?: string
  descrizione?: string
}

/**
 * Riga normalizzata di prezzario — schema unico verso cui ogni parser (legacy
 * euristico e i futuri parser per-famiglia) deve convergere. Sorgente di verità:
 * gli oggetti `rows.push({...})` del monolite PriceList_v2_3.html.
 */
export interface PriceRow {
  codice: string
  /** Descrizione estesa/declaratoria (eventualmente ereditata dal padre). */
  declaratoria: string
  /** Anteprima breve a una riga. */
  desc_short: string
  um: string
  prezzo: number
  /** Importo senza spese generali e utili d'impresa (0 se non disponibile). */
  importo_netto: number
  /** Incidenza/rapporto manodopera (%). */
  ru: number
  liv1: string
  liv2: string
  liv3: string
  liv4: string
  materia: string
  disciplina: string
  sistema: string
  attivita: string
  settore: string
  keywords: string
  tipologia: string
  regione: string
  anno: string
  /** Macro-tematica trasversale (classificata a runtime, vedi tematiche.ts). */
  tematica?: string
  /** Macrocategorie impianti 0..n (classificate a runtime, vedi macrocategorie.ts). */
  macro?: string[]
  /** Scomposizione ufficiale in componenti, se il prezzario la porta. */
  risorse?: RisorsaComponente[]
}

/** Regione/anno rilevati dal contenuto durante il parsing (può essere parziale). */
export interface Detected {
  regione: string | null
  anno: string | null
}

/** Metadati di un prezzario normalizzato. */
export interface PrezzarioMeta {
  regione: string | null
  anno: string | null
  /** Famiglia di formato del grezzo (es. 'easy', 'veneto', 'lombardia'). */
  family: string
  /** Percorso del grezzo dentro prezzari-src/ (tracciabilità). */
  source: string
  /** Numero di voci. */
  count: number
  /** Categoria per il raggruppamento in sidebar (default 'pubblico'). */
  categoria?: 'pubblico' | 'privato' | 'metel'
}

/**
 * Prezzario impacchettato per il disco/runtime: tabella stringhe condivisa
 * (`dict`) + righe come tuple posizionali, per eliminare la ripetizione di
 * chiavi e valori categoriali. Vedi pack.ts per il contratto.
 */
export interface PackedPrezzario {
  schema: 1
  meta: PrezzarioMeta
  /** Colonne memorizzate inline nella tupla (valori unici: codice, testi, numeri). */
  inlineCols: string[]
  /** Colonne codificate come indice in `dict` (campi categoriali a bassa cardinalità). */
  dictCols: string[]
  /** Tabella stringhe deduplicata, riferita dalle colonne `dictCols`. */
  dict: string[]
  /** Una tupla per voce: prima i valori `inlineCols`, poi gli indici `dictCols`. */
  rows: (string | number)[][]
  /** Scomposizioni per componenti — ADDITIVO: assente nei prezzari senza analisi. */
  componenti?: PackedComponenti
}

/**
 * Scomposizioni impacchettate: una lista di tuple numeriche per indice di riga.
 * `cols` documenta la tupla (self-describing come inlineCols); `cod`/`um`/`desc`
 * sono indici nella `dict` condivisa (-1 = campo assente perché il codice risolve
 * a catalogo e i testi si ricavano a runtime dal join).
 */
export interface PackedComponenti {
  /** Colonne della tupla: ['cod', 'tipo', 'qta', 'prezzo', 'um', 'desc']. */
  cols: string[]
  /** Indice riga (posizione in `rows`) → tuple componenti. */
  byRow: Record<number, number[][]>
}

/** Esito di un parser: righe + metadati rilevati dal contenuto. */
export interface ParseResult extends Detected {
  rows: PriceRow[]
}

/** Cella generica di un foglio (output di XLSX.utils.sheet_to_json header:1). */
export type CellRow = (string | number | boolean | null | undefined)[]
