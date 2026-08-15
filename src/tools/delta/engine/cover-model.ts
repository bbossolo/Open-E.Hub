/**
 * δ Pages — risoluzione dei campi in copertine concrete (puro, no DOM).
 * Un campo FISSO porta il suo valore letterale; un campo VARIABILE prende il
 * valore dalla colonna mappata della riga corrente dell'elenco. Se la colonna
 * è sparita da un re-import (campo "orfano") o la cella è vuota, il testo è ''.
 */
import type { DeltaState, CoverPage, CoverDoc, ResolvedField, CoverField, Anchor } from './types'
import { resolveExpr } from './expr'

/** Traslazione CSS per ancorare il testo al punto (x,y) secondo l'anchor. */
export function anchorTranslate(anchor: Anchor): { tx: string; ty: string } {
  const h = anchor[1] // l | c | r
  const v = anchor[0] // t | m | b
  const tx = h === 'l' ? '0' : h === 'c' ? '-50%' : '-100%'
  const ty = v === 't' ? '0' : v === 'm' ? '-50%' : '-100%'
  return { tx, ty }
}

/**
 * Larghezza della CASELLA DI TESTO di un campo, in frazione 0–1 della larghezza
 * pagina. Ogni campo è una casella che manda a capo: se la larghezza non è
 * dichiarata (`maxWidthFrac`), è lo spazio disponibile dal punto di ancoraggio
 * fino al bordo pagina, meno un margine — un campo ancorato a sinistra cresce
 * verso destra, a destra verso sinistra, al centro in entrambe le direzioni
 * (limitato dal bordo più vicino). Puro: lo usano editor, PDF e HTML di stampa
 * per ottenere lo stesso identico wrap.
 */
export function fieldBoxWidthFrac(anchor: Anchor, x: number, maxWidthFrac?: number, margin = 0.015): number {
  if (maxWidthFrac && maxWidthFrac > 0) return maxWidthFrac
  const h = anchor[1] // l | c | r
  if (h === 'l') return 1 - margin - x
  if (h === 'r') return x - margin
  return 2 * Math.min(x, 1 - x) - 2 * margin
}

/** Altezza delle MAIUSCOLE, in frazione del corpo: 0,716 in Arial come in
 *  Helvetica (e ±1% in ogni grottesco). È la base dell'ancoraggio verticale. */
export const CAP_HEIGHT_FRAC = 0.716

/** Interlinea del blocco multi-riga, in frazione del corpo. */
export const LINE_HEIGHT_FRAC = 1.2

/**
 * Distanza (verso il BASSO, nelle stesse unità di `size`) dal punto di
 * ancoraggio del campo alla baseline della sua PRIMA riga.
 *
 * L'ancoraggio si misura sulle MAIUSCOLE, non sulle metriche ascender/descender
 * del font: quelle cambiano da font a font (e il font di un cartiglio è spesso
 * un sottoinsieme, che per qualche glifo fa ripiegare su Helvetica) e lo stesso
 * campo finirebbe a quote diverse a seconda di che testo contiene. Con le
 * maiuscole il risultato è identico in editor, PDF, HTML di stampa e DXF:
 *  · `t` = la cima delle maiuscole sta sul punto;
 *  · `m` = le maiuscole sono centrate sul punto (il blocco multi-riga si
 *          centra sul punto nel suo insieme);
 *  · `b` = la baseline dell'ULTIMA riga sta sul punto (il testo «siede» lì).
 */
export function firstBaselineOffset(anchor: Anchor, size: number, lines = 1): number {
  const cap = CAP_HEIGHT_FRAC * size
  const lineH = LINE_HEIGHT_FRAC * size
  const extra = (lines - 1) * lineH
  const v = anchor[0] // t | m | b
  if (v === 't') return cap
  if (v === 'b') return -extra
  return cap / 2 - extra / 2
}

/**
 * Il testo finale di un campo per una data riga dell'elenco (o null=nessuna riga).
 * Campo VARIABILE: se ha un'espressione `expr` (con token `{Col}`/`{@Meta}`)
 * prevale sulla semplice `column`. `meta` = metadati progetto (PAGINA INIZIALE).
 */
export function fieldText(field: CoverField, row: Record<string, string> | null, meta: Record<string, string> = {}): string {
  if (field.kind === 'fixed') return field.value ?? ''
  if (field.expr) return resolveExpr(field.expr, row ?? {}, meta)
  if (!field.column || !row) return ''
  return row[field.column] ?? ''
}

function resolveField(field: CoverField, row: Record<string, string> | null, meta: Record<string, string> = {}): ResolvedField {
  return {
    text: fieldText(field, row, meta),
    x: field.x,
    y: field.y,
    anchor: field.anchor,
    align: field.align,
    fontFrac: field.fontFrac,
    bold: !!field.bold,
    ...(field.maxWidthFrac ? { maxWidthFrac: field.maxWidthFrac } : {}),
    ...(field.maxHeightFrac ? { maxHeightFrac: field.maxHeightFrac } : {}),
  }
}

/**
 * Risolve UNA copertina. `rowIndex` = -1 (o senza elenco) → anteprima "a vuoto":
 * i fissi mostrano il loro valore, i variabili un segnaposto «‹Colonna›».
 */
export function resolveCover(state: DeltaState, rowIndex: number): CoverPage | null {
  if (!state.template) return null
  const meta = state.elenco?.meta ?? {}
  const row = state.elenco && rowIndex >= 0 ? (state.elenco.rows[rowIndex] ?? null) : null
  // Nessuna riga reale in vista (rowIndex=-1, «anteprima a vuoto»): il segnaposto
  // vale sia senza elenco sia con elenco caricato ma nessuna riga selezionata —
  // altrimenti, appena importato l'elenco, i campi variabili sparivano (testo
  // vuoto) invece di mostrare «‹Colonna›» come da contratto di questa funzione.
  const placeholder = !row
  const fields = state.fields.map((f) => {
    const rf = resolveField(f, row, meta)
    if (placeholder && f.kind === 'variable' && !rf.text) rf.text = f.expr || f.column ? `‹${f.expr || f.column}›` : `‹${f.label}›`
    return rf
  })
  return { bg: state.template, fields }
}

/** Costruisce il documento completo: una copertina per riga dell'elenco.
 *  Senza elenco → una sola copertina coi soli campi fissi. */
export function buildCoverDoc(state: DeltaState): CoverDoc {
  if (!state.template) return { pages: [] }
  const meta = state.elenco?.meta ?? {}
  const n = state.elenco ? state.elenco.rows.length : 0
  if (!n) {
    return { pages: [{ bg: state.template, fields: state.fields.map((f) => resolveField(f, null, meta)) }] }
  }
  const pages: CoverPage[] = []
  for (let i = 0; i < n; i++) {
    const row = state.elenco!.rows[i]
    pages.push({ bg: state.template, fields: state.fields.map((f) => resolveField(f, row, meta)) })
  }
  return { pages }
}
