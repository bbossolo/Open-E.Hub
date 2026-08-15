/**
 * THESAURUS impiantistico cross-prezzario — famiglie canoniche di
 * componenti con i SINONIMI usati dai diversi prezzari regionali, per cercare
 * «con parole proprie» senza conoscere la terminologia del singolo listino.
 *
 * Modello: una famiglia ha `alias` (come l'utente può chiamarla), `sinonimi`
 * (come i prezzari la chiamano — gruppo OR in ricerca) e `accessori` (termini
 * che indicano l'accessorio della famiglia, NON il componente: usati dal
 * ranking per tenere i coperchi sotto le passerelle). I token della query non
 * riconosciuti (misure, sigle cavo) restano letterali AND — la ricerca per
 * codice non cambia.
 *
 * Terminologia VERIFICATA da Furio (lug 2026) sui prezzari reali in repo
 * (lombardia-2026, veneto-2026, trento-2026) + cataloghi: vietati i sinonimi
 * «falsi amici» isolati (rete, complanare, guaina, doppia parete, spiro) che
 * pescano fibre di carbonio, finestre scorrevoli, impermeabilizzazioni, canne
 * fumarie e funi di ancoraggio. «Passerella a filo» non esiste come voce nei
 * tre listini (è dicitura da catalogo Cablofil/Legrand): l'alias degrada sulle
 * passerelle/canali portacavi reali, tenendo i coperchi come accessorio.
 */
import { FAMIGLIE_DATA } from 'compositore-catalog:thesaurus'

export interface Famiglia {
  /** id canonico (kebab) */
  id: string
  /** come l'utente la chiama (frasi intere, matchate per prime — più specifico vince) */
  alias: string[]
  /** come la chiamano i prezzari: gruppo OR (basta un match) */
  sinonimi: string[]
  /** termini-accessorio della famiglia (coperchio, setto…): penalizzati dal ranking */
  accessori: string[]
  /** token di contesto: se NESSUNO compare nella descrizione breve, la voce è fuori famiglia (penalizzata) */
  richiede?: string[]
  /** radici di famiglia "sorella" (es. interrato/cavidotto) che, se presenti e NON chieste dall'utente, penalizzano la voce */
  esclude?: string[]
  /** macrocategoria attesa (es. IMPIANTI ELETTRICI): se la voce ha macro assegnata ma non la include, è fuori dominio (penalizzata) */
  macroAttesa?: string
  /** famiglia «facile a prezzario» (cavi/condotti…): esclusa dal compositore, resta cercabile — stesso flag di FrasarioFamiglia (componi.ts) */
  facilePrezzario?: boolean
}

/**
 * Le famiglie del thesaurus. `compositore-catalog:thesaurus` risolve (alias di
 * build, vedi vite.config.ts) ai dati veri; Open E.Hub non porta dataset
 * proprietari, quindi il bundle parte sempre dallo stub vuoto (lo studio
 * importa il proprio catalogo).
 */
export const FAMIGLIE: Famiglia[] = FAMIGLIE_DATA

/** Normalizza: minuscole + niente accenti + × → x + spazi compattati (allineata a index.html/normSearch). */
export function normQuery(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/×/g, 'x').replace(/\s+/g, ' ').trim()
    // formazione cavo: «3G6»/«3 g 6» (gergo elettricista) ≡ «3x6» (notazione
    // dei prezzari, sezione nominale poli×mmq) — stessa equivalenza già nota
    // a cables.ts, qui estesa alla ricerca testuale libera.
    .replace(/(\d)\s*g\s*(\d)/g, '$1x$2')
}

/**
 * Canonicalizza le MISURE come le scrivono i prezzari reali (verificato su
 * Lombardia/Veneto/Trento): decimali con la virgola («3x2,5 mm²»), «Ø 40» con
 * spazio, «diametro 30». Porta tutto a una forma unica così query e voce si
 * incontrano: virgola decimale→punto, «3 x 2.5»→«3x2.5», «diametro/diam./Ø/⌀ N»
 * →«øN», «²»→«2». Idempotente (viene applicata sia alla query sia all'haystack).
 * «d 25» resta volutamente fuori: mai visto nei prezzari e ambiguo.
 */
