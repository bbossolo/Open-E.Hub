import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts, PDFName, PDFDict } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { buildCoverPdfBytes, buildAllCoverPdfs, sanitizeFilename, fitFontSize, availWidth, fontCovers, sanitizeWinAnsi, wrapLines, layoutField } from '../../src/tools/delta/engine/pdf-export'
import type { DeltaState, CoverField, Template, ResolvedField } from '../../src/tools/delta/engine/types'

// pdf-lib "vero" (stessa istanza npm che verrà vendorizzata in vendor/pdf-lib.min.js):
// nessun mock, come da piano — così un rendering realmente sbagliato farebbe fallire i test.
const pdfLib = { PDFDocument, StandardFonts }

// 1×1 px PNG nero — dataUrl minimo valido per embedPng.
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const TPL: Template = { dataUrl: PNG_1PX, w: 850, h: 1200, kind: 'pdf', name: 't.pdf', ptW: 595, ptH: 842 }

function field(over: Partial<CoverField>): CoverField {
  return { id: 'f1', kind: 'fixed', label: 'C', x: 0.5, y: 0.5, anchor: 'mc', align: 'center', fontFrac: 0.03, ...over }
}

describe('δ pdf-export — sanitizeFilename', () => {
  it('rimuove i caratteri non validi nei nomi file', () => {
    expect(sanitizeFilename('A123_E_EL_PL_CTR-EL01a')).toBe('A123_E_EL_PL_CTR-EL01a')
    expect(sanitizeFilename('CP8/9-DR01a')).toBe('CP8_9-DR01a')
    expect(sanitizeFilename('Tit:olo "strano"')).not.toMatch(/[:"]/)
  })
  it('stringa vuota → fallback', () => {
    expect(sanitizeFilename('')).toBe('Copertina')
  })
})

describe('δ pdf-export — buildCoverPdfBytes', () => {
  it('produce un PDF vero, una pagina, alle dimensioni fisiche del template (ptW/ptH)', async () => {
    const page = { bg: TPL, fields: [{ text: 'Ciao', x: 0.5, y: 0.5, anchor: 'mc' as const, align: 'center' as const, fontFrac: 0.03, bold: false }] }
    const bytes = await buildCoverPdfBytes(page, pdfLib)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
    const reopened = await PDFDocument.load(bytes)
    expect(reopened.getPageCount()).toBe(1)
    const size = reopened.getPage(0).getSize()
    expect(size.width).toBeCloseTo(595, 0)
    expect(size.height).toBeCloseTo(842, 0)
  })
  it('senza ptW/ptH usa w/h del raster come fallback', async () => {
    const tplNoPt: Template = { dataUrl: PNG_1PX, w: 400, h: 600, kind: 'image', name: 'i.png' }
    const bytes = await buildCoverPdfBytes({ bg: tplNoPt, fields: [] }, pdfLib)
    const reopened = await PDFDocument.load(bytes)
    const size = reopened.getPage(0).getSize()
    expect(size.width).toBeCloseTo(400, 0)
    expect(size.height).toBeCloseTo(600, 0)
  })
})

/** BaseFont dei font usati nella pagina (per verificare quale font è finito nel PDF). */
async function baseFontsUsed(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes)
  const page = doc.getPages()[0]
  const resources = page.node.Resources()!
  const fontDict = doc.context.lookup(resources.get(PDFName.of('Font')), PDFDict)
  return fontDict.keys().map((k) => {
    const font = doc.context.lookup(fontDict.get(k), PDFDict)
    return String(font.get(PDFName.of('BaseFont')))
  })
}

describe('δ pdf-export — font del template (estratto dal PDF originale)', () => {
  it('font custom corrotto (bytes non validi) → fallback silenzioso su Helvetica, niente crash', async () => {
    const tplBadFont: Template = { ...TPL, fontRegularB64: Buffer.from('non sono affatto un font').toString('base64') }
    const page = { bg: tplBadFont, fields: [{ text: 'Testo', x: 0.5, y: 0.5, anchor: 'mc' as const, align: 'center' as const, fontFrac: 0.05, bold: false }] }
    const bytes = await buildCoverPdfBytes(page, pdfLib, fontkit)
    const names = await baseFontsUsed(bytes)
    expect(names.some((n) => n.includes('Helvetica'))).toBe(true)
  })

  it('senza fontRegularB64 → Helvetica come sempre (nessuna regressione)', async () => {
    const page = { bg: TPL, fields: [{ text: 'Testo', x: 0.5, y: 0.5, anchor: 'mc' as const, align: 'center' as const, fontFrac: 0.05, bold: false }] }
    const bytes = await buildCoverPdfBytes(page, pdfLib)
    const names = await baseFontsUsed(bytes)
    expect(names.some((n) => n.includes('Helvetica'))).toBe(true)
  })
})

describe('δ pdf-export — fitFontSize (auto-riduzione nei margini)', () => {
  // measure semplice: larghezza = numero caratteri × size (proporzionale, deterministico).
  const measure = (t: string, s: number) => t.length * s

  it('testo che ci sta già → size invariata', () => {
    expect(fitFontSize(measure, 'abc', 10, 100)).toBe(10) // 3×10=30 ≤ 100
  })
  it('testo che eccede → size ridotta per rientrare esattamente', () => {
    // 10 char × 10 = 100 > 50 disponibili → ratio 0.5 → size 5
    expect(fitFontSize(measure, '0123456789', 10, 50)).toBeCloseTo(5, 5)
  })
  it('mai sotto 1', () => {
    expect(fitFontSize(measure, '0123456789', 100, 1)).toBe(1)
  })
  it('avail ≤ 0 → size invariata (nessuna divisione per zero)', () => {
    expect(fitFontSize(measure, 'abc', 10, 0)).toBe(10)
    expect(fitFontSize(measure, 'abc', 10, -5)).toBe(10)
  })

  it('availWidth rispetta l\'ancora orizzontale', () => {
    // pagina larga 1000, campo a x=200, margine 15
    expect(availWidth('l', 200, 1000, 15)).toBeCloseTo(785, 5) // 1000-15-200
    expect(availWidth('r', 200, 1000, 15)).toBeCloseTo(185, 5) // 200-15
    // center: bordo più vicino è x=200 → 2×200 - 2×15 = 370
    expect(availWidth('c', 200, 1000, 15)).toBeCloseTo(370, 5)
  })

  it('un titolo lungo produce un PDF valido senza sbordare (non lancia)', async () => {
    const longTitle = 'Progetto esecutivo impianti elettrici e speciali — Titolo molto lungo dell\'elaborato'
    const page = { bg: TPL, fields: [{ text: longTitle, x: 0.02, y: 0.5, anchor: 'ml' as const, align: 'left' as const, fontFrac: 0.06, bold: false }] }
    const bytes = await buildCoverPdfBytes(page, pdfLib)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
  })
})

describe('δ pdf-export — copertura glifi (fix tofu trattino)', () => {
  it('fontCovers: testo vuoto → true; fk null → false (fallback sicuro)', () => {
    expect(fontCovers(null, '')).toBe(true)
    expect(fontCovers(null, 'x')).toBe(false)
  })
  it('fontCovers: true solo se OGNI codepoint è coperto', () => {
    const fk = { hasGlyphForCodePoint: (cp: number) => cp !== 0x2d } // NON copre "-"
    expect(fontCovers(fk, 'abc')).toBe(true)
    expect(fontCovers(fk, 'a-b')).toBe(false) // il trattino manca → fallback
  })

  it('sanitizeWinAnsi: en/em dash → "-", codepoint fuori WinAnsi → "?"', () => {
    expect(sanitizeWinAnsi('a-b')).toBe('a-b')
    expect(sanitizeWinAnsi('a–b—c')).toBe('a-b-c') // – —
    expect(sanitizeWinAnsi('à°é')).toBe('à°é') // dentro WinAnsi (≤ 0xFF)
    expect(sanitizeWinAnsi('x\u{1F600}y')).toBe('x?y') // emoji fuori range
  })

  it('testo con trattino/dash/° non fa fallire l\'export anche con font del template non-copertura', async () => {
    // font "corrotto" → embedTemplateFont ricade su Helvetica con covers()=true; ma il
    // punto è che l'export non deve MAI lanciare su questi caratteri.
    const tpl: Template = { ...TPL, fontRegularB64: Buffer.from('non un font').toString('base64') }
    const page = { bg: tpl, fields: [{ text: 'A-01 – 25° C', x: 0.5, y: 0.5, anchor: 'mc' as const, align: 'center' as const, fontFrac: 0.04, bold: false }] }
    const bytes = await buildCoverPdfBytes(page, pdfLib, fontkit)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
  })
})

describe('δ pdf-export — wrapLines (multi-riga)', () => {
  const measure = (t: string, s: number) => t.length * s // 1 char = size unità

  it('spezza il testo entro maxWidth ai confini di parola', () => {
    // maxWidth 50, size 10 → 5 char per riga
    const lines = wrapLines(measure, 'AAA BBB CCC', 10, 50)
    expect(lines).toEqual(['AAA', 'BBB', 'CCC'])
  })
  it('accorpa più parole se ci stanno', () => {
    const lines = wrapLines(measure, 'AA BB CC', 10, 90)
    expect(lines).toEqual(['AA BB CC'])
  })
  it('una parola più larga di maxWidth resta su una riga a sé', () => {
    const lines = wrapLines(measure, 'SUPERCALIFRAGILISTICO breve', 10, 60)
    expect(lines[0]).toBe('SUPERCALIFRAGILISTICO')
  })
  it('testo vuoto → una riga vuota', () => {
    expect(wrapLines(measure, '', 10, 50)).toEqual([''])
  })

  it('un campo con maxWidthFrac produce un PDF valido (blocco multi-riga)', async () => {
    const page = { bg: TPL, fields: [{ text: 'IMPIANTI ELETTRICI STIMA POTENZE QUADRO DI BASSA TENSIONE', x: 0.05, y: 0.4, anchor: 'tl' as const, align: 'left' as const, fontFrac: 0.04, bold: false, maxWidthFrac: 0.3 }] }
    const bytes = await buildCoverPdfBytes(page, pdfLib)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
  })
})

describe('δ pdf-export — layoutField (ogni campo è una casella di testo)', () => {
  // measure proporzionale e deterministico: larghezza = numero caratteri × size.
  const measure = (t: string, s: number) => t.length * s
  const rf = (over: Partial<ResolvedField>): ResolvedField =>
    ({ text: '', x: 0.05, y: 0.5, anchor: 'ml', align: 'left', fontFrac: 0.02, bold: false, ...over })
  // Pagina 1000×1000 → size = fontFrac × 1000 = 20; margine 1.5% = 15.
  const W = 1000, H = 1000

  it('SENZA maxWidthFrac: il testo lungo VA A CAPO e il corpo resta quello impostato', () => {
    const text = 'AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH IIII LLLL MMMM NNNN'
    const { lines, size } = layoutField(measure, rf({ text }), W, H)
    expect(size).toBe(20)             // NON ridotto (prima veniva scalato per stare su una riga)
    expect(lines.length).toBeGreaterThan(1)
    // ogni riga sta nella casella (dal campo al bordo, meno il margine)
    const maxW = availWidth('l', 0.05 * W, W, 0.015 * W)
    for (const l of lines) expect(measure(l, size)).toBeLessThanOrEqual(maxW)
  })

  it('testo corto → una riga sola, corpo invariato', () => {
    const { lines, size } = layoutField(measure, rf({ text: 'A1' }), W, H)
    expect(lines).toEqual(['A1'])
    expect(size).toBe(20)
  })

  it('CON maxWidthFrac: la casella è quella dichiarata (blocco invariato)', () => {
    const text = 'AAAA BBBB CCCC DDDD'
    const { lines, size } = layoutField(measure, rf({ text, anchor: 'tl', maxWidthFrac: 0.1 }), W, H)
    expect(size).toBe(20)
    for (const l of lines) expect(measure(l, size)).toBeLessThanOrEqual(100)
  })

  it('una PAROLA singola più larga della casella → unico caso in cui il corpo si riduce', () => {
    const { lines, size } = layoutField(measure, rf({ text: 'SUPERCALIFRAGILISTICO', anchor: 'tl', maxWidthFrac: 0.1 }), W, H)
    expect(lines).toEqual(['SUPERCALIFRAGILISTICO'])
    expect(size).toBeLessThan(20)
    expect(measure(lines[0], size)).toBeCloseTo(100, 5)
  })

  it('la larghezza della casella segue l\'ancora (l / r / c) come availWidth', () => {
    const long = 'X '.repeat(60).trim()
    for (const a of ['ml', 'mr', 'mc'] as const) {
      const { lines, size } = layoutField(measure, rf({ text: long, x: 0.2, anchor: a }), W, H)
      const maxW = availWidth(a[1] as 'l' | 'c' | 'r', 0.2 * W, W, 0.015 * W)
      for (const l of lines) expect(measure(l, size)).toBeLessThanOrEqual(maxW)
    }
  })

  it('campo appiccicato al bordo (nessuno spazio) → testo com\'è, non lancia', () => {
    const { lines } = layoutField(measure, rf({ text: 'abc', x: 0, anchor: 'mr' }), W, H)
    expect(lines).toEqual(['abc'])
  })

  it('CON maxHeightFrac: se il blocco sfora l\'altezza, il corpo si riduce finché ci sta (fit-in-box)', () => {
    const text = 'AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH'
    // casella stretta (10%) e bassa (3%): a corpo 20 il blocco multi-riga sfora
    const { lines, size } = layoutField(measure, rf({ text, anchor: 'tl', maxWidthFrac: 0.1, maxHeightFrac: 0.03 }), W, H)
    expect(size).toBeLessThan(20)
    expect(lines.length * size * 1.2).toBeLessThanOrEqual(30 + 1e-6) // sta nei 30px di casella
    for (const l of lines) expect(measure(l, size)).toBeLessThanOrEqual(100)
  })

  it('CON maxHeightFrac capiente: nessuna riduzione (il fit non tocca chi ci sta già)', () => {
    const { lines, size } = layoutField(measure, rf({ text: 'A1', anchor: 'tl', maxWidthFrac: 0.2, maxHeightFrac: 0.2 }), W, H)
    expect(lines).toEqual(['A1'])
    expect(size).toBe(20)
  })

  it('la casella può essere PIÙ STRETTA del testo: va a capo, non blocca la larghezza', () => {
    // 4 parole da 4 caratteri: a corpo 20 ognuna è larga 80 > casella 50 →
    // riduzione per parola singola, mai testo su una riga fuori casella
    const { lines, size } = layoutField(measure, rf({ text: 'AAAA BBBB', anchor: 'tl', maxWidthFrac: 0.05 }), W, H)
    for (const l of lines) expect(measure(l, size)).toBeLessThanOrEqual(50 + 1e-6)
  })
})

describe('δ pdf-export — buildAllCoverPdfs', () => {
  function stateWithRows(rows: Record<string, string>[]): DeltaState {
    return {
      v: 1,
      template: TPL,
      fields: [field({ kind: 'variable', column: 'CODICE ELABORATO', label: 'Codice' })],
      elenco: { headers: ['CODICE ELABORATO'], rows, fileName: 'e.xlsx' },
    }
  }

  it('un PDF distinto per riga, nominato dalla colonna scelta', async () => {
    const state = stateWithRows([
      { 'CODICE ELABORATO': 'A123_E_EL_RT_GEN-EL01a' },
      { 'CODICE ELABORATO': 'A123_E_EL_PL_EXT-DR01a' },
      { 'CODICE ELABORATO': 'A123_E_EL_PL_EXT-DR02a' },
    ])
    const out = await buildAllCoverPdfs(state, 'CODICE ELABORATO', pdfLib)
    expect(out).toHaveLength(3)
    expect(out.map(o => o.name)).toEqual([
      'A123_E_EL_RT_GEN-EL01a.pdf', 'A123_E_EL_PL_EXT-DR01a.pdf', 'A123_E_EL_PL_EXT-DR02a.pdf',
    ])
    // bytes distinti e tutti PDF validi
    for (const o of out) expect(String.fromCharCode(...o.bytes.slice(0, 4))).toBe('%PDF')
    expect(out[0].bytes).not.toEqual(out[1].bytes)
  })

  it('nomi duplicati (colonna non univoca) → suffisso -2, -3…', async () => {
    const state = stateWithRows([{ 'CODICE ELABORATO': 'X' }, { 'CODICE ELABORATO': 'X' }, { 'CODICE ELABORATO': 'X' }])
    const out = await buildAllCoverPdfs(state, 'CODICE ELABORATO', pdfLib)
    expect(out.map(o => o.name)).toEqual(['X.pdf', 'X-2.pdf', 'X-3.pdf'])
  })

  it('nessuna colonna nome-file scelta → fallback Copertina-N', async () => {
    const state = stateWithRows([{ 'CODICE ELABORATO': 'A' }, { 'CODICE ELABORATO': 'B' }])
    const out = await buildAllCoverPdfs(state, null, pdfLib)
    expect(out.map(o => o.name)).toEqual(['Copertina-1.pdf', 'Copertina-2.pdf'])
  })

  it('progress callback invocato per ogni pagina', async () => {
    const state = stateWithRows([{ 'CODICE ELABORATO': 'A' }, { 'CODICE ELABORATO': 'B' }])
    const calls: Array<[number, number]> = []
    await buildAllCoverPdfs(state, null, pdfLib, (done, total) => calls.push([done, total]))
    expect(calls).toEqual([[1, 2], [2, 2]])
  })
})
