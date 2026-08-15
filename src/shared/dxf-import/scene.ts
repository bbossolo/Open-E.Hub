/**
 * Da lettura DXF grezza a SCENA disegnabile: geometria divisa per layer, testi col loro
 * layer, INSERT posati sul disegno, bbox, unità.
 *
 * Le trasformazioni (matrici affini degli INSERT annidati, archi→polilinee, flip della Y)
 * ricalcano quelle collaudate del parser storico: stessa matematica,
 * stessi risultati. Cambia il CONTORNO — qui la geometria non collassa in un path unico,
 * perché senza il layer non si può né accendere/spegnere nulla né — cosa più seria —
 * distinguere le utenze vere dall'abaco dei simboli incollato sul layer `0`.
 */
import type { DxfEnt, DxfBlockDef, DxfLettura } from './read'
import { leggiDxf } from './read'
import { DXF_MAX_DEPTH, DXF_MAX_POLILINEE, DXF_MAX_PUNTI_POLILINEE, DXF_MAX_SEGMENTI } from './types'
import type { DxfLayerGeom, DxfParseOptions, DxfPt, DxfScene, DxfSceneInsert, DxfSceneText } from './types'

/* ── matrici affini 2×3: [a,b,c,d,e,f] → x' = a·x + c·y + e, y' = b·x + d·y + f ── */
type Mat = [number, number, number, number, number, number]
const matId = (): Mat => [1, 0, 0, 1, 0, 0]
function matMul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function insertMatrix(e: DxfEnt, blk: DxfBlockDef): Mat {
  const rot = e.a1 * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const T1: Mat = [1, 0, 0, 1, e.x, e.y]
  const R: Mat = [cos, sin, -sin, cos, 0, 0]
  const S: Mat = [e.sx, 0, 0, e.sy, 0, 0]
  const T0: Mat = [1, 0, 0, 1, -blk.baseX, -blk.baseY]
  const M = matMul(matMul(matMul(T1, R), S), T0)
  // OCS con estrusione -Z (group 230 < 0): il blocco è SPECCHIATO — l'intera
  // definizione (incluso il punto di inserimento, che è in OCS) va riflessa
  // sull'asse X. Prima il 230 era ignorato: i blocchi specchiati uscivano dritti.
  return e.ez < 0 ? matMul([-1, 0, 0, 1, 0, 0] as Mat, M) : M
}

/* arco/cerchio → polilinea, in coordinate DXF (Y su); il flip avviene dopo, in TX */
function arcPoly(cx: number, cy: number, r: number, a0deg: number, a1deg: number): DxfPt[] {
  let a0 = a0deg * Math.PI / 180
  let a1 = a1deg * Math.PI / 180
  if (a1 <= a0) a1 += Math.PI * 2
  const span = a1 - a0
  const n = Math.max(6, Math.ceil(span / (Math.PI / 18))) // ~10° per segmento
  const pts: DxfPt[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + span * (i / n)
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

/**
 * Arco definito dal BULGE di una polilinea → punti (ESCLUSO p0, incluso p1).
 * θ = 4·atan(b), raggio CON SEGNO r = corda/(2·sin(θ/2)) — il segno rende la
 * costruzione valida per entrambi i versi senza casistiche. Con bulge 0 o
 * corda nulla degrada al solo p1 (tratto dritto, comportamento storico).
 */
function bulgePoly(p0: DxfPt, p1: DxfPt, b: number): DxfPt[] {
  const theta = 4 * Math.atan(b)
  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const chord = Math.hypot(dx, dy)
  const s = Math.sin(theta / 2)
  if (!chord || !s) return [p1]
  const r = chord / (2 * s)
  const phi = Math.atan2(-dx, dy)
  const a0 = phi - theta / 2
  const cx = p0.x - r * Math.cos(a0)
  const cy = p0.y - r * Math.sin(a0)
  const n = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / 18))) // ~10° per segmento
  const out: DxfPt[] = []
  for (let i = 1; i <= n; i++) {
    const a = a0 + theta * (i / n)
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}

/** Accumulatore dei path, uno per layer. `parti` è un buffer di stringhe (join finale). */
interface LayerBuf {
  parti: string[]; segmenti: number; testi: number; inserts: number
  minX: number; minY: number; maxX: number; maxY: number
}

