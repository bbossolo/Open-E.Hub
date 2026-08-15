import { describe, it, expect } from 'vitest'
import { DxfBuilder, dxfBegin, dxfEnd, line, dtext } from '../../src/shared/dxf'

/**
 * Fondamenta DXF condivise — regressione Windows: i file DXF devono usare fine-riga
 * CRLF (standard DXF). Con LF-only i lettori Windows (AutoCAD/importer CAD) corrompono
 * il disegno. Vale per TUTTI gli export DXF della suite: passano da questo builder.
 */
describe('shared/dxf — fine-riga CRLF (compat Windows/AutoCAD)', () => {
  function sample(): string {
    const b = new DxfBuilder(100)
    dxfBegin(b, { extMax: [10, 10], layers: [{ name: 'L', color: 7 }] })
    line(b, 'L', 0, 0, 10, 10)
    dtext(b, 'L', 1, 1, 3, 'ciao')
    return dxfEnd(b)
  }

  it('usa CRLF, mai LF «nudo»', () => {
    const dxf = sample()
    expect(dxf.includes('\r\n')).toBe(true)
    // ogni \n è preceduto da \r (nessun LF solitario)
    expect(/[^\r]\n/.test(dxf)).toBe(false)
  })

  it('struttura DXF valida (coppie code/value, header AC1018)', () => {
    const dxf = sample()
    expect(dxf.startsWith('0\r\nSECTION')).toBe(true)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
    // numero di righe PARI (coppie group-code/valore)
    expect(dxf.trimEnd().split(/\r\n/).length % 2).toBe(0)
    expect(dxf).toContain('AC1018')
  })

  it('non emette MAI token non finiti (NaN/Infinity) — corrompono il file su AutoCAD', () => {
    // Coordinate NaN/Infinity (es. da una geometria degenere) NON devono finire nel DXF:
    // il builder le azzera, così il file resta apribile (regressione «DXF corrotto su Windows»).
    const b = new DxfBuilder(0)
    dxfBegin(b, { extMax: [10, 10], layers: [{ name: 'L', color: 7 }] })
    b.g(0, 'LINE'); b.g(8, 'L')
    b.g(10, NaN); b.g(20, Infinity); b.g(30, 0)
    b.g(11, -Infinity); b.g(21, NaN); b.g(31, 0)
    const dxf = dxfEnd(b)
    expect(dxf).not.toMatch(/NaN|Infinity/)
    expect(dxf).toMatch(/\r\n10\r\n0\r\n/) // il NaN è diventato 0
  })
})
