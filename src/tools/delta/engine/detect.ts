/**
 * δ Pages — auto-rilevamento dei campi dalle ETICHETTE del cartiglio (puro, no DOM).
 *
 * Il template vuoto (PDF CAD) porta uno strato di testo con le etichette delle
 * celle («Committente», «scala:», «Tavola N°:»…) a coordinate note. Da queste
 * ricaviamo un CAMPO per ogni cella riconosciuta, già posizionato (a destra o
 * sotto l'etichetta) e con la sorgente-valore pre-assegnata (`expr`) — così tutte
 * le celle capite dal cartiglio diventano CAMPI, anche quelle senza colonna
 * nell'elenco (che nascono fisse/derivate). L'utente rifinisce col drag.
 */
import type { CoverField } from './types'
import { matchCartiglioLabel, CARTIGLIO_LABELS } from './columns'

/** Un'etichetta stampata sul template, in coordinate-frazione 0–1 (origine in alto a sinistra). */
export interface LabelItem {
  text: string
  x: number   // sinistra
  y: number   // alto (baseline superiore)
  w: number   // larghezza
  h: number   // altezza carattere
}

const uid = (): string => 'f' + Math.random().toString(36).slice(2, 9)
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * Crea i campi δ dalle etichette riconosciute. Ogni etichetta che matcha una
 * cella nota (`CARTIGLIO_LABELS`) produce UN campo:
 *  - `below`  → valore SOTTO l'etichetta (ancora 'tl', box a blocco: `maxWidthFrac`);
 *  - inline   → valore a DESTRA dell'etichetta (ancora 'ml').
 * La dimensione font segue l'altezza dell'etichetta. Nessuna cella riconosciuta
 * viene omessa; le celle senza `expr` nascono FISSE e vuote.
 */
export function detectFieldsFromLabels(labels: LabelItem[]): CoverField[] {
  const out: CoverField[] = []
  const seen = new Set<string>()
  for (const lab of labels) {
    const cell = matchCartiglioLabel(lab.text)
    if (!cell || seen.has(cell.label)) continue
    seen.add(cell.label)
    const fontFrac = Math.max(0.012, Math.min(0.05, lab.h || 0.02))
    const kind = cell.expr ? 'variable' : 'fixed'
    const gap = (lab.h || 0.02) * 0.4
    const base: CoverField = {
      id: uid(),
      kind,
      label: cell.label,
      x: 0, y: 0,
      anchor: 'ml',
      align: 'left',
      fontFrac,
      ...(kind === 'variable' ? { expr: cell.expr } : { value: '' }),
    }
    // Una cella «a blocco» vuole il valore SOTTO l'etichetta, ma se l'etichetta
    // è già in fondo alla pagina (tipico di «STATO DEL PROGETTO:» nella fascia
    // bassa del cartiglio) sotto non c'è più spazio: il valore finirebbe sul
    // bordo/piè di pagina. In quel caso si ripiega sul posizionamento in linea.
    const staSotto = cell.below && (lab.y + 2 * (lab.h || 0.02) + gap) <= 0.97
    if (staSotto) {
      base.anchor = 'tl'
      base.x = clamp01(lab.x)
      base.y = clamp01(lab.y + (lab.h || 0.02) + gap)
      // box a blocco: larghezza disponibile fino a poco prima del bordo destro pagina
      base.maxWidthFrac = clamp01(1 - lab.x - 0.02)
    } else {
      base.anchor = 'ml'
      base.x = clamp01(lab.x + lab.w + gap)
      base.y = clamp01(lab.y + (lab.h || 0.02) / 2)
    }
    out.push(base)
  }
  aggiungiTitoloTavola(out)
  return out
}

/**
 * Il TITOLO TAVOLA (il titolo cartiglio = il NOME DELL'ELABORATO, colonna
 * «TITOLO CARTIGLIO» dell'elenco) è il campo essenziale della copertina: senza,
 * la copertina non dice che elaborato sia. Molti cartigli però NON stampano
 * l'etichetta «Titolo» — la cella è un riquadro vuoto sotto l'Oggetto (è il caso
 * del cartiglio dello studio) — e senza etichetta l'auto-rilevamento non lo genererebbe.
 * Qui lo si crea comunque, posizionato SOTTO l'Oggetto (o, in mancanza, sotto il
 * Committente): l'utente lo rifinisce col trascinamento come tutti gli altri.
 */
function aggiungiTitoloTavola(fields: CoverField[]): void {
  // Nessuna cella riconosciuta = il cartiglio non è stato capito affatto: non è
  // il caso di inventare un campo isolato (la UI ricade sui campi standard).
  if (!fields.length) return
  const cell = CARTIGLIO_LABELS.find((c) => c.label === 'Titolo Tavola')
  if (!cell || fields.some((f) => f.label === cell.label)) return
  const sopra = fields.find((f) => f.label === 'Oggetto') || fields.find((f) => f.label === 'Committente')
  const fontFrac = sopra ? sopra.fontFrac : 0.025
  fields.push({
    id: uid(),
    kind: cell.expr ? 'variable' : 'fixed',
    label: cell.label,
    // Due righe sotto il campo di riferimento (Oggetto/Committente sono blocchi
    // multi-riga), nella stessa colonna e con la stessa larghezza di casella.
    x: sopra ? sopra.x : 0.06,
    y: Math.min(0.95, clamp01(sopra ? sopra.y + fontFrac * 1.2 * 2 : 0.55)),
    anchor: 'tl',
    align: 'left',
    fontFrac,
    maxWidthFrac: sopra?.maxWidthFrac ?? 0.4,
    ...(cell.expr ? { expr: cell.expr } : { value: '' }),
  })
}
