/**
 * Il profilo di un collaboratore: la mappatura dei suoi layer, decisa una volta.
 *
 * È il punto in cui χ smette di essere un tool e diventa memoria dello studio. Il lavoro vero
 * non è normalizzare un file: è normalizzare il ventesimo file dello stesso collaboratore senza
 * rifare da capo le stesse cento decisioni. Per questo il profilo sta in `memoria-studio` — entra
 * gratis nel backup, si esporta, si passa a un collega — e non nel `.ehub`, che è un progetto.
 *
 * Il riconoscimento è per SOMIGLIANZA, non per nome del file: i nomi dei file cambiano a ogni
 * consegna, l'elenco dei layer no. Se il 50% dei layer coincide con quelli già visti, è lui.
 */
import { chiaveDi, parteDi, type Store } from '../memoria-studio/memoria'
import type { LayerTrovato } from '../dxf-import/analizza'
import { chiaveLayer } from './suggerisci'

export interface ProfiloCollaboratore {
  id: string
  /** Come lo chiama lo studio: «Studio Rossi — architettonico». */
  nome: string
  aggiornato: string
  /** chiaveLayer(nome) → destinazione. Solo le decisioni prese a mano. */
  regole: Record<string, string>
  /** Le chiavi layer già viste: è la firma con cui si riconosce il collaboratore. */
  firma: string[]
  usi: number
}

export type ArchivioProfili = Record<string, ProfiloCollaboratore>

const PARTE = 'profili-collaboratori'

function chiave(companyId?: string | null): string {
  const p = parteDi(PARTE)
  // La chiave la dichiara la parte, non il tool: così backup ed export restano allineati.
  return p ? chiaveDi(p, companyId) : `chi:profili:${companyId || 'anon'}`
}

export function leggiArchivio(store: Store, companyId?: string | null): ArchivioProfili {
  try {
    const raw = store.getItem(chiave(companyId))
    const j = raw ? JSON.parse(raw) : null
    return j && typeof j === 'object' ? j as ArchivioProfili : {}
  } catch { return {} }
}

export function salvaProfilo(store: Store, p: ProfiloCollaboratore, companyId?: string | null): void {
  const arc = leggiArchivio(store, companyId)
  arc[p.id] = p
  try { store.setItem(chiave(companyId), JSON.stringify(arc)) } catch { /* quota piena */ }
}

export function eliminaProfilo(store: Store, id: string, companyId?: string | null): void {
  const arc = leggiArchivio(store, companyId)
  delete arc[id]
  try { store.setItem(chiave(companyId), JSON.stringify(arc)) } catch { /* quota piena */ }
}

/** Identificativo stabile ricavato dal nome, così rinominare non crea un doppione. */
export function idDaNome(nome: string): string {
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'senza-nome'
}

/** La firma di un file: le chiavi dei layer che contengono davvero disegno. */
export function firmaDi(layer: LayerTrovato[]): string[] {
  const s = new Set<string>()
  for (const l of layer) if (!l.vuoto) s.add(chiaveLayer(l.nome))
  return [...s].sort()
}

export interface Riconoscimento {
  profilo: ProfiloCollaboratore
  /** Quanta parte dei layer di questo file il profilo conosce già (0..1). */
  copertura: number
}

/**
 * Chi ha mandato questo file. Si confronta la firma con quelle note e si guarda **quanta parte
 * del file nuovo è già conosciuta**, non la somiglianza simmetrica: un profilo ricco che copre
 * tutti i layer di un file piccolo è un'ottima notizia, e Jaccard la punirebbe.
 */
export function riconosci(layer: LayerTrovato[], arc: ArchivioProfili): Riconoscimento | null {
  const firma = firmaDi(layer)
  if (!firma.length) return null
  let migliore: Riconoscimento | null = null
  for (const p of Object.values(arc)) {
    if (!p.firma || !p.firma.length) continue
    const note = new Set(p.firma)
    const comuni = firma.filter(k => note.has(k)).length
    const copertura = comuni / firma.length
    if (!migliore || copertura > migliore.copertura) migliore = { profilo: p, copertura }
  }
  // Sotto la metà non si propone niente: una proposta sbagliata costa più che nessuna proposta,
  // perché l'utente si fida e non ricontrolla.
  return migliore && migliore.copertura >= 0.5 ? migliore : null
}

/** Aggiorna il profilo con quello che l'utente ha deciso a mano su questo file. */
export function aggiorna(
  p: ProfiloCollaboratore,
  righe: Array<{ layer: LayerTrovato; destinazione: string; manuale: boolean }>,
  ora: string,
): ProfiloCollaboratore {
  const regole = { ...p.regole }
  for (const r of righe) {
    // Solo le decisioni MANUALI: le proposte automatiche non sono conoscenza dello studio,
    // sono il tool che indovina — e se un domani il tool migliora, non devono restare congelate.
    if (!r.manuale || !r.destinazione) continue
    regole[chiaveLayer(r.layer.nome)] = r.destinazione
  }
  const firma = new Set([...(p.firma || []), ...firmaDi(righe.map(r => r.layer))])
  return { ...p, regole, firma: [...firma].sort(), aggiornato: ora, usi: (p.usi || 0) + 1 }
}

export function nuovoProfilo(nome: string, ora: string): ProfiloCollaboratore {
  return { id: idDaNome(nome), nome: nome.trim(), aggiornato: ora, regole: {}, firma: [], usi: 0 }
}
