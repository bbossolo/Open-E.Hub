/**
 * Parser per la famiglia **Documento / six.xsd** (software S.T.R.): Friuli V.G.,
 * Emilia-Romagna, Trento, Bolzano.
 *
 * Struttura:
 *  - tabella unità di misura: `<unitaDiMisura unitaDiMisuraId="44" simbolo="CDM"/>`
 *  - albero di `<gruppo>` che contiene `<prodotto>`:
 *      <prodotto prdId="01.1.AB1.01.A" unitaDiMisuraId="62">
 *        <incidenzaManodopera>29.13</incidenzaManodopera>
 *        <prdDescrizione breve="Puntellazione di travi…" />
 *        <prdQuotazione valore="27.32" />
 *      </prodotto>
 *  - i `prodotto` con `prdQuotazione/@valore=0` sono nodi-CATEGORIA: il loro
 *    `prdId` (più corto) è prefisso dei prodotti figli e ne fornisce la gerarchia.
 *
 * Region/anno non sono nel contenuto in modo affidabile → arrivano dal fallback
 * (cartella/anno del file) passato dal build.
 */
import { composeDesc } from '../descriptions'
import { makeParser, num, toArray } from '../xml'
import { fixEmiliaRomagnaGlyph } from './emilia-romagna-glyphs'
import type { ParseResult, PriceRow } from '../types'

const parser = makeParser({ parseTagValue: true })

interface Descr { '@_lingua'?: string; '@_breve'?: string; '@_estesa'?: string }
interface Quot { '@_valore'?: string }
interface PrdGrp { '@_grpValoreId'?: string }
interface Prodotto {
  '@_prdId'?: string
  '@_unitaDiMisuraId'?: string
  incidenzaManodopera?: number | string
  prdDescrizione?: Descr | Descr[]
  prdQuotazione?: Quot | Quot[]
  prdGrpValore?: PrdGrp | PrdGrp[]
}
// Classificazione per gruppi (export Alice/Emilia-Romagna): le CATEGORIE di
// elenco prezzi non sono prodotto-titolo ma <gruppo tipo="CATEGORIAELENCOPREZZI">
// con <grpValore vlrId="1.1"><vlrDescrizione breve="A01.001 - SCAVI…"/> e la voce
// vi punta con <prdGrpValore grpValoreId>. Senza questa tabella l'ER restava
// quasi tutto senza capitoli (sistema/settore vuoti → fuori macrocategoria).
interface GrpValore { '@_grpValoreId'?: string; '@_vlrId'?: string; vlrDescrizione?: { '@_breve'?: string } | { '@_breve'?: string }[] }
interface Gruppo { '@_tipo'?: string; grpValore?: GrpValore | GrpValore[] }

/** Descrizione italiana (breve+estesa); gestisce i prezzari bilingui (es. Bolzano). */
function pickDescr(p: Prodotto): { breve: string; estesa: string } {
  const arr = toArray<Descr>(p.prdDescrizione)
  const d = arr.find(x => x['@_lingua'] === 'it') ?? arr[0]
  return { breve: String(d?.['@_breve'] ?? '').trim(), estesa: String(d?.['@_estesa'] ?? '').trim() }
}

/** Prima quotazione con valore > 0 (alcuni prodotto hanno più liste prezzi). */
function pickPrezzo(p: Prodotto): number {
  for (const q of toArray<Quot>(p.prdQuotazione)) { const v = num(q['@_valore']); if (v > 0) return v }
  return 0
}
interface Udm { '@_unitaDiMisuraId'?: string; '@_simbolo'?: string }

/** Raccoglie ricorsivamente tutti i nodi che compaiono sotto la chiave `key`. */
function collect(node: unknown, key: string, out: unknown[]): void {
  if (Array.isArray(node)) { for (const n of node) collect(n, key, out); return }
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === key) for (const item of toArray(v)) out.push(item)
    else collect(v, key, out)
  }
}

/** Prefissi gerarchici progressivi di un prdId ("01.1.AB1" → ["01","01.1","01.1.AB1"]). */
function prefixes(prdId: string): string[] {
  const parts = prdId.split('.')
  const out: string[] = []
  let acc = ''
  for (let i = 0; i < parts.length; i++) { acc = i === 0 ? parts[0] : acc + '.' + parts[i]; out.push(acc) }
  return out
}

