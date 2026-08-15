/**
 * Parser per la famiglia **Lombardia** (`<report>`, struttura METEL).
 *
 * Struttura:
 *   <report><voci>
 *     <voci>
 *       <riferimenti_voce><autore>LOM</autore><anno>2026</anno></riferimenti_voce>
 *       <dettaglio_voce codice_voce="LOM261…" prezzo_voce="310.62" unita_misura_voce="1 cad"
 *                       importo_senza_sgui_voce="245.55" rapporto_RU_voce="5.13"
 *                       tipologia_risorsa="OPERA COMPIUTA">
 *         <declaratoria_voce>OPERA: …\nLAVORO: …</declaratoria_voce>        ← sintetica (riga OPERA:)
 *         <declaratoria_voce_dettaglio>…</declaratoria_voce_dettaglio>      ← estesa
 *         <cod_liv_1>OC</cod_liv_1><descr_liv_1>OPERA COMPIUTA</descr_liv_1> … (fino a liv_5)
 *       </dettaglio_voce>
 *     </voci>
 *
 * Nota: la "Parte 4 - Precedente struttura" (root `<dataroot>`) è un export Access
 * diverso e NON è gestita qui (vedi roadmap STEP 4b).
 */
import { REGIONS } from '../../data/regions'
import { firstLinePreview } from '../codes'
import { makeParser, num, toArray } from '../xml'
import type { ParseResult, PriceRow, RisorsaComponente } from '../types'
import type { AnalisiRigaTipo } from '../../../../shared/compositore/analisi-prezzi'

const parser = makeParser({ parseTagValue: false })

interface LRisorsa {
  '@_codifica_risorsa'?: string
  '@_udm_risorsa'?: string
  '@_quantita_risorsa'?: string
  '@_prezzo_risorsa'?: string
  '@_tipologia_risorsa'?: string
  declaratoria_risorsa?: string
}
interface LDettaglio {
  '@_codice_voce'?: string
  '@_prezzo_voce'?: string
  '@_unita_misura_voce'?: string
  '@_importo_senza_sgui_voce'?: string
  '@_rapporto_RU_voce'?: string
  '@_tipologia_risorsa'?: string
  declaratoria_voce?: string
  declaratoria_voce_dettaglio?: string
  risorse?: { risorsaDTOList?: LRisorsa | LRisorsa[] }
  descr_liv_1?: string
  descr_liv_2?: string
  descr_liv_3?: string
  descr_liv_4?: string
  descr_liv_5?: string
  descr_liv_8?: string
  descr_liv_9?: string
  descr_liv_10?: string
  descr_liv_11?: string
}
interface LVoce { riferimenti_voce?: { anno?: string }; dettaglio_voce?: LDettaglio }

/** Sintetica: la riga "OPERA: …" se presente in declVoce o declDett, altrimenti la prima
 *  riga di declVoce (declaratoria di VOCE, sintetica per natura) — declDett (l'estesa,
 *  con dettagli tecnici tipo "OP1 Cavo, FG21M21; geometria: …") è l'ultima risorsa, solo
 *  se declVoce è del tutto assente, per non restituire un frammento tecnico come breve.
 *  Le code «Incluso: …» / «Escluso: …» NON sono l'identità della voce (una presa che
 *  ESCLUDE i rivelatori di fumo non deve vincere la ricerca «rivelatore di fumo»):
 *  restano nella declaratoria estesa, fuori dalla descrizione breve. */
function sintetica(declVoce: string, declDett: string): string {
  const m = (declVoce + '\n' + declDett).match(/OPERA:\s*([^\n\r]+)/)
  const line = m ? m[1].trim().replace(/\s+/g, ' ') : firstLinePreview(declVoce || declDett)
  return line.replace(/\s*\b(Incluso|Escluso):.*$/, '').trim()
}

/** tipologia_risorsa → sezione dell'analisi prezzi (A manodopera / B materiale / C nolo / D varie). */
function tipoRisorsa(tipologia: string): AnalisiRigaTipo {
  if (/^RISORSA UMANA/i.test(tipologia)) return 'manodopera'
  if (/^RISORSA MATERIALE/i.test(tipologia)) return 'materiale'
  if (/^RISORSA STRUMENTALE/i.test(tipologia)) return 'nolo'
  return 'varie'
}

