/**
 * PAGINA DOCUMENTO in DXF — il ponte tra i PDF della suite e gli export CAD.
 *
 * Il golden standard (utente, 2026-07): il DXF esportato deve riprodurre FEDELMENTE la
 * pagina del PDF — foglio, cartiglio banda col brand ε/tool, angoli arrotondati, tratteggi
 * e SOPRATTUTTO i testi come CONTORNI dei glifi veri (Arimo/JetBrains Mono, gli stessi
 * dei PDF), come una conversione PDF→DXF: il riferimento contiene SOLO LWPOLYLINE.
 * Qui vivono le primitive:
 *
 *  - `textOutline`/`measureText` — testo come LWPOLYLINE chiuse dai contorni glifo
 *    (dati generati build-time in `dxf-glyphs.ts`, unità em, baseline a y).
 *  - `roundedRect` — rettangolo ad angoli arrotondati (LWPOLYLINE con bulge, archi veri).
 *  - `svgPathToPolylines` — appiattisce un path SVG (M/L/H/V/Q/C/A/Z assoluti) in
 *    contorni: serve per il marchio ε golden.
 *  - `dxfCartiglioBanda` — la banda cartiglio dei PDF (brand Open E.Hub + tag tool
 *    + titolo/sottotitolo/disclaimer), replica di `piCartiglioHTML`/`omegaCartiglioHTML` in mm foglio.
 *
 * Coordinate: come `dxf.ts`, spazio layout DOM-like (Y in basso) su builder con flip;
 * le primitive funzionano anche senza flip (spazio Y in alto), vedi `dirY`.
 */
import { DxfBuilder, asciiSafe, entity, type EntityOpts } from './dxf'
import { DXF_FONTS, type DxfFontFace } from './dxf-glyphs'
import { EHUB_MARK_PATH, EHUB_MARK_VIEWBOX, EHUB_MARK_DOT } from './ui/brand-mark'

/** Quarto di cerchio come bulge LWPOLYLINE: tan(90°/4). Segno secondo il flip del builder. */
const BULGE_Q = 0.41421

/** Colore opzionale di un'entità: ACI (gruppo 62) e/o true color 24 bit (gruppo 420). */
export interface DxfColor { aci?: number; rgb?: [number, number, number] }

/** Traduce un `DxfColor` nelle opzioni colore di `entity()`. */
const colorOpts = (c?: DxfColor): EntityOpts => (c ? { aci: c.aci, rgb: c.rgb } : {})

/** LWPOLYLINE (aperta/chiusa) con colore opzionale — variante di `polyline` di dxf.ts. */
export function polylineC(b: DxfBuilder, layer: string, pts: Array<[number, number]>, closed: boolean, color?: DxfColor): void {
  if (pts.length < 2) return
  entity(b, 'LWPOLYLINE', layer, colorOpts(color)); b.g(90, pts.length); b.g(70, closed ? 1 : 0)
  for (const [px, py] of pts) { b.g(10, b.fx(px)); b.g(20, b.fy(py)) }
}

/**
 * Rettangolo ad ANGOLI ARROTONDATI come LWPOLYLINE chiusa con bulge (archi veri, non
 * segmenti): la firma visiva delle carpenterie/celle dei PDF. r=0 → rettangolo netto.
 */
export function roundedRect(b: DxfBuilder, layer: string, x: number, y: number, w: number, h: number, r: number, color?: DxfColor): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (rr <= 0.01) { polylineC(b, layer, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, color); return }
  // Verso di percorrenza orario nello spazio layout: nel file (Y su) i quarti d'arco
  // degli angoli risultano CW → bulge negativo; senza flip il verso è CCW → positivo.
  const bg = b.flipY ? -BULGE_Q : BULGE_Q
  const v: Array<[number, number, number]> = [
    [x + rr, y, 0], [x + w - rr, y, bg],
    [x + w, y + rr, 0], [x + w, y + h - rr, bg],
    [x + w - rr, y + h, 0], [x + rr, y + h, bg],
    [x, y + h - rr, 0], [x, y + rr, bg],
  ]
  entity(b, 'LWPOLYLINE', layer, colorOpts(color)); b.g(90, v.length); b.g(70, 1)
  for (const [px, py, bl] of v) { b.g(10, b.fx(px)); b.g(20, b.fy(py)); if (bl) b.g(42, bl) }
}