export function parseDocumento(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const doc = parser.parse(xml)
  const root = doc?.Documento
  if (!root) return { rows: [], regione: fallback.regione ?? null, anno: fallback.anno ?? null }

  // tabella unità di misura: id → simbolo
  const udms: Udm[] = []
  collect(root, 'unitaDiMisura', udms)
  const umById = new Map<string, string>()
  for (const u of udms) {
    const id = u['@_unitaDiMisuraId']
    if (id) umById.set(String(id), String(u['@_simbolo'] ?? '').trim())
  }

  // tabella categorie di elenco prezzi (gruppo/grpValore): grpValoreId → { vlrId, label }
  // e vlrId → label per risalire la catena dei padri ("1.1" → "1").
  const gruppi: Gruppo[] = []
  collect(root, 'gruppo', gruppi)
  const grpById = new Map<string, { vlrId: string; label: string }>()
  const labelByVlr = new Map<string, string>()
  for (const g of gruppi) {
    if (String(g['@_tipo'] ?? '') !== 'CATEGORIAELENCOPREZZI') continue
    for (const v of toArray<GrpValore>(g.grpValore)) {
      const id = String(v['@_grpValoreId'] ?? '').trim()
      const vlrId = String(v['@_vlrId'] ?? '').trim()
      const d = toArray<{ '@_breve'?: string }>(v.vlrDescrizione)[0]
      let label = String(d?.['@_breve'] ?? '').trim()
      if (fallback.regione === 'Emilia-Romagna') label = fixEmiliaRomagnaGlyph(label)
      if (!id || !label) continue
      grpById.set(id, { vlrId, label })
      if (vlrId) labelByVlr.set(vlrId, label)
    }
  }
  /** Catena di categorie di una voce, dal capitolo alla sottocategoria. */
  function gruppoChain(p: Prodotto): string[] {
    const id = String(toArray<PrdGrp>(p.prdGrpValore)[0]?.['@_grpValoreId'] ?? '').trim()
    const g = id ? grpById.get(id) : undefined
    if (!g) return []
    const out: string[] = []
    for (const pre of prefixes(g.vlrId)) {
      const l = labelByVlr.get(pre)
      if (l) out.push(l)
    }
    return out.length ? out : [g.label]
  }

  // tutti i prodotto (categorie + voci)
  const prodotti: Prodotto[] = []
  collect(root, 'prodotto', prodotti)

  // mappa prdId → descrizione breve (per ereditare la gerarchia dai nodi-categoria)
  const descById = new Map<string, string>()
  for (const p of prodotti) {
    const id = String(p['@_prdId'] ?? '').trim()
    let breve = pickDescr(p).breve
    if (fallback.regione === 'Emilia-Romagna') breve = fixEmiliaRomagnaGlyph(breve)
    if (id && breve && !descById.has(id)) descById.set(id, breve)
  }

  const rows: PriceRow[] = []
  for (const p of prodotti) {
    const codice = String(p['@_prdId'] ?? '').trim()
    if (!codice) continue
    const prezzo = pickPrezzo(p)
    if (prezzo === 0) continue   // nodo-categoria o voce senza prezzo

    let { breve, estesa } = pickDescr(p)
    if (fallback.regione === 'Emilia-Romagna') {
      breve = fixEmiliaRomagnaGlyph(breve)
      estesa = fixEmiliaRomagnaGlyph(estesa)
    }
    const um = umById.get(String(p['@_unitaDiMisuraId'] ?? '')) ?? ''

    // gerarchia: descrizioni dei prefissi-categoria (esclusa la voce stessa),
    // ADDITIVA con la catena gruppo/grpValore in testa (capitoli che nell'export
    // Alice/ER non esistono come prodotto-titolo). La dedup guarda SOLO la catena
    // nuova: a catena vuota (Trento/Bolzano/Friuli) l'output resta quello storico.
    const chain = gruppoChain(p)
    const levels: string[] = [...chain]
    for (const pre of prefixes(codice)) {
      if (pre === codice) break
      const d = descById.get(pre)
      if (d && !chain.some(l => l.toLowerCase().includes(d.toLowerCase()))) levels.push(d)
    }

    // self-contained: se la foglia è un frammento, antepone la gerarchia (categorie padre)
    const sintetica = composeDesc(levels, breve) || codice
    const estesaFull = composeDesc(levels, estesa || breve) || sintetica

    rows.push({
      codice,
      declaratoria: estesaFull,            // estesa self-contained (estesa se c'è, es. Bolzano)
      desc_short: sintetica,               // sintetica self-contained
      um,
      prezzo,
      importo_netto: 0,
      ru: num(p.incidenzaManodopera),     // incidenza manodopera %
      liv1: levels[0] ?? '', liv2: levels[1] ?? '', liv3: levels[2] ?? '', liv4: levels[3] ?? '',
      materia: '',
      disciplina: levels[0] ?? '',
      sistema: levels[1] ?? '',
      attivita: '',
      settore: levels[levels.length - 1] ?? '',
      keywords: '',
      tipologia: '',
      regione: fallback.regione ?? '',
      anno: fallback.anno ?? '',
    })
  }

  return { rows, regione: fallback.regione ?? null, anno: fallback.anno ?? null }
}