class SceneBuilder {
  private perLayer = new Map<string, LayerBuf>()
  readonly texts: DxfSceneText[] = []
  segmenti = 0
  troncato = false
  minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity

  /* Campione di coordinate per l'ingombro ROBUSTO — vedi `bboxRobusto()`. */
  private campX: number[] = []
  private campY: number[] = []
  private visti = 0
  private passo = 1

  /** Polilinee GIÀ trasformate dei layer richiesti (opts.raccogliPolilinee):
      il consumatore le usa come ostacoli/muri senza ri-parsare i path `d`.
      Con un TETTO rigido: su una tavola vera i layer architettonici possono
      contenere 150.000 polilinee (misurato su una tavola reale) — raccoglierle
      tutte significa centinaia di MB clonati verso il renderer e, a valle,
      altrettanti nodi DOM: è il crash, non una feature. Oltre il tetto si
      smette di raccogliere e stats.polilineeTroncate lo dichiara. */
  readonly polilinee: Record<string, DxfPt[][]> = {}
  polilineeTroncate = false
  private poliPoly = 0
  private poliPunti = 0
  private raccogliPoli: ((layer: string) => boolean) | null = null

  constructor(private maxSegmenti: number, raccogliKeywords?: string[]) {
    if (raccogliKeywords && raccogliKeywords.length) {
      const kw = raccogliKeywords.map((k) => k.toLowerCase())
      const cache = new Map<string, boolean>()
      this.raccogliPoli = (layer: string) => {
        let v = cache.get(layer)
        if (v === undefined) {
          const h = layer.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          v = kw.some((k) => h.includes(k))
          cache.set(layer, v)
        }
        return v
      }
    }
  }

