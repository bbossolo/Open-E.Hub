/**
 * LIBRERIA BLOCCHI DELLO STUDIO — tipi condivisi.
 *
 * Tassonomia dei blocchi di una planimetria elettrica (prese, comandi,
 * allacciamenti…), usata per dedurre la famiglia di un layer o di un nome blocco.
 */

/** Famiglia tassonomica di un blocco, dal prefisso del nome nella libreria studio. */
export type FamigliaBlocco =
  | 'allacciamenti' | 'comandi' | 'illuminazione' | 'prese' | 'terra' | 'scatole-tubi' | 'quadri' | 'varie'

/** Tutte le famiglie tassonomiche, per popolare una palette di scelta. */
export const FAMIGLIA_BLOCCO_LIST: FamigliaBlocco[] = [
  'allacciamenti', 'comandi', 'illuminazione', 'prese', 'terra', 'scatole-tubi', 'quadri', 'varie',
]

/** Prefissi noti → famiglia. Ordine non rilevante (match esatto sul primo token). */
export const PREFISSO_FAMIGLIA: Record<string, FamigliaBlocco> = {
  AL: 'allacciamenti',
  COM: 'comandi',
  PL: 'illuminazione',
  PR: 'prese',
  PRESA: 'prese',
  TERRA: 'terra',
  VARI: 'scatole-tubi',
}