/* ── Path SVG → contorni ─────────────────────────────────────────────────── */

/**
 * Appiattisce un path SVG con comandi ASSOLUTI (M/L/H/V/Q/C/A/Z — quelli di
 * `TOOL_GLYPH_PATHS` e del marchio ε) in una lista di contorni. Le curve sono
 * campionate (8 segmenti); comandi non gestiti vengono ignorati senza inventare.
 */
export function svgPathToPolylines(d: string): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = []
  let cur: Array<[number, number]> = []
  const toks = d.match(/[MLHVQCAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || []
  let i = 0, x = 0, y = 0, sx = 0, sy = 0
  const num = () => parseFloat(toks[i++] || '0')
  const N = 8
  const close = () => { if (cur.length > 2) out.push(cur); cur = [] }
  while (i < toks.length) {
    const cmd = toks[i++].toUpperCase()
    if (cmd === 'M') { close(); x = sx = num(); y = sy = num(); cur.push([x, y]) }
    else if (cmd === 'L') { x = num(); y = num(); cur.push([x, y]) }
    else if (cmd === 'H') { x = num(); cur.push([x, y]) }
    else if (cmd === 'V') { y = num(); cur.push([x, y]) }
    else if (cmd === 'Q') {
      const x1 = num(), y1 = num(), ex = num(), ey = num()
      for (let k = 1; k <= N; k++) {
        const u = k / N, v = 1 - u
        cur.push([v * v * x + 2 * v * u * x1 + u * u * ex, v * v * y + 2 * v * u * y1 + u * u * ey])
      }
      x = ex; y = ey
    } else if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), ex = num(), ey = num()
      for (let k = 1; k <= N; k++) {
        const u = k / N, v = 1 - u
        cur.push([v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * ex,
                  v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * ey])
      }
      x = ex; y = ey
    } else if (cmd === 'A') {
      const rx = num(), ry = num(); num(); num(); const sweep = num(); const ex = num(), ey = num()
      const r = (rx + ry) / 2, mx = (x + ex) / 2, my = (y + ey) / 2
      const dx = ex - x, dy = ey - y, chord = Math.hypot(dx, dy)
      if (chord > 0 && r > 0) {
        const half = Math.min(1, chord / 2 / r)
        const hgt = r * Math.sqrt(Math.max(0, 1 - half * half))
        const nx = -dy / chord, ny = dx / chord, sg = sweep ? 1 : -1
        const ccx = mx + sg * nx * hgt, ccy = my + sg * ny * hgt
        const a0 = Math.atan2(y - ccy, x - ccx)
        let a1 = Math.atan2(ey - ccy, ex - ccx)
        if (sweep && a1 < a0) a1 += Math.PI * 2
        if (!sweep && a1 > a0) a1 -= Math.PI * 2
        for (let k = 1; k <= N; k++) {
          const a = a0 + (a1 - a0) * (k / N)
          cur.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)])
        }
      } else cur.push([ex, ey])
      x = ex; y = ey
    } else if (cmd === 'Z') { x = sx; y = sy; close() }
  }
  close()
  return out
}

/* ── Testo a contorni ────────────────────────────────────────────────────── */

/**
 * Layer del TESTO RICERCABILE: ogni `textOutline` emette anche una entità TEXT gemella
 * su questo layer SPENTO (colore negativo in tabella = layer off) — come il livello di
 * testo selezionabile sotto i glifi di un PDF: invisibile, ma cercabile/copiabile in CAD.
 * I writer che usano `textOutline` DEVONO includerlo nelle TABLES (già negativo).
 */