  /**
   * Ingombro che ignora la geometria vagante.
   *
   * Gli estremi veri non si possono usare per inquadrare: su una tavola reale bastano poche
   * entità perse a chilometri dal disegno per farli esplodere — su una logistica misurata,
   * 168 milioni × 511 milioni di unità contro un edificio di 150 × 81 metri. Chi ci costruisce
   * sopra un viewBox ottiene un puntino al centro di un foglio vuoto.
   *
   * Il criterio è RILEVA E RIPIEGA, non «taglia sempre». Gli estremi restano quelli veri, e si
   * sostituiscono con le barriere di Tukey (quartili ± 3·IQR) solo su un asse dove gli estremi
   * sono più di otto volte le barriere — cioè dove sono palesemente inquinati.
   *
   * Tagliare sempre sarebbe un danno, non un rimedio: le coordinate di un disegno non sono
   * distribuite normalmente, si addensano sui muri, e qualunque criterio statistico applicato
   * d'ufficio mangia disegno vero. Misurato su file sani: le barriere da sole toglievano il 30%
   * a una villa e il 72% dell'asse X a una tavola di squadrature. Con la soglia, quei due file
   * escono **identici** agli estremi, e la logistica con la geometria vagante passa da
   * 168 milioni × 511 milioni di unità a 300.000 × 69.000.
   */
  bboxRobusto(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.campX.length < 32) return null
    const q = (v: number[], f: number): number => v[Math.min(v.length - 1, Math.max(0, Math.floor(v.length * f)))]
    const barriere = (v: number[]): [number, number] => {
      const s2 = [...v].sort((a, b) => a - b)
      const q1 = q(s2, 0.25), q3 = q(s2, 0.75)
      const iqr = q3 - q1
      // Senza dispersione (tutto su una riga) le barriere non dicono niente: si tiene tutto.
      if (!(iqr > 0)) return [s2[0], s2[s2.length - 1]]
      return [Math.max(s2[0], q1 - 3 * iqr), Math.min(s2[s2.length - 1], q3 + 3 * iqr)]
    }
    /** Sopra questo rapporto fra estremi e barriere, gli estremi non sono credibili. */
    const SOGLIA = 8
    const asse = (camp: number[], min: number, max: number): [number, number] => {
      const [a, b] = barriere(camp)
      const pieno = max - min, corto = b - a
      return (corto > 0 && pieno / corto > SOGLIA) ? [a, b] : [min, max]
    }
    const [x0, x1] = asse(this.campX, this.minX, this.maxX)
    const [y0, y1] = asse(this.campY, this.minY, this.maxY)
    if (!(x1 > x0) || !(y1 > y0)) return null
    return { minX: x0, maxX: x1, minY: y0, maxY: y1 }
  }

  private buf(layer: string): LayerBuf {
    let b = this.perLayer.get(layer)
    if (!b) {
      b = { parti: [], segmenti: 0, testi: 0, inserts: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      this.perLayer.set(layer, b)
    }
    return b
  }

  private bbox(x: number, y: number, b?: LayerBuf): void {
    // Campionamento decimato: si tiene un punto ogni `passo`, e il passo raddoppia quando il
    // campione cresce troppo. Bastano poche decine di migliaia di punti per un quantile, e
    // tenerli tutti su una tavola da un milione di segmenti costerebbe più del disegno.
    if (++this.visti % this.passo === 0) {
      this.campX.push(x); this.campY.push(y)
      if (this.campX.length > 120000) {
        this.campX = this.campX.filter((_, i) => i % 2 === 0)
        this.campY = this.campY.filter((_, i) => i % 2 === 0)
        this.passo *= 2
      }
    }
    if (x < this.minX) this.minX = x
    if (x > this.maxX) this.maxX = x
    if (y < this.minY) this.minY = y
    if (y > this.maxY) this.maxY = y
    if (!b) return
    if (x < b.minX) b.minX = x
    if (x > b.maxX) b.maxX = x
    if (y < b.minY) b.minY = y
    if (y > b.maxY) b.maxY = y
  }

  pushPoly(layer: string, pts: DxfPt[]): void {
    if (pts.length < 2) return
    if (this.segmenti >= this.maxSegmenti) { this.troncato = true; return }
    if (this.raccogliPoli && this.raccogliPoli(layer)) {
      if (this.poliPoly >= DXF_MAX_POLILINEE || this.poliPunti >= DXF_MAX_PUNTI_POLILINEE) {
        this.polilineeTroncate = true
      } else {
        (this.polilinee[layer] || (this.polilinee[layer] = [])).push(pts)
        this.poliPoly++
        this.poliPunti += pts.length
      }
    }
    const b = this.buf(layer)
    let d = ''
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      this.bbox(p.x, p.y, b)
      d += (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)
      if (i < pts.length - 1) d += ' '
    }
    b.parti.push(d)
    const seg = pts.length - 1
    b.segmenti += seg
    this.segmenti += seg
  }

  pushText(t: DxfSceneText): void {
    this.texts.push(t)
    const b = this.buf(t.layer)
    b.testi++
    this.bbox(t.x, t.y, b)
  }

  contaInsert(layer: string, x: number, y: number): void {
    const b = this.buf(layer)
    b.inserts++
    this.bbox(x, y, b)
  }

  layers(): DxfLayerGeom[] {
    const out: DxfLayerGeom[] = []
    for (const [layer, b] of this.perLayer) {
      const vuoto = !Number.isFinite(b.minX)
      out.push({
        layer, d: b.parti.join(' '), segmenti: b.segmenti, testi: b.testi, inserts: b.inserts,
        bbox: vuoto ? { minX: 0, minY: 0, maxX: 0, maxY: 0 } : { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY },
      })
    }
    return out.sort((a, b) => b.segmenti - a.segmenti)
  }
}

