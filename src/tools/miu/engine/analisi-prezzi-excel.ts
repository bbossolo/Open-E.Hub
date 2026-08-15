/**
 * Export EXCEL dell'ANALISI PREZZI di μ Prezzi — template proprio (solo
 * elaborato "Analisi Prezzi" da consegnare), nessun template esterno da
 * rispettare: la parte pura si limita a produrre la matrice di celle
 * (AOA — array of arrays), così resta testabile senza DOM/SheetJS. La
 * UI (index.html) la trasforma in foglio Excel vero con `XLSX.utils.aoa_to_sheet`
 * + `XLSX.writeFile`, dopo aver caricato la libreria on-demand (`loadXLSX`),
 * stesso pattern già usato per la LETTURA dei prezzari .xls/.xlsx.
 */
import { calcolaAnalisi, incidenzaManodopera, type AnalisiPrezzi, type AnalisiRiga } from '../../../shared/compositore/analisi-prezzi'

/** Una cella della matrice AOA: stringa o numero (SheetJS le distingue da sole). */
export type AoaCell = string | number
export type AoaRow = AoaCell[]

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const TIPO_LABEL: Record<AnalisiRiga['tipo'], string> = {
  manodopera: 'MANODOPERA',
  materiale: 'MATERIALI',
  nolo: 'NOLI',
  varie: 'VARIE',
}

// Lettere di sezione nello schema classico delle analisi da lavori pubblici
// (elenco/analisi nuovi prezzi): componenti elementari A..D, poi riepilogo.
const TIPO_LETTERA: Record<AnalisiRiga['tipo'], string> = {
  manodopera: 'A',
  materiale: 'B',
  nolo: 'C',
  varie: 'D',
}

const INTESTAZIONE_COLONNE: AoaRow = ['Codice', 'Descrizione', 'U.M.', 'Quantità', 'Prezzo unitario', 'Importo']

function sezioneAOA(tipo: AnalisiRiga['tipo'], righe: AnalisiRiga[], subtotale: number): AoaRow[] {
  const rr = righe.filter((r) => r.tipo === tipo)
  if (!rr.length) return []
  const rows: AoaRow[] = [
    [`${TIPO_LETTERA[tipo]} — ${TIPO_LABEL[tipo]}`],
    INTESTAZIONE_COLONNE,
  ]
  for (const r of rr) {
    rows.push([
      r.fonte?.codice ?? '',
      r.fonte ? `${r.descrizione} (${r.fonte.regione} ${r.fonte.anno})`.replace(/\(\s*\)/, '').trim() : r.descrizione,
      r.um,
      r.quantita,
      round2(r.prezzoUnitario),
      round2(r.quantita * r.prezzoUnitario),
    ])
  }
  rows.push(['', '', '', '', `Totale ${TIPO_LABEL[tipo].toLowerCase()} (${TIPO_LETTERA[tipo]})`, round2(subtotale)])
  rows.push([])
  return rows
}

/**
 * Matrice AOA (array of arrays) del documento Analisi Prezzi — pura, testabile.
 * Struttura TECNICA da lavori pubblici (verificata sui modelli reali di
 * elenco/analisi nuovi prezzi): componenti elementari per sezione (A manodopera,
 * B materiali, C noli, D varie) con colonne Codice/Descrizione/U.M./Quantità/
 * Prezzo unitario/Importo, poi il quadro economico: totale costi elementari →
 * Spese Generali % → Utile d'Impresa % → PREZZO DI APPLICAZIONE + incidenza
 * manodopera (richiesta nei nuovi prezzi).
 */
