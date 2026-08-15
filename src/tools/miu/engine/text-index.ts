/**
 * INDICE A TRIGRAMMI — prefiltro LOSSLESS per la ricerca sui prezzari.
 *
 * Problema: searchRows scansiona ~40k voci a ogni battuta (Lombardia 39.714).
 * Idea: se un termine deve comparire come SUBSTRING in un testo, allora TUTTI
 * i suoi trigrammi compaiono in quel testo → l'intersezione delle posting list
 * dei trigrammi del termine è un SUPERSET GARANTITO delle righe che matchano
 * (lossless per costruzione: mai una voce pertinente tagliata). Il match vero
 * resta quello di search.ts, eseguito solo sui candidati.
 *
 * Il testo indicizzato porta ENTRAMBI i piani di hitTerm (raw ∪ stem paddato):
 * così anche i candidati del lato stemmato sono selettivi per frasi intere.
 *
 * Regole di sicurezza (violarle romperebbe la losslessness):
 *  - il testo indicizzato deve contenere TUTTO ciò su cui hitTerm matcha (full,
 *    con padding di spazio in testa/coda per i match a inizio/fine);
 *  - termini < 3 caratteri → nessun prefiltro (null = scansione completa);
 *  - intersecare un SOTTOINSIEME dei trigrammi (i più rari) resta un superset;
 *  - il clamp a 8 bit dei charcode può FONDERE trigrammi diversi nella stessa
 *    posting (candidati in più): superset, mai in meno.
 *
 * Costruzione: SOLO esplicita (prewarm sync per test/CLI, async a chunk per la
 * UI — una build sincrona su 40k voci congelerebbe il thread). Invalidazione:
 * WeakMap sull'identità dell'array righe (nuovo prezzario ⇒ array nuovo).
 */

interface TermLike { raw: string; stem: string }
export interface TextIndex { postings: Map<number, Uint32Array> }

let ENABLED = true
/** Solo per i test (equivalenza con/senza indice) e diagnosi. */
export function __setTextIndexEnabled(on: boolean): void { ENABLED = on }

const IDX_CACHE = new WeakMap<object, TextIndex>()

// chiave numerica del trigramma: 3 charcode clampati a 8 bit (fusione = superset)
function keyAt(s: string, p: number): number {
  return (s.charCodeAt(p) & 255) | ((s.charCodeAt(p + 1) & 255) << 8) | ((s.charCodeAt(p + 2) & 255) << 16)
}

interface Building {
  rows: object[]
  textOf: (r: never) => string
  counts: Map<number, number>
  lastSeen: Map<number, number>
  texts: string[]
  next: number
}

function countRow(b: Building, i: number): void {
  const s = b.texts[i] = (b.textOf as (r: object) => string)(b.rows[i]!)
  for (let p = 0; p + 3 <= s.length; p++) {
    const key = keyAt(s, p)
    if (b.lastSeen.get(key) !== i) {
      b.lastSeen.set(key, i)
      b.counts.set(key, (b.counts.get(key) ?? 0) + 1)
    }
  }
}

function finalize(b: Building): TextIndex {
  const postings = new Map<number, Uint32Array>()
  const fill = new Map<number, number>()
  for (const [g, c] of b.counts) { postings.set(g, new Uint32Array(c)); fill.set(g, 0) }
  for (let i = 0; i < b.rows.length; i++) {
    const s = b.texts[i]!
    for (let p = 0; p + 3 <= s.length; p++) {
      const key = keyAt(s, p)
      const arr = postings.get(key)!
      const k = fill.get(key)!
      if (k > 0 && arr[k - 1]! === i) continue // dedupe: righe processate in ordine
      arr[k] = i
      fill.set(key, k + 1)
    }
  }
  const idx: TextIndex = { postings }
  IDX_CACHE.set(b.rows, idx)
  return idx
}

function newBuilding<T extends object>(rows: T[], textOf: (r: T) => string): Building {
  return { rows, textOf: textOf as Building['textOf'], counts: new Map(), lastSeen: new Map(), texts: new Array(rows.length), next: 0 }
}

/** Indice già costruito per questo array di righe (null se assente/disabilitato). */
export function textIndexFor<T extends object>(rows: T[]): TextIndex | null {
  if (!ENABLED) return null
  return IDX_CACHE.get(rows) ?? null
}

