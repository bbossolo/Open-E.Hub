import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Pattern condiviso "CAD stage": toolbar fissa + canvas pannabile/zoomabile,
 * senza che i due condividano lo scroll dell'area principale (#app/#main…).
 * Bug scoperto e corretto la prima volta su un canvas CAD: la toolbar aveva
 * troppi bottoni, l'area principale diventava scrollabile e la toolbar si
 * muoveva insieme al canvas invece di restarne fuori. Le classi vivono in
 * src/shared/ui/components.css così ogni tool con un canvas CAD può
 * riusarle invece di reinventare lo stesso fix.
 */

const components = readFileSync(resolve(__dirname, '../../src/shared/ui/components.css'), 'utf8')

describe('shared/ui — pattern .ehb-cad-stage/.ehb-cad-toolbar/.ehb-cad-canvas', () => {
  it('le 3 classi sono definite in components.css', () => {
    expect(components).toContain('.ehb-cad-stage {')
    expect(components).toContain('.ehb-cad-toolbar {')
    expect(components).toContain('.ehb-cad-canvas {')
  })

  it('.ehb-cad-stage contiene il proprio contenuto (overflow:hidden) — niente scroll di ricaduta', () => {
    const rule = components.match(/\.ehb-cad-stage\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('overflow: hidden')
  })

  it('.ehb-cad-toolbar va a capo invece di tagliare i bottoni fuori dalla UI', () => {
    const rule = components.match(/\.ehb-cad-toolbar\s*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('flex-wrap: wrap')
    expect(rule).toContain('flex: 0 0 auto')
  })
})

/* γ (e ω, già fuso in γ) non fanno più parte di Open E.Hub: il contratto CAD
   condiviso resta verificato dai due test sopra (le classi vivono in
   src/shared/ui/components.css, cross-tool per costruzione). */
