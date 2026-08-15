import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Contratto di COERENZA UI — la barriera che si autoimpone.
 *
 * Obiettivo (rilievo utente): «voglio che ogni aggiunta segua lo stile, senza
 * continui ritocchi post-implementazione». I pulsanti della suite hanno UNA sola
 * casa — il design system condiviso src/shared/ui/ (.ehb-btn* / .ehb-icon-btn in
 * components.css, token in tokens.css). Questo test FALLISCE se un tool
 * reintroduce le vecchie primitive locali (.p-btn/.p-icon-btn/.btn) nel markup o
 * nei propri CSS, o se hardcoda un'identità cross-tool invece del token.
 *
 * Gemello di lint:css (stylelint): stylelint presidia i CSS, questo copre anche
 * il MARKUP e gira nel gate primario (vitest) della CI.
 */

const ROOT = resolve(__dirname, '../..')
const toolsDir = resolve(ROOT, 'src/tools')

// Tool = ogni sottocartella di src/tools con un index.html.
const TOOLS = readdirSync(toolsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(resolve(toolsDir, d.name, 'index.html')))
  .map((d) => d.name)

function toolHtml(tool: string): string {
  return readFileSync(resolve(toolsDir, tool, 'index.html'), 'utf8')
}
function toolCss(tool: string): string {
  const dir = resolve(toolsDir, tool, 'styles')
  if (!existsSync(dir)) return ''
  return readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(resolve(dir, f), 'utf8'))
    .join('\n')
}

// Token base VIETATI nel markup (esatti, non i modificatori come btn--pi).
const FORBIDDEN_MARKUP_TOKENS = ['p-btn', 'p-icon-btn', 'btn', 'p-tab', 'p-tabs']
// Selettori/riferimenti VIETATI nei CSS di tool (mirror di stylelint).
const FORBIDDEN_CSS = [/\.p-btn/, /\.p-icon-btn/, /\.btn(?![-\w])/, /\.p-tabs?\b/]
// Identità cross-tool: devono venire dai token --phi/--miu/--pi.
const IDENTITY_HEX = /#(19b6d8|48cfeb|22d3ee|1ca371|2fc78d|2d6ae0|5a8cee|b23a5c|d2607f)\b/i

/** Estrae i token di classe da ogni attributo class="..." dell'HTML. */
function classAttrs(html: string): string[] {
  return [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1])
}

describe('coerenza UI — i pulsanti vivono SOLO nel design system condiviso', () => {
  it('la suite ha tool da controllare', () => {
    expect(TOOLS.length).toBeGreaterThan(0)
  })

  it('components.css definisce le primitive canoniche (.ehb-btn* / .ehb-icon-btn)', () => {
    const c = readFileSync(resolve(ROOT, 'src/shared/ui/components.css'), 'utf8')
    for (const cls of ['.ehb-btn {', '.ehb-btn--sm', '.ehb-btn--ghost', '.ehb-btn--accent-soft', '.ehb-btn--danger', '.ehb-icon-btn {', '.ehb-btn__count', '.ehb-tab {', '.ehb-tabs {', '.ehb-flash {', '.ehb-view-enter {', '.ehb-skeleton {', '.ehb-toast--undo {', '.ehb-toast__undo {']) {
      expect(c, cls).toContain(cls)
    }
  })

  describe.each(TOOLS)('%s', (tool) => {
    it('nel markup nessun pulsante usa le primitive locali (.p-btn/.p-icon-btn/.btn)', () => {
      const offending: string[] = []
      for (const attr of classAttrs(toolHtml(tool))) {
        const tokens = attr.split(/\s+/)
        for (const bad of FORBIDDEN_MARKUP_TOKENS) {
          if (tokens.includes(bad)) offending.push(attr)
        }
      }
      expect(offending, `class con primitive locali in ${tool}/index.html`).toEqual([])
    })

    it('nei CSS del tool nessuna definizione/uso di primitive locali (usa .ehb-btn*)', () => {
      const css = toolCss(tool)
      for (const re of FORBIDDEN_CSS) {
        expect(re.test(css), `${re} trovato in ${tool}/styles`).toBe(false)
      }
    })

    it('nei CSS del tool nessun hex di identità cross-tool (usa var(--phi/--miu/--pi))', () => {
      const css = toolCss(tool)
      const m = css.match(IDENTITY_HEX)
      expect(m, `identità hardcoded in ${tool}/styles: ${m?.[0]}`).toBeNull()
    })

    it('nel markup nessun pulsante con colore hex inline (style="...#...")', () => {
      const html = toolHtml(tool)
      const badButtons = [...html.matchAll(/<button[^>]*style="([^"]*)"[^>]*>/g)]
        .filter((m) => /#[0-9a-fA-F]{3,8}\b/.test(m[1]))
        .map((m) => m[0].slice(0, 80))
      expect(badButtons, `<button> con hex inline in ${tool}/index.html`).toEqual([])
    })
  })
})
