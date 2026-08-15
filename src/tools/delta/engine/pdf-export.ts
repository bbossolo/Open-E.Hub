/**
 * δ Pages — generazione di PDF veri, UNO per copertina (puro salvo pdf-lib
 * iniettato dal chiamante — mai import statico: pdf-lib resta un vendor
 * caricato a runtime via `loadPdfLib()`, come xlsx/jszip/pdf.js).
 *
 * Il testo dei campi è disegnato con `page.drawText`, replicando lo stesso
 * schema a 9 ancore già usato nell'editor SVG (`drawCover` in main.js):
 * allineamento orizzontale via larghezza testo misurata, verticale via
 * `firstBaselineOffset` (cover-model.ts) — misurato sulle MAIUSCOLE e quindi
 * indipendente dal font effettivo del campo: un cartiglio col font in subset
 * fa ripiegare qualche campo su Helvetica, e i valori devono restare allineati
 * tra loro e con le etichette stampate. PDF-lib disegna dalla BASELINE, in
 * coordinate y-up — l'editor lavora in frazioni y-down — da qui le conversioni.
 *
 * FONT DEL TEMPLATE: se `Template.fontRegularB64`/`fontBoldB64` sono presenti
 * (estratti dal PDF originale via `template-font.ts`), il testo dei campi usa
 * il font VERO del cartiglio invece di Helvetica — richiede `pdf-lib`
 * registrato con `fontkit` (altro vendor, `loadFontkit()`) per incorporare
 * font custom. Se l'embedding del font custom fallisce (bytes corrotti,
 * formato non supportato da fontkit) si ricade su Helvetica per quel
 * font/quella copertina, senza far fallire l'intero export.
 */
import { buildCoverDoc, fieldBoxWidthFrac, firstBaselineOffset, LINE_HEIGHT_FRAC } from './cover-model'
import type { CoverPage, DeltaState, ResolvedField, Template } from './types'
// Solo TIPI (erasi in build — mai un import a runtime): pdf-lib resta un vendor
// caricato via `loadPdfLib()` come xlsx/jszip/pdf.js, mai nel bundle inline.
import type { PDFDocument, PDFFont, PDFPage, StandardFonts } from 'pdf-lib'

/** `window.PDFLib` una volta caricato: gli stessi tipi reali della libreria (solo compile-time). */
export interface PdfLibModule {
  PDFDocument: typeof PDFDocument
  StandardFonts: typeof StandardFonts
}

/** base64 → bytes grezzi (funziona sia in browser che in Node/vitest: `atob` è globale in entrambi). */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** data:URL → bytes grezzi. */
function dataUrlBytes(dataUrl: string): Uint8Array {
  return b64ToBytes(dataUrl.slice(dataUrl.indexOf(',') + 1))
}

/** Margine minimo dai bordi pagina, come frazione della larghezza, per l'auto-riduzione. */
const MARGIN_FRAC = 0.015

/**
 * Larghezza disponibile per un campo secondo la sua ancora orizzontale e la x:
 * un campo left cresce verso destra, right verso sinistra, center in entrambe le
 * direzioni (limitato dal bordo più vicino). Serve a NON far sbordare il testo.
 */
export function availWidth(h: 'l' | 'c' | 'r', px: number, ptW: number, margin: number): number {
  return fieldBoxWidthFrac(`m${h}` as ResolvedField['anchor'], px / ptW, undefined, margin / ptW) * ptW
}

/**
 * Riduce la dimensione del font finché il testo rientra in `avail` (larghezza
 * disponibile). Puro e testabile: riceve `measure(text, size)` così non dipende
 * da pdf-lib. Se il testo già ci sta, `size` resta invariata; mai sotto 1.
 *
 * STORICA: i campi non sono più a riga singola (vedi `layoutField`), quindi il
 * disegno non la usa più — resta esportata perché è il modo di rimpicciolire un
 * testo per farlo rientrare in una larghezza, ed è coperta da test.
 */
export function fitFontSize(measure: (text: string, size: number) => number, text: string, size: number, avail: number): number {
  if (avail <= 0) return size
  const width = measure(text, size)
  if (width <= avail) return size
  return Math.max(1, size * (avail / width))
}

/**
 * Spezza `text` in righe che stanno entro `maxWidth` (wrap ai confini di parola,
 * greedy). Puro/testabile: riceve `measure(text,size)`. Una parola singola più
 * larga di `maxWidth` resta su una riga a sé (poi rimpicciolita dal chiamante).
 */
export function wrapLines(measure: (text: string, size: number) => number, text: string, size: number, maxWidth: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let cur = words[0]
  for (let i = 1; i < words.length; i++) {
    const test = `${cur} ${words[i]}`
    if (measure(test, size) <= maxWidth) cur = test
    else { lines.push(cur); cur = words[i] }
  }
  lines.push(cur)
  return lines
}

