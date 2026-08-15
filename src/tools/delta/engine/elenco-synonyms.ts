/**
 * DIZIONARIO SINONIMI ELENCO ELABORATI — per-studio (δ Pages). PURO (Store iniettato).
 *
 * `STANDARD_ELENCO_COLUMNS` (columns.ts) riconosce ~14 intestazioni italiane censite su UN
 * solo di uno studio: un altro studio con sigle proprie (es. "CMS" per "Codice Commessa")
 * non viene mai riconosciuto automaticamente. Questo dizionario lascia lo studio INSEGNARE
 * i propri alias — SOLO per le colonne dell'elenco elaborati, non per i campi del cartiglio
 * (`CARTIGLIO_LABELS` resta generico/condiviso: quei campi sono stabili fra studi, le sigle
 * dell'elenco elaborati no — vedi guida.ts). Le codifiche specifiche di UNA commessa (fase,
 * lotto, comparto…) non appartengono qui: variano progetto per progetto, restano colonne
 * importate e mappabili a mano, mai "insegnate" allo studio.
 *
 * Compartimentato per studio (`ehub:elenco-sinonimi:<companyId>`): la curazione (chi scrive)
 * resta fuori da questo motore, che è puro — è il chiamante (`ui/elenco.js`) a insegnare
 * un alias durante la verifica import, senza restrizioni (uno studio, un solo profilo).
 */
import { STANDARD_ELENCO_COLUMNS, normalizeHeaderText } from './columns'

/** alias normalizzato (es. "cms") → chiave standard (es. "CODICE_COMMESSA"). */
export interface SinonimiElenco { v: 1; map: Record<string, string> }
export const SINONIMI_VUOTO: SinonimiElenco = { v: 1, map: {} }

/** Il minimo per persistere (un `localStorage`, o qualunque cosa gli somigli). */
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** Lo scomparto dello studio. Nessuna azienda → 'anon'. */
export function chiaveStore(companyId?: string | null): string {
  return `ehub:elenco-sinonimi:${companyId || 'anon'}`
}

/** Scarta chiavi non standard (dizionario corrotto o edizione precedente della suite). */
function normMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const alias = normalizeHeaderText(k)
    if (alias && typeof v === 'string' && v in STANDARD_ELENCO_COLUMNS) out[alias] = v
  }
  return out
}

export function caricaSinonimi(store: Store, companyId?: string | null): SinonimiElenco {
  try {
    const raw = store.getItem(chiaveStore(companyId))
    if (!raw) return { v: 1, map: {} }
    const j = JSON.parse(raw)
    return { v: 1, map: normMap(j?.map) }
  } catch {
    return { v: 1, map: {} } // un dizionario illeggibile non deve impedire di lavorare
  }
}

export function salvaSinonimi(store: Store, sinonimi: SinonimiElenco, companyId?: string | null): void {
  try { store.setItem(chiaveStore(companyId), JSON.stringify(sinonimi)) } catch { /* quota piena: non rompere */ }
}

/** La chiave standard insegnata per questo alias — `null` se lo studio non l'ha mai detto. */
export function sinonimoDi(sinonimi: SinonimiElenco, alias: string): string | null {
  const norm = normalizeHeaderText(alias)
  if (!norm) return null
  return sinonimi.map[norm] || null
}

/**
 * Lo studio insegna (o disinsegna) un alias. Immutabile: restituisce un dizionario nuovo.
 * `standardKey: null` (o non fra le 14 chiavi note) cancella la decisione.
 */
export function decidiSinonimo(sinonimi: SinonimiElenco, alias: string, standardKey: string | null): SinonimiElenco {
  const norm = normalizeHeaderText(alias)
  if (!norm) return sinonimi
  const map = { ...sinonimi.map }
  if (standardKey && standardKey in STANDARD_ELENCO_COLUMNS) map[norm] = standardKey
  else delete map[norm]
  return { v: 1, map }
}
