/**
 * SUGGERIMENTI di ricerca — layer puro sopra il motore rankizzato:
 * nessun secondo algoritmo. Compone il filtro macrocategoria
 * con `searchRows` e tronca ai primi N, nello stesso ordine di rilevanza.
 *
 * `suggestLabel` prepara i tre campi visibili di un suggerimento (titolo,
 * capitolo, prezzario) con i fallback: così il criterio «capitolo e prezzario
 * visibili» è logica testata, non markup.
 */

import { normQuery } from '../../../shared/compositore/thesaurus'
import { searchRows } from './search'
import type { PriceRow } from './types'

export interface SuggestOpts {
  /** Macrocategoria attiva: restringe il pool a monte del motore. */
  macro?: string
  /** Numero massimo di suggerimenti (default 8). */
  limit?: number
}

/** Etichetta di un suggerimento: i tre campi visibili nel dropdown. */
export interface SuggestLabel { titolo: string; capitolo: string; prezzario: string }

/** Lunghezza minima (normalizzata) perché la query produca suggerimenti. */
const MIN_QUERY = 2
/** Troncamento del titolo quando si ripiega sulla declaratoria. */
const TITLE_MAX = 90

/**
 * Suggerimenti per la ricerca globale: filtro macro + motore di ricerca + top-N.
 * Query vuota o troppo corta (<2 caratteri normalizzati) ⇒ [] (nessun rumore).
 */
export function suggestRows(rows: PriceRow[], q: unknown, opts: SuggestOpts = {}): PriceRow[] {
  const nq = normQuery(q)
  if (nq.length < MIN_QUERY) return []
  const { macro, limit = 8 } = opts
  const pool = macro ? rows.filter(r => (r.macro ?? []).includes(macro)) : rows
  return searchRows(pool, nq).slice(0, Math.max(0, limit))
}

/** Titolo/capitolo/prezzario di una voce, con fallback per i campi mancanti. */
export function suggestLabel(r: PriceRow): SuggestLabel {
  let titolo = String(r.desc_short ?? '').trim()
  if (!titolo) {
    const d = String(r.declaratoria ?? '').replace(/[\r\n]+/g, ' ').trim()
    titolo = d.length > TITLE_MAX ? d.slice(0, TITLE_MAX - 1).trimEnd() + '…' : d
  }
  if (!titolo) titolo = String(r.codice ?? '').trim() || '—'
  const capitolo = String(r.disciplina ?? '').trim() || String(r.tematica ?? '').trim() || '—'
  const prezzario = [String(r.regione ?? '').trim(), String(r.anno ?? '').trim()].filter(Boolean).join(' ') || '—'
  return { titolo, capitolo, prezzario }
}
