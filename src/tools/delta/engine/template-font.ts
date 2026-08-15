/**
 * δ Pages — estrazione dei font INCORPORATI nel PDF del template (puro salvo
 * pdf-lib iniettato dal chiamante — mai import statico, stesso principio di
 * pdf-export.ts). La stragrande maggioranza dei cartigli esportati da CAD/BIM
 * incorpora i propri font (TrueType, `/FontFile2`) nel PDF: se li estraiamo e
 * li re-incorporiamo nel PDF generato, il testo dei campi esce nel font VERO
 * del cartiglio invece che in un'approssimazione (Helvetica).
 *
 * Copre i due casi realmente osservati sui cartigli censiti (studio,
 * commessa A123): font semplice con `/FontDescriptor` diretto, e font
 * composito `/Type0` con `/DescendantFonts` → CIDFont → `/FontDescriptor`
 * (il caso più comune per il testo CAD, che usa quasi sempre Type0/Identity-H).
 * Solo TrueType/OpenType (`FontFile2`/`FontFile3`, supportati da fontkit) —
 * i rari Type1 non incorporati come TrueType restano fuori: fontkit non li
 * legge, e non c'è nulla da estrarre se il font non è incorporato nel PDF.
 */

/** Vista minima di `window.PDFLib` che serve qui — solo i tipi, mai un import a runtime. */
export interface PdfLibLowLevel {
  PDFDocument: { load(bytes: Uint8Array, opts?: { ignoreEncryption?: boolean }): Promise<PdfLLDocument> }
  PDFName: { of(name: string): PdfLLName }
  PDFDict: unknown
  PDFRawStream: unknown
  decodePDFRawStream: (stream: unknown) => { decode(): Uint8Array }
}
interface PdfLLName { toString(): string }
interface PdfLLDict { get(key: PdfLLName): unknown; keys(): PdfLLName[] }
interface PdfLLPage { node: { Resources(): PdfLLDict | undefined } }
interface PdfLLContext { lookup(ref: unknown, type?: unknown): unknown }
interface PdfLLDocument { getPages(): PdfLLPage[]; context: PdfLLContext }

export interface ExtractedFont {
  /** Nome reale del font, senza il prefisso di subset (es. "ABCDEF+ArialMT" → "ArialMT"). */
  name: string
  bytes: Uint8Array
  /** Vero se il nome del font suggerisce un peso bold (es. "Arial-BoldMT"). */
  bold: boolean
}

const stripSubsetTag = (name: string): string => name.replace(/^[A-Z]{6}\+/, '')

function fontFileBytes(pdfLib: PdfLibLowLevel, ctx: PdfLLContext, fontDescriptor: PdfLLDict): Uint8Array | null {
  for (const key of ['FontFile2', 'FontFile3']) {
    const ref = fontDescriptor.get(pdfLib.PDFName.of(key))
    if (!ref) continue
    try {
      const stream = ctx.lookup(ref, pdfLib.PDFRawStream)
      return pdfLib.decodePDFRawStream(stream).decode()
    } catch { /* stream non decodificabile: si prova il prossimo FontFile* */ }
  }
  return null
}

function descriptorOf(pdfLib: PdfLibLowLevel, ctx: PdfLLContext, fontDict: PdfLLDict): PdfLLDict | null {
  const direct = fontDict.get(pdfLib.PDFName.of('FontDescriptor'))
  if (direct) return ctx.lookup(direct, pdfLib.PDFDict) as PdfLLDict
  // Font composito (Type0, il caso comune nei PDF da CAD): il descrittore vero
  // sta sul CIDFont discendente, non sul font Type0 stesso.
  const descendants = fontDict.get(pdfLib.PDFName.of('DescendantFonts'))
  if (!descendants) return null
  try {
    const arr = ctx.lookup(descendants) as { get(i: number): unknown }
    const cidFont = ctx.lookup(arr.get(0), pdfLib.PDFDict) as PdfLLDict
    const fd = cidFont.get(pdfLib.PDFName.of('FontDescriptor'))
    return fd ? (ctx.lookup(fd, pdfLib.PDFDict) as PdfLLDict) : null
  } catch { return null }
}

/**
 * Estrae tutti i font incorporati (TrueType/OpenType) nella PRIMA pagina del
 * PDF (l'unica che δ usa come template). Un font per BaseFont reale (dedup),
 * mai duplicati per via del subset tag.
 */
export async function extractEmbeddedFonts(pdfBytes: Uint8Array, pdfLib: PdfLibLowLevel): Promise<ExtractedFont[]> {
  try {
    const doc = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    const page = doc.getPages()[0]
    if (!page) return []
    const resources = page.node.Resources()
    if (!resources) return []
    const fontDictRef = resources.get(pdfLib.PDFName.of('Font'))
    if (!fontDictRef) return []
    const fontDict = doc.context.lookup(fontDictRef, pdfLib.PDFDict) as PdfLLDict
    const out: ExtractedFont[] = []
    const seen = new Set<string>()
    for (const key of fontDict.keys()) {
      try {
        const fRef = fontDict.get(key)
        const font = doc.context.lookup(fRef, pdfLib.PDFDict) as PdfLLDict
        const baseFontRaw = font.get(pdfLib.PDFName.of('BaseFont'))
        const rawName = baseFontRaw ? stripSubsetTag(String(baseFontRaw).replace(/^\//, '')) : ''
        if (!rawName || seen.has(rawName)) continue
        const fd = descriptorOf(pdfLib, doc.context, font)
        if (!fd) continue
        const bytes = fontFileBytes(pdfLib, doc.context, fd)
        if (!bytes || !bytes.length) continue
        seen.add(rawName)
        out.push({ name: rawName, bytes, bold: /bold/i.test(rawName) })
      } catch { /* una voce Font malformata non deve bloccare le altre */ }
    }
    return out
  } catch {
    return [] // template senza font incorporati (o illeggibile a questo livello): niente da estrarre, si userà Helvetica
  }
}

/** Il miglior font "regolare" tra quelli estratti: il primo non-bold, o il primo in assoluto se sono tutti bold. */
export function pickRegularFont(fonts: ExtractedFont[]): ExtractedFont | null {
  return fonts.find((f) => !f.bold) ?? fonts[0] ?? null
}
/** Il miglior font "grassetto": il primo flaggato bold nel NOME (mai sintetizzato). */
export function pickBoldFont(fonts: ExtractedFont[]): ExtractedFont | null {
  return fonts.find((f) => f.bold) ?? null
}
