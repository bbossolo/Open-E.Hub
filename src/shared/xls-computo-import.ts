/**
 * Import di un COMPUTO esportato in Excel (griglia) in voci carrello, MANTENENDO
 * le categorie del computo (è il loro pregio). Parte pura/testabile: riceve una
 * griglia (array di righe; la lettura .xls la fa la UI con SheetJS) e ne ricava
 * `CartItem[]`.
 *
 * Riconosce le due strutture più comuni negli export dei software di computo
 * metrico (auto-rilevate dall'intestazione):
 *   • Formato A — niente colonna U.m.: l'unità è nella riga "SOMMANO <um>";
 *     Quantità in col5, prezzo unitario in col6.
 *   • Formato B — colonna "U.m." dedicata: tutto spostato di 1 (U.m. col5,
 *     Quantità col6, prezzo col7); l'um sta sulla riga della voce.
 * In entrambi: col1 = Nr, col2 = Tariffa (codice), col3 = DESIGNAZIONE (categorie
 * indentate, declaratoria, righe "NNN - Nome" del percorso, "MISURAZIONI:", "SOMMANO").
 * Una VOCE inizia dove Nr è un numero e Tariffa è valorizzata; chiude su "SOMMANO".
 * Le colonne reali si leggono dall'intestazione → robusto alle due strutture.
 */
import type { CartItem } from './compositore'

const cell = (row: unknown[], i: number): string => (i < 0 ? '' : String(row?.[i] ?? '').trim())

/** Indici colonna del computo + convenzione decimale, rilevati dal file. */
export interface ComputoXlsLayout { nr: number; cod: number; desc: number; um: number; qty: number; prezzo: number; format: 'A' | 'B'; decimal: ',' | '.' }

/** Rileva colonne (dall'intestazione) e convenzione decimale (dai dati). */
export function detectComputoXlsLayout(grid: unknown[][]): ComputoXlsLayout {
  const reCod = /tariff/i, reDesc = /designaz/i, reQty = /quantit/i, reUm = /^u\.?\s?m\.?$|unit[àa]?\s*di\s*mis/i, reNr = /^nr\.?$/i
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const row = (grid[i] || []).map(c => String(c ?? '').trim())
    const find = (re: RegExp) => row.findIndex(c => re.test(c))
    const cod = find(reCod), desc = find(reDesc)
    if (cod >= 0 && desc >= 0) {
      const qty = find(reQty), um = find(reUm), nr = find(reNr)
      const q = qty >= 0 ? qty : 5
      const prezzo = q + 1
      return { nr: nr >= 0 ? nr : Math.max(0, cod - 1), cod, desc, um, qty: q, prezzo, format: um >= 0 ? 'B' : 'A', decimal: detectDecimal(grid, q, prezzo) }
    }
  }
  // fallback: Formato A classico (10 colonne)
  return { nr: 1, cod: 2, desc: 3, um: -1, qty: 5, prezzo: 6, format: 'A', decimal: detectDecimal(grid, 5, 6) }
}

/**
 * Numero da computo → number (0 se vuoto). La convenzione decimale è CONNESSA al
 * tipo di computo (rilevata dai dati, vedi `detectDecimal`), passata come `sep`:
 *  • sep=',' (italiano): "1.234,56"=1234.56 · "1.500"=1500 (punto = migliaia).
 *  • sep='.' (export Misurazioni μ / Excel): "1357.94"=1357.94 · "1,234.56"=1234.56.
 * Senza `sep` usa un'euristica auto (per uso diretto/test): virgola → italiano;
 * altrimenti punto = migliaia solo se separa gruppi da 3 cifre. */
export function parseNum(s: unknown, sep?: ',' | '.'): number {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0
  let t = String(s ?? '').replace(/[^\d,.\-]/g, '')
  if (!t) return 0
  if (sep === '.') {
    t = t.replace(/,/g, '')                                // dot-decimal: virgola = migliaia
  } else if (sep === ',') {
    t = t.replace(/\./g, '').replace(',', '.')             // italiano
  } else if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')             // auto: ha virgola → italiano
  } else {
    const dots = (t.match(/\./g) || []).length             // auto: nessuna virgola
    if (dots >= 2) t = t.replace(/\./g, '')
    else if (dots === 1 && (t.split('.')[1] || '').length === 3) t = t.replace('.', '')
  }
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** Convenzione decimale del computo, dedotta dai valori delle colonne numeriche. */
function detectDecimal(grid: unknown[][], qtyCol: number, prezzoCol: number): ',' | '.' {
  let comma = 0, dot = 0
  for (const row of grid) {
    for (const c of [qtyCol, prezzoCol]) {
      const v = String(row?.[c] ?? '').trim()
      if (!/\d/.test(v)) continue
      if (v.includes(',')) comma++
      else if (/\.\d{1,2}(\D|$)/.test(v) && !/\.\d{3}(\D|$)/.test(v)) dot++ // punto seguito da 1-2 decimali (non migliaia)
    }
  }
  return dot > comma ? '.' : ','   // default italiano in caso di parità/assenza
}

