/**
 * GOLDEN SET dei glifi dei tool (μ β δ χ α) come VETTORIALI.
 *
 * I glifi NON sono più caratteri di font (`<span>μ</span>`) ma path SVG estratti
 * da **JetBrains Mono ExtraBold** (OFL): identici su ogni OS e in OGNI output
 * (welcome card, nav, header, NOMI dei tool, PDF, DXF) — immuni dal font-loading
 * e dal fallback di sistema. Regola: il glifo di un tool è SEMPRE questo vettoriale,
 * MAI un carattere di font (che a volte cadeva su un μ di sistema «senza apice»).
 *
 * L'ε (marchio Open E.Hub) NON è qui: ha il suo tracciato golden dedicato, in
 * `./brand-mark` (è un LOGO, non una lettera del set tool).
 *
 * viewBox condiviso `0 -800 600 1000`: baseline a y=0, advance monospace 600,
 * gabbia em 1000 → i glifi occupano lo stesso spazio di un carattere di font
 * (height 1em, width .6em) e restano mutuamente coerenti.
 */

export type ToolGlyphKey = 'mu' | 'alfa' | 'beta' | 'delta' | 'chi'

export const TOOL_GLYPH_VIEWBOX = '0 -800 600 1000'

/** Path SVG (asse Y già ribaltato per lo spazio SVG) — JetBrains Mono ExtraBold. */
export const TOOL_GLYPH_PATHS: Record<ToolGlyphKey, string> = {
  mu: 'M66 180V-550H216V-210Q216 -167 239.0 -143.5Q262 -120 303 -120Q344 -120 367.0 -143.5Q390 -167 390 -210V-550H540V0H390L395 -105H393Q387 -51 363.5 -20.5Q340 10 303 10Q266 10 242.5 -20.5Q219 -51 213 -105H211L216 30V180Z',
  // α — stessa pipeline (fonttools varLib.instancer wght=800 sul greco variabile, poi
  // opentype.js).
  alfa: 'M243 10Q160 10 110 -48.5Q60 -107 60 -205L60 -345Q60 -443 110 -501.5Q160 -560 243 -560Q311 -560 349 -520.5Q387 -481 387 -410L354 -445L389 -445L389 -550L534 -550L534 0L389 0L389 -105L354 -105L387 -140Q387 -69 349 -29.5Q311 10 243 10ZM297 -120Q338 -120 361 -143.5Q384 -167 384 -210L384 -340Q384 -383 361 -406.5Q338 -430 297 -430Q255 -430 232.5 -407Q210 -384 210 -340L210 -210Q210 -167 232.5 -143.5Q255 -120 297 -120Z',
  // β — stessa pipeline (fonttools varLib.instancer wght=800 sul greco variabile, poi
  // SVGPathPen con Y ribaltata): ExtraBold, stesso viewBox/advance del set. Ha una discesa
  // sotto la baseline (y fino a +180), come da disegno della lettera.
  beta: 'M60 180V-516Q60 -583 89.5 -633.5Q119 -684 172 -712Q225 -740 296 -740Q372 -740 428 -715.5Q484 -691 515.5 -647.5Q547 -604 547 -545Q547 -482 513.5 -441.5Q480 -401 418 -387Q483 -371 521.5 -324Q560 -277 560 -209Q560 -147 529 -99.5Q498 -52 442.5 -26Q387 0 312 0H195V180ZM195 -125H307Q355 -125 382 -150.5Q409 -176 409 -221Q409 -266 381.5 -292Q354 -318 307 -318H260V-428H305Q347 -428 371.5 -452Q396 -476 396 -517Q396 -562 369 -588.5Q342 -615 295 -615Q249 -615 222 -588.5Q195 -562 195 -516Z',
  // δ — stessa pipeline (fonttools varLib.instancer wght=800 su jetbrains-mono-greek
  // variabile → SVGPathPen con Y ribaltata): ExtraBold, stesso viewBox/advance del set.
  delta: 'M40 -227Q40 -286 64.5 -334Q89 -382 132 -411Q175 -440 230 -440Q257 -440 277.5 -433.5Q298 -427 311 -414L317 -420L94 -607V-730H495V-607H269L440 -469Q472 -443 499.5 -408Q527 -373 543.5 -329.6Q560 -286.2 560 -234Q560 -163.2 526.5 -107.6Q493 -52 434.5 -21Q376 10 300.3 10Q224.5 10 165.8 -20.5Q107 -51 73.5 -105Q40 -159 40 -227ZM193 -233Q193 -200 206.5 -174.5Q220 -149 244.3 -134.5Q268.6 -120 299.9 -120Q332 -120 356 -134.5Q380 -149 393.5 -174.5Q407 -200 407 -233Q407 -266 393.5 -294Q380 -322 355.9 -339Q331.9 -356 300 -356Q269 -356 244.5 -339Q220 -322 206.5 -294Q193 -266 193 -233Z',
  // χ — stessa pipeline (fonttools varLib.instancer wght=800 sul greco variabile →
  // SVGPathPen con Y ribaltata). Come β, scende sotto la baseline: le due code della X
  // arrivano a y=+180, ed è il disegno della lettera, non un errore di estrazione.
  chi: 'M20 180 216 -197 33 -550H198L274 -390Q285 -368 292.5 -350Q300 -332 302 -324Q304 -332 311 -350Q318 -368 328 -390L406 -550H567L384 -197L580 180H415L327 0Q317 -22 309 -41Q301 -60 297 -70Q294 -60 287 -41Q280 -22 269 0L181 180Z',
}

/** Il glifo del tool per la LETTERA greca iniziale (per vettorializzare i NOMI). */
export const NAME_LEAD_GLYPH: Record<string, ToolGlyphKey> = {
  'μ': 'mu', 'α': 'alfa', 'β': 'beta', 'δ': 'delta', 'χ': 'chi',
}

/**
 * Rende un NOME di tool con la lettera greca iniziale come SVG vettoriale
 * (`.ehb-name-glyph`) + il resto come testo. Coerenza totale: il glifo del tool
 * non è MAI un carattere di font, nemmeno dentro «μ Prezzi».
 */
export function nameWithGlyph(name: string): string {
  if (!name) return ''
  const key = NAME_LEAD_GLYPH[name[0]]
  if (!key) return name
  return `<span class="ehb-name-glyph">${toolGlyphSvg(key)}</span>${name.slice(1)}`
}

/** Tool-id della suite (data-tool / hub registry) → chiave glifo del set. */
export const TOOL_GLYPH_KEY: Record<string, ToolGlyphKey> = {
  miu: 'mu',
  mu: 'mu',
  alfa: 'alfa',
  beta: 'beta',
  delta: 'delta',
  chi: 'chi',
}

/** SVG inline del glifo (fill:currentColor → eredita l'accento del contenitore). */
export function toolGlyphSvg(key: ToolGlyphKey, cls = ''): string {
  const cl = cls ? ` ${cls}` : ''
  return `<svg class="ehb-glyph-svg${cl}" viewBox="${TOOL_GLYPH_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${TOOL_GLYPH_PATHS[key]}" fill="currentColor"/></svg>`
}

/** Come sopra, ma partendo dal tool-id (ritorna '' se non è un tool con glifo). */
export function toolGlyphSvgById(toolId: string, cls = ''): string {
  const key = TOOL_GLYPH_KEY[toolId]
  return key ? toolGlyphSvg(key, cls) : ''
}
