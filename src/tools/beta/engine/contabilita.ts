/**
 * β Contabilità — MOTORE PURO della contabilità (a corpo, a misura, misto).
 * Codifica le regole di calcolo del D.Lgs. 36/2023 (Allegato II.14) e la
 * cascata del SAL. Nessun DOM, nessuno stato: solo funzioni testabili.
 *
 * Regola di fedeltà del dato: le quote %/quantità sono ATTESTAZIONI del DL
 * (input), il motore non le stima mai; i dati mancanti restano tali (null),
 * non vengono colmati d'ufficio.
 */
import type { Appalto, Partita, Sal, RigaSal, ListaEconomia } from './types'
import { sommaMisurazioni } from '../../../shared/compositore/misurazioni'
import { economiaATuttoSal } from './economia'

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Ribasso % = (base − offerta) / base × 100 (4 decimali, come negli atti). null se dati non disponibili. */
export function ribassoPct(baseAsta?: number | null, offerta?: number | null): number | null {
  if (baseAsta == null || offerta == null || baseAsta <= 0) return null
  return Math.round(((baseAsta - offerta) / baseAsta) * 100 * 1e4) / 1e4
}

/** Importo contrattuale di una partita: a misura = prezzo × qtyProgetto; a corpo = importoContrattuale. */
export function importoContrattualePartita(p: Partita): number {
  if (p.modalita === 'corpo') return round2(p.importoContrattuale || 0)
  return round2((p.prezzoUnitario || 0) * (p.qtyProgetto || 0))
}

/** Totale contrattuale dei lavori (somma delle partite), diviso per modalità. */
export function totaleContrattualeLavori(partite: Partita[]): { misura: number; corpo: number; totale: number } {
  let misura = 0, corpo = 0
  for (const p of partite) {
    const imp = importoContrattualePartita(p)
    if (p.modalita === 'corpo') corpo += imp; else misura += imp
  }
  misura = round2(misura); corpo = round2(corpo)
  return { misura, corpo, totale: round2(misura + corpo) }
}

/**
 * Totale contrattuale dell'appalto: offerta ribassata (o Σ partite se non nota)
 * + oneri sicurezza + eventuali varianti già incluse nelle partite.
 */
export function totaleContrattuale(appalto: Appalto, partite: Partita[]): number {
  const lavori = appalto.importoOfferta != null ? appalto.importoOfferta : totaleContrattualeLavori(partite).totale
  return round2(lavori + (appalto.oneriSicurezza || 0))
}

/** Aliquota % di un corpo d'opera sul totale dei corpi (0 se non a corpo o totale nullo). */
export function aliquotaCorpoPct(p: Partita, partite: Partita[]): number | null {
  if (p.modalita !== 'corpo') return null
  const totCorpi = totaleContrattualeLavori(partite).corpo
  if (totCorpi <= 0) return null
  return round2((importoContrattualePartita(p) / totCorpi) * 100)
}

/**
 * Quadratura di un corpo disaggregato: Σ importi delle voci deve eguagliare
 * l'importo del corpo (tolleranza 0,01 €). Ritorna lo scostamento e l'esito.
 */
export function quadraturaCorpo(importoCorpo: number, voci: Array<{ importo?: number | null }>): { somma: number; scostamento: number; quadra: boolean } {
  const somma = round2(voci.reduce((s, v) => s + (v.importo || 0), 0))
  const scostamento = round2(somma - importoCorpo)
  return { somma, scostamento, quadra: Math.abs(scostamento) <= 0.01 }
}

/**
 * Una voce COMPARE nel libretto del SAL n se è stata introdotta entro n
 * (le voci da computo, senza `introdottaSal`, valgono da sempre). Le voci
 * soppresse restano visibili (traccia dello storno), col valore azzerato.
 */
export function voceVisibileInSal(p: Partita, salNumero: number): boolean {
  return (p.introdottaSal ?? 1) <= salNumero
}

/** true se la voce risulta soppressa (stornata) a tutto il SAL n. */
export function voceSoppressaInSal(p: Partita, salNumero: number): boolean {
  return p.soppressaSal != null && salNumero >= p.soppressaSal
}

/**
 * Importo eseguito di una partita a un dato SAL (progressivo a tutto il SAL).
 * Se `salNumero` è noto e la voce è soppressa a quel SAL, l'eseguito è 0
 * (la detrazione dello storno), coerentemente con la traccia negli atti.
 */
export function eseguitoPartita(p: Partita, riga: RigaSal | undefined, salNumero?: number): number {
  if (salNumero != null && voceSoppressaInSal(p, salNumero)) return 0
  if (!riga) return 0
  if (p.modalita === 'corpo') {
    const quota = riga.quotaPct == null ? 0 : Math.max(0, Math.min(100, riga.quotaPct))
    return round2(importoContrattualePartita(p) * (quota / 100))
  }
  // a misura: quantità progressiva (esplicita o somma delle righe di misura) × prezzo
  const qty = riga.quantitaProgressiva != null ? riga.quantitaProgressiva
    : (riga.misurazioni && riga.misurazioni.length ? sommaMisurazioni(riga.misurazioni) : 0)
  return round2((p.prezzoUnitario || 0) * qty)
}