/**
 * Impagina il testo di UN campo: righe già spezzate + dimensione finale del font.
 * Puro/testabile (riceve `measure(text,size)`).
 *
 * OGNI campo è una CASELLA DI TESTO: manda a capo entro la larghezza della sua
 * casella (`fieldBoxWidthFrac`) e **conserva il corpo impostato** — non lo scala
 * per far stare tutto su una riga. Le riduzioni automatiche sono due sole:
 *  · una PAROLA singola più larga della casella (il wrap non può nulla);
 *  · il blocco multi-riga più ALTO di `maxHeightFrac`, se dichiarata: la
 *    casella è un'area fissa e il corpo scende finché il testo ci sta.
 */
export function layoutField(
  measure: (text: string, size: number) => number,
  rf: ResolvedField,
  ptW: number,
  ptH: number,
): { lines: string[]; size: number } {
  let size = Math.max(1, rf.fontFrac * ptH)
  const maxW = fieldBoxWidthFrac(rf.anchor, rf.x, rf.maxWidthFrac, MARGIN_FRAC) * ptW
  if (maxW <= 0) return { lines: [rf.text], size } // campo sul bordo: niente spazio da misurare
  let lines = wrapLines(measure, rf.text, size, maxW)
  const widest = Math.max(...lines.map((l) => measure(l, size)))
  if (widest > maxW) {
    size = Math.max(1, size * (maxW / widest))
    lines = wrapLines(measure, rf.text, size, maxW)
  }
  // Fit-in-box verticale: col corpo più piccolo il wrap può produrre meno
  // righe, quindi si itera (converge in pochi giri; guardia a 6).
  const maxH = (rf.maxHeightFrac ?? 0) * ptH
  for (let i = 0; maxH > 0 && size > 1 && lines.length * size * LINE_HEIGHT_FRAC > maxH && i < 6; i++) {
    size = Math.max(1, size * (maxH / (lines.length * size * LINE_HEIGHT_FRAC)))
    lines = wrapLines(measure, rf.text, size, maxW)
  }
  return { lines, size }
}

function drawField(page: PDFPage, rf: ResolvedField, ptW: number, ptH: number, regular: FieldFont, bold: FieldFont): void {
  if (!rf.text) return
  const ff = rf.bold ? bold : regular
  // Fallback per-campo: se il font del template non copre TUTTI i glifi del testo
  // (font subset del cartiglio → il trattino ed altri glifi mancano = box/tofu),
  // si disegna quel campo in Helvetica, che copre l'ASCII incluso "-".
  const usesFallback = !ff.covers(rf.text)
  const font = usesFallback ? ff.fallback : ff.font
  // Helvetica è WinAnsi-only e lancia sui codepoint fuori WinAnsi: sanifica il testo.
  const text = usesFallback ? sanitizeWinAnsi(rf.text) : rf.text
  const measure = (t: string, s: number): number => font.widthOfTextAtSize(t, s)
  const h = rf.anchor[1] // l | c | r
  const px = rf.x * ptW
  const py = ptH - rf.y * ptH
  const { lines, size } = layoutField(measure, { ...rf, text }, ptW, ptH)
  const lineH = size * LINE_HEIGHT_FRAC
  // Baseline della prima riga secondo l'ancora verticale del BLOCCO multi-riga.
  // L'offset è misurato sulle MAIUSCOLE (non sulle metriche del font scelto):
  // così un campo non si sposta a seconda che il template copra o no i suoi
  // glifi, e la quota è identica a quella dell'editor e dell'HTML di stampa.
  const y0 = py - firstBaselineOffset(rf.anchor, size, lines.length)
  lines.forEach((ln, i) => {
    const w = measure(ln, size)
    const x = h === 'l' ? px : h === 'r' ? px - w : px - w / 2
    page.drawText(ln, { x, y: y0 - i * lineH, size, font })
  })
}

/** Font effettivo di un campo: il font scelto (template o Helvetica), un checker
 *  di copertura per-glifo, e il fallback Helvetica per i campi non coperti. */
interface FieldFont {
  font: PDFFont
  covers: (text: string) => boolean
  fallback: PDFFont
}

/** Vista minima di un font fontkit: basta `hasGlyphForCodePoint` per la copertura. */
interface FontkitFont { hasGlyphForCodePoint(cp: number): boolean }
interface FontkitModule { create(bytes: Uint8Array): FontkitFont }

/**
 * Vero se `fk` ha un glifo per OGNI codepoint di `text`. Se `fk` è null (fontkit
 * non disponibile: non possiamo verificare) ⇒ false, così si preferisce il
 * fallback sicuro invece di rischiare il tofu. Testo vuoto ⇒ true.
 */
export function fontCovers(fk: FontkitFont | null, text: string): boolean {
  if (!text) return true
  if (!fk) return false
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp == null || !fk.hasGlyphForCodePoint(cp)) return false
  }
  return true
}

/**
 * Sanifica il testo per Helvetica (WinAnsi-only): i codepoint fuori dal range
 * WinAnsi (> 0x255) sono rimpiazzati per evitare che `drawText` lanci. En/em dash
 * e simili diventano "-"; gli altri diventano "?".
 */
