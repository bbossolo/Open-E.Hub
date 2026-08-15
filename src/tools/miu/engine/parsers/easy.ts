/**
 * Parser per la famiglia **EASY** (`<EASY:Prezzario>`): Calabria, Campania,
 * Piemonte, Sardegna e le 10 province della Toscana (vedi taxonomy dei formati).
 *
 * È un parser di BUILD: gira in Node (o nei test) su una stringa XML e produce
 * righe già normalizzate (`PriceRow`). NON viene inglobato nel bundle runtime del
 * tool, che consuma solo l'output JSON.
 *
 * Struttura sorgente:
 *   <EASY:Prezzario>
 *     <EASY:intestazione><EASY:dettaglio anno="2025" .../></EASY:intestazione>
 *     <EASY:Contenuto>
 *       <EASY:Articolo codice="CAL25_01.A01.001.001">
 *         <EASY:livello1..4>…</> <EASY:um>m²</> <EASY:prezzo>1.5605</>
 *         <EASY:Analisi>
 *           <EASY:totaleparziale valore="1.2336"/>
 *           <EASY:incidenzamanodopera percentuale="49.28" valore="…"/>
 *         </EASY:Analisi>
 *       </EASY:Articolo>
 *     </EASY:Contenuto>
 */
import { REGIONS } from '../../data/regions'
import { firstLinePreview } from '../codes'
import { isSelfContained, composeDesc } from '../descriptions'
import { makeParser, num, toArray } from '../xml'
import type { ParseResult, PriceRow } from '../types'

/**
 * Testo di un livello: stringa diretta, oppure nodo XML con attributi/CDATA
 * (es. Piemonte/Sardegna: `<livello4 descrizionebreve="…">CDATA</livello4>` →
 * fast-xml-parser lo rende un OGGETTO, non una stringa → senza questo si otteneva
 * "[object Object]"). Si preferisce il testo (#text/CDATA), poi descrizionebreve.
 */
function levelText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o['#text'] === 'string') return o['#text'].trim()
    if (typeof o['@_descrizionebreve'] === 'string') return o['@_descrizionebreve'].trim()
    return ''
  }
  return String(v).trim()
}

/** Unisce due testi senza duplicare (uno contenuto nell'altro → il più completo). */
function joinDesc(a: string, b: string): string {
  a = a.trim(); b = b.trim()
  if (!a) return b
  if (!b) return a
  const la = a.toLowerCase(), lb = b.toLowerCase()
  if (la.includes(lb)) return a
  if (lb.includes(la)) return b
  return `${a} — ${b}`
}

/**
 * Descrizioni EASY self-contained.
 *  - Calabria/Campania/Toscana: la foglia (liv4) è già una descrizione completa →
 *    invariate (sintetica = foglia, estesa = liv4).
 *  - Piemonte/Sardegna (e voci-frammento altrove): liv3 è la descrizione e liv4 la
 *    VARIANTE → sintetica = "liv3 — variante", estesa = "liv3 — liv4".
 */
function easyDesc(liv1: string, liv2: string, liv3: string, liv4: string): { sintetica: string; estesa: string } {
  const leaf = firstLinePreview(liv4)
  const variant = !leaf || leaf.length < 40 || !isSelfContained(leaf)
  const useLiv3 = variant && isSelfContained(liv3) && !liv3.toLowerCase().includes((leaf || '').toLowerCase())
  if (useLiv3) {
    return { sintetica: joinDesc(liv3, leaf), estesa: joinDesc(liv3, liv4) }
  }
  const sintetica = (isSelfContained(leaf) ? leaf : composeDesc([liv1, liv2, liv3], leaf)) || liv3 || ''
  return { sintetica, estesa: liv4 || liv3 }
}

const parser = makeParser({
  removeNSPrefix: true,   // "EASY:Articolo" → "Articolo"
  parseTagValue: false,   // mantieni i testi come stringhe (prezzo lo converto io)
})

interface EasyAnalisi {
  totaleparziale?: { '@_valore'?: string }
  incidenzamanodopera?: { '@_percentuale'?: string }
}
interface EasyArticolo {
  '@_codice'?: string
  livello1?: string
  livello2?: string
  livello3?: string
  livello4?: string
  um?: string
  prezzo?: string | number
  Analisi?: EasyAnalisi
}

/** Converte un Articolo EASY in una riga normalizzata (null se senza prezzo). */
function articoloToRow(a: EasyArticolo, regione: string, anno: string): PriceRow | null {
  const codice = String(a['@_codice'] ?? '').trim()
  if (!codice) return null
  const prezzo = num(a.prezzo)
  if (prezzo === 0) return null   // salta voci senza prezzo (coerente col legacy)

  const liv1 = levelText(a.livello1)
  const liv2 = levelText(a.livello2)
  const liv3 = levelText(a.livello3)
  const liv4 = levelText(a.livello4)
  const an = a.Analisi
  const { sintetica, estesa } = easyDesc(liv1, liv2, liv3, liv4)

  return {
    codice,
    declaratoria: estesa || codice,           // descrizione estesa
    desc_short: sintetica || codice,          // sintetica self-contained
    um: String(a.um ?? '').trim(),
    prezzo,
    importo_netto: num(an?.totaleparziale?.['@_valore']),   // base senza SG/utile
    ru: num(an?.incidenzamanodopera?.['@_percentuale']),    // incidenza manodopera %
    liv1, liv2, liv3, liv4,
    materia: '',
    disciplina: liv1,
    sistema: liv2,
    attivita: '',
    settore: liv3,
    keywords: '',
    tipologia: '',
    regione,
    anno,
  }
}

/**
 * Esegue il parsing di un prezzario in formato EASY.
 * @param xml contenuto del file XML
 * @param fallback regione/anno di default se non rilevabili dal contenuto
 */
export function parseEasy(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const doc = parser.parse(xml)
  const prez = doc?.Prezzario
  if (!prez) return { rows: [], regione: fallback.regione ?? null, anno: fallback.anno ?? null }

  // anno dall'intestazione: <intestazione><dettaglio anno="2025"/></intestazione>
  const annoAttr = prez.intestazione?.dettaglio?.['@_anno']
  let anno: string | null = annoAttr ? String(annoAttr) : (fallback.anno ?? null)

  const articoli = toArray<EasyArticolo>(prez.Contenuto?.Articolo)

  // regione dal prefisso di 3 lettere del primo codice (CAL→Calabria, ecc.)
  let regione: string | null = fallback.regione ?? null
  for (const a of articoli) {
    const cod = String(a['@_codice'] ?? '')
    if (cod.length >= 3) {
      const pfx = cod.substring(0, 3).toUpperCase()
      if (REGIONS[pfx]) { regione = REGIONS[pfx]; break }
    }
  }
  // anno di riserva dal codice se l'intestazione non lo dava
  if (!anno) {
    for (const a of articoli) {
      const m = String(a['@_codice'] ?? '').match(/20(\d{2})/)
      if (m) { anno = '20' + m[1]; break }
    }
  }

  const rows: PriceRow[] = []
  for (const a of articoli) {
    const row = articoloToRow(a, regione ?? '', anno ?? '')
    if (row) rows.push(row)
  }
  return { rows, regione, anno }
}
