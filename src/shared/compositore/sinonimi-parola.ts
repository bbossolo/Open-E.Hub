/**
 * SINONIMI A LIVELLO DI PAROLA — gruppi di equivalenza tra singole parole del
 * gergo impiantistico: «punto luce interrotto» deve trovare le voci scritte
 * «interruttore», «presa stagna» le voci «IP65». Complementare al thesaurus
 * (che lavora per FAMIGLIE/frasi): qui si equiparano i singoli token liberi
 * della query, sia nel vincolo AND sia nel boost del ranking (vedi search.ts).
 *
 * Regole di inclusione (per non allargare la ricerca a sproposito):
 *  - solo equivalenze STRETTE del dominio (mai iperonimi: «quadro» NON è
 *    «quadrato», «esterno» NON è «ip65»);
 *  - le coppie singolare/plurale servono SOLO per le parole ≤4 lettere che lo
 *    stemming leggero non copre (tubo/tubi, cavo/cavi, vite/viti, fumo/fumi);
 *  - varianti multi-parola ammesse come FORME (matchano per substring), ma la
 *    chiave di lookup è sempre la singola parola stemmata.
 */

import { normQuery, stemToken } from './thesaurus'
import { GRUPPI_PAROLA_DATA } from 'compositore-catalog:sinonimi-parola'

/**
 * Gruppi di sinonimi a livello di parola. `compositore-catalog:sinonimi-parola`
 * risolve (alias di build, vedi vite.config.ts) ai dati veri; Open E.Hub non
 * porta dataset proprietari, quindi il bundle parte sempre dallo stub vuoto
 * (lo studio importa il proprio catalogo).
 */
export const GRUPPI_PAROLA: readonly (readonly string[])[] = GRUPPI_PAROLA_DATA

// Mappa stem(parola) → gruppo (forme raw normalizzate), costruita una volta.
let MAP: Map<string, readonly string[]> | null = null
function mapOf(): Map<string, readonly string[]> {
  if (!MAP) {
    MAP = new Map()
    for (const gruppo of GRUPPI_PAROLA) {
      const forme = gruppo.map(normQuery)
      for (const forma of forme) {
        // solo le forme mono-parola fanno da chiave (i liberi sono token singoli)
        if (forma.includes(' ')) continue
        MAP.set(stemToken(forma), forme)
      }
    }
  }
  return MAP
}

/**
 * Varianti equivalenti di un token (gruppo completo, token incluso); se il
 * token non appartiene a nessun gruppo ritorna solo il token. Lookup sulla
 * forma stemmata: «interrotta» trova il gruppo di «interrotto».
 */
export function variantiParola(token: string): readonly string[] {
  const t = normQuery(token)
  return mapOf().get(stemToken(t)) ?? [t]
}
