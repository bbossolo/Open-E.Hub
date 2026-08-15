/**
 * δ Pages — riconoscimento delle colonne standard dell'elenco elaborati (puro, no DOM).
 *
 * L'elenco elaborati italiano (AEC) usa quasi sempre le stesse 14 intestazioni,
 * censite su file reali di studio: CODICE
 * COMMESSA, FASE PROGETTO, Disciplina, TIPO DI ELABORATO, EDIFICIO/ZONA/AMBITO,
 * TIPO IMPIANTO, PROGRESSIVO, REVISIONE, CODICE ELABORATO, TITOLO CARTIGLIO,
 * SCALA, DATA, FORMATO, STATO. Questo modulo permette di:
 *  - trovare la RIGA di intestazione vera in un foglio che ha righe di
 *    preambolo (Commessa/Cliente/Impianto) prima della tabella;
 *  - suggerire a quale colonna dell'elenco corrisponde un campo variabile
 *    dell'editor, per etichetta (niente OCR: solo testo su testo).
 */

/** Chiave standard → sinonimi noti (testo normalizzato: minuscole, senza accenti/punteggiatura). */
export const STANDARD_ELENCO_COLUMNS: Record<string, string[]> = {
  CODICE_COMMESSA: ['codice commessa', 'commessa n', 'commessa', 'n commessa'],
  FASE_PROGETTO: ['fase progetto', 'fase'],
  DISCIPLINA: ['disciplina'],
  TIPO_ELABORATO: ['tipo di elaborato', 'tipo elaborato'],
  ZONA: ['edificio zona o ambito', 'edificio zona ambito', 'zona o ambito', 'ambito', 'edificio'],
  TIPO_IMPIANTO: ['tipo impianto'],
  PROGRESSIVO: ['progressivo'],
  REVISIONE: ['revisione', 'rev'],
  CODICE_ELABORATO: ['codice elaborato', 'tavola n', 'protocollo tavola', 'codice tavola', 'tavola'],
  TITOLO_CARTIGLIO: ['titolo cartiglio', 'titolo tavola', 'titolo elaborato', 'titolo'],
  SCALA: ['scala'],
  DATA: ['data di emissione', 'data emissione', 'data'],
  FORMATO: ['formato'],
  STATO: ['stato del progetto', 'stato progetto', 'stato'],
}

