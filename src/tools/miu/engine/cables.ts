/**
 * Matching dei CAVI di una distinta importata → voci di prezzario. Robusto a:
 *  - sezioni scritte con spazi ("3 x 10 mmq" ≡ "3x10") o con "×"/"g";
 *  - sigle abbreviate (FG16OR16 ≡ FG16OR: il "16" finale è la tensione, spesso omessa);
 *  - tipo di cavo SBAGLIATO con la stessa sezione: una voce di famiglia diversa
 *    (es. H07RN-F, FTG, N07V-K) viene penalizzata quando si è chiesto FG16OR16,
 *    così non vince solo perché ha "3x10".
 *
 * Puro e testabile (nessun DOM). Mirror di engine/conduits.ts.
 */
import { productText } from './conduits'

export interface CableItem {
  sigla?: string
  allum?: boolean
  form?: string        // es. "3G", "5x", "1x"
  sec?: number | string // es. 10, 1.5
  desc?: string
}
export interface CableRowLike {
  codice?: string
  desc_short?: string
  declaratoria?: string
  um?: string
  prezzo?: number
}

/** minuscole, no accenti, "×"→"x", spazi singoli. */
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/×/g, 'x').replace(/\s+/g, ' ').trim()
}
/** Collassa gli spazi nelle sezioni: "3 x 10" → "3x10", "3 g 10" → "3g10". */
function collapseSections(h: string): string {
  return h.replace(/(\d)\s*([xg])\s*(\d)/g, '$1$2$3')
}

const isLenUm = (u: unknown): boolean => /^(m|ml|mt|mtl)$/.test(String(u ?? '').trim().toLowerCase())

/** Famiglie di cavo riconoscibili — per capire se una voce è un cavo DIVERSO. */
const FAMILIES: ReadonlyArray<readonly [string, RegExp]> = [
  ['FG_M21', /\bf[gt]g?21m/],          // FG21M21 / FTG21M21 — resistente al fuoco, non confondere con FG_R/FG_M
  ['FG_M4',  /\bf[gt]g?4o?h?m/],       // FG4OHM1 / FTG4OHM1 — antincendio al silicone, non confondere con FG_M (LSZH)
  ['FG_R',  /\bfg1?[678]\(?o?\)?r/],   // FG16OR16 / FG7OR / FG16(O)R16 — potenza in gomma
  ['FG_M',  /\bfg1?[678]\(?o?\)?m/],   // FG16OM16 / FG7OM1 — LSZH
  ['FTG',   /\bftg/],                   // FTG…  — resistente al fuoco
  ['N07VK', /\bn07v|\bfs17\b/],         // N07V-K / FS17 — unipolare PVC
  ['H07Z1K', /\bh07z1/],                // H07Z1-K — unipolare LSZH tipo 2, non confondere con N07V-K
  ['H07RNF',/\bh07-?rn/],               // H07RN-F (anche scritto H07-RN-F) — gomma flessibile
  ['FROR',  /\bfror\b|h05vv|h07vv|h05rn/],
  ['N1VVK', /\bn1vv|\bfg16oh/],
  ['RG_MT', /\brfg\d|\brg\d/],          // RG7H1R / RG16H1R12 / RFG7ORAR… — cavi unipolari MT 12/20kV
]
/** Famiglia di cavo del testo (o null se non riconosciuta). */
export function cableFamily(text: unknown): string | null {
  const h = norm(text)
  for (const [id, re] of FAMILIES) if (re.test(h)) return id
  return null
}

/** Varianti della sigla: completa + radice senza la tensione finale (FG16OR16→FG16OR). */
export function siglaVariants(sigla: unknown): string[] {
  const s = norm(sigla).replace(/[()]/g, '')
  if (!s) return []
  const out = new Set<string>([s])
  const trimmed = s.replace(/\d{1,2}$/, '')
  if (trimmed.length >= 4) out.add(trimmed)
  return [...out]
}

const formCounts = (form: unknown): number | null => {
  const m: Record<string, number> = { '1x': 1, '2x': 2, '3x': 3, '4x': 4, '5x': 5, '3g': 3, '4g': 4, '5g': 5 }
  return m[String(form ?? '').toLowerCase()] ?? null
}
const secVariants = (sec: unknown): string[] => {
  const s = String(sec ?? '')
  return [...new Set([s, s.replace('.', ','), s.replace(',', '.')])]
}

/**
 * Punteggio di una riga come candidata per un cavo della distinta.
 * Più alto = match migliore. Può andare negativo (famiglia sbagliata) → in coda.
 */
export function scoreCable(item: CableItem, row: CableRowLike): number {
  const full = collapseSections(norm(`${row.codice} ${row.desc_short} ${row.declaratoria}`))
  // riga-PRODOTTO: desc breve + testa della declaratoria (PRIMA della posa), così
  // "5 x 2,5 mmq" nel prodotto conta, ma "cavo/10mm" citati nella posa no.
  const prod = collapseSections(productText(row.desc_short, row.declaratoria))
  let score = 0

  // Sigla / famiglia (cercata sul testo completo: è specifica, pochi falsi positivi).
  const variants = siglaVariants(item.sigla)
  const sigHit = variants.some(v => v && full.includes(v))
  if (sigHit) score += 6
  else {
    const famReq = cableFamily(item.sigla)
    const famRow = cableFamily(full)
    if (famReq && famRow && famReq !== famRow) score -= 8 // cavo di TIPO diverso
  }
  if (item.allum && /allumin/.test(full)) score += 1

  // Forma + sezione cercate sulla RIGA-PRODOTTO (non nel corpo della posa, dove
  // "cavo"/"10 mm" compaiono in modo incidentale → falsi positivi). Due livelli:
  //  - formHit: formazione+sezione esplicita ("3x10"/"3g10") → match forte;
  //  - secHit:  la sezione come "N mm/mmq/mm²" → per i prezzari che elencano i cavi
  //    PER SEZIONE (es. Basilicata "CAVI E CONDUTTORI — sezione 10 mmq.").
  const nC = formCounts(item.form)
  let formHit = false, secHit = false
  for (const sv of secVariants(item.sec)) {
    const svN = norm(sv)
    const cands = [norm(item.form) + svN]
    if (nC) cands.push(`${nC}x${svN}`, `${nC}g${svN}`)
    if (cands.some(c => c && prod.includes(c))) formHit = true
    if (new RegExp(`(?<![\\d.,])${svN.replace('.', '\\.')}\\s*mm`).test(prod)) secHit = true
  }
  if (formHit) score += 6
  else if (secHit) score += 3

  // Contesto cavo NELLA RIGA-PRODOTTO: la voce è davvero un cavo/conduttore
  // (sigla, famiglia nota, o lessico). Evita che "10 mm" su un tubo o un anodo
  // (che cita "cavo" solo nella posa) venga scambiato per un cavo.
  const cableCtx = sigHit || cableFamily(prod) != null || /\bcav[oi]\b|condutt|unipolar|multipolar|\bcordin/.test(prod)

  // Evidenza minima: la sigla, OPPURE sezione/formazione in un contesto-cavo.
  if (!sigHit && !(cableCtx && (formHit || secHit))) return score < 0 ? score : 0

  if (isLenUm(row.um)) score += 2
  if ((row.prezzo ?? 0) > 0) score += 1
  return score
}
