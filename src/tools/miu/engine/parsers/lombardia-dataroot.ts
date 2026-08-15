/**
 * Parser per la famiglia **Lombardia `dataroot`** (export Microsoft Access).
 *
 * È la "Parte 4 - Elenco prezzi - Precedente struttura": un file diverso dalla
 * famiglia `lombardia` (`<report>`, struttura METEL) e perciò gestito a parte.
 *
 * Struttura (record flat, nome elemento "manglato" da Access):
 *   <dataroot xmlns:od="urn:schemas-microsoft-com:officedata">
 *     <F_x0029__x0020_Parte_x0020_4_x0020_-_x0020_Elenco_x0020_prezzi>
 *       <Codice>LOM261.1C</Codice>
 *       <Declaratoria>OPERE COMPIUTE</Declaratoria>          ← riga-categoria (NO Prezzo)
 *     </…>
 *     <F_x0029__…_Elenco_prezzi>
 *       <Codice>LOM261.1C.00.010.0010</Codice>
 *       <Declaratoria>Misura della durezza superficiale…</Declaratoria>   ← foglia self-contained
 *       <U_M>cad</U_M>
 *       <Prezzo>1.44</Prezzo>
 *       <Importo_senza_SG_e_UI>1.14</Importo_senza_SG_e_UI>
 *       <Rapporto_RU>0.456140350877193</Rapporto_RU>        ← rapporto manodopera (frazione)
 *     </…>
 *
 * Le righe-categoria (senza `<Prezzo>`) definiscono solo la gerarchia per prefisso
 * di codice e vengono scartate. Le foglie hanno una `Declaratoria` già estesa e
 * autosufficiente (stile Lombardia), quindi `declaratoria`/`desc_short` derivano
 * direttamente da essa: il quality gate self-contained passa senza risalita ai padri.
 */
import { REGIONS } from '../../data/regions'
import { firstLinePreview } from '../codes'
import { makeParser, num, toArray } from '../xml'
import type { ParseResult, PriceRow } from '../types'

// parseTagValue:false → codici e u.m. ("100 kg") restano stringhe intatte.
const parser = makeParser({ parseTagValue: false })

interface DRecord {
  Codice?: string
  Declaratoria?: string
  U_M?: string
  Prezzo?: string
  Importo_senza_SG_e_UI?: string
  Rapporto_RU?: string
}

const str = (v: unknown): string => String(v ?? '').trim()

/** Estrae l'array dei record dal nodo `dataroot`: la chiave Access contiene "Elenco_prezzi". */
function recordsOf(root: Record<string, unknown> | undefined): DRecord[] {
  if (!root) return []
  const key = Object.keys(root).find(k => /elenco/i.test(k) && /prezzi/i.test(k))
  return key ? toArray<DRecord>(root[key] as DRecord | DRecord[]) : []
}

export function parseLombardiaDataroot(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const doc = parser.parse(xml)
  const records = recordsOf(doc?.dataroot)
  if (!records.length) return { rows: [], regione: fallback.regione ?? null, anno: fallback.anno ?? null }

  let regione: string | null = fallback.regione ?? null
  const anno: string | null = fallback.anno ?? null

  // 1ª passata — righe-categoria (senza <Prezzo>): codice → etichetta, per dare
  // alle foglie i livelli/disciplina per prefisso ("LOM261.1C.00.010" ereditando
  // "LOM261.1C" = OPERE COMPIUTE, "LOM261.1C.00" = capitolo, …).
  const labelByCode = new Map<string, string>()
  for (const rec of records) {
    const codice = str(rec.Codice)
    if (!codice || (rec.Prezzo != null && str(rec.Prezzo) !== '')) continue
    const label = firstLinePreview(str(rec.Declaratoria))
    if (label && !labelByCode.has(codice)) labelByCode.set(codice, label)
  }
  /** Etichette dei prefissi-categoria di un codice foglia (dal generale al particolare). */
  function livelliOf(codice: string): string[] {
    const parts = codice.split('.')
    const out: string[] = []
    let acc = ''
    for (let i = 0; i < parts.length - 1; i++) {
      acc = i === 0 ? parts[0] : acc + '.' + parts[i]
      const l = labelByCode.get(acc)
      if (l) out.push(l)
    }
    return out
  }

  const rows: PriceRow[] = []
  for (const rec of records) {
    const codice = str(rec.Codice)
    if (!codice) continue
    // Le righe-categoria non hanno <Prezzo>: non diventano voci (solo gerarchia).
    if (rec.Prezzo == null || str(rec.Prezzo) === '') continue
    const prezzo = num(rec.Prezzo)

    if (!regione) {
      const pfx = codice.substring(0, 3).toUpperCase()
      if (REGIONS[pfx]) regione = REGIONS[pfx]
    }

    const declaratoria = str(rec.Declaratoria)
    const livelli = livelliOf(codice)

    rows.push({
      codice,
      declaratoria: declaratoria || codice,                 // estesa: Declaratoria intera
      desc_short: firstLinePreview(declaratoria) || codice,  // sintetica: prima riga (già self-contained)
      um: str(rec.U_M),
      prezzo,
      importo_netto: num(rec.Importo_senza_SG_e_UI),
      ru: num(rec.Rapporto_RU),                              // rapporto manodopera (frazione 0..1)
      liv1: livelli[0] ?? '', liv2: livelli[1] ?? '', liv3: livelli[2] ?? '', liv4: livelli[3] ?? '',
      materia: '',
      disciplina: livelli[0] ?? '',
      sistema: livelli[1] ?? '',
      attivita: '',
      settore: livelli[livelli.length - 1] ?? '',
      keywords: '',
      tipologia: '',
      regione: regione ?? '',
      anno: anno ?? '',
    })
  }

  // riempi regione sulle righe se rilevata dopo le prime
  if (regione) for (const r of rows) r.regione = regione
  return { rows, regione, anno }
}
