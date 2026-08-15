import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EHUB_MARK_PATH, EHUB_MARK_VIEWBOX, EHUB_MARK_DOT, ehubMarkSvg,
} from '../../src/shared/ui/brand-mark'

/**
 * MARCHIO ε GOLDEN, unica fonte + guardia di non-divergenza.
 * L'ε è un LOGO (tracciato dall'immagine dell'utente), non un font:
 * qui vive il path canonico; hub e output devono usare ESATTAMENTE questo.
 */

const SRC = resolve(__dirname, '../..')

describe('marchio ε golden', () => {
  it('espone path + viewBox + punto rosso identitario', () => {
    expect(EHUB_MARK_PATH).toMatch(/^M348\.3 707\.5/)
    expect(EHUB_MARK_PATH).toMatch(/Z$/)
    expect(EHUB_MARK_VIEWBOX).toBe('-18 -18 986.5 744')
    expect(EHUB_MARK_DOT).toEqual({ cx: 841.5, cy: 576.6, r: 109, fill: '#e5484d' })
  })

  it('ehubMarkSvg produce path a currentColor + cerchio rosso', () => {
    const svg = ehubMarkSvg()
    expect(svg).toContain('ehb-mark-svg')
    expect(svg).toContain('fill="currentColor"')
    expect(svg).toContain('fill="#e5484d"')
    expect(svg).toContain(EHUB_MARK_PATH)
  })
})

describe('guardia: hub e output usano lo STESSO ε', () => {
  it('src/hub/index.html contiene il path canonico (non divergono)', () => {
    const html = readFileSync(resolve(SRC, 'src/hub/index.html'), 'utf8')
    expect(html).toContain(EHUB_MARK_PATH)
  })

  it('il brand dei documenti (output) monta il marchio golden, non il carattere ε', () => {
    const brand = readFileSync(resolve(SRC, 'src/shared/doc/brand.ts'), 'utf8')
    expect(brand).toContain('ehubMarkSvg')
    // niente più <span class="e">ε</span> serif nell'output
    expect(brand).not.toContain('class="e"')
  })
})
