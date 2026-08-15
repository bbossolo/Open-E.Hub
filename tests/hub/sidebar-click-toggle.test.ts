import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hubSource } from './hub-src'

/**
 * Clic su una zona "morta" della sidebar la espande/collassa,
 * senza rubare i click a nav-item / pulsanti / input / pannello impostazioni.
 */

const SRC = resolve(__dirname, '../..')
const mainJs = hubSource()
const css = readFileSync(resolve(SRC, 'src/hub/styles/hub.css'), 'utf8')

describe('click-to-toggle della sidebar', () => {
  it('registra un listener di click su #sidebar che chiama toggleSidebar', () => {
    expect(mainJs).toMatch(/getElementById\('sidebar'\)[\s\S]{0,120}addEventListener\('click'/)
    expect(mainJs).toMatch(/addEventListener\('click'[\s\S]{0,260}toggleSidebar\(\)/)
  })

  it('esclude gli elementi interattivi (nav-item, button, input, settings)', () => {
    // il guard usa closest(...) per NON toggle-are quando si clicca un interattivo
    expect(mainJs).toMatch(/closest\([^)]*button[^)]*\)/)
    expect(mainJs).toMatch(/closest\([^)]*\.nav-item/)
    expect(mainJs).toMatch(/closest\([^)]*#settingsPanel/)
  })

  it('la CSS dà l\'affordance del cursore a mano sulle zone morte', () => {
    expect(css).toMatch(/#sidebar\{[^}]*cursor:pointer/)
    expect(css).toMatch(/#sidebar #search\{cursor:text/)
  })
})
