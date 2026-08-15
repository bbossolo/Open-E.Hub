/**
 * Parser per la famiglia **Veneto** (`<prezzario>` minuscolo).
 *
 * Struttura (gerarchia esplicita per annidamento):
 *   <prezzario cod="2025" desc="Prezzario 2025">
 *     <settore cod="VEN25-01" desc="OPERE EDILI">
 *       <capitolo cod="VEN25-01.02" desc="SCAVI">
 *         <paragrafo cod="VEN25-01.02.01" manodopera="0">
 *           <sint>SCAVO DI PULIZIA…</sint>          ← descrizione sintetica
 *           <estesa>Scavo di pulizia generale…</estesa>  ← descrizione estesa
 *           <prezzi>
 *             <prezzo cod="…00" umi="m²" val="3.4" man="34.97">SCAVO DI PULIZIA…</prezzo>
 *           </prezzi>
 *         </paragrafo>
 *
 * Una voce per ogni <prezzo> (un paragrafo può avere più varianti di prezzo); la
 * sintetica/estesa del paragrafo viene ereditata da tutte le sue varianti.
 */
import { REGIONS } from '../../data/regions'
import { makeParser, num, toArray } from '../xml'
import type { ParseResult, PriceRow } from '../types'

const parser = makeParser({ parseTagValue: false })

interface VPrezzo {
  '@_cod'?: string
  '@_umi'?: string
  '@_val'?: string
  '@_man'?: string
  '#text'?: string
}
interface VParagrafo {
  sint?: string
  estesa?: string
  prezzi?: { prezzo?: VPrezzo | VPrezzo[] }
}
interface VCapitolo { '@_desc'?: string; paragrafo?: VParagrafo | VParagrafo[] }
interface VSettore { '@_cod'?: string; '@_desc'?: string; capitolo?: VCapitolo | VCapitolo[] }

export function parseVeneto(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const doc = parser.parse(xml)
  const prez = doc?.prezzario
  if (!prez) return { rows: [], regione: fallback.regione ?? null, anno: fallback.anno ?? null }

  // anno dall'attributo cod della radice (es. cod="2025")
  const rootCod = String(prez['@_cod'] ?? '')
  let anno: string | null = rootCod.match(/20\d{2}/)?.[0] ?? (fallback.anno ?? null)
  let regione: string | null = fallback.regione ?? null

  const rows: PriceRow[] = []
  for (const s of toArray<VSettore>(prez.settore)) {
    const liv1 = String(s['@_desc'] ?? '').trim()
    // regione dal prefisso di 3 lettere del codice settore (VEN → Veneto)
    if (!regione) {
      const pfx = String(s['@_cod'] ?? '').substring(0, 3).toUpperCase()
      if (REGIONS[pfx]) regione = REGIONS[pfx]
    }
    for (const cap of toArray<VCapitolo>(s.capitolo)) {
      const liv2 = String(cap['@_desc'] ?? '').trim()
      for (const para of toArray<VParagrafo>(cap.paragrafo)) {
        const sint = String(para.sint ?? '').trim()
        const estesa = String(para.estesa ?? '').trim()
        for (const p of toArray<VPrezzo>(para.prezzi?.prezzo)) {
          const prezzo = num(p['@_val'])
          if (prezzo === 0) continue
          const codice = String(p['@_cod'] ?? '').trim()
          if (!codice) continue
          // sintetica: preferisci il testo specifico della variante, poi il sint del paragrafo
          const variante = String(p['#text'] ?? '').trim()
          const descShort = variante || sint
          rows.push({
            codice,
            declaratoria: estesa || sint || variante,
            desc_short: descShort || codice,
            um: String(p['@_umi'] ?? '').trim(),
            prezzo,
            importo_netto: 0,
            ru: num(p['@_man']),            // incidenza manodopera %
            liv1, liv2, liv3: '', liv4: '',
            materia: '',
            disciplina: liv1,
            sistema: '',
            attivita: '',
            settore: liv2,
            keywords: '',
            tipologia: '',
            regione: regione ?? '',
            anno: anno ?? '',
          })
        }
      }
    }
  }

  if (!anno) {
    const m = rows.find(r => r.codice.match(/20\d{2}/))?.codice.match(/20\d{2}/)
    if (m) anno = m[0]
  }
  return { rows, regione, anno }
}