export const DXF_HIDDEN_TEXT_LAYER = 'TESTO_RICERCA'
/** Definizione pronta del layer nascosto per le TABLES dei writer. */
export const HIDDEN_TEXT_LAYER_DEF = { name: DXF_HIDDEN_TEXT_LAYER, color: -8 } as const

export interface TextOpts {
  font?: DxfFontFace
  align?: 'left' | 'center' | 'right'
  color?: DxfColor
  /** Rotazione VISIVA antioraria in gradi attorno all'ancora (x,y) — es. 90 per quote verticali. */
  rot?: number
}

/** Larghezza (unità layout) di `s` alla dimensione em `size` col font dato. */
export function measureText(s: string, size: number, font: DxfFontFace = 'arimo'): number {
  const F = DXF_FONTS[font]
  let w = 0
  for (const ch of String(s ?? '')) {
    const g = F[ch] || F[asciiSafe(ch)] || F['?']
    if (g) w += g.adv * size
  }
  return w
}

/**
 * TESTO A CONTORNI: ogni glifo emesso come LWPOLYLINE chiuse (i contorni veri di
 * Arimo/JetBrains Mono, gli stessi font dei PDF) — il golden standard dell'export,
 * identico su qualunque CAD perché non dipende dai font installati.
 * `y` è la BASELINE; `size` è il corpo em (≙ font-size CSS in mm foglio).
 */
export function textOutline(b: DxfBuilder, layer: string, x: number, y: number, size: number, s: string, opts: TextOpts = {}): void {
  const F = DXF_FONTS[opts.font || 'arimo']
  const str = String(s ?? '')
  if (!str || size <= 0) return
  let ox = x
  const align = opts.align || 'left'
  if (align !== 'left') {
    const w = measureText(str, size, opts.font || 'arimo')
    ox = align === 'center' ? x - w / 2 : x - w
  }
  // I contorni glifo sono in em con Y verso l'ALTO: nello spazio layout DOM-like
  // (builder con flip) l'ascendente sottrae; nello spazio Y-su somma.
  const gs = b.flipY ? -1 : 1
  // Rotazione visiva antioraria attorno all'ancora: in spazio Y-giù è la rotazione
  // matematica ORARIA (e viceversa) — così il testo a 90° si legge dal basso in alto.
  const th = ((opts.rot || 0) * Math.PI) / 180
  const cos = Math.cos(th), sin = Math.sin(th) * (b.flipY ? 1 : -1)
  const place = (px: number, py: number): [number, number] => {
    const dx = px - x, dy = py - y
    return th ? [x + dx * cos + dy * sin, y - dx * sin + dy * cos] : [px, py]
  }
  const startX = ox
  for (const ch of str) {
    const g = F[ch] || F[asciiSafe(ch)] || F['?']
    if (!g) { ox += size * 0.5; continue }
    for (const contour of g.c) {
      const pts = contour.map(([gx, gy]) => place(ox + gx * size, y + gs * gy * size))
      polylineC(b, layer, pts, true, opts.color)
    }
    ox += g.adv * size
  }
  // Gemello RICERCABILE sul layer nascosto (vedi DXF_HIDDEN_TEXT_LAYER).
  const safe = asciiSafe(str)
  if (safe) {
    entity(b, 'TEXT', DXF_HIDDEN_TEXT_LAYER, {})
    b.g(10, b.fx(startX)); b.g(20, b.fy(y)); b.g(30, 0)
    b.g(40, +size.toFixed(3)); b.g(1, safe); b.g(7, 'STANDARD'); b.g(50, opts.rot || 0)
  }
}

/* ── Cartiglio banda (replica del cartiglio PDF) ─────────────────────────── */

