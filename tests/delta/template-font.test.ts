import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as PDFLibNS from 'pdf-lib'
import { extractEmbeddedFonts, pickRegularFont, pickBoldFont } from '../../src/tools/delta/engine/template-font'

describe('δ template-font — extractEmbeddedFonts', () => {
  it('PDF senza font (pagina vuota, solo grafica) → nessun font estratto', async () => {
    const doc = await PDFLibNS.PDFDocument.create()
    doc.addPage([100, 100])
    const bytes = await doc.save()
    const fonts = await extractEmbeddedFonts(bytes, PDFLibNS as any)
    expect(fonts).toEqual([])
  })

  it('PDF con SOLO font standard (StandardFonts, mai incorporati come FontFile) → nessun font estratto', async () => {
    const doc = await PDFLibNS.PDFDocument.create()
    const page = doc.addPage([200, 100])
    const font = await doc.embedFont(PDFLibNS.StandardFonts.Helvetica)
    page.drawText('Ciao', { x: 10, y: 10, size: 12, font })
    const bytes = await doc.save()
    const fonts = await extractEmbeddedFonts(bytes, PDFLibNS as any)
    expect(fonts).toEqual([])
  })

  it('bytes non-PDF → nessun errore, nessun font (fallback silenzioso)', async () => {
    const fonts = await extractEmbeddedFonts(new Uint8Array([1, 2, 3, 4]), PDFLibNS as any)
    expect(fonts).toEqual([])
  })

  it('pickRegularFont/pickBoldFont: preferenze corrette su un set misto', () => {
    const regular = { name: 'ArialMT', bytes: new Uint8Array(), bold: false }
    const bold = { name: 'Arial-BoldMT', bytes: new Uint8Array(), bold: true }
    expect(pickRegularFont([regular, bold])).toBe(regular)
    expect(pickBoldFont([regular, bold])).toBe(bold)
    expect(pickBoldFont([regular])).toBeNull()
    expect(pickRegularFont([bold])).toBe(bold) // solo bold disponibile: meglio che niente
    expect(pickRegularFont([])).toBeNull()
  })
})

describe('δ template-font — su un cartiglio reale (se presente su Desktop)', () => {
  const realPath = 'C:/Users/dev/Desktop/1 vuoto.pdf'
  const has = fs.existsSync(realPath)
  it.skipIf(!has)('estrae ArialMT e TwCenMT-Regular da un cartiglio di studio', async () => {
    const bytes = fs.readFileSync(realPath)
    const fonts = await extractEmbeddedFonts(new Uint8Array(bytes), PDFLibNS as any)
    const names = fonts.map(f => f.name)
    expect(names).toContain('ArialMT')
    expect(fonts.every(f => f.bytes.length > 0)).toBe(true)
    expect(pickRegularFont(fonts)?.name).toBe('ArialMT')
  })
})
