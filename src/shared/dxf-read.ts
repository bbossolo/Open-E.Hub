/**
 * LETTORE DXF CONDIVISO — tokenizzatore group-code (code/value) usato per leggere
 * BLOCCHI (definizioni), INSERT (istanze + attributi) e LAYER da un file DXF grezzo.
 *
 * Convenzione INSERT/ATTRIB/SEQEND, generalizzata con scala (41/42/43) e rotazione (50):
 * gli INSERT di una tavola fornitore sono spesso a scala 1 senza rotazione, ma non sempre.
 * È il punto di convergenza per la lettura di blocchi e attributi (catalogo blocchi
 * studio, riconoscimento in una planimetria).
 */

/** Un INSERT del DXF con i suoi attributi (tag→valore), più scala/rotazione. */
export interface DxfInsert {
  name: string
  layer: string
  x: number
  y: number
  /** Fattori di scala (41=X, 42=Y, 43=Z); assente = 1 (nessuna scala). */
  sx?: number
  sy?: number
  /** Rotazione in gradi (gruppo 50); assente = 0. */
  rot?: number
  attrs: Record<string, string>
}

/** Una definizione ATTDEF dentro una BLOCK (tag, prompt, valore default, posizione). */
export interface DxfAttdef { tag: string; prompt?: string; default?: string; x: number; y: number; height?: number }

/** Una primitiva geometrica semplificata dentro una BLOCK (coordinate locali al block). */
export type DxfBlockPrim =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'arc'; cx: number; cy: number; r: number; a1: number; a2: number }
  | { kind: 'polyline'; pts: Array<[number, number]>; closed: boolean }

/** Definizione di un blocco (sezione BLOCKS): geometria + ATTDEF + base point. */
export interface DxfBlockDef {
  name: string
  layer: string
  baseX: number
  baseY: number
  prims: DxfBlockPrim[]
  attdefs: DxfAttdef[]
}

/** Voce della tabella LAYER (nome, colore ACI, linetype). */
export interface DxfLayerInfo { name: string; color: number; linetype: string }

/** Tokenizza il DXF in coppie group-code/valore. Righe spurie (codice non numerico) tollerate. */
function tokenize(text: string): string[] {
  return text.split(/\r\n|\r|\n/)
}

/**
 * Estrae gli INSERT della sezione ENTITIES con i loro ATTRIB (tag code 2 → valore code 1)
 * fino al SEQEND. Single-pass, nessuna risoluzione di trasformazioni annidate (INSERT dentro
 * BLOCK non gestiti: sufficiente per planimetrie piatte).
 */
export function parseInserts(text: string): DxfInsert[] {
  const L = tokenize(text)
  const out: DxfInsert[] = []
  let section: string | null = null
  for (let i = 0; i + 1 < L.length; i += 2) {
    const code = parseInt(L[i], 10); const val = L[i + 1]
    if (Number.isNaN(code)) { i -= 1; continue }
    if (code === 0 && val === 'SECTION') { const c2 = parseInt(L[i + 2], 10); if (c2 === 2) section = L[i + 3]; continue }
    if (code === 0 && val === 'ENDSEC') { section = null; continue }
    if (section !== 'ENTITIES' || code !== 0 || val !== 'INSERT') continue
    const rec: DxfInsert = { name: '', layer: '', x: 0, y: 0, sx: 1, sy: 1, rot: 0, attrs: {} }
    let attrFollow = false
    let j = i + 2
    for (; j + 1 < L.length; j += 2) {
      const c = parseInt(L[j], 10); const v = L[j + 1]
      if (c === 0) break
      if (c === 8) rec.layer = v
      else if (c === 2) rec.name = v
      else if (c === 10) rec.x = parseFloat(v) || 0
      else if (c === 20) rec.y = parseFloat(v) || 0
      else if (c === 41) rec.sx = parseFloat(v) || 1
      else if (c === 42) rec.sy = parseFloat(v) || 1
      else if (c === 50) rec.rot = parseFloat(v) || 0
      else if (c === 66) attrFollow = v.trim() === '1'
    }
    if (attrFollow) {
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0 && v === 'SEQEND') { j += 2; break }
        if (c === 0 && v === 'ATTRIB') {
          let tag = '', value = ''
          for (let m = j + 2; m + 1 < L.length; m += 2) {
            const cc = parseInt(L[m], 10); const mv = L[m + 1]
            if (cc === 0) break
            if (cc === 2) tag = mv; else if (cc === 1) value = mv
          }
          if (tag) rec.attrs[tag] = value
        }
      }
    }
    out.push(rec)
    i = j - 2
  }
  return out
}

/**
 * Estrae le definizioni della sezione BLOCKS: nome, layer, base point, geometria
 * (LINE/CIRCLE/ARC/LWPOLYLINE→primitive semplificate) e ATTDEF. Blocchi anonimi
 * (`*U…`, `*D…`, `A$…`, `G$…`) sono comunque restituiti — il filtro «nominato» è a carico
 * del chiamante (catalogo studio vs. rumore CAD).
 */