/** Trasforma una singola entità (già con la sua matrice) in geometria o testo. */
function geomEntita(e: DxfEnt, M: Mat, layer: string, sb: SceneBuilder): void {
  // flip Y: il mondo del disegno ha la Y verso il basso
  const TX = (x: number, y: number): DxfPt => ({
    x: M[0] * x + M[2] * y + M[4],
    y: -(M[1] * x + M[3] * y + M[5]),
  })

  switch (e.t) {
    case 'LINE':
      sb.pushPoly(layer, [TX(e.x, e.y), TX(e.x2, e.y2)])
      break
    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const xs = e.xs, ys = e.ys
      if (!xs || !ys) break
      const n = Math.min(xs.length, ys.length)
      if (n < 2) break
      const chiusa = (e.flag & 1) === 1
      // Il bulge lavora in coordinate DXF (prima della matrice): si tessella
      // l'arco lì e si trasforma dopo, come per ARC/CIRCLE.
      const grezzi: DxfPt[] = [{ x: xs[0], y: ys[0] }]
      for (let i = 1; i < n; i++) {
        const b = e.bulges ? (e.bulges[i - 1] || 0) : 0
        const p1 = { x: xs[i], y: ys[i] }
        if (b) grezzi.push(...bulgePoly(grezzi[grezzi.length - 1], p1, b))
        else grezzi.push(p1)
      }
      if (chiusa) {
        const b = e.bulges ? (e.bulges[n - 1] || 0) : 0
        if (b) grezzi.push(...bulgePoly(grezzi[grezzi.length - 1], { x: xs[0], y: ys[0] }, b))
        else grezzi.push({ x: xs[0], y: ys[0] })
      }
      sb.pushPoly(layer, grezzi.map((p) => TX(p.x, p.y)))
      break
    }
    case 'CIRCLE':
      sb.pushPoly(layer, arcPoly(e.x, e.y, e.h, 0, 360).map((p) => TX(p.x, p.y)))
      break
    case 'ARC':
      sb.pushPoly(layer, arcPoly(e.x, e.y, e.h, e.a1, e.a2).map((p) => TX(p.x, p.y)))
      break
    case 'TEXT':
    case 'MTEXT': {
      const s = e.txt.replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').replace(/\\P/g, ' ').trim()
      if (!s) break
      const p = TX(e.x, e.y)
      const scala = Math.hypot(M[0], M[1]) || 1
      sb.pushText({ x: p.x, y: p.y, s, h: (e.h || 2.5) * scala, r: e.a1, layer })
      break
    }
    default:
      break
  }
}

/** Espande ricorsivamente gli INSERT e accumula la geometria. */
function espandi(
  ents: DxfEnt[],
  blocchi: Map<string, DxfBlockDef>,
  M: Mat,
  layerCtx: string,
  depth: number,
  maxDepth: number,
  sb: SceneBuilder,
  escludiPs = false,
  esclusi: Set<string> | null = null,
): void {
  if (depth > maxDepth) return
  for (const e of ents) {
    // Paperspace (group 67): cartigli e viewport di layout, non il disegno —
    // su richiesta (opts.escludiPaperspace) si saltano. Solo al primo livello:
    // dentro ai blocchi il 67 non esiste.
    if (escludiPs && depth === 0 && e.ps) continue
    // Convenzione DXF: un'entità su layer '0' dentro un blocco eredita il layer dell'INSERT.
    const layer = e.layer && e.layer !== '0' ? e.layer : layerCtx
    // Layer escluso ALLA RADICE (opts.escludiLayer): l'entità non viene
    // costruita; un INSERT su layer escluso porta via tutto il suo blocco.
    if (esclusi && esclusi.has(layer)) continue

    if (e.t === 'INSERT') {
      const blk = blocchi.get(e.name)
      if (!blk) continue
      const cols = Math.max(1, e.flag || 1)
      const rows = Math.max(1, e.flag2 || 1)
      const base = matMul(M, insertMatrix(e, blk))
      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          const Mi = (ci || ri)
            ? matMul(base, [1, 0, 0, 1, ci * e.cspc, ri * e.rspc] as Mat)
            : base
          espandi(blk.ents, blocchi, Mi, layer, depth + 1, maxDepth, sb, escludiPs, esclusi)
        }
      }
      continue
    }
    geomEntita(e, M, layer, sb)
  }
}

/** Raccoglie gli INSERT di primo livello coi loro ATTRIB (che nel DXF li SEGUONO). */
function raccogliInserts(entita: DxfEnt[], escludiPs = false, esclusi: Set<string> | null = null): DxfSceneInsert[] {
  const out: DxfSceneInsert[] = []
  let corrente: DxfSceneInsert | null = null
  for (const e of entita) {
    if (e.t === 'INSERT') {
      if (escludiPs && e.ps) { corrente = null; continue }
      if (esclusi && esclusi.has(e.layer || '0')) { corrente = null; continue }
      corrente = {
        name: e.name,
        layer: e.layer || '0',
        x: e.ez < 0 ? -e.x : e.x, // estrusione -Z: punto di inserimento in OCS specchiata
        y: -e.y, // stessa Y-giù della geometria: è ciò che rimette i marker SOPRA la pianta
        sx: e.sx,
        sy: e.sy,
        rot: e.a1,
        attrs: {},
      }
      if (corrente.name) out.push(corrente)
      continue
    }
    if (e.t === 'ATTRIB' && corrente) {
      if (e.name) corrente.attrs[e.name] = e.txt
      continue
    }
    corrente = null // qualunque altra entità chiude la sequenza INSERT+ATTRIB
  }
  return out
}