/** Build SINCRONA (test, CLI, dataset piccoli): blocca finché l'indice è pronto. */
export function buildTextIndex<T extends object>(rows: T[], textOf: (r: T) => string): TextIndex {
  const cached = IDX_CACHE.get(rows)
  if (cached) return cached
  const b = newBuilding(rows, textOf)
  for (let i = 0; i < rows.length; i++) countRow(b, i)
  return finalize(b)
}

/**
 * Build ASINCRONA a chunk per la UI: lavora ~CHUNK righe per volta e cede il
 * thread, così la digitazione resta fluida durante l'indicizzazione. Se
 * l'array viene sostituito nel frattempo, l'indice orfano si perde da solo
 * (WeakMap). Ritorna l'indice (o quello già in cache).
 */
export async function buildTextIndexAsync<T extends object>(rows: T[], textOf: (r: T) => string, chunk = 2000): Promise<TextIndex> {
  const cached = IDX_CACHE.get(rows)
  if (cached) return cached
  const b = newBuilding(rows, textOf)
  while (b.next < rows.length) {
    const end = Math.min(b.next + chunk, rows.length)
    for (; b.next < end; b.next++) countRow(b, b.next)
    await new Promise(res => setTimeout(res, 0))
  }
  return finalize(b)
}

const EMPTY = new Uint32Array(0)

// intersezione/unione di posting list ORDINATE (le build le producono in ordine di riga)
function intersect(a: Uint32Array, b: Uint32Array): Uint32Array {
  const out = new Uint32Array(Math.min(a.length, b.length))
  let i = 0, j = 0, k = 0
  while (i < a.length && j < b.length) {
    if (a[i]! === b[j]!) { out[k++] = a[i]!; i++; j++ }
    else if (a[i]! < b[j]!) i++
    else j++
  }
  return out.subarray(0, k)
}
function union(a: Uint32Array, b: Uint32Array): Uint32Array {
  const out = new Uint32Array(a.length + b.length)
  let i = 0, j = 0, k = 0
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i]! <= b[j]!)) {
      if (k === 0 || out[k - 1]! !== a[i]!) out[k++] = a[i]!
      if (j < b.length && b[j] === a[i]) j++
      i++
    } else {
      if (k === 0 || out[k - 1]! !== b[j]!) out[k++] = b[j]!
      j++
    }
  }
  return out.subarray(0, k)
}

/** Candidati per UNA stringa: intersezione dei suoi 4 trigrammi più rari. */
function candForString(idx: TextIndex, s: string): Uint32Array | null {
  if (s.length < 3) return null
  const posts: Uint32Array[] = []
  const seen = new Set<number>()
  for (let p = 0; p + 3 <= s.length; p++) {
    const key = keyAt(s, p)
    if (seen.has(key)) continue
    seen.add(key)
    const post = idx.postings.get(key)
    if (!post) return EMPTY // un trigramma assente ⇒ nessuna riga può contenere s
    posts.push(post)
  }
  posts.sort((a, b) => a.length - b.length)
  let cand = posts[0]!
  for (let i = 1; i < Math.min(posts.length, 4) && cand.length; i++) cand = intersect(cand, posts[i]!)
  return cand
}

/**
 * Candidati per un termine sui DUE piani di match (il testo indicizzato deve
 * contenerli entrambi: raw ∪ stem paddato, vedi indexTextOf in search.ts).
 * null ⇒ prefiltro impossibile (termine corto): scansione completa.
 */
export function candidatesForTerm(idx: TextIndex, t: TermLike): Uint32Array | null {
  const raw = candForString(idx, t.raw)
  if (raw === null) return null
  if (t.stem === t.raw) return raw
  const st = candForString(idx, ' ' + t.stem)
  if (st === null) return null
  return union(raw, st)
}

/** Intersezione di candidati tra vincoli AND (esportata per search.ts). */
export function intersectCandidates(a: Uint32Array, b: Uint32Array): Uint32Array { return intersect(a, b) }
/** Unione di candidati dentro un gruppo OR (esportata per search.ts). */
export function unionCandidates(a: Uint32Array, b: Uint32Array): Uint32Array { return union(a, b) }