export function normMisure(s: string): string {
  return s
    .replace(/²/g, '2')
    .replace(/(\d)\s*,\s*(?=\d)/g, '$1.')     // lookahead: regge le catene «2,5,3»
    .replace(/(\d)\s*x\s*(?=\d)/g, '$1x')     // idem per «3 x 2.5 x 4»
    .replace(/(^|[\s(])(?:diam(?:\.|etro)?|ø|⌀)\s*(?=\d)/g, '$1ø')
}

/**
 * Stemming italiano LEGGERO e conservativo per il matching morfologico
 * (faretti↔faretto, orientabili↔orientabile): tronca la sola vocale finale
 * [aeio] delle parole INTERAMENTE alfabetiche di almeno 5 lettere. Sigle,
 * misure e token con cifre o simboli restano intatti (led, ip65, 3x2.5,
 * fg16or16, mm2). Il piano stemmato è sempre ADDITIVO rispetto al match
 * letterale: chi lo usa deve tenere anche la forma raw (vedi search.ts).
 */
export function stemToken(t: string): string {
  if (t.length < 5 || !/^[a-z]+$/.test(t)) return t
  return t.replace(/[aeio]$/, '')
}

/** stemToken applicato a ogni parola di un testo già normalizzato. */
export function stemText(s: string): string {
  return s.split(' ').map(stemToken).join(' ')
}

/** Coppia di piani di matching: raw (normQuery+normMisure) e stemmato. */
export interface MatchText { raw: string; stem: string }

/** Pipeline completa di normalizzazione per il matching testuale. */
export function normMatch(s: unknown): MatchText {
  const raw = normMisure(normQuery(s))
  return { raw, stem: stemText(raw) }
}

export interface ExpandedQuery {
  /** famiglie riconosciute nella query (in ordine di specificità) */
  famiglie: Famiglia[]
  /** gruppi OR: per ogni famiglia riconosciuta, i suoi sinonimi (normalizzati) */
  gruppi: string[][]
  /** le frasi-alias effettivamente digitate (normalizzate): bonus di specificità nel ranking */
  frasi: string[]
  /** token residui non riconosciuti (misure, sigle, parole libere): AND letterale */
  liberi: string[]
}

/**
 * Espande una query in linguaggio naturale: riconosce le famiglie (frase più
 * specifica prima) e lascia il resto come token letterali. Query senza famiglie
 * riconosciute ⇒ comportamento identico alla ricerca attuale.
 */
// Alias (normalizzato) → famiglie che lo dichiarano: alcuni alias sono
// legittimamente CONDIVISI («faretto orientabile» è sia binario sia incasso,
// «interruttore differenziale» sia MT sia differenziale puro) — al match il
// gruppo OR dei sinonimi unisce TUTTE le famiglie dell'alias, così la voce
// giusta matcha qualunque sia la famiglia dichiarata per prima.
let ALIAS_FAMS: Map<string, Famiglia[]> | null = null
function aliasFams(): Map<string, Famiglia[]> {
  if (!ALIAS_FAMS) {
    ALIAS_FAMS = new Map()
    for (const f of FAMIGLIE) for (const a of f.alias) {
      const k = normQuery(a)
      const list = ALIAS_FAMS.get(k) ?? []
      if (!list.includes(f)) list.push(f)
      ALIAS_FAMS.set(k, list)
    }
  }
  return ALIAS_FAMS
}

export function expandQuery(q: unknown): ExpandedQuery {
  let rest = ' ' + normQuery(q) + ' '
  const famiglie: Famiglia[] = []
  const gruppi: string[][] = []
  const frasi: string[] = []
  const addMatch = (f: Famiglia, a: string): void => {
    famiglie.push(f)
    frasi.push(a)
    const union = (aliasFams().get(a) ?? [f]).flatMap(x => x.sinonimi.map(normQuery))
    gruppi.push([...new Set(union)])
  }
  // alias più lunghi prima: «passerella a filo» deve vincere su «passerella»
  const byAlias = FAMIGLIE.flatMap(f => f.alias.map(a => ({ f, a: normQuery(a) })))
    .sort((x, y) => y.a.length - x.a.length)
  for (const { f, a } of byAlias) {
    if (famiglie.includes(f)) continue
    const idx = rest.indexOf(' ' + a + ' ')
    if (idx !== -1) {
      addMatch(f, a)
      rest = rest.replace(' ' + a + ' ', ' ')
    }
  }
  // Secondo passaggio ADDITIVO sul piano stemmato: riconosce l'alias anche
  // flesso («faretti orientabili» → alias «faretto orientabile») confrontando
  // gli stem parola-per-parola sui token residui. Il primo passaggio letterale
  // resta invariato: qui si aggiungono solo famiglie che sarebbero sfuggite.
  const tokens = rest.trim().split(/\s+/).filter(Boolean)
  const stems = tokens.map(stemToken)
  for (const { f, a } of byAlias) {
    if (famiglie.includes(f)) continue
    const aStems = a.split(' ').map(stemToken)
    outer: for (let i = 0; i + aStems.length <= stems.length; i++) {
      for (let j = 0; j < aStems.length; j++) if (stems[i + j] !== aStems[j]) continue outer
      addMatch(f, a) // la frase resta la forma canonica dell'alias: è quella scritta nelle voci
      tokens.splice(i, aStems.length)
      stems.splice(i, aStems.length)
      break
    }
  }
  const liberi = tokens
  return { famiglie, gruppi, frasi, liberi }
}