/**
 * INSERT ANNIDATI (blocchi dentro blocchi), posizionati in coordinate mondo via
 * matrici: senza questa discesa i dispositivi raggruppati in un blocco
 * contenitore non entravano né in distinta né fra i dispositivi riconosciuti
 * (limite storico documentato in types.ts). Opt-in con opts.profonditaInserts.
 */
function raccogliAnnidati(
  entita: DxfEnt[],
  blocchi: Map<string, DxfBlockDef>,
  profondita: number,
  escludiPs = false,
  esclusi: Set<string> | null = null,
): DxfSceneInsert[] {
  const out: DxfSceneInsert[] = []
  const discendi = (ents: DxfEnt[], M: Mat, layerCtx: string, depth: number): void => {
    if (depth > profondita) return
    for (const e of ents) {
      if (e.t !== 'INSERT' || !e.name) continue
      const blk = blocchi.get(e.name)
      if (!blk) continue
      const layer = e.layer && e.layer !== '0' ? e.layer : layerCtx
      const Mi = matMul(M, insertMatrix(e, blk))
      // posizione = dove atterra il punto base del blocco figlio, nel mondo
      const px = Mi[0] * blk.baseX + Mi[2] * blk.baseY + Mi[4]
      const py = Mi[1] * blk.baseX + Mi[3] * blk.baseY + Mi[5]
      out.push({ name: e.name, layer, x: px, y: -py, sx: e.sx, sy: e.sy, rot: e.a1, attrs: {}, annidato: true })
      discendi(blk.ents, Mi, layer, depth + 1)
    }
  }
  for (const e of entita) {
    if (e.t !== 'INSERT' || !e.name) continue
    if (escludiPs && e.ps) continue
    if (esclusi && esclusi.has(e.layer || '0')) continue
    const blk = blocchi.get(e.name)
    if (!blk) continue
    discendi(blk.ents, insertMatrix(e, blk), e.layer || '0', 1)
  }
  return out
}

/** Costruisce la scena da una lettura già fatta (utile nei test: nessun I/O). */
export function scenaDaLettura(l: DxfLettura, opts: DxfParseOptions = {}): DxfScene {
  const t0 = Date.now()
  const sb = new SceneBuilder(opts.maxSegmenti ?? DXF_MAX_SEGMENTI, opts.raccogliPolilinee)
  const escludiPs = !!opts.escludiPaperspace
  const esclusi = opts.escludiLayer && opts.escludiLayer.length ? new Set(opts.escludiLayer) : null
  espandi(l.entita, l.blocchi, matId(), '0', 0, opts.maxDepth ?? DXF_MAX_DEPTH, sb, escludiPs, esclusi)

  const inserts = raccogliInserts(l.entita, escludiPs, esclusi)
  for (const i of inserts) sb.contaInsert(i.layer, i.x, i.y)
  if (opts.profonditaInserts && opts.profonditaInserts > 0) {
    inserts.push(...raccogliAnnidati(l.entita, l.blocchi, opts.profonditaInserts, escludiPs, esclusi))
  }

  const vuoto = !Number.isFinite(sb.minX)
  return {
    layers: sb.layers(),
    texts: sb.texts,
    inserts,
    bbox: vuoto
      ? { minX: 0, minY: 0, maxX: 0, maxY: 0 }
      : { minX: sb.minX, minY: sb.minY, maxX: sb.maxX, maxY: sb.maxY },
    bboxCore: vuoto ? null : sb.bboxRobusto(),
    unitsPerMeter: l.unitsPerMeter,
    layerTable: l.layerTable,
    polilinee: sb.polilinee,
    stats: {
      entita: l.entita.length,
      blocchi: l.blocchi.size,
      segmenti: sb.segmenti,
      troncato: sb.troncato,
      polilineeTroncate: sb.polilineeTroncate || undefined,
      saltatePerTipo: l.saltatePerTipo,
      ms: Date.now() - t0,
    },
  }
}

/** API principale: testo DXF → scena. Un solo passaggio sul file. */
export function dxfToScene(text: string, opts: DxfParseOptions = {}): DxfScene {
  const t0 = Date.now()
  const scena = scenaDaLettura(leggiDxf(text, opts.onProgress), opts)
  scena.stats.ms = Date.now() - t0
  return scena
}
