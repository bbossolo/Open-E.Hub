/**
 * Parser dei **Listini METEL** (file LSP `.txt`, standard METEL a colonne fisse).
 * Importati a RUNTIME via drag-drop (un file = un fornitore), non bundlati.
 *
 * Header (riga 0): "LISTINO METEL …".
 * Record (177 char), layout (stesso dell'export METEL del tool):
 *   [0:3] marca · [3:19] codice articolo · [19:32] EAN · [32:75] descrizione ·
 *   [75:90] qty (carton/multiplo/min) · [90:96] max · [96] flag ·
 *   [97:108] prezzo netto ×100 · [108:119] prezzo LISTINO ×100 · [119:125] moltipl. ·
 *   [125:128] valuta · [128:131] unità di misura METEL.
 */
import type { ParseResult, PriceRow } from '../types'

/** UM METEL (UN/ECE) → simbolo del tool. */
const METEL_UM: Record<string, string> = {
  PCE: 'nr', NR: 'nr', PZ: 'nr', MTR: 'm', MTK: 'm²', MTQ: 'm³',
  KGM: 'kg', GRM: 'g', LTR: 'l', SET: 'set', CEN: '100', MIL: '1000',
}

/** True se il testo è un listino METEL LSP. */
export function isMetel(text: string): boolean {
  return /^LISTINO\s+METEL/i.test(String(text || '').slice(0, 40))
}

/**
 * @param text contenuto del file LSP (leggere come latin1/ISO-8859-1).
 * @param fallback regione = etichetta fornitore (dal nome file), anno opzionale.
 */
export function parseMetel(text: string, fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const lines = String(text || '').split(/\r?\n/)
  const regione = fallback.regione ?? 'METEL'
  const anno = fallback.anno ?? null
  if (!isMetel(lines[0] || '')) return { rows: [], regione: null, anno }

  const rows: PriceRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i]
    if (!ln || ln.length < 119) continue
    const marca = ln.slice(0, 3).trim()
    const art = ln.slice(3, 19).trim()
    if (!art) continue
    const desc = ln.slice(32, 75).trim().replace(/^[?*]\s*/, '').trim()
    const prezzo = (parseInt(ln.slice(108, 119), 10) || 0) / 100   // prezzo di listino (lordo)
    if (!(prezzo > 0)) continue
    const umRaw = ln.length >= 131 ? ln.slice(128, 131).trim().toUpperCase() : ''

    rows.push({
      codice: (marca ? marca + '.' : '') + art,
      declaratoria: desc || art,
      desc_short: desc || art,
      um: METEL_UM[umRaw] ?? (umRaw ? umRaw.toLowerCase() : 'nr'),
      prezzo,
      importo_netto: 0,
      ru: 0,
      liv1: marca, liv2: '', liv3: '', liv4: '',
      materia: '', disciplina: marca, sistema: '', attivita: '', settore: '',
      keywords: '', tipologia: '',
      regione, anno: anno ?? '',
    })
  }
  return { rows, regione, anno }
}
