/**
 * δ Pages — export DXF vettoriale dei cartigli (un file per elaborato). PURO.
 *
 * Riproduce SOLO il cartiglio dell'utente: cornice/linee come LWPOLYLINE (dai
 * vettori del PDF), etichette e valori compilati come TEXT editabile. NESSUN
 * marchio/brand Open E.Hub, nessun contorno-glifo — il cartiglio è una cosa a sé.
 * Il vettoriale del cartiglio (`PageVectors`) è identico su ogni riga: si converte
 * una volta e si clona aggiungendo per riga solo i TEXT dei valori.
 */
import { DxfBuilder, dxfBegin, dxfEnd, polyline, dtext, type DxfLayer } from '../../../shared/dxf'
import type { PageVectors } from '../../../shared/dxf-from-pdf'
import { buildCoverDoc, fieldBoxWidthFrac, firstBaselineOffset, CAP_HEIGHT_FRAC, LINE_HEIGHT_FRAC } from './cover-model'
import { sanitizeFilename } from './pdf-export'
import type { DeltaState, ResolvedField } from './types'

const PT2MM = 25.4 / 72

const LAYERS: DxfLayer[] = [
  { name: 'CORNICE', color: 7 },   // linee/cornice del cartiglio
  { name: 'TESTO', color: 7 },     // etichette fisse + valori compilati
  { name: 'IMMAGINI', color: 8 },  // loghi (fase B2)
]
/** Nomi layer attesi (per i test). */
export const DELTA_DXF_LAYERS = LAYERS.map((l) => l.name)

/** Stima grezza della larghezza di `s` (per allineare center/right e il wrap) — mm. */
const estWidth = (s: string, hmm: number): number => s.length * hmm * 0.5

/** Spezza il testo in righe entro `maxWmm` (greedy, ai confini di parola). */
function wrap(s: string, hmm: number, maxWmm: number): string[] {
  const words = s.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let cur = words[0]
  for (let i = 1; i < words.length; i++) {
    if (estWidth(`${cur} ${words[i]}`, hmm) <= maxWmm) cur = `${cur} ${words[i]}`
    else { lines.push(cur); cur = words[i] }
  }
  lines.push(cur)
  return lines
}

/** Emette un campo risolto come TEXT DXF (una o più righe), in mm y-su. */
function drawFieldText(b: DxfBuilder, rf: ResolvedField, wmm: number, hmm: number): void {
  if (!rf.text || !rf.text.trim()) return
  // In DXF l'altezza del testo È l'altezza delle MAIUSCOLE: `size` (il corpo del
  // campo) va convertito, altrimenti il testo esce più grande che nel PDF.
  let size = Math.max(0.5, rf.fontFrac * hmm)
  const xL = rf.x * wmm
  const anchorY = hmm * (1 - rf.y) // punto d'ancoraggio, y-su
  const h = rf.anchor[1]           // l | c | r
  // Come nel PDF e nell'editor, ogni campo è una casella che manda a capo: se la
  // larghezza non è dichiarata è lo spazio fino al bordo pagina (fieldBoxWidthFrac).
  const maxWmm = fieldBoxWidthFrac(rf.anchor, rf.x, rf.maxWidthFrac) * wmm
  let lines = maxWmm > 0 ? wrap(rf.text, size, maxWmm) : [rf.text]
  // Fit-in-box verticale, come layoutField nel PDF: corpo ridotto finché il
  // blocco sta nell'altezza dichiarata (iterato: meno corpo ⇒ meno righe).
  const maxHmm = (rf.maxHeightFrac ?? 0) * hmm
  for (let i = 0; maxHmm > 0 && maxWmm > 0 && size > 0.5 && lines.length * size * LINE_HEIGHT_FRAC > maxHmm && i < 6; i++) {
    size = Math.max(0.5, size * (maxHmm / (lines.length * size * LINE_HEIGHT_FRAC)))
    lines = wrap(rf.text, size, maxWmm)
  }
  const th = Math.max(0.5, CAP_HEIGHT_FRAC * size)
  const lineH = size * LINE_HEIGHT_FRAC
  // baseline della PRIMA riga secondo l'ancora verticale del blocco (stessa
  // convenzione — sulle maiuscole — di editor, PDF e HTML di stampa)
  const topBaseline = anchorY - firstBaselineOffset(rf.anchor, size, lines.length)
  lines.forEach((ln, i) => {
    const w = estWidth(ln, size)
    const x = h === 'l' ? xL : h === 'r' ? xL - w : xL - w / 2
    dtext(b, 'TESTO', x, topBaseline - i * lineH, th, ln)
  })
}

/** Costruisce il DXF di UNA copertina: vettori del cartiglio + valori del campo risolti. */
export function buildCoverDxf(base: PageVectors, fields: ResolvedField[]): string {
  const wmm = base.widthPt * PT2MM
  const hmm = base.heightPt * PT2MM
  const b = new DxfBuilder(0) // coordinate già y-su (punti PDF) → nessun flip
  dxfBegin(b, { extMax: [+wmm.toFixed(3), +hmm.toFixed(3)], layers: LAYERS })
  // Cornice/linee del cartiglio
  for (const p of base.paths) {
    if (p.pts.length < 2) continue
    polyline(b, 'CORNICE', p.pts.map(([x, y]) => [x * PT2MM, y * PT2MM] as [number, number]), p.closed)
  }
  // Etichette fisse del cartiglio (dal testo del PDF)
  for (const t of base.texts) dtext(b, 'TESTO', t.x * PT2MM, t.y * PT2MM, Math.max(0.5, t.h * PT2MM), t.str)
  // Valori compilati (campi δ)
  for (const rf of fields) drawFieldText(b, rf, wmm, hmm)
  return dxfEnd(b)
}

export interface GeneratedDxf { name: string; dxf: string }

/** Un DXF per riga dell'elenco (o uno solo senza elenco). Nomi come l'export PDF. */
export function buildAllCoverDxf(state: DeltaState, base: PageVectors, filenameColumn?: string | null): GeneratedDxf[] {
  const doc = buildCoverDoc(state)
  const rows = state.elenco ? state.elenco.rows : []
  const out: GeneratedDxf[] = []
  const used = new Map<string, number>()
  for (let i = 0; i < doc.pages.length; i++) {
    const dxf = buildCoverDxf(base, doc.pages[i].fields)
    const raw = filenameColumn && rows[i] ? rows[i][filenameColumn] : ''
    let name = raw && raw.trim() ? sanitizeFilename(raw) : `Cartiglio-${i + 1}`
    const seen = used.get(name) ?? 0
    used.set(name, seen + 1)
    if (seen > 0) name = `${name}-${seen + 1}`
    out.push({ name: `${name}.dxf`, dxf })
  }
  return out
}