export interface CartiglioBandaOpts {
  /** Angolo ALTO-sinistra della banda in unità layout (tipicamente mm foglio × scala). */
  x: number; y: number; w: number; h: number
  /** Moltiplicatore mm→unità layout (pagine disegnate a scala k: passare k). */
  scale?: number
  /** Tag tool accanto al brand, es. «μ Prezzi». */
  toolTag?: string
  /** Colore accento del tool (tag). */
  accent?: [number, number, number]
  title: string
  subtitle?: string
  disclaimer?: string
  layer?: string
}

/**
 * BANDA CARTIGLIO fedele ai PDF della suite (replica di `piCartiglioHTML`/`omegaCartiglioHTML`,
 * layout a COLONNA allineata a sinistra: via il blocco tool pieno col glifo grande
 * — spaginava ed era disallineato dal PDF): riquadro, brand Open E.Hub (marchio golden + punto
 * rosso) + tag tool, titolo/sottotitolo/disclaimer come contorni glifo.
 *
 * `y` è il bordo ALTO della banda nella pagina; `dirY` traduce «verso il basso della
 * pagina» nello spazio del builder (flip: +1, Y-su nativo: -1).
 */
export function dxfCartiglioBanda(b: DxfBuilder, o: CartiglioBandaOpts): void {
  const L = o.layer || 'CARTIGLIO'
  const k = o.scale ?? 1
  const mm = (v: number) => v * k
  const accent: [number, number, number] = o.accent || [178, 58, 92] // bordeaux di default
  const dirY = b.flipY ? 1 : -1
  const accentC: DxfColor = { rgb: accent }
  const grey: DxfColor = { aci: 8 }
  /** Baseline/quota a `dMm` mm dal bordo alto della banda. */
  const row = (dMm: number) => o.y + dirY * mm(dMm)

  // Riquadro banda
  polylineC(b, L, [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, row(o.h / k)], [o.x, row(o.h / k)]], true)

  // Colonna testi allineata a sinistra (padding 4mm dal bordo)
  const tx = o.x + mm(4)

  // Riga brand: marchio ε golden (4.4mm) + punto rosso + «E.HUB» mono + tag tool accento
  let bx = tx
  const [vbX, vbY, vbW, vbH] = EHUB_MARK_VIEWBOX.split(' ').map(Number)
  const markH = mm(4.4)
  const ms = markH / vbH
  const markTop = row(2.2)
  for (const c of svgPathToPolylines(EHUB_MARK_PATH)) {
    polylineC(b, L, c.map(([px, py]) => [bx + (px - vbX) * ms, markTop + dirY * (py - vbY) * ms] as [number, number]), true)
  }
  entity(b, 'CIRCLE', L, { rgb: [229, 72, 77] })
  b.g(10, b.fx(bx + (EHUB_MARK_DOT.cx - vbX) * ms))
  b.g(20, b.fy(markTop + dirY * (EHUB_MARK_DOT.cy - vbY) * ms))
  b.g(30, 0); b.g(40, +(EHUB_MARK_DOT.r * ms).toFixed(3))
  bx += vbW * ms + mm(1.6)
  textOutline(b, L, bx, row(6.4), mm(2.1), 'E.HUB', { font: 'mono', color: grey })
  bx += measureText('E.HUB', mm(2.1), 'mono') + mm(2.5)
  if (o.toolTag) textOutline(b, L, bx, row(6.6), mm(3), o.toolTag, { font: 'arimo-bold', color: accentC })

  // Titolo · sottotitolo · disclaimer (baseline scalate sull'altezza banda standard 24mm)
  textOutline(b, L, tx, row(12.2), mm(4.2), o.title, { font: 'arimo-bold' })
  if (o.subtitle) textOutline(b, L, tx, row(16.2), mm(3), o.subtitle, { color: grey })
  if (o.disclaimer) textOutline(b, L, tx, row(20.4), mm(2.3), o.disclaimer, { color: grey })
}
