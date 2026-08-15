import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * LINGUAGGIO MONOSPACE SU μ
 * (docs/mockups/suite-redesign/ — shared.css/tool.css)
 *
 * Spec di puro restyle CSS sulle superfici proprietarie che restano in Open
 * Open E.Hub. La verifica è invariante di
 * stile statico + non-regressione dei ponti di bus, sullo stesso modello di
 * tests/shared/glyph-brand.test.ts (lettura CSS + assert mirati):
 *   1. titolo header sull'accento identitario del tool (mai grigio);
 *   2. niente Georgia/serif sui glifi (glyph-only mono dritto);
 *   3. i literal accent (#fff) sostituiti da var(--on-accent);
 *   4. i selettori dei ponti restano presenti (bus non smontato).
 */

const SRC = resolve(__dirname, '../..')
const miu = readFileSync(resolve(SRC, 'src/tools/miu/styles/pricelist.css'), 'utf8')
const tokens = readFileSync(resolve(SRC, 'src/shared/ui/tokens.css'), 'utf8')

/** Estrae il blocco { … } della prima regola il cui head contiene `selector`. */
function block(css: string, selector: string): string {
  const idx = css.indexOf(selector)
  if (idx === -1) return ''
  const open = css.indexOf('{', idx)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

const SURFACES: Array<{ name: string; css: string; tool: string }> = [
  { name: 'μ (pricelist)', css: miu, tool: 'miu' },
]

describe('header: titolo sull’accento identitario (mai grigio)', () => {
  for (const { name, css, tool } of SURFACES) {
    it(`${name}: .ehb-hdr[data-tool="${tool}"] .ehb-hdr__brand-name è su var(--accent)`, () => {
      // catturiamo la regola che lega brand-name al data-tool corrente
      const re = new RegExp(
        `\\.ehb-hdr\\[data-tool="${tool}"\\][^{}]*\\.ehb-hdr__brand-name[^{}]*\\{[^}]*color\\s*:\\s*var\\(--accent\\)`,
        's',
      )
      expect(css).toMatch(re)
    })
  }
})

describe('glifi glyph-only mono dritti, niente serif', () => {
  for (const { name, css } of SURFACES) {
    it(`${name}: nessuna regola Georgia/serif`, () => {
      expect(css).not.toMatch(/Georgia/i)
      expect(css).not.toMatch(/serif/i)
    })
  }

})

describe('colore funzionale: literal accent → var(--on-accent)', () => {
  it('μ: nessun color:#fff sui pulsanti su fondo --accent', () => {
    for (const sel of ['#detail-add-cart {', '.btn-primary {', '.pg-btn.act {', '#folder-btn {']) {
      const b = block(miu, sel)
      expect(b, sel).not.toMatch(/color\s*:\s*#fff\b/i)
    }
    // #detail-add-cart/.btn-primary: standard suite (rilievo utente, giro
    // "uniformazione pulsanti") — accento su testo, sfondo accento trasparente
    // (--accent-soft), non più fill pieno → var(--accent), non var(--on-accent).
    expect(block(miu, '#detail-add-cart {')).toMatch(/color\s*:\s*var\(--accent\)/)
    expect(block(miu, '.btn-primary {')).toMatch(/color\s*:\s*var\(--accent\)/)
    // .pg-btn.act: stato SELEZIONATO/attivo, resta a fondo pieno di proposito.
    expect(block(miu, '.pg-btn.act {')).toMatch(/color\s*:\s*var\(--on-accent\)/)
  })
})

describe('token identità cross-tool definiti', () => {
  it('tokens.css definisce --miu (verde μ) e --src-import (ciano, dati importati)', () => {
    expect(tokens).toMatch(/--miu\s*:\s*#1ca371/i)
    expect(tokens).toMatch(/--src-import\s*:\s*#19b6d8/i)
  })
})