/** Unità di misura da una riga "SOMMANO <um>" (toglie un eventuale fattore iniziale). */
export function sommaUm(desig: string): string {
  const m = desig.match(/SOMMANO\s+(.+)$/i)
  if (!m) return ''
  return m[1].trim().replace(/^\d+([.,]\d+)?\s+/, '').trim() // "1 m" → "m", "a corpo" → "a corpo"
}

const RE_SOMMANO = /^\s*SOMMANO\b/i
const RE_PATH = /^\d{2,3}\s*-\s*(.+)$/            // "003 - Esterni - Opere Edili"
const RE_SKIP = /^(LAVORI A MISURA|LAVORI IN ECONOMIA|M\s*I\s*S\s*U\s*R\s*A\s*Z\s*I\s*O\s*N\s*I|Lavori a MISURA|Lavori in ECONOMIA|RIPORTO|A RIPORTARE)/i
const isNr = (s: string) => /^\d+$/.test(s.trim())

/** Categorie da NON usare come sezione (radici generiche del computo). */
const ROOT_CAT = /^(lavori a misura|lavori in economia|opere edili)$/i

/**
 * Converte la griglia del computo Excel in voci carrello. `categoria` = percorso
 * di categoria del computo (dalle righe "NNN - Nome"), mantenuto fedele.
 */
const rawCell = (row: unknown[], i: number): string => String(row?.[i] ?? '')
const indentOf = (s: string): number => (s.match(/^\s*/)?.[0].length ?? 0)

export function parseComputoXls(grid: unknown[][]): CartItem[] {
  const L = detectComputoXlsLayout(grid)
  const items: CartItem[] = []
  const catStack: Array<{ indent: number; title: string }> = [] // categorie da intestazioni indentate (fallback)
  const stackPath = () => catStack.map(s => s.title).filter(t => !ROOT_CAT.test(t)).join(' · ')
  let i = 0
  while (i < grid.length) {
    const row = grid[i]
    const nr = cell(row, L.nr)
    const cod = cell(row, L.cod)
    // Intestazione di categoria indentata (fuori da una voce): aggiorna lo stack.
    if (!isNr(nr) && !cod) {
      const raw = rawCell(row, L.desc)
      const d = raw.trim()
      if (d && !RE_SOMMANO.test(d) && !RE_SKIP.test(d) && !RE_PATH.test(d)) {
        const ind = indentOf(raw)
        while (catStack.length && catStack[catStack.length - 1].indent >= ind) catStack.pop()
        catStack.push({ indent: ind, title: d })
      }
    }
    if (isNr(nr) && cod) {
      // Inizio voce
      const codice = cod
      const desc_short = cell(row, L.desc).replace(/\s+/g, ' ').trim()
      const umVoce = cell(row, L.um) // Formato B: l'um è sulla riga della voce
      let declaratoria = ''
      const pathParts: string[] = []
      let um = '', qty = 0, prezzo = 0
      i++
      while (i < grid.length) {
        const r = grid[i]
        const d = cell(r, L.desc)
        if (RE_SOMMANO.test(d)) { um = umVoce || sommaUm(d); qty = parseNum(cell(r, L.qty), L.decimal); prezzo = parseNum(cell(r, L.prezzo), L.decimal); i++; break }
        if (isNr(cell(r, L.nr)) && cell(r, L.cod)) break // voce successiva senza SOMMANO (difensivo)
        const mp = d.match(RE_PATH)
        if (mp) { const p = mp[1].trim(); if (!ROOT_CAT.test(p)) pathParts.push(p) }
        else if (d && !RE_SKIP.test(d) && d.length > declaratoria.length) declaratoria = d.replace(/\s+/g, ' ').trim()
        i++
      }
      if (!um && umVoce) um = umVoce
      // categoria: dal percorso "NNN - Nome" (più specifico) o, in assenza, dalle
      // intestazioni indentate correnti (fallback).
      // Se assente del tutto, resta '' e i documenti la deducono da classifyChapter.
      const categoria = ([...new Set(pathParts)].join(' · ')) || stackPath()
      items.push({ codice, desc_short, declaratoria, um, qty, prezzo, categoria, source: 'xls' })
    } else i++
  }
  return items
}
