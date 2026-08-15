/**
 * Detection di cavidotti / tubi / passerelle nei prezzari — robusta alle
 * terminologie regionali. Usata dallo scorer della distinta importata per
 * riconoscere le voci-condotto qualunque sia il lessico del prezzario.
 *
 * Puro e testabile. La normalizzazione (minuscole + niente accenti + spazi
 * singoli) rispecchia `normSearch` dell'inline, così `isConduit(h)` funziona sia
 * su testo grezzo sia su testo già normalizzato (idempotente).
 */

/** Famiglie di canalizzazione riconosciute. */
export type ConduitFamily = 'tubo' | 'canalizzazione' | 'interrato'

/** Posa interrata / sotterranea (la più specifica). */
const RE_INTERRATO = /interrat|cunicol|doppia parete/
/** Canalizzazioni a vista: passerelle, canali, portacavi. */
const RE_CANAL = /passerell|portacav|canalin|canalett|\bcanale\b|canalizzazion|asolat/
/** Tubi e guaine (corrugato/rigido/pieghevole/ICTA/PVC/PE…). */
const RE_TUBO = /tub[oi]\b|tubazion|corrugat|\brigid|guain|pieghevol|flessibil|spiralat|\bicta\b|polietilen|\bpvc\b|\bpe(ad)?\b|cavidott/

/** Regex unica (unione delle tre famiglie) — comoda per un match rapido. */
export const CONDUIT_RE = new RegExp(
  [RE_INTERRATO.source, RE_CANAL.source, RE_TUBO.source].join('|'),
)

/** Normalizzazione minima allineata a normSearch (minuscole, no accenti, spazi singoli). */
function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/** True se il testo descrive un cavidotto/tubo/passerella (qualunque regione). */
export function isConduit(text: unknown): boolean {
  return CONDUIT_RE.test(norm(text))
}

/** Famiglia del condotto (interrato → canalizzazione → tubo, dalla più specifica), o null. */
export function conduitFamily(text: unknown): ConduitFamily | null {
  const h = norm(text)
  if (RE_INTERRATO.test(h)) return 'interrato'
  if (RE_CANAL.test(h)) return 'canalizzazione'
  if (RE_TUBO.test(h)) return 'tubo'
  return null
}

/**
 * Inizio della parte "posa/installazione" della declaratoria. Lì compaiono
 * parole-condotto come METODO DI POSA (es. «...posato su passerella o entro
 * tubazione...») che NON descrivono il prodotto: un cavo che cita "passerella"
 * nella posa non è una passerella. Troncando qui togliamo i falsi positivi.
 */
const RE_INSTALL = /\bforni|\bposa\b|\bposat|\bposto in opera|\bin opera\b|\bcompres|\binstallazion|\bmessa in opera|\bdato in opera|\bentro\b|\bsu canale\b|\bsu passerell/

/**
 * Testo del PRODOTTO: desc breve + testa della declaratoria (prima della posa).
 * È su questo che vanno fatti detection e scoring, non sui campi categoria
 * (settore/materia/tipologia) né sul corpo della posa — entrambi inquinano.
 */
export function productText(descShort: unknown, declaratoria: unknown): string {
  const decl = String(declaratoria ?? '')
  const i = decl.search(RE_INSTALL)
  const head = i > 0 ? decl.slice(0, i) : decl
  return norm(String(descShort ?? '') + ' ' + head)
}

/** Cavi/conduttori: prodotti che NON sono condotti ma citano spesso tubo/canale/passerella nella posa. */
const RE_CABLE = /\bcav[oi]\b|conduttor|\bcordin|\bcorda\b|trecci|cavedi|\bfg\d|\bn07|\bfs17|unipolar|multipolar|\bfibr/

/** True se il testo-prodotto descrive un cavo/conduttore (da escludere dai match condotto). */
export function isCableProduct(text: unknown): boolean {
  return RE_CABLE.test(norm(text))
}

/**
 * Condotte idrauliche/fognarie/gas: sono tubi, ma NON canalizzazioni elettriche.
 * I condotti di distinta sono sempre elettrici, quindi queste vanno escluse dai match.
 */