export function sanitizeWinAnsi(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp <= 0xff) out += ch
    else if (cp === 0x2010 || cp === 0x2011 || cp === 0x2012 || cp === 0x2013 || cp === 0x2014 || cp === 0x2212) out += '-'
    else out += '?'
  }
  return out
}

/** Un font incorporato di `pdf-lib` con fontkit — nessun tipo pubblico esportato
 *  da pdf-lib per l'oggetto fontkit stesso: resta opaco, solo passato a `registerFontkit`.
 *  Ritorna il `FieldFont` col checker di copertura e il fallback Helvetica. */
async function embedTemplateFont(pdfDoc: import('pdf-lib').PDFDocument, b64: string | undefined, fontkit: unknown, fallback: PDFFont): Promise<FieldFont> {
  if (!b64) return { font: fallback, covers: () => true, fallback }
  try {
    if (fontkit) pdfDoc.registerFontkit(fontkit as Parameters<typeof pdfDoc.registerFontkit>[0])
    const bytes = b64ToBytes(b64)
    const font = await pdfDoc.embedFont(bytes)
    let fk: FontkitFont | null = null
    try { fk = fontkit ? (fontkit as FontkitModule).create(bytes) : null } catch { fk = null }
    return { font, covers: (text) => fontCovers(fk, text), fallback }
  } catch {
    return { font: fallback, covers: () => true, fallback } // font del template corrotto/non supportato: Helvetica, l'export non si blocca
  }
}

/** Costruisce il PDF (un solo file, una pagina) di UNA copertina già risolta.
 *  `fontkit` è richiesto solo se `page.bg` porta un font custom (`fontRegularB64`/
 *  `fontBoldB64`) — omettilo per il solo Helvetica standard. */
export async function buildCoverPdfBytes(page: CoverPage, pdfLib: PdfLibModule, fontkit?: unknown): Promise<Uint8Array> {
  const pdfDoc = await pdfLib.PDFDocument.create()
  const ptW = page.bg.ptW && page.bg.ptW > 0 ? page.bg.ptW : page.bg.w
  const ptH = page.bg.ptH && page.bg.ptH > 0 ? page.bg.ptH : page.bg.h
  const pdfPage = pdfDoc.addPage([ptW, ptH])
  const bytes = dataUrlBytes(page.bg.dataUrl)
  const img = /^data:image\/png/i.test(page.bg.dataUrl) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
  pdfPage.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH })
  const helv = await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica)
  const helvBold = await pdfDoc.embedFont(pdfLib.StandardFonts.HelveticaBold)
  const tpl = page.bg as Template
  const regular = await embedTemplateFont(pdfDoc, tpl.fontRegularB64, fontkit, helv)
  // Bold: solo se il template incorpora DAVVERO un peso bold — mai sintetizzato.
  const bold: FieldFont = tpl.fontBoldB64
    ? await embedTemplateFont(pdfDoc, tpl.fontBoldB64, fontkit, helvBold)
    : { font: helvBold, covers: () => true, fallback: helvBold }
  for (const rf of page.fields) drawField(pdfPage, rf, ptW, ptH, regular, bold)
  return pdfDoc.save()
}

export interface GeneratedPdf { name: string; bytes: Uint8Array }

/** Nome file (senza estensione) sanificato: niente caratteri non validi su Windows/macOS/Linux. */
export function sanitizeFilename(name: string): string {
  const clean = String(name || '').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120)
  return clean || 'Copertina'
}

function filenameFor(row: Record<string, string> | null, index: number, filenameColumn?: string | null): string {
  const raw = filenameColumn && row ? row[filenameColumn] : ''
  return raw && raw.trim() ? sanitizeFilename(raw) : `Copertina-${index + 1}`
}

/**
 * Genera un PDF per OGNI riga dell'elenco (o uno solo, senza elenco): mai un
 * unico multipagina. Nomi derivati dalla colonna `filenameColumn` se scelta e
 * presente in ogni riga, altrimenti `Copertina-N`; le collisioni di nome
 * (colonna non univoca) sono disambiguate con un suffisso `-2`, `-3`…
 */
export async function buildAllCoverPdfs(
  state: DeltaState,
  filenameColumn: string | null | undefined,
  pdfLib: PdfLibModule,
  onProgress?: (done: number, total: number) => void,
  fontkit?: unknown,
): Promise<GeneratedPdf[]> {
  const doc = buildCoverDoc(state)
  const rows = state.elenco ? state.elenco.rows : []
  const out: GeneratedPdf[] = []
  const used = new Map<string, number>()
  for (let i = 0; i < doc.pages.length; i++) {
    const bytes = await buildCoverPdfBytes(doc.pages[i], pdfLib, fontkit)
    let name = filenameFor(rows[i] ?? null, i, filenameColumn)
    const seen = used.get(name) ?? 0
    used.set(name, seen + 1)
    if (seen > 0) name = `${name}-${seen + 1}`
    out.push({ name: `${name}.pdf`, bytes })
    onProgress?.(i + 1, doc.pages.length)
  }
  return out
}