export function parseBlockDefs(text: string): DxfBlockDef[] {
  const L = tokenize(text)
  const out: DxfBlockDef[] = []
  let section: string | null = null
  let cur: DxfBlockDef | null = null
  for (let i = 0; i + 1 < L.length; i += 2) {
    const code = parseInt(L[i], 10); const val = L[i + 1]
    if (Number.isNaN(code)) { i -= 1; continue }
    if (code === 0 && val === 'SECTION') { const c2 = parseInt(L[i + 2], 10); if (c2 === 2) section = L[i + 3]; continue }
    if (code === 0 && val === 'ENDSEC') { section = null; continue }
    if (section !== 'BLOCKS') continue
    if (code === 0 && val === 'BLOCK') {
      cur = { name: '', layer: '0', baseX: 0, baseY: 0, prims: [], attdefs: [] }
      let j = i + 2
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0) break
        if (c === 2 && !cur.name) cur.name = v
        else if (c === 8) cur.layer = v
        else if (c === 10) cur.baseX = parseFloat(v) || 0
        else if (c === 20) cur.baseY = parseFloat(v) || 0
      }
      i = j - 2
      continue
    }
    if (code === 0 && val === 'ENDBLK') { if (cur) out.push(cur); cur = null; continue }
    if (!cur) continue
    if (code === 0 && val === 'ATTDEF') {
      const a: DxfAttdef = { tag: '', x: 0, y: 0 }
      let j = i + 2
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0) break
        if (c === 2) a.tag = v
        else if (c === 3) a.prompt = v
        else if (c === 1) a.default = v
        else if (c === 10) a.x = parseFloat(v) || 0
        else if (c === 20) a.y = parseFloat(v) || 0
        else if (c === 40) a.height = parseFloat(v) || undefined
      }
      if (a.tag) cur.attdefs.push(a)
      i = j - 2
      continue
    }
    if (code === 0 && val === 'LINE') {
      const p = { x1: 0, y1: 0, x2: 0, y2: 0 }
      let j = i + 2
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0) break
        if (c === 10) p.x1 = parseFloat(v) || 0
        else if (c === 20) p.y1 = parseFloat(v) || 0
        else if (c === 11) p.x2 = parseFloat(v) || 0
        else if (c === 21) p.y2 = parseFloat(v) || 0
      }
      cur.prims.push({ kind: 'line', ...p })
      i = j - 2
      continue
    }
    if (code === 0 && val === 'CIRCLE') {
      const p = { cx: 0, cy: 0, r: 0 }
      let j = i + 2
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0) break
        if (c === 10) p.cx = parseFloat(v) || 0
        else if (c === 20) p.cy = parseFloat(v) || 0
        else if (c === 40) p.r = parseFloat(v) || 0
      }
      if (p.r > 0) cur.prims.push({ kind: 'circle', ...p })
      i = j - 2
      continue
    }
    if (code === 0 && val === 'ARC') {
      const p = { cx: 0, cy: 0, r: 0, a1: 0, a2: 0 }
      let j = i + 2
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0) break
        if (c === 10) p.cx = parseFloat(v) || 0
        else if (c === 20) p.cy = parseFloat(v) || 0
        else if (c === 40) p.r = parseFloat(v) || 0
        else if (c === 50) p.a1 = parseFloat(v) || 0
        else if (c === 51) p.a2 = parseFloat(v) || 0
      }
      if (p.r > 0) cur.prims.push({ kind: 'arc', ...p })
      i = j - 2
      continue
    }
    if (code === 0 && (val === 'LWPOLYLINE' || val === 'POLYLINE')) {
      const pts: Array<[number, number]> = []
      let closed = false
      let px: number | undefined
      let j = i + 2
      for (; j + 1 < L.length; j += 2) {
        const c = parseInt(L[j], 10); const v = L[j + 1]
        if (c === 0) break
        if (c === 70) closed = (parseInt(v, 10) & 1) === 1
        else if (c === 10) px = parseFloat(v) || 0
        else if (c === 20 && px !== undefined) { pts.push([px, parseFloat(v) || 0]); px = undefined }
      }
      if (pts.length >= 2) cur.prims.push({ kind: 'polyline', pts, closed })
      i = j - 2
      continue
    }
  }
  return out
}

/** Estrae la tabella LAYER (nome, colore ACI, linetype). Utile per un registro layer studio. */
export function parseLayers(text: string): DxfLayerInfo[] {
  const L = tokenize(text)
  const out: DxfLayerInfo[] = []
  let inTable = false
  for (let i = 0; i + 1 < L.length; i += 2) {
    const code = parseInt(L[i], 10); const val = L[i + 1]
    if (Number.isNaN(code)) { i -= 1; continue }
    if (code === 0 && val === 'TABLE') { const c2 = parseInt(L[i + 2], 10); if (c2 === 2 && L[i + 3] === 'LAYER') inTable = true; continue }
    if (code === 0 && val === 'ENDTAB') { inTable = false; continue }
    if (!inTable || code !== 0 || val !== 'LAYER') continue
    const layer: DxfLayerInfo = { name: '', color: 7, linetype: 'CONTINUOUS' }
    let j = i + 2
    for (; j + 1 < L.length; j += 2) {
      const c = parseInt(L[j], 10); const v = L[j + 1]
      if (c === 0) break
      if (c === 2) layer.name = v
      else if (c === 62) layer.color = parseInt(v, 10) || 7
      else if (c === 6) layer.linetype = v
    }
    if (layer.name) out.push(layer)
    i = j - 2
  }
  return out
}