/** Minuscole, senza accenti/punteggiatura, spazi collassati — per confrontare testo con testo. */
export function normalizeHeaderText(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** N. di celle di `row` che combaciano (match esatto di sinonimo) con una qualunque chiave
 *  standard, oppure — se presente — con un alias del dizionario per-studio (`extraSynonyms`:
 *  testo normalizzato → chiave standard, es. "cms" → "CODICE_COMMESSA"). Il dizionario per-studio
 *  ha priorità: è una correzione esplicita dello studio su una sigla che il dizionario fisso
 *  non conosce. */
function countKnownHeaders(row: unknown[], extraSynonyms?: Record<string, string>): number {
  let n = 0
  for (const cell of row) {
    const norm = normalizeHeaderText(cell)
    if (!norm) continue
    if (extraSynonyms && extraSynonyms[norm]) { n++; continue }
    for (const syns of Object.values(STANDARD_ELENCO_COLUMNS)) {
      if (syns.includes(norm)) { n++; break }
    }
  }
  return n
}

/**
 * Indice della riga di intestazione vera in `grid` (scandisce le prime 15 righe).
 * Ritorna la riga con più celle riconosciute come colonna standard (soglia
 * minima 3 celle). Se nessuna riga raggiunge la soglia, ritorna 0 (fallback:
 * comportamento storico, riga 0 = intestazione — retrocompatibile con gli
 * elenchi "puliti" già in uso, dove la riga 0 è già l'intestazione vera).
 * `extraSynonyms` (opzionale) = dizionario per-studio, vedi `countKnownHeaders`.
 */
export function detectHeaderRow(grid: unknown[][], extraSynonyms?: Record<string, string>): number {
  const limit = Math.min(grid.length, 15)
  let best = 0, bestScore = 0
  for (let i = 0; i < limit; i++) {
    const row = grid[i]
    if (!Array.isArray(row) || !row.length) continue
    const score = countKnownHeaders(row, extraSynonyms)
    if (score > bestScore) { bestScore = score; best = i }
  }
  return bestScore >= 3 ? best : 0
}

/** Punteggio di confidenza [0..1] per UNA riga specifica (non l'intero `grid`) — usato
 *  per ricalcolare la confidenza quando l'utente sceglie a mano una riga di intestazione
 *  diversa da quella auto-rilevata, nel pannello di verifica import. */
export function scoreHeaderRow(row: unknown[], extraSynonyms?: Record<string, string>): number {
  if (!Array.isArray(row) || !row.length) return 0
  return Math.min(1, countKnownHeaders(row, extraSynonyms) / 6)
}

/** Punteggio di confidenza [0..1] che `grid` sia davvero un elenco elaborati tabellare. */
export function elencoConfidence(grid: unknown[][], extraSynonyms?: Record<string, string>): number {
  const headerRow = detectHeaderRow(grid, extraSynonyms)
  return scoreHeaderRow(grid[headerRow], extraSynonyms)
}

/** Il miglior header REALE (tra quelli presenti) per una chiave standard, o null.
 *  `extraSynonyms` (opzionale, dizionario per-studio) ha priorità sul dizionario fisso. */
export function matchColumn(headers: string[], key: string, extraSynonyms?: Record<string, string>): string | null {
  const normed = headers.map(h => ({ h, norm: normalizeHeaderText(h) }))
  if (extraSynonyms) {
    const hit = normed.find(x => x.norm && extraSynonyms[x.norm] === key)
    if (hit) return hit.h
  }
  const syns = STANDARD_ELENCO_COLUMNS[key]
  if (!syns) return null
  // 1) match esatto di sinonimo
  for (const syn of syns) {
    const hit = normed.find(x => x.norm === syn)
    if (hit) return hit.h
  }
  // 2) contenimento (l'header contiene il sinonimo o viceversa) — solo su sinonimi
  //    di almeno 4 caratteri, altrimenti "rev"/"data" darebbero troppi falsi positivi.
  let best: { h: string; len: number } | null = null
  for (const syn of syns) {
    if (syn.length < 4) continue
    for (const x of normed) {
      if (x.norm && (x.norm.includes(syn) || syn.includes(x.norm))) {
        const len = Math.min(x.norm.length, syn.length)
        if (!best || len > best.len) best = { h: x.h, len }
      }
    }
  }
  return best ? best.h : null
}

/** Trasposizione pura di una griglia (righe↔colonne) — usata per riconoscere elenchi
 *  "trasposti" (etichette in prima colonna, un elaborato per colonna) riusando TUTTA
 *  la logica di rilevamento/parsing pensata per il layout a righe: si traspone la
 *  griglia in ingresso e si tratta come se fosse già orientata per righe. */
export function transposeGrid(grid: unknown[][]): unknown[][] {
  if (!Array.isArray(grid) || !grid.length) return []
  let cols = 0
  for (const r of grid) if (Array.isArray(r)) cols = Math.max(cols, r.length)
  const out: unknown[][] = []
  for (let c = 0; c < cols; c++) {
    out.push(grid.map((r) => (Array.isArray(r) ? (r[c] ?? '') : '')))
  }
  return out
}

export type TableOrientation = 'rows' | 'columns'
export interface OrientationGuess {
  orientation: TableOrientation
  /** Indice della riga (orientation='rows') o colonna (orientation='columns', già trasposta) di intestazione. */
  headerIndex: number
  confidence: number
}

/**
 * Rileva se `grid` ha le etichette dei campi sulla RIGA (layout standard, un
 * elaborato per riga) o sulla COLONNA (layout "trasposto", un elaborato per
 * colonna) — nessun tool della suite lo faceva finora, si assumeva sempre riga.
 * Calcola la confidenza in entrambi i sensi (il secondo sulla griglia trasposta,
 * riusando `detectHeaderRow`/`elencoConfidence`) e sceglie il migliore; in caso
 * di parità vince 'rows' (comportamento storico, retrocompatibile).
 */
export function detectOrientation(grid: unknown[][], extraSynonyms?: Record<string, string>): OrientationGuess {
  const rowsGuess: OrientationGuess = { orientation: 'rows', headerIndex: detectHeaderRow(grid, extraSynonyms), confidence: elencoConfidence(grid, extraSynonyms) }
  const transposed = transposeGrid(grid)
  const colsGuess: OrientationGuess = { orientation: 'columns', headerIndex: detectHeaderRow(transposed, extraSynonyms), confidence: elencoConfidence(transposed, extraSynonyms) }
  return colsGuess.confidence > rowsGuess.confidence ? colsGuess : rowsGuess
}

/**
 * Suggerisce la colonna dell'elenco più adatta per un campo, a partire dalla
 * sua ETICHETTA (es. "Commessa n°" → colonna "CODICE COMMESSA" se presente).
 * Prova prima le chiavi standard (sinonimi noti), poi un confronto diretto
 * testo-su-testo con gli header disponibili. Nessun OCR: solo testo.
 */
export function suggestFieldColumn(fieldLabel: string, headers: string[], extraSynonyms?: Record<string, string>): string | null {
  const normLabel = normalizeHeaderText(fieldLabel)
  if (!normLabel) return null
  // 1) la label combacia ESATTAMENTE con un sinonimo noto → chiave certa.
  //    Va provato PER PRIMO e a parte dal contenimento: "titolo tavola" contiene
  //    "tavola" (sinonimo corto di CODICE_ELABORATO) e andrebbe a un'altra
  //    chiave se si permettesse il contenimento nello stesso passaggio.
  for (const key of Object.keys(STANDARD_ELENCO_COLUMNS)) {
    if (STANDARD_ELENCO_COLUMNS[key].includes(normLabel)) {
      const col = matchColumn(headers, key, extraSynonyms)
      if (col) return col
    }
  }
  // 2) contenimento, solo su sinonimi lunghi (≥6) per evitare che una parola
  //    corta e generica ("tavola", "rev") catturi etichette di un'altra chiave.
  for (const key of Object.keys(STANDARD_ELENCO_COLUMNS)) {
    const hit = STANDARD_ELENCO_COLUMNS[key].some(s => s.length >= 6 && (normLabel.includes(s) || s.includes(normLabel)))
    if (hit) {
      const col = matchColumn(headers, key, extraSynonyms)
      if (col) return col
    }
  }
  // 2) confronto diretto label↔header (label libera non riconosciuta come chiave nota)
  let best: { h: string; len: number } | null = null
  for (const h of headers) {
    const norm = normalizeHeaderText(h)
    if (!norm) continue
    if (norm === normLabel) return h
    if (norm.length >= 4 && normLabel.length >= 4 && (norm.includes(normLabel) || normLabel.includes(norm))) {
      const len = Math.min(norm.length, normLabel.length)
      if (!best || len > best.len) best = { h, len }
    }
  }
  return best ? best.h : null
}

/**
 * Etichette dei campi variabili "tipici" del cartiglio standard, pronte da
 * creare in un colpo solo (pulsante "Aggiungi campi standard"). La colonna
 * viene assegnata a runtime con `suggestFieldColumn` sugli header REALI
 * dell'elenco importato — non hardcoded qui, perché il nome delle colonne
 * cambia da un elenco all'altro anche quando il significato è lo stesso.
 * "Committente" e "Oggetto" restano volutamente senza colonna corrispondente:
 * nel formato censito sono metadati di progetto (righe di preambolo del
 * foglio, es. "Cliente"), non colonne per-riga della tabella elaborati —
 * `suggestFieldColumn` li lascia non mappati, ed è corretto così.
 */
export const STANDARD_FIELD_SET: string[] = [
  'Committente',
  'Oggetto',
  'Titolo Tavola',
  'Commessa n°',
  'Protocollo Tavola',
  'Data di Emissione',
  'Scala',
  'Tavola N°',
  'Revisione',
  'Stato del Progetto',
]

/**
 * Specifica di una CELLA del cartiglio riconosciuta da un'etichetta stampata sul
 * template. `expr` (token, vedi expr.ts) è la sorgente-valore; se assente il
 * campo nasce FISSO e vuoto (l'utente lo scrive a mano). `below` = il valore va
 * SOTTO l'etichetta (cella a blocco), altrimenti a DESTRA (cella in linea).
 */
export interface CartiglioCell {
  /** Etichetta leggibile del campo δ generato. */
  label: string
  /** Sinonimi normalizzati dell'etichetta stampata (match esatto o prefisso). */
  syns: string[]
  /** Espressione-valore con token; assente = campo fisso vuoto. */
  expr?: string
  /** Valore sotto l'etichetta (true) o a destra (false, default). */
  below?: boolean
}

/**
 * Dizionario delle celle standard del cartiglio elaborati (censite sul cartiglio
 * reale osservato). Le espressioni derivano dai NOMI-COLONNA reali dell'elenco;
 * se una colonna manca il token resta vuoto (nessun crash, campo comunque creato).
 * Committente/Oggetto vengono dai metadati progetto (foglio PAGINA INIZIALE) via
 * `{@…}`. Disegnato/Controllato sono campi fissi (sigle persona, non nell'elenco).
 */
export const CARTIGLIO_LABELS: CartiglioCell[] = [
  { label: 'Committente', syns: ['committente', 'cliente', 'stazione appaltante', 'committenza', 'proponente'], expr: '{@Committente}', below: true },
  { label: 'Oggetto', syns: ['oggetto', 'oggetto dei lavori', 'oggetto intervento'], expr: '{@Oggetto}', below: true },
  { label: 'Ubicazione', syns: ['ubicazione', 'localizzazione intervento', 'localizzazione', 'indirizzo intervento', 'luogo'], expr: '{@Ubicazione}', below: true },
  { label: 'Commessa n°', syns: ['commessa n', 'commessa', 'codice commessa'], expr: '{CODICE COMMESSA}' },
  { label: 'Protocollo Tavola', syns: ['protocollo tavola'], expr: '{FASE PROGETTO|upper}-{Disciplina|upper}-{TIPO DI ELABORATO|upper}' },
  { label: 'Data di Emissione', syns: ['data di emissione', 'data emissione'], expr: '{DATA|meseanno}' },
  { label: 'Scala', syns: ['scala'], expr: '{SCALA}' },
  { label: 'Titolo Tavola', syns: ['titolo tavola', 'titolo cartiglio', 'titolo elaborato', 'titolo', 'denominazione tavola', 'contenuto tavola'], expr: '{TITOLO CARTIGLIO}', below: true },
  { label: 'Tavola N°', syns: ['tavola n', 'tavola nr', 'tav', 'n tavola', 'n tav', 'elaborato n', 'n elaborato', 'foglio n', 'n foglio'], expr: '{CODICE ELABORATO|tail}' },
  { label: 'Revisione', syns: ['agg', 'revisione'] },
  { label: 'Stato del Progetto', syns: ['stato del progetto', 'stato progetto'], expr: '{FASE PROGETTO|stato}', below: true },
  { label: 'Disegnato', syns: ['disegnato', 'disegnatore', 'redatto', 'redattore'] },
  { label: 'Controllato', syns: ['controllato', 'verificato', 'controllo'] },
  { label: 'Approvato', syns: ['approvato', 'approvazione'] },
]

/** La cella del cartiglio che corrisponde a un'etichetta stampata (o null). */
export function matchCartiglioLabel(labelText: string): CartiglioCell | null {
  const n = normalizeHeaderText(labelText)
  if (!n) return null
  for (const cell of CARTIGLIO_LABELS) {
    for (const s of cell.syns) {
      if (n === s || n.startsWith(s + ' ')) return cell
    }
  }
  return null
}
