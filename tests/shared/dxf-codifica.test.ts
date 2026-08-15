import { describe, it, expect } from 'vitest'
import { CodificatoreCp1252, leggiStreamConFallback, type CodificaDxf } from '../../src/shared/dxf-import/codifica'
import { AnalizzatoreDxf } from '../../src/shared/dxf-import/analizza'

/**
 * La codifica dei DXF ANSI: il caso italiano tipico è un file cp1252 con à/è/°
 * nei nomi layer e nei testi. La proprietà da difendere è la SIMMETRIA:
 * decodifica cp1252 → stringhe giuste (mai U+FFFD), e ri-codifica cp1252 →
 * gli stessi byte di partenza, così l'identità byte-per-byte del riscrittore
 * vale anche sui file ANSI.
 */

/** Un consumatore banale: accumula il testo decodificato. */
class Accumulo {
  testo = ''
  push(t: string) { this.testo += t }
}

const enc1252 = (s: string): Uint8Array<ArrayBuffer> => new CodificatoreCp1252().codifica(s)

describe('CodificatoreCp1252', () => {
  it('è l’inverso esatto di TextDecoder(windows-1252) su tutti i 256 byte', () => {
    // Vale sia col decoder WHATWG (0x80 → €) sia sui runtime senza ICU completo
    // che decadono a latin-1 (0x80 → U+0080): l'encoder accetta entrambe le rese.
    const byte = new Uint8Array(256)
    for (let i = 0; i < 256; i++) byte[i] = i
    const testo = new TextDecoder('windows-1252').decode(byte)
    const e = new CodificatoreCp1252()
    expect(Array.from(e.codifica(testo))).toEqual(Array.from(byte))
    expect(e.nonMappabili).toBe(0)
  })

  it('codifica gli speciali della fascia 0x80–0x9F', () => {
    const e = new CodificatoreCp1252()
    expect(Array.from(e.codifica('€…“”'))).toEqual([0x80, 0x85, 0x93, 0x94])
  })

  it('il carattere non rappresentabile diventa «?» e viene contato', () => {
    const e = new CodificatoreCp1252()
    expect(Array.from(e.codifica('a≥b'))).toEqual([0x61, 0x3F, 0x62])
    expect(e.nonMappabili).toBe(1)
  })
})

describe('leggiStreamConFallback', () => {
  const TESTO = '0\nTEXT\n8\nPARETE È\n1\nquota à 90°\n'

  it('un file UTF-8 valido passa al primo tentativo', async () => {
    const file = new File([TESTO], 'a.dxf') // Blob serializza le stringhe in UTF-8
    const chiamate: CodificaDxf[] = []
    const { consumatore, codifica } = await leggiStreamConFallback(file, (c) => { chiamate.push(c); return new Accumulo() })
    expect(codifica).toBe('utf-8')
    expect(chiamate).toEqual(['utf-8'])
    expect(consumatore.testo).toBe(TESTO)
  })

  it('un file cp1252 fa scattare il fallback: factory richiamata, niente U+FFFD', async () => {
    const file = new File([enc1252(TESTO)], 'ansi.dxf')
    const chiamate: CodificaDxf[] = []
    const { consumatore, codifica } = await leggiStreamConFallback(file, (c) => { chiamate.push(c); return new Accumulo() })
    expect(codifica).toBe('windows-1252')
    expect(chiamate).toEqual(['utf-8', 'windows-1252'])
    expect(consumatore.testo).toBe(TESTO)
    expect(consumatore.testo).not.toContain('�')
  })

  it('con la codifica già nota salta il tentativo UTF-8', async () => {
    const file = new File([enc1252(TESTO)], 'ansi.dxf')
    const chiamate: CodificaDxf[] = []
    const { codifica } = await leggiStreamConFallback(file, (c) => { chiamate.push(c); return new Accumulo() }, undefined, 'windows-1252')
    expect(codifica).toBe('windows-1252')
    expect(chiamate).toEqual(['windows-1252'])
  })

  it('il percorso di analisi di χ legge giusti i nomi layer accentati', async () => {
    // Lo stesso cablaggio di analizzaStream in χ: AnalizzatoreDxf dietro il fallback.
    const dxf = '0\nSECTION\n2\nENTITIES\n0\nLINE\n5\nA1\n8\nPARETE È\n10\n0\n20\n0\n0\nENDSEC\n0\nEOF\n'
    const file = new File([enc1252(dxf)], 'ansi.dxf')
    const { consumatore } = await leggiStreamConFallback(file, () => new AnalizzatoreDxf())
    const analisi = consumatore.chiudi()
    expect(analisi.layer.map(l => l.nome)).toContain('PARETE È')
  })
})
