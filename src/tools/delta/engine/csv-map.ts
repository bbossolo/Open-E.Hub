/**
 * δ Pages — parsing dell'elenco elaborati da una griglia (puro, no DOM).
 * Ingresso: la matrice di celle prodotta da XLSX.utils.sheet_to_json({header:1}).
 * Uscita: headers deduplicati + righe come oggetti {colonna: valore}. Gestisce
 * header vuoti/duplicati e celle mancanti. L'elenco elaborati reale spesso ha
 * righe di preambolo (Commessa/Cliente/Impianto) prima dell'intestazione vera:
 * il chiamante individua quella riga con `detectHeaderRow` (columns.ts) e la
 * passa qui come `headerRowIndex` — default 0 per compatibilità con gli
 * elenchi "puliti" dove la riga 0 è già l'intestazione.
 */
import type { Elenco } from './types'
import { detectHeaderRow, normalizeHeaderText } from './columns'

/** Dedup + riempi header vuoti: 'Colonna 2', 'Titolo', 'Titolo (2)'… */
export function normalizeHeaders(rawRow: unknown[]): string[] {
  const seen = new Map<string, number>()
  return rawRow.map((h, i) => {
    let name = String(h ?? '').trim() || `Colonna ${i + 1}`
    const key = name.toLowerCase()
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    if (n > 0) name = `${name} (${n + 1})`
    return name
  })
}

/** Vero se il nome è un fallback generato da `normalizeHeaders` (nessuna intestazione reale in quella colonna). */
const isFallbackHeader = (h: string): boolean => /^Colonna \d+$/.test(h)

/**
 * Rimuove le colonne-fallback ("Colonna N", mai una vera intestazione)
 * completamente vuote su TUTTE le righe — capita spesso su fogli Excel dove
 * il "range usato" si estende oltre l'ultima colonna reale (celle vuote
 * formattate, bordi trascinati…): senza questo filtro, l'elenco elaborati
 * reale (A123) porta 25 colonne fantasma in più nella mappatura e nell'anteprima.
 * Le colonne con un nome VERO restano sempre, anche se vuote in questo file.
 */
function dropEmptyFallbackColumns(headers: string[], rows: Record<string, string>[]): string[] {
  return headers.filter((h) => !isFallbackHeader(h) || rows.some((r) => r[h] !== ''))
}

/** Costruisce l'Elenco da una griglia grezza (righe di celle), a partire dalla
 *  riga `headerRowIndex` (default 0 = comportamento storico). Le righe prima
 *  di `headerRowIndex` (preambolo) sono ignorate, non trattate come dati. */
export function parseElenco(grid: unknown[][], fileName = 'elenco', headerRowIndex = 0): Elenco {
  const rowsIn = Array.isArray(grid) ? grid.filter((r) => Array.isArray(r)) : []
  const start = Math.max(0, Math.min(headerRowIndex, Math.max(0, rowsIn.length - 1)))
  if (!rowsIn.length || start >= rowsIn.length) return { headers: [], rows: [], fileName }
  const headersRaw = normalizeHeaders(rowsIn[start])
  const rows: Record<string, string>[] = []
  for (let i = start + 1; i < rowsIn.length; i++) {
    const cells = rowsIn[i]
    // salta le righe interamente vuote (celle tutte vuote/spazi)
    if (!cells.some((c) => String(c ?? '').trim() !== '')) continue
    const obj: Record<string, string> = {}
    headersRaw.forEach((h, j) => { obj[h] = String(cells[j] ?? '').trim() })
    rows.push(obj)
  }
  const headers = dropEmptyFallbackColumns(headersRaw, rows)
  if (headers.length !== headersRaw.length) {
    for (const r of rows) for (const h of headersRaw) if (!headers.includes(h)) delete r[h]
  }
  return { headers, rows, fileName }
}

/**
 * Unisce più fogli-dati (es. E.E. ELETTRICO + E.E. MECCANICO + E.E. ANTINCENDIO
 * della stessa commessa) in un solo Elenco: per ciascuno rileva la propria riga
 * di intestazione (`detectHeaderRow`), unisce gli header in un unico insieme e
 * aggiunge una colonna "Foglio" con la provenienza di ogni riga.
 */
