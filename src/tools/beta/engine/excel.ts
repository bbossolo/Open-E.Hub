/**
 * β Contabilità — export Excel (AOA, array-of-arrays) dei registri contabili, sul
 * modello di miu/engine/analisi-prezzi-excel.ts. Builder PURI: la UI li passa a
 * SheetJS (`XLSX.utils.aoa_to_sheet`). Numeri restano numerici (SheetJS li tipa).
 */
import type { Appalto, Partita, Sal, ListaEconomia } from './types'
import { calcolaSals, eseguitoPartita, importoContrattualePartita, voceVisibileInSal, voceSoppressaInSal } from './contabilita'
import { economiaATuttoSal } from './economia'
import { buildSommario } from './sommario'

export type AoaCell = string | number
export type AoaRow = AoaCell[]

const n2 = (n: number | null | undefined): number => (n == null || !Number.isFinite(n) ? 0 : Math.round(n * 100) / 100)

/** Foglio SAL: cascata + dettaglio partite. */
export function salAOA(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): AoaRow[] {
  const res = calcolaSals(appalto, partite, sals, liste).find((s) => s.numero === numero)
  const aoa: AoaRow[] = []
  aoa.push([`Stato di Avanzamento Lavori n. ${numero} — ${appalto.oggetto || ''}`])
  aoa.push([])
  aoa.push(['Codice', 'Designazione', 'Modalità', '% / Qtà', 'Importo a tutto il SAL'])
  for (const r of res?.righe || []) {
    aoa.push([r.partita.codice, r.partita.descrizione, r.partita.modalita, r.progressivo ?? '', n2(r.eseguito)])
  }
  if (res?.lavoriEconomia) aoa.push(['—', 'Lavori in economia (liste settimanali)', 'economia', '', n2(res.lavoriEconomia)])
  aoa.push([])
  const kv = (k: string, v: number): AoaRow => ['', '', '', k, n2(v)]
  aoa.push(kv('Lavori a misura', res?.lavoriMisura ?? 0))
  aoa.push(kv('Lavori a corpo', res?.lavoriCorpo ?? 0))
  if (res?.lavoriEconomia) aoa.push(kv('Lavori in economia', res.lavoriEconomia))
  aoa.push(kv('Oneri sicurezza', res?.oneriSicurezzaEseguiti ?? 0))
  aoa.push(kv('Totale eseguito', res?.totaleEseguito ?? 0))
  aoa.push(kv('Detrazioni', -(res?.detrazioni ?? 0)))
  aoa.push(kv('Totale contabilizzato', res?.totaleContabilizzato ?? 0))
  aoa.push(kv('Ritenuta 0,5%', -(res?.ritenuta ?? 0)))
  aoa.push(kv('SAL precedenti', -(res?.salPrecedenti ?? 0)))
  aoa.push(kv('IMPORTO DEL SAL (netto IVA)', res?.importoSal ?? 0))
  return aoa
}

/** Foglio Registro: partite con prezzo/quantità/importo eseguito all'ultimo SAL. */
export function registroAOA(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): AoaRow[] {
  const results = calcolaSals(appalto, partite, sals, liste)
  const ultimo = results[results.length - 1]
  const salN = ultimo?.numero ?? 1
  const rigaById = new Map((ultimo ? sals.find((s) => s.numero === ultimo.numero)?.righe : [])?.map((r) => [r.partitaId, r]) || [])
  const aoa: AoaRow[] = []
  aoa.push([`Registro di Contabilità — ${appalto.oggetto || ''}`])
  aoa.push([])
  aoa.push(['Codice', 'Designazione', 'Modalità', 'Prezzo', 'Importo contrattuale', 'Importo eseguito'])
  for (const p of partite) {
    if (!voceVisibileInSal(p, salN)) continue
    const r = rigaById.get(p.id)
    const desc = voceSoppressaInSal(p, salN) ? `${p.descrizione} — soppressa al SAL ${p.soppressaSal} (storno)` : p.descrizione
    aoa.push([p.codice, desc, p.modalita, n2(p.prezzoUnitario), n2(importoContrattualePartita(p)), n2(eseguitoPartita(p, r, salN))])
  }
  const economia = economiaATuttoSal(liste, salN)
  if (economia > 0) aoa.push(['—', 'Lavori in economia (liste settimanali)', 'economia', '', '', n2(economia)])
  return aoa
}

/** Foglio Sommario per categoria al SAL k. */
export function sommarioAOA(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): AoaRow[] {
  const righe = buildSommario(appalto, partite, sals, numero, liste)
  const aoa: AoaRow[] = []
  aoa.push([`Sommario del Registro — SAL ${numero} — ${appalto.oggetto || ''}`])
  aoa.push([])
  aoa.push(['Categoria', 'Contrattuale', `A tutto il SAL ${numero}`, 'SAL precedenti', `Nel SAL ${numero}`])
  for (const r of righe) aoa.push([r.categoria, n2(r.contrattuale), n2(r.aTutto), n2(r.precedenti), n2(r.corrente)])
  return aoa
}

/** Larghezze colonne (caratteri, clamp 10..64), come miu. */
export function aoaColWidths(aoa: AoaRow[]): number[] {
  const w: number[] = []
  for (const row of aoa) {
    if (row.length <= 1) continue
    row.forEach((c, i) => { w[i] = Math.max(w[i] || 10, Math.min(64, String(c ?? '').length + 2)) })
  }
  return w.map((x) => x || 10)
}
