/**
 * Parser per il **Prezzario RFI — Rete Ferroviaria Italiana** (privato, XPWE).
 *
 * A differenza degli altri grezzi (xlsx/csv/xml "piatto"), qui il file è un
 * vero export **XPWE** ("PriMus Exchange", `File → Esporta → XPWE` di PriMus,
 * `TipoDocumento=0` = solo Elenco Prezzi, nessun `PweVociComputo`) — stesso
 * formato documentato in `Docs/HANDOFF-formato-xpwe-primus.md`, ma qui è un
 * export REALE di terzi (ACCA/RFI), non il nostro `buildXpwe`: a differenza
 * del nostro export, che lascia sempre `PweDGCapitoli` vuoti (il dominio μ
 * non li modella), il grezzo RFI li popola per davvero con la gerarchia
 * ufficiale a 3 livelli (Tariffa/Capitolo/Gruppo) — verificato sul campione
 * reale 2024/2025/2026.
 *
 * `PweElencoPrezzi > EPItem` contiene DUE tipi di riga, indistinguibili dal
 * solo `Prezzo1` (alcune voci reali hanno prezzo NEGATIVO — detrazioni, es.
 * "smontaggio in meno" — quindi `prezzo>0` da solo scarterebbe voci vere):
 *  - righe-titolo, copia della definizione di Tariffa/Capitolo/Gruppo già
 *    nelle tabelle `PweDG*Capitoli` (prezzo sempre 0, `UnMisura` sempre vuota);
 *  - voci vere (foglia), con `UnMisura` sempre valorizzata.
 * Il discriminante affidabile è quindi `UnMisura` non vuota (verificato: 0
 * voci con prezzo>0 e UM vuota, quindi nessun falso negativo).
 */
import { makeParser, toArray, num } from '../../../../shared/xml-utils'
import type { ParseResult, PriceRow } from '../types'

type XmlNode = Record<string, unknown>

const attr = (node: XmlNode, name: string): string => {
  const v = node['@_' + name]
  return v == null ? '' : String(v)
}

const childText = (node: XmlNode | undefined, tagName: string): string => {
  const v = node?.[tagName]
  return v == null ? '' : String(v).trim()
}

/** "[AC.PC] Posto Centrale e configurazioni" → "Posto Centrale e configurazioni"
 *  (il codice tariffa è già in `codice`, il prefisso tra [] è ridondante). */
const stripCodicePrefix = (s: string): string => s.replace(/^\[[^\]]*\]\s*/, '')

/** Tabella `PweDG{tag}` → mappa `ID` (attributo) → `DesSintetica` (elemento),
 *  stesso pattern di `lookupTabella` in `xpwe-import.ts` ma per i Capitoli
 *  dell'Elenco Prezzi (`SuperCapitoli`/`Capitoli`/`SubCapitoli`), non le
 *  Categorie del Computo. */
function lookupCapitoli(dgCapCat: XmlNode | undefined, tag: string): Map<string, string> {
  const out = new Map<string, string>()
  const wrapper = dgCapCat?.['PweDG' + tag] as XmlNode | undefined
  for (const item of toArray(wrapper?.['DG' + tag + 'Item'] as XmlNode | XmlNode[] | undefined)) {
    const id = attr(item, 'ID')
    const nome = stripCodicePrefix(childText(item, 'DesSintetica'))
    if (id && nome) out.set(id, nome)
  }
  return out
}

/**
 * @param xml testo grezzo del file `.xpwe` (XML semplice, nessun BOM/prolog XML).
 */
export function parseRfi(xml: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const regione = fallback.regione ?? 'RFI'
  const anno = fallback.anno ?? null

  let doc: XmlNode
  try {
    doc = makeParser().parse(xml.replace(/^﻿/, '')) as XmlNode
  } catch {
    return { rows: [], regione, anno }
  }
  const pwe = doc['PweDocumento'] as XmlNode | undefined
  const misurazioni = pwe?.['PweMisurazioni'] as XmlNode | undefined
  const collEp = misurazioni?.['PweElencoPrezzi'] as XmlNode | undefined
  if (!pwe || !misurazioni || !collEp) return { rows: [], regione, anno }

  const dg = pwe['PweDatiGenerali'] as XmlNode | undefined
  const dgCapCat = dg?.['PweDGCapitoliCategorie'] as XmlNode | undefined
  const superCap = lookupCapitoli(dgCapCat, 'SuperCapitoli')
  const cap = lookupCapitoli(dgCapCat, 'Capitoli')
  const subCap = lookupCapitoli(dgCapCat, 'SubCapitoli')

  const rows: PriceRow[] = []
  for (const ep of toArray(collEp['EPItem'] as XmlNode | XmlNode[] | undefined)) {
    const um = childText(ep, 'UnMisura')
    if (!um) continue // riga-titolo (Tariffa/Capitolo/Gruppo), non una voce reale

    const codice = childText(ep, 'Tariffa')
    const desRid = childText(ep, 'DesRidotta')
    const desEst = childText(ep, 'DesEstesa')
    const prezzo = num(childText(ep, 'Prezzo1'))

    const liv1 = superCap.get(childText(ep, 'IDSpCap')) ?? ''
    const liv2 = cap.get(childText(ep, 'IDCap')) ?? ''
    const liv3 = subCap.get(childText(ep, 'IDSbCap')) ?? ''

    rows.push({
      codice,
      declaratoria: desEst || desRid || codice,
      desc_short: desRid || codice,
      um,
      prezzo,
      importo_netto: 0,
      ru: num(childText(ep, 'IncMDO')),
      liv1, liv2, liv3, liv4: '',
      materia: '', disciplina: liv1, sistema: liv2, attivita: '', settore: liv3,
      keywords: '', tipologia: '',
      regione, anno: anno ?? '',
    })
  }

  return { rows, regione, anno }
}