/**
 * Metadati di progetto dal foglio "PAGINA INIZIALE"/frontespizio (layout libero,
 * non tabellare): Committente, Oggetto, Commessa, Data. Best-effort — coppie
 * etichetta/valore adiacenti (a destra o nella riga sotto) + euristiche sul testo
 * libero (Committente = riga con S.p.A./S.r.l., Oggetto = riga «PROGETTO…»). I
 * valori sono editabili dall'utente: qui si cerca solo un buon default. Mai
 * inventa nulla: chiavi assenti restano fuori dalla mappa.
 */
export function parseProjectMeta(grid: unknown[][]): Record<string, string> {
  const cell = (i: number, j: number): string => String((grid[i] && grid[i][j]) ?? '').trim()
  const rows = Array.isArray(grid) ? grid : []
  const meta: Record<string, string> = {}
  const LABELS: Record<string, string[]> = {
    Committente: ['committente', 'cliente', 'stazione appaltante'],
    Commessa: ['commessa', 'codice commessa', 'commessa n', 'n commessa'],
    Data: ['data', 'data di emissione', 'data emissione'],
    Oggetto: ['oggetto'],
  }
  // 1) coppie etichetta → valore (a destra, poi sotto)
  for (let i = 0; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : []
    for (let j = 0; j < row.length; j++) {
      const norm = normalizeHeaderText(cell(i, j))
      if (!norm) continue
      for (const [key, syns] of Object.entries(LABELS)) {
        if (meta[key] || !syns.includes(norm)) continue
        const right = cell(i, j + 1)
        const below = cell(i + 1, j)
        const v = right || below
        if (v) meta[key] = v
      }
    }
  }
  // 2) euristiche sul testo libero, solo se non già trovato
  const flat = rows.flatMap((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : [])).filter(Boolean)
  if (!meta.Committente) { const hit = flat.find((t) => /\bS\.?\s?[pr]\.?\s?[al]\.?\b/i.test(t)); if (hit) meta.Committente = hit }
  if (!meta.Oggetto) { const hit = flat.find((t) => /^(progetto|intervent|ampliament|lavori)/i.test(t)); if (hit) meta.Oggetto = hit }
  return meta
}

/**
 * Unisce Elenchi GIÀ RISOLTI (uno per foglio, ognuno già parsato con la propria
 * riga/colonna di intestazione — anche da un layout trasposto, indifferente qui:
 * `parseElenco` normalizza sempre allo stesso `Elenco`) in un unico Elenco, con
 * una colonna "Foglio" per la provenienza di ogni riga. Pura: nessun rilevamento,
 * quello è già stato fatto a monte (auto o confermato dall'utente nella verifica).
 */
export function mergeElencos(entries: { name: string; elenco: Elenco }[], fileName = 'elenco'): Elenco {
  const headerSet: string[] = []
  for (const p of entries) for (const h of p.elenco.headers) if (!headerSet.includes(h)) headerSet.push(h)
  headerSet.push('Foglio')
  const rows: Record<string, string>[] = []
  for (const p of entries) {
    for (const r of p.elenco.rows) {
      const row: Record<string, string> = {}
      for (const h of headerSet) row[h] = h === 'Foglio' ? p.name : (r[h] ?? '')
      rows.push(row)
    }
  }
  return { headers: headerSet, rows, fileName, sheetName: entries.map((p) => p.name).join(', ') }
}

/** Scorciatoia storica: rileva riga di intestazione per ciascun foglio (comportamento
 *  automatico, no orientamento/verifica) e unisce con `mergeElencos`. Retrocompatibile
 *  coi chiamanti esistenti; il flusso con verifica utente costruisce gli `Elenco` a
 *  monte (con l'orientamento/riga confermati) e chiama `mergeElencos` direttamente. */
export function mergeSheets(sheets: { name: string; grid: unknown[][] }[], fileName = 'elenco'): Elenco {
  const entries = sheets.map((s) => ({ name: s.name, elenco: parseElenco(s.grid, fileName, detectHeaderRow(s.grid)) }))
  return mergeElencos(entries, fileName)
}