export interface SalRigaResult {
  partita: Partita
  /** quantità (a misura) o quota % (a corpo) progressiva a tutto il SAL. */
  progressivo: number | null
  eseguito: number
}

export interface SalResult {
  numero: number
  data?: string
  righe: SalRigaResult[]
  lavoriMisura: number
  lavoriCorpo: number
  /** Lavori in economia (liste settimanali) a tutto il SAL. */
  lavoriEconomia: number
  lavoriEseguiti: number
  oneriSicurezzaEseguiti: number
  totaleEseguito: number
  detrazioni: number
  totaleContabilizzato: number
  /** Ritenuta di garanzia 0,5% cumulativa sul progressivo contabilizzato (art. 125). */
  ritenuta: number
  nettoProgressivo: number
  /** Netto già liquidato coi SAL precedenti. */
  salPrecedenti: number
  /** Importo NETTO del presente SAL (= netto progressivo − SAL precedenti). */
  importoSal: number
  iva: number
  totaleLordo: number
}

const RITENUTA_GARANZIA = 0.005 // 0,5% — art. 125 D.Lgs. 36/2023

/** Percentuale di avanzamento dei lavori (eseguito/contrattuale) per ripartire gli oneri sicurezza. */
function avanzamentoLavori(partite: Partita[], sal: Sal): number {
  const contr = totaleContrattualeLavori(partite).totale
  if (contr <= 0) return 0
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  let eseg = 0
  for (const p of partite) eseg += eseguitoPartita(p, rigaById.get(p.id), sal.numero)
  return Math.max(0, Math.min(1, eseg / contr))
}

/**
 * Calcola la cascata di TUTTI i SAL in sequenza (ognuno progressivo a tutto il
 * SAL). Gli oneri sicurezza sono liquidati per quota di avanzamento dei lavori.
 * `importoSal` è il netto del singolo SAL (il credito del certificato).
 */
export function calcolaSals(appalto: Appalto, partite: Partita[], sals: Sal[], liste?: ListaEconomia[]): SalResult[] {
  const ordinati = [...sals].sort((a, b) => a.numero - b.numero)
  const oneri = appalto.oneriSicurezza || 0
  const iva = appalto.ivaPct == null ? 10 : appalto.ivaPct
  const out: SalResult[] = []
  let nettoPrecedente = 0
  for (const sal of ordinati) {
    const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
    const righe: SalRigaResult[] = partite.map((p) => {
      const r = rigaById.get(p.id)
      const eseguito = eseguitoPartita(p, r, sal.numero)
      const soppressa = voceSoppressaInSal(p, sal.numero)
      const progressivo = soppressa ? 0 : p.modalita === 'corpo'
        ? (r?.quotaPct ?? null)
        : (r?.quantitaProgressiva ?? (r?.misurazioni ? sommaMisurazioni(r.misurazioni) : null))
      return { partita: p, progressivo, eseguito }
    })
    let lavoriMisura = 0, lavoriCorpo = 0
    for (const rr of righe) {
      if (rr.partita.modalita === 'corpo') lavoriCorpo += rr.eseguito; else lavoriMisura += rr.eseguito
    }
    lavoriMisura = round2(lavoriMisura); lavoriCorpo = round2(lavoriCorpo)
    const lavoriEconomia = economiaATuttoSal(liste, sal.numero)
    const lavoriEseguiti = round2(lavoriMisura + lavoriCorpo + lavoriEconomia)
    const oneriSicurezzaEseguiti = round2(oneri * avanzamentoLavori(partite, sal))
    const totaleEseguito = round2(lavoriEseguiti + oneriSicurezzaEseguiti)
    const detrazioni = round2(sal.detrazioni || 0)
    const totaleContabilizzato = round2(totaleEseguito - detrazioni)
    const ritenuta = round2(totaleContabilizzato * RITENUTA_GARANZIA)
    const nettoProgressivo = round2(totaleContabilizzato - ritenuta)
    const importoSal = round2(nettoProgressivo - nettoPrecedente)
    const ivaImporto = round2(importoSal * (iva / 100))
    out.push({
      numero: sal.numero, data: sal.data, righe,
      lavoriMisura, lavoriCorpo, lavoriEconomia, lavoriEseguiti, oneriSicurezzaEseguiti,
      totaleEseguito, detrazioni, totaleContabilizzato, ritenuta,
      nettoProgressivo, salPrecedenti: round2(nettoPrecedente), importoSal,
      iva: ivaImporto, totaleLordo: round2(importoSal + ivaImporto),
    })
    nettoPrecedente = nettoProgressivo
  }
  return out
}

/** Risultato di un singolo SAL (l'ultimo di indice `numero`), o null se assente. */
export function calcolaSal(appalto: Appalto, partite: Partita[], sals: Sal[], numero: number, liste?: ListaEconomia[]): SalResult | null {
  return calcolaSals(appalto, partite, sals, liste).find((s) => s.numero === numero) || null
}
