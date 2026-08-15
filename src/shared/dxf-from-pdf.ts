/**
 * PDF → primitive vettoriali, per l'export DXF dei cartigli (δ Pages). PURO salvo
 * l'oggetto `page`/`pdfjsLib` iniettato dal chiamante (pdf.js resta un vendor, mai
 * import statico). Estrae dalla PRIMA pagina del PDF:
 *  - TESTO   ← `getTextContent()` (unicode + posizione + altezza, spazio punti y-su);
 *  - LINEE   ← `getOperatorList()` interpretando i path op con uno stack CTM;
 *  - IMMAGINI← op `paintImageXObject` (loghi) — vedi `extractImages` (fase B2).
 *
 * Coordinate: punti PDF (1pt=1/72"), origine in basso a sinistra (Y verso l'ALTO),
 * come lo spazio dei TEXT — così testo e linee combaciano senza conversioni.
 */

/** Matrice affine PDF [a,b,c,d,e,f]. */
type Mat = [number, number, number, number, number, number]
const IDENT: Mat = [1, 0, 0, 1, 0, 0]
/** m1 ∘ m2 (applica prima m2, poi m1). */
function mul(m1: Mat, m2: Mat): Mat {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}
const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** Un sottopercorso appiattito (curve campionate), in punti. */
export interface DxfPath { pts: Array<[number, number]>; closed: boolean }
/** Un run di testo: ancora (x,y) baseline in punti, altezza em `h`, rotazione gradi. */
export interface DxfTextItem { x: number; y: number; h: number; str: string; rot: number }
/** Un logo/immagine (fase B2). */
export interface DxfImageRef { name: string; x: number; y: number; w: number; h: number; pxW: number; pxH: number; bytes: Uint8Array }
export interface PageVectors { paths: DxfPath[]; texts: DxfTextItem[]; images: DxfImageRef[]; widthPt: number; heightPt: number }

/** Vista minima di pdf.js che serve qui (solo ciò che usiamo). */
export interface PdfJsLike { OPS: Record<string, number> }
export interface PdfPageLike {
  getViewport(o: { scale: number }): { width: number; height: number }
  getTextContent(): Promise<{ items: Array<{ str: string; transform: number[]; height?: number }> }>
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>
}

const N = 8 // campioni per curva

/**
 * Appiattisce un `constructPath` (pdf.js): `ops` = codici sub-op, `coords` = numeri
 * consumati per sub-op (moveTo:2, lineTo:2, curveTo:6, curveTo2/3:4, rectangle:4,
 * closePath:0). Applica la CTM corrente e campiona le bézier. Ritorna i sottopercorsi.
 */
export function flattenConstructPath(ops: number[], coords: number[], OPS: Record<string, number>, ctm: Mat): DxfPath[] {
  const out: DxfPath[] = []
  let cur: Array<[number, number]> = []
  let closed = false
  let ci = 0
  let cx = 0, cy = 0
  const P = (x: number, y: number): [number, number] => apply(ctm, x, y)
  const flush = (): void => { if (cur.length >= 2) out.push({ pts: cur, closed }); cur = []; closed = false }
  for (const op of ops) {
    if (op === OPS.moveTo) { flush(); cx = coords[ci++]; cy = coords[ci++]; cur = [P(cx, cy)] }
    else if (op === OPS.lineTo) { cx = coords[ci++]; cy = coords[ci++]; cur.push(P(cx, cy)) }
    else if (op === OPS.curveTo) {
      const x1 = coords[ci++], y1 = coords[ci++], x2 = coords[ci++], y2 = coords[ci++], ex = coords[ci++], ey = coords[ci++]
      for (let k = 1; k <= N; k++) { const u = k / N, v = 1 - u
        cur.push(P(v * v * v * cx + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * ex, v * v * v * cy + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * ey)) }
      cx = ex; cy = ey
    }
    else if (op === OPS.curveTo2) { // control point = current point
      const x2 = coords[ci++], y2 = coords[ci++], ex = coords[ci++], ey = coords[ci++]
      for (let k = 1; k <= N; k++) { const u = k / N, v = 1 - u
        cur.push(P(v * v * v * cx + 3 * v * v * u * cx + 3 * v * u * u * x2 + u * u * u * ex, v * v * v * cy + 3 * v * v * u * cy + 3 * v * u * u * y2 + u * u * u * ey)) }
      cx = ex; cy = ey
    }
    else if (op === OPS.curveTo3) { // second control = end point
      const x1 = coords[ci++], y1 = coords[ci++], ex = coords[ci++], ey = coords[ci++]
      for (let k = 1; k <= N; k++) { const u = k / N, v = 1 - u
        cur.push(P(v * v * v * cx + 3 * v * v * u * x1 + 3 * v * u * u * ex + u * u * u * ex, v * v * v * cy + 3 * v * v * u * y1 + 3 * v * u * u * ey + u * u * u * ey)) }
      cx = ex; cy = ey
    }
    else if (op === OPS.rectangle) {
      const x = coords[ci++], y = coords[ci++], w = coords[ci++], h = coords[ci++]
      flush()
      cur = [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)]; closed = true; flush()
      cx = x; cy = y
    }
    else if (op === OPS.closePath) { closed = true }
  }
  flush()
  return out
}

/** Estrae testo + linee (+ immagini in B2) dalla prima pagina. */
export async function pageVectors(page: PdfPageLike, pdfjsLib: PdfJsLike, opts: { withImages?: boolean } = {}): Promise<PageVectors> {
  const OPS = pdfjsLib.OPS
  const vp = page.getViewport({ scale: 1 })
  // TESTO: transform in spazio utente (punti, y-su). Altezza em dalla scala verticale.
  const tc = await page.getTextContent()
  const texts: DxfTextItem[] = []
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue
    const t = it.transform
    const h = Math.hypot(t[2], t[3]) || it.height || 8
    const rot = Math.atan2(t[1], t[0]) * 180 / Math.PI
    texts.push({ x: t[4], y: t[5], h, str: it.str, rot: Math.abs(rot) < 0.5 ? 0 : rot })
  }
  // LINEE (+ immagini): interpreta l'operator list con lo stack CTM.
  const ol = await page.getOperatorList()
  const paths: DxfPath[] = []
  const images: DxfImageRef[] = []
  let ctm: Mat = IDENT
  const stack: Mat[] = []
  for (let k = 0; k < ol.fnArray.length; k++) {
    const fn = ol.fnArray[k]
    const a = ol.argsArray[k] as unknown[]
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() || IDENT
    else if (fn === OPS.transform) ctm = mul(ctm, a as unknown as Mat)
    else if (fn === OPS.constructPath) {
      const sub = a[0] as number[]
      const coords = a[1] as number[]
      for (const p of flattenConstructPath(sub, coords, OPS, ctm)) paths.push(p)
    }
    // immagini gestite in fase B2 (extractImages) — qui solo struttura pronta
    void images; void opts
  }
  return { paths, texts, images, widthPt: vp.width, heightPt: vp.height }
}