const RE_NONELEC = /acquedott|irrigu|fognatur|\bscarico\b|drenagg|\bgas\b|potabil|reflu|pluvial|grondai|antincendi|riscaldament|\bghisa\b|\bacque?\b|\bfosso\b|gocciolant|raccolta acqu|guardia/

/** True se il tubo è idraulico/fognario/gas (da escludere dai match condotto elettrico). */
export function isHydraulicPipe(text: unknown): boolean {
  return RE_NONELEC.test(norm(text))
}

/** Voce-distinta di un condotto (cavidotto/passerella/tubo). */
export interface ConduitItem {
  tipo?: string
  size?: string
  desc?: string
}

/** Riga di prezzario (campi usati dallo scorer). */
export interface ConduitRowLike {
  codice?: string
  desc_short?: string
  declaratoria?: string
  um?: string
  prezzo?: number
}

const isLenUm = (u: unknown): boolean => /^(m|ml|mt|mtl)$/.test(String(u ?? '').trim().toLowerCase())

/** Punteggio della dimensione (es. "150x30" o un DN) contro il testo-prodotto.
 * I numeri vanno confrontati ISOLATI (niente cifre/decimali adiacenti): senza
 * questo, "50x30" matcherebbe dentro "750x300" e "30" dentro "1,30" → falsi
 * positivi (passerella da pontile, griglia per canaletta) visti su Basilicata. */
function sizeScore(size: unknown, hay: string): number {
  const s = norm(size)
  if (!s) return 0
  // numero "isolato": non preceduto né seguito da cifra, virgola o punto.
  const iso = (n: string) => new RegExp(`(?<![\\d.,])${n}(?![\\d.,])`)
  const wh = s.match(/(\d+)\s*[x×]\s*(\d+)/)
  if (wh) {
    const [, a, b] = wh
    if (new RegExp(`(?<![\\d.,])${a}\\s*[x×]\\s*${b}(?![\\d.,])`).test(hay)) return 6
    return iso(a).test(hay) ? 3 : 0   // solo la larghezza, isolata → match debole
  }
  const dn = s.match(/\d+/)
  if (dn) {
    const d = dn[0]
    if (hay.includes(`dn${d}`) || hay.includes(`ø${d}`)
      || new RegExp(`(?<![\\d.,])${d}\\s*mm`).test(hay) || iso(d).test(hay)) return 5
  }
  return 0
}

/**
 * Punteggio di una riga di prezzario come candidata per un condotto.
 * 0 = scartare (non è un condotto, o è un cavo). Più alto = match migliore.
 * Lavora sul testo-prodotto (no boilerplate di posa, no campi categoria).
 */
export function scoreConduit(item: ConduitItem, row: ConduitRowLike): number {
  const prod = productText(row.desc_short, row.declaratoria) + ' ' + norm(row.codice)
  if (isCableProduct(prod)) return 0          // è un cavo: non è un condotto
  if (isHydraulicPipe(prod)) return 0         // tubo idraulico/gas: non è elettrico
  const famRow = conduitFamily(prod)
  if (!famRow) return 0                        // il prodotto non è un condotto
  let score = 0
  const famItem = conduitFamily([item.tipo, item.desc].join(' '))
  score += famItem && famItem === famRow ? 6 : 2
  for (const w of norm(item.tipo || item.desc).split(' ')) {
    if (w.length >= 4 && prod.includes(w)) score += 3
  }
  // La DIMENSIONE è l'evidenza che discrimina: senza di essa, un accordo di sola
  // famiglia + parola generica ("passerella", "tubo") fa vincere voci sbagliate
  // (es. "passerella di accesso ai pontili" per "passerella a filo 150x30") quando
  // il prezzario non ha la voce giusta. Richiediamo che la misura compaia davvero.
  const szScore = sizeScore(item.size, prod)
  if (szScore <= 0) return 0
  score += szScore
  if (isLenUm(row.um)) score += 2
  if ((row.prezzo ?? 0) > 0) score += 1
  return score
}