/** Scomposizione ufficiale della voce: un componente per risorsaDTOList. */
function risorseOf(d: LDettaglio): RisorsaComponente[] | undefined {
  const out: RisorsaComponente[] = []
  for (const r of toArray<LRisorsa>(d.risorse?.risorsaDTOList)) {
    const codice = String(r['@_codifica_risorsa'] ?? '').trim()
    const quantita = num(r['@_quantita_risorsa'])
    if (!codice || quantita <= 0) continue
    out.push({
      codice,
      tipo: tipoRisorsa(String(r['@_tipologia_risorsa'] ?? '')),
      quantita,
      prezzo: num(r['@_prezzo_risorsa']),
      um: String(r['@_udm_risorsa'] ?? '').replace(/^[0-9\s]+/, '').trim(),   // "1 cad" → "cad"
      descrizione: firstLinePreview(String(r.declaratoria_risorsa ?? '').trim()),
    })
  }
  return out.length ? out : undefined
}

export function parseLombardia(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const doc = parser.parse(xml)
  const voci = toArray<LVoce>(doc?.report?.voci?.voci)
  if (!voci.length) return { rows: [], regione: fallback.regione ?? null, anno: fallback.anno ?? null }

  let regione: string | null = fallback.regione ?? null
  let anno: string | null = fallback.anno ?? null

  const rows: PriceRow[] = []
  for (const v of voci) {
    const d = v.dettaglio_voce
    if (!d) continue
    const codice = String(d['@_codice_voce'] ?? '').trim()
    if (!codice) continue
    const prezzo = num(d['@_prezzo_voce'])
    if (prezzo === 0) continue   // scarta voci senza prezzo

    if (!regione) {
      const pfx = codice.substring(0, 3).toUpperCase()
      if (REGIONS[pfx]) regione = REGIONS[pfx]
    }
    if (!anno && v.riferimenti_voce?.anno) anno = String(v.riferimenti_voce.anno)

    const declVoce = String(d.declaratoria_voce ?? '').trim()
    const declDett = String(d.declaratoria_voce_dettaglio ?? '').trim()
    const liv1 = String(d.descr_liv_1 ?? '').trim()
    const liv2 = String(d.descr_liv_2 ?? '').trim()
    const liv3 = String(d.descr_liv_3 ?? '').trim()
    const liv4 = String(d.descr_liv_4 ?? '').trim()
    const liv5 = String(d.descr_liv_5 ?? '').trim()
    // Voci a 11 livelli (OPERA COMPIUTA e affini): liv2..liv5 descrivono il
    // CONTESTO dell'opera (EDILIZIA · EDIFICI · RESIDENZE), non la disciplina —
    // quella vera sta nei livelli profondi (liv8 = INGEGNERIA ELETTRICA/…,
    // liv9 = sistema, liv10 = famiglia prodotto, liv11 = materia). Senza questa
    // mappa le OC impiantistiche restano fuori macrocategoria e la ricerca le
    // seppellisce sotto le RISORSE MATERIALE gemelle.
    const liv8 = String(d.descr_liv_8 ?? '').trim()
    const liv9 = String(d.descr_liv_9 ?? '').trim()
    const liv10 = String(d.descr_liv_10 ?? '').trim()
    const liv11 = String(d.descr_liv_11 ?? '').trim()
    const deep = !!liv8
    const risorse = risorseOf(d)

    rows.push({
      codice,
      declaratoria: declDett || declVoce,                          // estesa
      desc_short: sintetica(declVoce, declDett) || codice,          // sintetica
      um: String(d['@_unita_misura_voce'] ?? '').replace(/^[0-9\s]+/, '').trim(), // "1 cad" → "cad"
      prezzo,
      importo_netto: num(d['@_importo_senza_sgui_voce']),
      ru: num(d['@_rapporto_RU_voce']),                            // rapporto manodopera
      liv1, liv2, liv3, liv4,
      materia: deep ? liv11 : liv5,
      disciplina: deep ? liv8 : liv2,
      sistema: deep ? liv9 : liv3,
      attivita: '',
      settore: deep ? liv10 : liv4,
      keywords: '',
      tipologia: String(d['@_tipologia_risorsa'] ?? '').trim(),
      regione: regione ?? '',
      anno: anno ?? '',
      ...(risorse ? { risorse } : {}),
    })
  }

  // riempi regione/anno sulle righe se rilevati dopo le prime
  if (regione || anno) for (const r of rows) { r.regione = regione ?? ''; r.anno = anno ?? '' }
  return { rows, regione, anno }
}
