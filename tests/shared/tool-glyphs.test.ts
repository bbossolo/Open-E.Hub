import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TOOL_GLYPH_PATHS, TOOL_GLYPH_VIEWBOX, TOOL_GLYPH_KEY,
  toolGlyphSvg, toolGlyphSvgById, nameWithGlyph,
} from '../../src/shared/ui/glyphs'
import { renderDocPage } from '../../src/shared/doc'
import { hubSource } from '../hub/hub-src'

/**
 * GOLDEN SET dei glifi tool (μ β δ χ α) VETTORIALI.
 * I glifi non sono più caratteri di font (fallback per-OS, μ «di un altro font»)
 * ma path SVG estratti da JetBrains Mono ExtraBold: coerenti ovunque, μ incluso.
 */

const SRC = resolve(__dirname, '../..')

describe('path dei 5 glifi tool', () => {
  it('espone i 5 tool con path non vuoti e viewBox condiviso', () => {
    for (const k of ['mu', 'alfa', 'beta', 'delta', 'chi'] as const) {
      expect(TOOL_GLYPH_PATHS[k]).toMatch(/^M[\d.]/)
      expect(TOOL_GLYPH_PATHS[k].length).toBeGreaterThan(30)
    }
    // gabbia em condivisa → glifi mutuamente coerenti
    expect(TOOL_GLYPH_VIEWBOX).toBe('0 -800 600 1000')
  })

  it('mappa i tool-id della suite (miu→mu…) alla chiave giusta', () => {
    expect(TOOL_GLYPH_KEY.miu).toBe('mu')
    expect(TOOL_GLYPH_KEY.delta).toBe('delta')
    expect(TOOL_GLYPH_KEY.chi).toBe('chi')
    expect(TOOL_GLYPH_KEY.beta).toBe('beta')
    expect(TOOL_GLYPH_KEY.alfa).toBe('alfa')
  })
})

describe('helper SVG', () => {
  it('toolGlyphSvg produce un <svg> con path a currentColor', () => {
    const svg = toolGlyphSvg('mu')
    expect(svg).toContain('<svg')
    expect(svg).toContain('ehb-glyph-svg')
    expect(svg).toContain(`viewBox="${TOOL_GLYPH_VIEWBOX}"`)
    expect(svg).toContain('fill="currentColor"')
    expect(svg).toContain(TOOL_GLYPH_PATHS.mu)
  })

  it('toolGlyphSvgById risolve i tool noti e restituisce \'\' per gli ignoti', () => {
    expect(toolGlyphSvgById('miu')).toContain(TOOL_GLYPH_PATHS.mu)
    expect(toolGlyphSvgById('hub')).toBe('')
    expect(toolGlyphSvgById('boh')).toBe('')
  })
})

describe('l\'hub monta i glifi vettoriali (non più caratteri)', () => {
  const mainJs = hubSource()
  const componentsCss = readFileSync(resolve(SRC, 'src/shared/ui/components.css'), 'utf8')

  it('logoHTML usa toolGlyphSvgById', () => {
    expect(mainJs).toMatch(/toolGlyphSvgById\(m\.tool\)/)
  })
  it('la CSS dimensiona il glifo SVG su --logo-size', () => {
    expect(componentsCss).toMatch(/\.ehb-logo__glyph svg\s*\{[\s\S]*var\(--logo-size\)/)
  })
})

describe('gli header dei tool usano lo STESSO path (guardia non-divergenza)', () => {
  const cases: [string, keyof typeof TOOL_GLYPH_PATHS][] = [
    ['miu', 'mu'], ['beta', 'beta'],
    ['delta', 'delta'], ['chi', 'chi'], ['alfa', 'alfa'],
  ]
  it.each(cases)('src/tools/%s/index.html: logo E nome col path canonico, niente greco nudo', (tool, key) => {
    const html = readFileSync(resolve(SRC, `src/tools/${tool}/index.html`), 'utf8')
    // presente sia nel logo che nel nome → almeno 2 occorrenze del path
    const occ = html.split(TOOL_GLYPH_PATHS[key]).length - 1
    expect(occ).toBeGreaterThanOrEqual(2)
    // il glifo non è più il carattere greco nudo, né nel logo né nel nome brand
    expect(html).not.toMatch(/ehb-logo__glyph">[φπμλτ]</)
    expect(html).not.toMatch(/ehb-hdr__brand-name">[φπμλτ] /)
  })
})

describe('helper nome + coerenza nei DOCUMENTI (PDF)', () => {
  it('nameWithGlyph vettorializza la lettera greca iniziale', () => {
    const out = nameWithGlyph('μ Prezzi')
    expect(out).toContain('ehb-name-glyph')
    expect(out).toContain(TOOL_GLYPH_PATHS.mu)
    expect(out).toContain(' Prezzi')
    expect(out).not.toMatch(/^μ/)
  })

  it('il documento (renderDocPage) usa il cartiglio GOLDEN STANDARD: brand Open E.Hub + tag testo, niente chip/glifo', () => {
    const page = renderDocPage({
      tool: 'miu', kicker: 'k', title: 't',
      bodyHTML: '<p>x</p>',
      footer: { fields: [], disc: 'd' },
    })
    expect(page).toContain('ehub-brand')                    // brand Open E.Hub, header e footer (come piCartiglioHTML)
    expect(page).toContain('>Prezzi<')                        // nome tool in chiaro, niente carattere greco nudo
    expect(page).not.toMatch(/class="glyph">μ</)
    expect(page).not.toContain('dochead__tool"><span class="glyph"')  // niente più chip/glifo su sfondo pieno
  })
})
