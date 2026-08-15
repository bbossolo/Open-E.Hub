import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * GLIFI GLYPH-ONLY DRITTI + ICONA APP ε (Monospace)
 * (docs/mockups/suite-redesign/ — README §4 "Glifi & brand", icon-b.svg)
 *
 * Spec di puro restyle CSS + asset: la verifica è invariante di stile +
 * non-regressione + ispezione asset, non un nuovo flusso utente. Parsiamo i
 * CSS dei componenti e dell'hub e l'icona app, asserendo il passaggio da
 * "piastrella a gradiente" a "sola lettera colorata mono dritta".
 */

const SRC = resolve(__dirname, '../..')
const components = readFileSync(resolve(SRC, 'src/shared/ui/components.css'), 'utf8')
const hub = readFileSync(resolve(SRC, 'src/hub/styles/hub.css'), 'utf8')
const iconSvg = readFileSync(resolve(SRC, 'assets/icon.svg'), 'utf8')

/**
 * Estrae il blocco { … } della regola la cui lista di selettori termina con
 * `selector` ma NON è un override [data-theme]. Evita di catturare per errore
 * le regole light dove lo stesso selettore compare in coda.
 */
function block(css: string, selector: string): string {
  let from = 0
  while (from < css.length) {
    const idx = css.indexOf(selector, from)
    if (idx === -1) return ''
    const open = css.indexOf('{', idx)
    // testa della regola = dall'ultimo '}' prima del selettore fino a '{'
    const prevClose = css.lastIndexOf('}', idx)
    const head = css.slice(prevClose + 1, open)
    if (!head.includes('[data-theme')) {
      const close = css.indexOf('}', open)
      return css.slice(open + 1, close)
    }
    from = open + 1
  }
  return ''
}

describe('.ehb-logo glyph-only', () => {
  const logo = block(components, '.ehb-logo {')
  const glyph = block(components, '.ehb-logo__glyph {')

  it('non è più una piastrella: niente background/sfondo nel box-glifo', () => {
    expect(logo).not.toMatch(/background\s*:/)
    expect(logo).not.toMatch(/accent-soft/)
  })

  it('il glifo è mono e dritto (font-style normal, niente italic)', () => {
    expect(glyph).toMatch(/font-family\s*:\s*var\(--mono\)/)
    expect(glyph).toMatch(/font-style\s*:\s*normal/)
    expect(glyph).not.toMatch(/font-style\s*:\s*italic/)
  })

  it('il colore del glifo deriva da var(--accent)', () => {
    expect(glyph).toMatch(/color\s*:\s*var\(--accent\)/)
  })

  it('nessuna regola serif/Georgia sui glifi .ehb-logo*', () => {
    const logoRules = components
      .split('\n')
      .filter((l) => l.includes('.ehb-logo'))
      .join('\n')
    expect(logoRules).not.toMatch(/Georgia/i)
    expect(logoRules).not.toMatch(/serif/i)
  })
})

describe('icona app variante B (ε + punto rosso)', () => {
  it('porta il marchio ε come tracciato VETTORIALE (glifo tracciato, non più testo)', () => {
    // Il marchio ε dell'icona app è ora VETTORIALE (path tracciato), non un glifo di
    // testo dipendente dal font. L'SVG quindi NON contiene più il carattere ε/&#949; ma il
    // segno come <path>. (Regressione CI: il vecchio test cercava il carattere ε letterale.)
    expect(iconSvg).toMatch(/<path\b/)
    expect(iconSvg).not.toMatch(/<text\b/)
    expect(iconSvg).toMatch(/aria-label="Open E\.Hub app icon"/)
  })

  it('contiene il punto identitario rosso #e5484d e lo stroke bianco con paint-order', () => {
    expect(iconSvg).toMatch(/#e5484d/i)
    expect(iconSvg).not.toMatch(/#19b6d8/i) // non più ciano
    expect(iconSvg).toMatch(/paint-order\s*=\s*"stroke"/)
    expect(iconSvg).toMatch(/stroke\s*=\s*"#ffffff"/i)
  })

  it('non contiene più il gradiente rosso/#dc2626 né la piastrella', () => {
    expect(iconSvg).not.toMatch(/#dc2626/i)
    expect(iconSvg).not.toMatch(/linearGradient/i)
    expect(iconSvg).not.toMatch(/<rect/i)
  })

  it('assets/icon.png è stato rigenerato (esiste e non è vuoto)', () => {
    const st = statSync(resolve(SRC, 'assets/icon.png'))
    expect(st.size).toBeGreaterThan(0)
  })
})

describe('marchio Open E.Hub mono + override light', () => {
  const brandMark = block(hub, '#brand-mark{')
  const wlcMark = block(hub, '.wlc-mark{')

  it('#brand-mark / .wlc-mark non sono più piastrelle serif', () => {
    expect(brandMark).not.toMatch(/Georgia/i)
    expect(brandMark).not.toMatch(/accent-soft/)
    expect(wlcMark).not.toMatch(/Georgia/i)
    expect(wlcMark).not.toMatch(/accent-soft/)
  })

  it('sidebar in colore-del-tool (var(--accent)); welcome in primo piano (var(--text), come l\'icona)', () => {
    expect(brandMark).toMatch(/color\s*:\s*var\(--accent\)/) // #brand-mark segue il tool
    expect(wlcMark).toMatch(/color\s*:\s*var\(--text\)/)      // .wlc-mark = foreground, come l'icona
    expect(brandMark).toMatch(/font-family\s*:\s*var\(--mono\)/)
  })

  it('esiste un override [data-theme="light"] che forza il marchio a nero', () => {
    expect(hub).toMatch(/\[data-theme="light"\][^{]*#brand-mark/)
    // la regola light del brand deve impostare il colore nero
    const lightIdx = hub.indexOf('[data-theme="light"] #brand-mark')
    expect(lightIdx).toBeGreaterThan(-1)
    const open = hub.indexOf('{', lightIdx)
    const close = hub.indexOf('}', open)
    const lightBlock = hub.slice(open + 1, close)
    expect(lightBlock).toMatch(/color\s*:\s*#000/)
  })
})
