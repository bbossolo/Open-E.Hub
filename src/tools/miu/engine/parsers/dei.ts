/**
 * Parser per il **Prezzario DEI — Impianti Elettrici** (privato, XLSX).
 *
 * Il foglio dati ha 7 colonne: codice · descrizione · um · "€ prezzo" · mdo% ·
 * noli% · mt%. La gerarchia è data dall'ordine + dai codici:
 *   0CAP… / CAP… → righe-titolo (capitolo / sezione, senza prezzo)
 *   M01001  "Edile IV livello:"            ← padre (senza prezzo, finisce con ':')
 *   M01001a "costo non comprensivo…"  €    ← voce (variante, con prezzo)
 *
 * Come Basilicata: la voce è la VARIANTE (foglia) e va resa self-contained col padre.
 * Opera su un array 2D già estratto dall'xlsx (il read del workbook sta nel build).
 */
import { composeDesc } from '../descriptions'
import type { ParseResult, PriceRow } from '../types'

const clean = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

/** "€ 33.29" / "€ 1.234,56" → numero. */
function parsePrezzo(s: unknown): number {
  let t = clean(s).replace(/€/g, '').replace(/\s/g, '')
  if (!t) return 0
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(',', '.')
  const n = parseFloat(t)
  return isFinite(n) ? n : 0
}
const parsePct = (s: unknown): number => {
  const n = parseFloat(clean(s).replace('%', '').replace(',', '.'))
  return isFinite(n) ? n : 0
}

/** True se il codice è una riga-titolo (capitolo/sezione), non una voce. */
const isCapitolo = (cod: string): boolean => /^0?CAP/i.test(cod)
const isTopCapitolo = (cod: string): boolean => /^0CAP/i.test(cod)

/**
 * @param grid righe del foglio dati (array di celle), colonne:
 *   [0]codice [1]descrizione [2]um [3]prezzo [4]mdo% [5]noli% [6]mt%
 */
export function parseDei(grid: unknown[][], fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const regione = fallback.regione ?? 'DEI · Impianti Elettrici'
  const anno = fallback.anno ?? null
  const rows: PriceRow[] = []
  let cap = '', sez = '', padre = ''

  for (const r of grid) {
    const codice = clean(r[0])
    const desc = clean(r[1])
    if (!codice && !desc) continue
    const prezzo = parsePrezzo(r[3])

    if (prezzo > 0) {
      // VOCE (variante con prezzo) → self-contained col padre della gerarchia
      const sintetica = composeDesc([cap, sez, padre], desc) || padre || desc || codice
      const estesa = padre && !padre.toLowerCase().includes(desc.toLowerCase())
        ? `${padre} — ${desc}` : (composeDesc([cap, sez, padre], desc) || desc)
      rows.push({
        codice,
        declaratoria: estesa || codice,
        desc_short: sintetica,
        um: clean(r[2]),
        prezzo,
        importo_netto: 0,
        ru: parsePct(r[4]),
        liv1: cap, liv2: sez, liv3: padre, liv4: '',
        materia: '', disciplina: cap, sistema: sez, attivita: '', settore: padre,
        keywords: '', tipologia: '',
        regione, anno: anno ?? '',
      })
    } else {
      // riga-titolo senza prezzo: aggiorna il contesto gerarchico
      if (isTopCapitolo(codice)) { cap = desc; sez = ''; padre = '' }
      else if (isCapitolo(codice)) { sez = desc; padre = '' }
      else if (desc) { padre = desc }   // es. "Edile IV livello:" → padre delle varianti
    }
  }

  return { rows, regione, anno }
}
