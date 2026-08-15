import { describe, it, expect } from 'vitest'
import { DxfBuilder, dxfBegin, dxfEnd } from '../../src/shared/dxf'
import {
  textOutline, measureText, roundedRect, svgPathToPolylines,
  dxfCartiglioBanda, HIDDEN_TEXT_LAYER_DEF, DXF_HIDDEN_TEXT_LAYER,
} from '../../src/shared/dxf-doc'
import { DXF_FONTS } from '../../src/shared/dxf-glyphs'
import { TOOL_GLYPH_PATHS } from '../../src/shared/ui/glyphs'

/**
 * PAGINA DOCUMENTO in DXF (golden standard «fedele al PDF»): testi come CONTORNI dei
 * glifi veri + gemello TEXT ricercabile su layer spento, angoli arrotondati con bulge,
 * cartiglio banda col brand ε/tool. Il riferimento utente contiene SOLO LWPOLYLINE.
 */

function makeBuilder(): DxfBuilder {
  const b = new DxfBuilder(297)
  dxfBegin(b, { extMax: [210, 297], layers: [{ name: 'L', color: 7 }, { name: 'CARTIGLIO', color: 7 }, HIDDEN_TEXT_LAYER_DEF] })
  return b
}

describe('dxf-glyphs — dati generati dai font dei PDF', () => {
  it('le 3 face (arimo, arimo-bold, mono) coprono ASCII + accentate + greche dei tool', () => {
    for (const face of ['arimo', 'arimo-bold', 'mono'] as const) {
      const F = DXF_FONTS[face]
      for (const ch of 'AZaz09 ·×°àèìòù') expect(F[ch], `${face} '${ch}'`).toBeTruthy()
      for (const ch of 'πφωμτλε') expect(F[ch], `${face} '${ch}'`).toBeTruthy()
      // glifo visibile → contorni non vuoti; advance em plausibile
      expect(F['A']!.c.length).toBeGreaterThan(0)
      expect(F['A']!.adv).toBeGreaterThan(0.2)
      expect(F['A']!.adv).toBeLessThan(1.5)
    }
  })

  it('mono è monospaziato, arimo è proporzionale', () => {
    expect(DXF_FONTS.mono['i']!.adv).toBeCloseTo(DXF_FONTS.mono['W']!.adv, 3)
    expect(DXF_FONTS.arimo['i']!.adv).toBeLessThan(DXF_FONTS.arimo['W']!.adv)
  })
})

describe('textOutline — testo a contorni + gemello ricercabile', () => {
  it('emette LWPOLYLINE chiuse per i glifi e UNA TEXT sul layer nascosto', () => {
    const b = makeBuilder()
    textOutline(b, 'L', 10, 100, 5, 'AB 61439')
    const dxf = dxfEnd(b)
    const polys = (dxf.match(/\r?\nLWPOLYLINE\r?\n/g) || []).length
    expect(polys).toBeGreaterThanOrEqual(6) // A=2 contorni, B=3, cifre ≥1 l'una
    expect(dxf).toContain('61439') // ricercabile
    expect(dxf).toContain(DXF_HIDDEN_TEXT_LAYER)
  })

  it('measureText cresce con la stringa e scala con il corpo', () => {
    expect(measureText('AAA', 10)).toBeCloseTo(3 * measureText('A', 10), 3)
    expect(measureText('A', 20)).toBeCloseTo(2 * measureText('A', 10), 3)
  })

  it('caratteri fuori charset → fallback asciiSafe, mai crash', () => {
    const b = makeBuilder()
    textOutline(b, 'L', 0, 0, 5, '猫 ok')
    expect(dxfEnd(b)).toContain('EOF')
  })
})

describe('roundedRect — angoli come archi veri (bulge)', () => {
  it('emette una LWPOLYLINE chiusa con 8 vertici e bulge ±tan(22.5°)', () => {
    const b = makeBuilder()
    roundedRect(b, 'L', 10, 10, 100, 50, 5)
    const dxf = dxfEnd(b)
    expect(dxf).toMatch(/\r\n42\r\n-?0\.41421\r\n/)
  })

  it('raggio 0 → rettangolo netto senza bulge', () => {
    const b = makeBuilder()
    roundedRect(b, 'L', 10, 10, 100, 50, 0)
    expect(dxfEnd(b)).not.toContain('0.41421')
  })
})

describe('svgPathToPolylines — appiattimento path (glifi tool + marchio ε)', () => {
  it('appiattisce i TOOL_GLYPH_PATHS in contorni chiusi non degeneri', () => {
    for (const key of ['mu', 'beta', 'delta'] as const) {
      const cs = svgPathToPolylines(TOOL_GLYPH_PATHS[key])
      expect(cs.length).toBeGreaterThan(0)
      for (const c of cs) expect(c.length).toBeGreaterThan(2)
    }
  })
})

describe('dxfCartiglioBanda — la banda dei PDF nel DXF', () => {
  it('porta colonna a sinistra (niente più blocco tool pieno/glifo), brand E.HUB, titolo/sottotitolo/disclaimer ricercabili', () => {
    const b = makeBuilder()
    dxfCartiglioBanda(b, {
      x: 12, y: 261, w: 186, h: 24,
      toolTag: 'μ Prezzi', accent: [178, 58, 92],
      title: 'QUADRO 1', subtitle: 'Resi9 MP - 357x500x108 mm', disclaimer: 'verifica 61439 del costruttore',
    })
    const dxf = dxfEnd(b)
    expect(dxf).not.toContain('SOLID') // niente più blocco tool pieno (allineato a sinistra come il PDF)
    expect(dxf).toContain('E.HUB')
    expect(dxf).toContain('u Prezzi') // toolTag ricercabile (μ → u)
    expect(dxf).toContain('QUADRO 1')
    expect(dxf).toContain('357x500x108 mm')
    expect(dxf).toContain('61439')
    expect(dxf).toContain('CIRCLE') // punto rosso del marchio ε
  })

  it('è deterministica', () => {
    const gen = () => {
      const b = makeBuilder()
      dxfCartiglioBanda(b, { x: 0, y: 0, w: 100, h: 24, title: 'T' })
      return dxfEnd(b)
    }
    expect(gen()).toBe(gen())
  })
})