export function analisiPrezziAOA(a: AnalisiPrezzi): AoaRow[] {
  const t = calcolaAnalisi(a)
  const lettere = (['manodopera', 'materiale', 'nolo', 'varie'] as const)
    .filter((tipo) => a.righe.some((r) => r.tipo === tipo))
    .map((tipo) => TIPO_LETTERA[tipo])
  const somma = lettere.length ? lettere.join('+') : 'A+B+C+D'
  const incidenzaMO = incidenzaManodopera(t)
  const rows: AoaRow[] = [
    ['ANALISI PREZZI'],
    ['Articolo', a.codice],
    ['Descrizione', a.descrizioneBreve],
    ...(a.descrizioneEstesa && a.descrizioneEstesa !== a.descrizioneBreve ? [['Descrizione estesa', a.descrizioneEstesa] as AoaRow] : []),
    ['Unità di misura', a.um],
    [],
    ...sezioneAOA('manodopera', a.righe, t.totManodopera),
    ...sezioneAOA('materiale', a.righe, t.totMateriali),
    ...sezioneAOA('nolo', a.righe, t.totNoli),
    ...sezioneAOA('varie', a.righe, t.totVarie),
    ['QUADRO ECONOMICO'],
    ['', '', '', '', `Totale costi elementari (${somma})`, t.costoDiretto],
    ['', '', '', '', `Spese Generali (${a.speseGeneraliPct}%)`, t.speseGenerali],
    ['', '', '', '', 'Totale', t.subtotale],
    ['', '', '', '', `Utile d'Impresa (${a.utileImpresaPct}%)`, t.utileImpresa],
    ['', '', '', '', `PREZZO DI APPLICAZIONE (€/${a.um})`, t.prezzoUnitario],
    ['', '', '', '', 'Incidenza manodopera', `${String(incidenzaMO).replace('.', ',')}%`],
  ]
  if (a.note) rows.push([], ['Note', a.note])
  return rows
}

/** Nome file suggerito per l'export, es. "AP01-analisi-prezzi.xlsx". */
export function analisiPrezziFileName(a: AnalisiPrezzi): string {
  const slug = (a.codice || 'analisi').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${slug || 'analisi'}-analisi-prezzi.xlsx`
}

// ────────────────────────────────────────────────────────────────────────────
// FASCICOLO multi-analisi (mockup export-toolbar-miu, variante A): un unico
// .xlsx con il foglio «Indice» + un foglio per ogni Analisi Prezzi del
// carrello. Qui la parte PURA (indice, nomi foglio, nome file); il workbook
// vero lo assembla la UI con SheetJS, come per la singola analisi.
// ────────────────────────────────────────────────────────────────────────────

/** Foglio «Indice» del fascicolo: elenco delle analisi con U.M. e prezzo unitario. */
export function fascicoloIndiceAOA(analisi: AnalisiPrezzi[]): AoaRow[] {
  const rows: AoaRow[] = [
    ['FASCICOLO ANALISI PREZZI'],
    ['Analisi contenute', analisi.length],
    [],
    ['N.', 'Codice', 'Descrizione', 'U.M.', 'Prezzo unitario'],
  ]
  analisi.forEach((a, i) => {
    const t = calcolaAnalisi(a)
    rows.push([i + 1, a.codice || `AP${String(i + 1).padStart(2, '0')}`, a.descrizioneBreve, a.um, t.prezzoUnitario])
  })
  return rows
}

/**
 * Nome del foglio di una analisi nel fascicolo: unico e valido per Excel
 * (max 31 caratteri, senza []:*?/\), es. "01 · AP.001".
 */
export function fascicoloSheetName(a: AnalisiPrezzi, index: number): string {
  const base = (a.codice || a.descrizioneBreve || 'analisi').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim()
  return `${String(index + 1).padStart(2, '0')} · ${base}`.slice(0, 31)
}

/** Nome file del fascicolo, con data ISO per non sovrascrivere export precedenti. */
export function fascicoloFileName(date: Date = new Date()): string {
  return `fascicolo-analisi-prezzi-${date.toISOString().slice(0, 10)}.xlsx`
}

// ────────────────────────────────────────────────────────────────────────────
// PRESENTAZIONE del foglio (pura, testabile): larghezze colonna e celle unite
// calcolate dalla matrice. La UI le applica a SheetJS (ws['!cols']/['!merges']).
// ────────────────────────────────────────────────────────────────────────────

/** Larghezza massima del contenuto per colonna (in caratteri), clampata 10..64. */
export function aoaColWidths(aoa: AoaRow[]): number[] {
  const w: number[] = []
  for (const row of aoa) {
    // le righe-titolo a cella singola (ANALISI PREZZI, MANODOPERA…) verranno
    // UNITE su tutta la larghezza: non devono dettare la larghezza della col. A
    if (row.length === 1) continue
    row.forEach((c, i) => { w[i] = Math.max(w[i] ?? 0, String(c ?? '').length) })
  }
  return w.map((n) => Math.max(10, Math.min(64, n + 2)))
}

/** Celle unite: ogni riga a cella singola non vuota si estende su tutta la tabella. */
export function aoaMerges(aoa: AoaRow[], width = 6): { s: { r: number; c: number }; e: { r: number; c: number } }[] {
  const out: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  aoa.forEach((row, r) => {
    if (row.length === 1 && String(row[0] ?? '').trim() !== '') out.push({ s: { r, c: 0 }, e: { r, c: width - 1 } })
  })
  return out
}
