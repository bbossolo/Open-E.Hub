/**
 * β Contabilità — import del COMPUTO METRICO in partite contabili.
 * Sorgente: il carrello μ via bus — strutturalmente compatibile con
 * `CartItem` (shared/compositore).
 *
 * Modalità:
 *  - **misura**: ogni voce → una `Partita` a misura (prezzo, qtyProgetto,
 *    misurazioni conservate per il libretto).
 *  - **corpo**: le voci sono aggregate per CATEGORIA (categorie di lavorazioni
 *    omogenee) in corpi d'opera con importo contrattuale = Σ importi.
 */
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'
import type { Modalita, Partita } from './types'

/** Voce di computo in ingresso — sottoinsieme di `CartItem` (nessuna dipendenza tool→tool). */
export interface VoceImport {
  codice?: string
  desc_short?: string
  declaratoria?: string
  um?: string
  prezzo?: number | null
  qty?: number | null
  categoria?: string
  misurazioni?: MisurazioneRiga[]
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
const CAT_SEP = ' · '
let _seq = 0
const uid = (): string => `p${Date.now().toString(36)}${(_seq++).toString(36)}`

/** Livello 1 della categoria (la Supercategoria / ambito), o etichetta di ripiego. */
export function categoriaLiv1(categoria?: string): string {
  const c = (categoria || '').trim()
  if (!c) return '(senza categoria)'
  return c.split(CAT_SEP)[0].trim() || '(senza categoria)'
}

const descOf = (v: VoceImport): string => (v.desc_short || v.declaratoria || '').trim()

/** Import A MISURA: ogni voce → una partita a misura. */
export function importaAMisura(voci: VoceImport[]): Partita[] {
  return voci.map((v) => ({
    id: uid(),
    modalita: 'misura' as Modalita,
    codice: (v.codice || '').trim(),
    descrizione: descOf(v),
    um: v.um,
    categoria: v.categoria,
    prezzoUnitario: v.prezzo == null || v.prezzo <= 0 ? null : v.prezzo,
    qtyProgetto: v.qty ?? null,
    ...(v.misurazioni && v.misurazioni.length ? { misurazioniProgetto: v.misurazioni } : {}),
  }))
}

/** Import A CORPO: aggrega le voci per categoria (liv.1) in corpi d'opera. */
export function importaACorpo(voci: VoceImport[]): Partita[] {
  const gruppi = new Map<string, { importo: number; codici: string[] }>()
  for (const v of voci) {
    const cat = categoriaLiv1(v.categoria)
    const imp = round2((v.prezzo || 0) * (v.qty || 0))
    const g = gruppi.get(cat) || { importo: 0, codici: [] }
    g.importo = round2(g.importo + imp)
    if (v.codice) g.codici.push(v.codice.trim())
    gruppi.set(cat, g)
  }
  let n = 0
  return [...gruppi.entries()].map(([cat, g]) => ({
    id: uid(),
    modalita: 'corpo' as Modalita,
    codice: `C${String(++n).padStart(2, '0')}`,
    descrizione: cat,
    categoria: cat,
    importoContrattuale: g.importo,
  }))
}

/** Import secondo la modalità scelta. Per «misto» il default è a misura (l'utente potrà convertire gruppi a corpo). */
export function importaComputo(voci: VoceImport[], modalita: Modalita): Partita[] {
  return modalita === 'corpo' ? importaACorpo(voci) : importaAMisura(voci)
}
