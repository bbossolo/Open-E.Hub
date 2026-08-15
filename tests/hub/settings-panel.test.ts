// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { hubSource } from './hub-src'

/**
 * Pannello IMPOSTAZIONI in fondo alla sidebar hub: trigger + pannello
 * (Profilo + bottone "Aspetto grafica"). Le impostazioni GRAFICHE (palette, font,
 * dimensione testo, densità, ombre, animazioni) sono state spostate nel modale
 * separato #appearance-overlay ("Aspetto").
 */

const SRC = resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf8')
const html = read('src/hub/index.html')
const mainJs = hubSource()
const css = read('src/hub/styles/hub.css')
const doc = new JSDOM(html).window.document

describe('markup del pannello Impostazioni', () => {
  it('vive nel footer della sidebar con trigger + pannello', () => {
    const footer = doc.querySelector('#sidebar-footer')!
    const settings = footer.querySelector('#side-settings')
    expect(settings).not.toBeNull()
    expect(settings!.querySelector('#settingsTrigger')).not.toBeNull()
    const panel = settings!.querySelector('#settingsPanel')
    expect(panel).not.toBeNull()
    expect(panel!.hasAttribute('hidden')).toBe(true) // chiuso di default
    // il pannello ora apre il menu grafico separato (Aspetto)
    expect(panel!.querySelector('.side-set-appearance')?.getAttribute('onclick')).toMatch(/openAppearance\(\)/)
  })

  it('le 5 palette (nel modale Aspetto) chiamano setPalette', () => {
    const opts = doc.querySelectorAll('#appearance-overlay [data-palette-opt]')
    expect(opts.length).toBe(5)
    opts.forEach(b => expect(b.getAttribute('onclick')).toMatch(/setPalette\('/))
  })

  it('solo il NOME inline; la descrizione è in data-desc, popup via ::after', () => {
    const opts = doc.querySelectorAll('#appearance-overlay [data-palette-opt]')
    opts.forEach(b => {
      expect(b.querySelector('.set-sw__name')?.textContent?.trim()).toBeTruthy()
      expect(b.getAttribute('data-desc')?.trim()).toBeTruthy()   // descrizione in attributo
      expect(b.querySelector('.set-sw__desc')).toBeNull()        // nessun nodo di testo inline
      expect(b.hasAttribute('title')).toBe(false)                // niente title nativo
    })
    // il popup è un ::after guidato da data-desc, con ritardo su hover
    expect(css).toMatch(/\.set-sw\[data-desc\]::after\{[^}]*content:attr\(data-desc\)/)
    expect(css).toMatch(/\.set-sw\[data-desc\]:hover::after\{[^}]*transition-delay/)
  })

  it('contiene la densità comoda/compatta che chiama setDensity', () => {
    const seg = doc.querySelectorAll('#appearance-overlay [data-density-opt]')
    expect(seg.length).toBe(2)
    const modes = Array.from(seg).map(b => b.getAttribute('data-density-opt'))
    expect(modes).toEqual(['comfortable', 'compact'])
    seg.forEach(b => expect(b.getAttribute('onclick')).toMatch(/setDensity\('/))
  })
})

describe('logica densità + settings', () => {
  it('setDensity persiste su hub:density e applica data-density', () => {
    expect(mainJs).toMatch(/function setDensity/)
    expect(mainJs).toContain("localStorage.setItem('hub:density'")
    expect(mainJs).toMatch(/setAttribute\('data-density'/)
    expect(mainJs).toMatch(/applyDensity\(\)/)
  })
  it('toggleSettings/closeSettings + setDensity esposti su window', () => {
    expect(mainJs).toMatch(/toggleSettings, closeSettings, setDensity/)
  })
  it('la CSS definisce il pannello e la densità compatta', () => {
    expect(css).toContain('.side-set-panel{')
    expect(css).toMatch(/\[data-density="compact"\]/)
  })
})
